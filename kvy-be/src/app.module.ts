import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuthModule } from './modules/auth/auth.module';
import { VerifierProxyModule } from './modules/verifier-proxy/verifier-proxy.module';
import { MockVerificationModule } from './modules/mock-verification/mock-verification.module';
import { PrismaModule } from './prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    DocumentsModule,
    AuthModule,
    VerifierProxyModule,
    MockVerificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
