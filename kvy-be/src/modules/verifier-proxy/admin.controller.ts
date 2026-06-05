import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/verifications')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Get all inconclusive reviews pending manual action
  @Get('pending')
  async getPendingVerifications() {
    return this.prisma.verification.findMany({
      where: { status: 'UNDER_MANUAL_REVIEW' },
      include: {
        document: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 2. Get the full history/audit trail of a verification attempt
  @Get(':id/history')
  async getVerificationHistory(@Param('id') id: string) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      include: {
        document: true,
        events: {
          orderBy: { createdAt: 'desc' }, // Latest events first for the timeline
        },
      },
    });

    if (!verification) {
      throw new NotFoundException(`Verification with ID ${id} not found`);
    }

    return verification;
  }

  // 3. Make a final decision (Approve / Reject)
  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  async makeDecision(
    @Param('id') id: string,
    @Body() body: { action: 'verify' | 'reject'; reason?: string },
    @Req() req: any,
  ) {
    const { action, reason } = body;
    const adminId = req.user.id;

    if (!action || !['verify', 'reject'].includes(action)) {
      throw new BadRequestException(
        "Action must be either 'verify' or 'reject'",
      );
    }

    const verification = await this.prisma.verification.findUnique({
      where: { id },
    });

    if (!verification) {
      throw new NotFoundException(`Verification with ID ${id} not found`);
    }

    // Transition Guard: Only verifications under manual review can be decided by an admin
    if (verification.status !== 'UNDER_MANUAL_REVIEW') {
      throw new BadRequestException(
        `Cannot make decision on verification in state '${verification.status}'. Must be 'UNDER_MANUAL_REVIEW'.`,
      );
    }

    const newStatus = action === 'verify' ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update Verification status and reason
      const v = await tx.verification.update({
        where: { id },
        data: {
          status: newStatus,
          reason: reason || null,
        },
      });

      // Create VerificationEvent logging who performed the action, when, and what changed
      await tx.verificationEvent.create({
        data: {
          verificationId: id,
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'ADMIN_DECISION',
          fromStatus: 'UNDER_MANUAL_REVIEW',
          toStatus: newStatus,
          reason: reason || `Admin manual decision: ${action.toUpperCase()}`,
        },
      });

      return v;
    });

    return {
      message: `Verification successfully updated to ${newStatus}`,
      verification: updated,
    };
  }
}
