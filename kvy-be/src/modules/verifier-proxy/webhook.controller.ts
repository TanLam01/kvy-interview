import {
  Controller,
  Post,
  Body,
  NotFoundException,
  ConflictException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookDto } from './dto/webhook.dto';

@Controller('verifier-webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: WebhookDto) {
    const { verificationId, documentId, status, reason } = body;

    this.logger.log(
      `Received webhook callback for verification ${verificationId}: status=${status}`,
    );

    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      this.logger.error(
        `Webhook error: Verification ${verificationId} not found`,
      );
      throw new NotFoundException(
        `Verification with ID ${verificationId} not found`,
      );
    }

    if (verification.documentId !== documentId) {
      throw new NotFoundException(
        `Document ${documentId} does not belong to verification ${verificationId}`,
      );
    }

    if (verification.status !== 'PROCESSING') {
      this.logger.warn(
        `Ignored result for verification ${verificationId} because it is in state '${verification.status}'`,
      );
      return {
        status: 'ignored',
        message: `Verification is not awaiting an automated result. Current state: '${verification.status}'.`,
      };
    }

    // Map verifier status to database status
    let dbStatus: string;
    if (status === 'verified') {
      dbStatus = 'VERIFIED';
    } else if (status === 'rejected') {
      dbStatus = 'REJECTED';
    } else {
      dbStatus = 'UNDER_MANUAL_REVIEW'; // Inconclusive goes to manual review
    }

    const processed = await this.prisma.$transaction(async (tx) => {
      const update = await tx.verification.updateMany({
        where: {
          id: verificationId,
          documentId,
          status: 'PROCESSING',
        },
        data: {
          status: dbStatus,
          automatedResult: status.toUpperCase(),
          reason: reason || null,
        },
      });

      if (update.count !== 1) {
        return false;
      }

      await tx.verificationEvent.create({
        data: {
          verificationId,
          actorType: 'SYSTEM',
          action: 'RECEIVE_RESULT',
          fromStatus: 'PROCESSING',
          toStatus: dbStatus,
          reason:
            reason ||
            `Automated verification completed with outcome: ${status}`,
        },
      });

      return true;
    });

    if (!processed) {
      throw new ConflictException(
        'Verification state changed while processing the webhook.',
      );
    }

    this.logger.log(
      `Updated verification ${verificationId} state to ${dbStatus}`,
    );

    return {
      status: 'processed',
      newStatus: dbStatus,
    };
  }
}
