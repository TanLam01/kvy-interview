import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifierProxyService } from '../verifier-proxy/verifier-proxy.service';

@Processor('document-verification', {
  limiter: {
    max: 100,
    duration: 60000,
  },
  concurrency: 5, // Process up to 5 concurrent jobs
})
export class VerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(VerificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifierProxy: VerifierProxyService,
  ) {
    super();
  }

  async process(
    job: Job<
      {
        verificationId: string;
        documentId: string;
        documentType: string;
      },
      void,
      string
    >,
  ): Promise<void> {
    const { verificationId, documentId, documentType } = job.data;

    this.logger.log(
      `Processing verification job ${job.id} for document ${documentId}`,
    );

    const transitioned = await this.prisma.$transaction(async (tx) => {
      const update = await tx.verification.updateMany({
        where: {
          id: verificationId,
          status: 'QUEUED',
        },
        data: {
          status: 'PROCESSING',
          attemptCount: {
            increment: 1,
          },
        },
      });

      if (update.count !== 1) {
        return false;
      }

      await tx.verificationEvent.create({
        data: {
          verificationId,
          actorType: 'SYSTEM',
          action: 'SUBMIT',
          fromStatus: 'QUEUED',
          toStatus: 'PROCESSING',
          reason: `Document submitted to external verifier. Attempt count: ${job.attemptsMade + 1}`,
        },
      });

      return true;
    });

    if (!transitioned) {
      this.logger.log(
        `Verification ${verificationId} is missing or no longer queued. Skipping submission.`,
      );
      return;
    }

    try {
      // 2. Submit to external verification service via proxy
      await this.verifierProxy.submitToVerifier(
        verificationId,
        documentId,
        documentType,
      );

      this.logger.log(
        `Successfully submitted verification ${verificationId} to external verifier.`,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error submitting verification ${verificationId}: ${errMsg}`,
      );

      const exhausted = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      await this.prisma.$transaction(async (tx) => {
        const reverted = await tx.verification.updateMany({
          where: {
            id: verificationId,
            status: 'PROCESSING',
          },
          data: {
            status: exhausted ? 'NEEDS_ATTENTION' : 'QUEUED',
            reason: `Submission failed: ${errMsg}`,
          },
        });

        if (reverted.count !== 1) {
          return;
        }

        await tx.verificationEvent.create({
          data: {
            verificationId,
            actorType: 'SYSTEM',
            action: 'SUBMIT_FAIL',
            fromStatus: 'PROCESSING',
            toStatus: exhausted ? 'NEEDS_ATTENTION' : 'QUEUED',
            reason: exhausted
              ? `Failed to submit after maximum attempts: ${errMsg}`
              : `Failed to submit: ${errMsg}. Retrying via queue...`,
          },
        });
      });

      throw error; // Re-throw so BullMQ flags the job as failed and triggers retry
    }
  }
}
