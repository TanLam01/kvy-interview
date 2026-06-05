import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectQueue('document-verification')
    private readonly verificationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async uploadAndQueue(data: {
    sellerId: string;
    fileName: string;
    documentType: string;
  }) {
    const { sellerId, fileName, documentType } = data;

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize submissions for a seller so concurrent uploads cannot create
      // duplicate paid verification attempts.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sellerId}))`;

      const existingVerification = await tx.verification.findFirst({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
      });

      if (existingVerification?.status === 'VERIFIED') {
        throw new BadRequestException(
          'You are already verified and cannot submit another document.',
        );
      }

      if (
        existingVerification &&
        ['QUEUED', 'PROCESSING', 'UNDER_MANUAL_REVIEW'].includes(
          existingVerification.status,
        )
      ) {
        throw new BadRequestException(
          `A verification attempt is already in progress (Status: ${existingVerification.status}).`,
        );
      }

      // 1. Create Document
      const document = await tx.document.create({
        data: {
          sellerId,
          fileName,
          documentType,
        },
      });

      // 2. Create Verification record
      const verification = await tx.verification.create({
        data: {
          documentId: document.id,
          sellerId,
          status: 'QUEUED',
          attemptCount: 0,
        },
      });

      // 3. Create VerificationEvent
      await tx.verificationEvent.create({
        data: {
          verificationId: verification.id,
          actorType: 'SELLER',
          actorId: sellerId,
          action: 'UPLOAD',
          fromStatus: null,
          toStatus: 'QUEUED',
          reason: `Document '${fileName}' uploaded successfully.`,
        },
      });

      return {
        document,
        verification,
      };
    });

    // Publish only after the database transaction commits. The stable job ID
    // makes repeated enqueue attempts idempotent.
    try {
      await this.verificationQueue.add(
        'verify-document',
        {
          verificationId: result.verification.id,
          documentId: result.document.id,
          documentType,
        },
        {
          jobId: result.verification.id,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch {
      await this.prisma.verification.update({
        where: { id: result.verification.id },
        data: {
          status: 'NEEDS_ATTENTION',
          reason: 'Failed to enqueue verification request.',
        },
      });
      throw new BadRequestException(
        'Document was saved, but verification could not be queued. Please contact support.',
      );
    }

    this.logger.log(
      `Queued document verification for seller: ${sellerId}, document ID: ${result.document.id}`,
    );

    return result;
  }

  async getVerificationStatus(sellerId: string) {
    const verification = await this.prisma.verification.findFirst({
      where: { sellerId },
      include: {
        document: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return {
        status: 'UNSUBMITTED',
        message: 'No document has been uploaded yet.',
      };
    }

    return verification;
  }
}
