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
      // 1. Sliding window rate limit check
      // Remove elements older than 1 minute
      await this.redis.zremrangebyscore(redisKey, 0, oneMinuteAgo);

      // Get current request count in the last minute
      const currentCount = await this.redis.zcard(redisKey);

      if (currentCount >= 100) {
        this.logger.warn(
          `Mock Verifier: Rate limit exceeded (current count: ${currentCount} in last minute)`,
        );
        return { status: 'rate_limited' };
      }

      // Add current request to the sorted set
      const uniqueId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
      await this.redis.zadd(redisKey, now, uniqueId);

      // Set TTL on the key so it cleans up if idle
      await this.redis.expire(redisKey, 120);

      // 2. Trigger asynchronous background verification
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
      // Fallback: If Redis is down, allow request but log warning to avoid complete blockage
      this.processAsyncVerification(payload);
      return { status: 'accepted' };
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

          // POST the webhook callback
          const response = await fetch(payload.callbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              verificationId: payload.verificationId,
              documentId: payload.documentId,
              status: result,
              reason,
            }),
          });

          if (!response.ok) {
            this.logger.error(
              `Mock Verifier: Webhook callback failed with status ${response.status} for verification ${payload.verificationId}`,
            );
          } else {
            this.logger.log(
              `Mock Verifier: Webhook callback successfully delivered for ${payload.verificationId}`,
            );
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Mock Verifier: Failed to send webhook callback: ${errMsg}`,
          );
        }
      })();
    }, delayMs);
  }
}
