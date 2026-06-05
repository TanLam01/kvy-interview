import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class VerifierProxyService {
  private readonly logger = new Logger(VerifierProxyService.name);

  async submitToVerifier(
    verificationId: string,
    documentId: string,
    documentType: string,
  ): Promise<unknown> {
    const mockVerifierUrl =
      process.env.MOCK_VERIFIER_URL ||
      'http://localhost:3000/api/mock-verifier';
    const webhookUrl =
      process.env.WEBHOOK_URL || 'http://localhost:3000/api/verifier-webhook';

    this.logger.log(
      `Submitting verification ${verificationId} to external service...`,
    );

    try {
      const response = await fetch(`${mockVerifierUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verificationId,
          documentId,
          documentType,
          callbackUrl: webhookUrl,
        }),
      });

      if (response.status === 429) {
        this.logger.warn(
          `External service rate limit hit (429) for verification ${verificationId}`,
        );
        throw new Error('RATE_LIMIT_EXHAUSTED');
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `External service returned error ${response.status}: ${errorText}`,
        );
        throw new Error(`EXTERNAL_SERVICE_ERROR: ${response.status}`);
      }

      const data = (await response.json()) as unknown;
      this.logger.log(
        `Verification ${verificationId} accepted: ${JSON.stringify(data)}`,
      );
      return data;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to submit verification ${verificationId}: ${errMsg}`,
      );
      throw error;
    }
  }
}
