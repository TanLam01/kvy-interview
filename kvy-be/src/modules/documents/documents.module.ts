import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { VerificationProcessor } from './verification.processor';
import { VerifierProxyModule } from '../verifier-proxy/verifier-proxy.module';
import { VerificationReconciliationService } from './verification-reconciliation.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-verification',
    }),
    VerifierProxyModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    VerificationProcessor,
    VerificationReconciliationService,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
