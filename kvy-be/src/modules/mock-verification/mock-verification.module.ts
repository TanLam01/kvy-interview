import { Module } from '@nestjs/common';
import { MockVerificationController } from './mock-verification.controller';
import { MockVerificationService } from './mock-verification.service';

@Module({
  controllers: [MockVerificationController],
  providers: [MockVerificationService],
  exports: [MockVerificationService],
})
export class MockVerificationModule {}
