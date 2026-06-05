import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VerificationReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VerificationReconciliationService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectQueue('document-verification')
    private readonly verificationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.RECONCILIATION_INTERVAL_MS || 60000);
    this.timer = setInterval(
      () =>
        void this.reconcile().catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Reconciliation failed: ${message}`);
        }),
      intervalMs,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async reconcile(): Promise<void> {
    const staleMs = Number(process.env.RECONCILIATION_STALE_MS || 300000);
    const staleBefore = new Date(Date.now() - staleMs);

    await this.requeueMissingJobs(staleBefore);
    await this.flagStaleProcessing(staleBefore);
  }

  private async requeueMissingJobs(staleBefore: Date): Promise<void> {
    const queued = await this.prisma.verification.findMany({
      where: {
        status: 'QUEUED',
        updatedAt: { lt: staleBefore },
      },
      include: { document: true },
      take: 100,
    });

    for (const verification of queued) {
      const existingJob = await this.verificationQueue.getJob(verification.id);
      const state = existingJob ? await existingJob.getState() : null;

      if (
        state &&
        ['active', 'waiting', 'delayed', 'prioritized'].includes(state)
      ) {
        continue;
      }

      if (existingJob) {
        await existingJob.remove();
      }

      await this.verificationQueue.add(
        'verify-document',
        {
          verificationId: verification.id,
          documentId: verification.documentId,
          documentType: verification.document.documentType,
        },
        {
          jobId: verification.id,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      await this.prisma.verificationEvent.create({
        data: {
          verificationId: verification.id,
          actorType: 'SYSTEM',
          action: 'RECONCILE_REQUEUE',
          fromStatus: 'QUEUED',
          toStatus: 'QUEUED',
          reason: 'Re-enqueued stale verification with no active queue job.',
        },
      });
    }
  }

  private async flagStaleProcessing(staleBefore: Date): Promise<void> {
    const processing = await this.prisma.verification.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: staleBefore },
      },
      select: { id: true },
      take: 100,
    });

    for (const verification of processing) {
      await this.prisma.$transaction(async (tx) => {
        const update = await tx.verification.updateMany({
          where: {
            id: verification.id,
            status: 'PROCESSING',
            updatedAt: { lt: staleBefore },
          },
          data: {
            status: 'NEEDS_ATTENTION',
            reason: 'Verification timed out while awaiting external result.',
          },
        });

        if (update.count !== 1) {
          return;
        }

        await tx.verificationEvent.create({
          data: {
            verificationId: verification.id,
            actorType: 'SYSTEM',
            action: 'RECONCILE_TIMEOUT',
            fromStatus: 'PROCESSING',
            toStatus: 'NEEDS_ATTENTION',
            reason: 'Verification timed out while awaiting external result.',
          },
        });
      });
    }

    if (processing.length > 0) {
      this.logger.warn(
        `Moved ${processing.length} stale PROCESSING verification(s) to NEEDS_ATTENTION.`,
      );
    }
  }
}
