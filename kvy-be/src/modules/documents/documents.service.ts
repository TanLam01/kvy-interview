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

    // Guard: check if there is already a terminal VERIFIED state
    // or active verification in progress (QUEUED, PROCESSING, UNDER_MANUAL_REVIEW)
    const existingVerification = await this.prisma.verification.findFirst({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingVerification) {
      if (existingVerification.status === 'VERIFIED') {
        throw new BadRequestException(
          'You are already verified and cannot submit another document.',
        );
      }
      if (
        existingVerification.status === 'QUEUED' ||
        existingVerification.status === 'PROCESSING' ||
        existingVerification.status === 'UNDER_MANUAL_REVIEW'
      ) {
        throw new BadRequestException(
          `A verification attempt is already in progress (Status: ${existingVerification.status}).`,
        );
      }
    }

    // Begin Transaction to save database records
    return this.prisma.$transaction(async (tx) => {
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
          attemptCount: 1,
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

      // 4. Add to BullMQ verification queue
      await this.verificationQueue.add(
        'verify-document',
        {
          verificationId: verification.id,
          documentId: document.id,
          documentType,
        },
        {
          jobId: verification.id, // Idempotency: ensures only one active job per verification ID
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `Queued document verification for seller: ${sellerId}, document ID: ${document.id}`,
      );

      return {
        document,
        verification,
      };
    });
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
