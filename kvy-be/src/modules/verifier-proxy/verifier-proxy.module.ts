import { Module } from '@nestjs/common';
import { VerifierProxyService } from './verifier-proxy.service';
import { WebhookController } from './webhook.controller';
import { AdminController } from './admin.controller';

@Module({
  controllers: [WebhookController, AdminController],
  providers: [VerifierProxyService],
  exports: [VerifierProxyService],
})
export class VerifierProxyModule {}
