import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MockVerificationService } from './mock-verification.service';

interface VerifyBody {
  verificationId?: string;
  documentId?: string;
  documentType?: string;
  callbackUrl?: string;
}

@Controller('mock-verifier')
export class MockVerificationController {
  constructor(private readonly mockService: MockVerificationService) {}

  @Post('verify')
  async verify(@Body() body: VerifyBody, @Res() res: Response) {
    const { verificationId, documentId, documentType, callbackUrl } = body;

    if (!verificationId || !documentId || !documentType || !callbackUrl) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message:
          'verificationId, documentId, documentType, and callbackUrl are required',
      });
    }

    const result = await this.mockService.verifyDocument({
      verificationId,
      documentId,
      documentType,
      callbackUrl,
    });

    if (result.status === 'rate_limited') {
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        message:
          'Rate limit exceeded. External verification service accepts at most 100 calls per minute.',
      });
    }

    return res.status(HttpStatus.ACCEPTED).json({
      message: 'Verification request accepted and queued.',
    });
  }
}
