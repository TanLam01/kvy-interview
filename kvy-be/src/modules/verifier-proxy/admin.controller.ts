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
  ConflictException,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AdminDecisionDto } from './dto/admin-decision.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/verifications')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAllVerifications() {
    return this.prisma.verification.findMany({
      include: {
        document: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

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

  @Get(':id/document')
  async downloadDocument(@Param('id') id: string, @Res() response: Response) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      include: { document: true },
    });

    if (!verification) {
      throw new NotFoundException(`Verification with ID ${id} not found`);
    }

    const uploadRoot = path.resolve('./uploads');
    const filePath = path.resolve(uploadRoot, verification.document.fileName);

    if (
      !filePath.startsWith(`${uploadRoot}${path.sep}`) ||
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException('Document file not found');
    }

    return response.sendFile(filePath);
  }

  // 3. Make a final decision (Approve / Reject)
  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  async makeDecision(
    @Param('id') id: string,
    @Body() body: AdminDecisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { action, reason } = body;
    const adminId = req.user.id;

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
      const result = await tx.verification.updateMany({
        where: {
          id,
          status: 'UNDER_MANUAL_REVIEW',
        },
        data: {
          status: newStatus,
          reason: reason || null,
        },
      });

      if (result.count !== 1) {
        return null;
      }

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

      await tx.verificationEvent.create({
        data: {
          verificationId: id,
          actorType: 'SYSTEM',
          action: 'SELLER_NOTIFICATION',
          fromStatus: newStatus,
          toStatus: newStatus,
          reason: reason || `Seller notified of final outcome: ${newStatus}`,
        },
      });

      return tx.verification.findUniqueOrThrow({ where: { id } });
    });

    if (!updated) {
      throw new ConflictException(
        'Verification state changed while applying the admin decision.',
      );
    }

    return {
      message: `Verification successfully updated to ${newStatus}`,
      verification: updated,
    };
  }
}
