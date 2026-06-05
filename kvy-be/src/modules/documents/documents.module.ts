import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { VerificationProcessor } from './verification.processor';
import { VerifierProxyModule } from '../verifier-proxy/verifier-proxy.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-verification',
    }),
    VerifierProxyModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, VerificationProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
