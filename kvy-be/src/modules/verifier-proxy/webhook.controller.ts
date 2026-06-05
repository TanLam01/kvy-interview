import {
  Controller,
  Post,
  Body,
  NotFoundException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('verifier-webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body()
    body: {
      verificationId: string;
      documentId: string;
      status: 'verified' | 'rejected' | 'inconclusive';
      reason?: string;
    },
  ) {
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

    // CRITICAL GUARD: Prevent late automated results from overwriting terminal manual decisions
    const terminalStates = ['VERIFIED', 'REJECTED'];
    if (terminalStates.includes(verification.status)) {
      this.logger.warn(
        `Webhook warning: Ignored late result for verification ${verificationId} because it is already in terminal state '${verification.status}'`,
      );
      return {
        status: 'ignored',
        message: `Verification is already in terminal state '${verification.status}'.`,
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

    await this.prisma.$transaction(async (tx) => {
      // 1. Update Verification status
      await tx.verification.update({
        where: { id: verificationId },
        data: {
          status: dbStatus,
          automatedResult: status.toUpperCase(),
          reason: reason || null,
        },
      });

      // 2. Log VerificationEvent
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
    });

    this.logger.log(
      `Updated verification ${verificationId} state to ${dbStatus}`,
    );

    return {
      status: 'processed',
      newStatus: dbStatus,
    };
  }
}
