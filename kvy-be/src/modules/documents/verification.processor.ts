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

  async process(job: Job<any, any, string>): Promise<any> {
    const { verificationId, documentId, documentType } = job.data as {
      verificationId: string;
      documentId: string;
      documentType: string;
    };

    this.logger.log(
      `Processing verification job ${job.id} for document ${documentId}`,
    );

    // Fetch the verification record
    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      this.logger.warn(
        `Verification record ${verificationId} not found. Skipping.`,
      );
      return;
    }

    // Guard: If it's already processed, skip (idempotency check)
    if (verification.status !== 'QUEUED') {
      this.logger.log(
        `Verification ${verificationId} is already in status '${verification.status}'. Skipping submission.`,
      );
      return;
    }

    // 1. Transition status from QUEUED to PROCESSING
    await this.prisma.$transaction(async (tx) => {
      await tx.verification.update({
        where: { id: verificationId },
        data: {
          status: 'PROCESSING',
          attemptCount: {
            increment: 1,
          },
        },
      });

      await tx.verificationEvent.create({
        data: {
          verificationId,
          actorType: 'SYSTEM',
          action: 'SUBMIT',
          fromStatus: 'QUEUED',
          toStatus: 'PROCESSING',
          reason: `Document submitted to external verifier. Attempt count: ${verification.attemptCount + 1}`,
        },
      });
    });

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

      // Update database and throw error to let BullMQ handle retry/backoff
      await this.prisma.$transaction(async (tx) => {
        await tx.verification.update({
          where: { id: verificationId },
          data: {
            status: 'QUEUED', // Revert to QUEUED so it can be retried
            reason: `Submission failed: ${errMsg}`,
          },
        });

        await tx.verificationEvent.create({
          data: {
            verificationId,
            actorType: 'SYSTEM',
            action: 'SUBMIT_FAIL',
            fromStatus: 'PROCESSING',
            toStatus: 'QUEUED',
            reason: `Failed to submit: ${errMsg}. Retrying via queue...`,
          },
        });
      });

      throw error; // Re-throw so BullMQ flags the job as failed and triggers retry
    }
  }
}
