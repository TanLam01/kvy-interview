import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class MockVerificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MockVerificationService.name);
  private redis!: Redis;

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
    this.logger.log('MockVerificationService initialized Redis client.');
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  async verifyDocument(payload: {
    verificationId: string;
    documentId: string;
    documentType: string;
    callbackUrl: string;
  }): Promise<{ status: 'accepted' } | { status: 'rate_limited' }> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const redisKey = 'mock-verifier:rate-limit-tracker';

    try {
      const uniqueId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      const accepted = await this.redis.eval(
        `
          redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
          local count = redis.call('ZCARD', KEYS[1])
          if count >= tonumber(ARGV[2]) then
            return 0
          end
          redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
          redis.call('EXPIRE', KEYS[1], 120)
          return 1
        `,
        1,
        redisKey,
        oneMinuteAgo,
        100,
        now,
        uniqueId,
      );

      if (accepted !== 1) {
        this.logger.warn(
          'Mock Verifier: Rate limit exceeded (100 requests in the last minute)',
        );
        return { status: 'rate_limited' };
      }

      this.logger.log(
        `Mock Verifier: Accepted verification request for ${payload.verificationId}`,
      );
      this.processAsyncVerification(payload);

      return { status: 'accepted' };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Mock Verifier error during rate limit evaluation: ${errMsg}`,
      );
      return { status: 'rate_limited' };
    }
  }

  private processAsyncVerification(payload: {
    verificationId: string;
    documentId: string;
    documentType: string;
    callbackUrl: string;
  }) {
    // Generate a variable delay between 5 and 15 seconds for testing purposes
    // (In production this would take minutes to hours)
    const delayMs = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;

    this.logger.log(
      `Mock Verifier: Scheduling verification callback for ${payload.verificationId} in ${delayMs / 1000}s`,
    );

    setTimeout(() => {
      void (async () => {
        try {
          const rand = Math.random();
          let result: 'verified' | 'rejected' | 'inconclusive';
          let reason: string | undefined;

          if (rand < 0.45) {
            result = 'verified';
          } else if (rand < 0.9) {
            result = 'rejected';
            reason =
              'Business registration number or tax ID could not be found in official directories.';
          } else {
            result = 'inconclusive';
            reason =
              'Document resolution is too low or contains illegible signatures. Manual review required.';
          }

          this.logger.log(
            `Mock Verifier: Dispatching result '${result}' for ${payload.verificationId} after delay.`,
          );

          await this.deliverWebhookWithRetry(payload.callbackUrl, {
            verificationId: payload.verificationId,
            documentId: payload.documentId,
            status: result,
            reason,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Mock Verifier: Failed to send webhook callback: ${errMsg}`,
          );
        }
      })();
    }, delayMs);
  }

  private async deliverWebhookWithRetry(
    callbackUrl: string,
    body: {
      verificationId: string;
      documentId: string;
      status: 'verified' | 'rejected' | 'inconclusive';
      reason?: string;
    },
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          this.logger.log(
            `Mock Verifier: Webhook callback delivered for ${body.verificationId}`,
          );
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);

        if (attempt === maxAttempts) {
          this.logger.error(
            `Mock Verifier: Webhook callback exhausted retries for ${body.verificationId}: ${errMsg}`,
          );
          return;
        }

        const delayMs = 1000 * 2 ** (attempt - 1);
        this.logger.warn(
          `Mock Verifier: Webhook callback attempt ${attempt} failed for ${body.verificationId}; retrying in ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
