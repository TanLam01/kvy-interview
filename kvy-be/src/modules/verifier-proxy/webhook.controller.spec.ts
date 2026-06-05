import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { signWebhookPayload } from './webhook-signature';

describe('WebhookController (Terminal State Guard Tests)', () => {
  let controller: WebhookController;

  const mockPrismaService = {
    verification: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    verificationEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mockPrismaService.$transaction.mockImplementation(
    (cb: (tx: any) => unknown) => cb(mockPrismaService),
  );

  const handleWebhook = (body: {
    verificationId: string;
    documentId: string;
    status: 'verified' | 'rejected' | 'inconclusive';
    reason?: string;
  }) => controller.handleWebhook(body, signWebhookPayload(body));

  beforeAll(() => {
    process.env.WEBHOOK_SECRET = 'test-webhook-secret';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw NotFoundException if verification is not found', async () => {
    mockPrismaService.verification.findUnique.mockResolvedValue(null);

    await expect(
      handleWebhook({
        verificationId: 'non-existent-id',
        documentId: 'doc-id',
        status: 'verified',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrismaService.verification.findUnique).toHaveBeenCalledWith({
      where: { id: 'non-existent-id' },
    });
  });

  it('should ignore webhook callback and return status ignored if verification is in VERIFIED state', async () => {
    const existingVerification = {
      id: 'v-123',
      documentId: 'doc-123',
      sellerId: 'seller-123',
      status: 'VERIFIED',
    };
    mockPrismaService.verification.findUnique.mockResolvedValue(
      existingVerification,
    );

    const result = await handleWebhook({
      verificationId: 'v-123',
      documentId: 'doc-123',
      status: 'rejected',
      reason: 'Late rejection attempt',
    });

    expect(result).toEqual({
      status: 'ignored',
      message:
        "Verification is not awaiting an automated result. Current state: 'VERIFIED'.",
    });
    // Check that we did NOT call transaction or database update methods
    expect(mockPrismaService.verification.updateMany).not.toHaveBeenCalled();
    expect(mockPrismaService.verificationEvent.create).not.toHaveBeenCalled();
  });

  it('should ignore webhook callback and return status ignored if verification is in REJECTED state', async () => {
    const existingVerification = {
      id: 'v-123',
      documentId: 'doc-123',
      sellerId: 'seller-123',
      status: 'REJECTED',
    };
    mockPrismaService.verification.findUnique.mockResolvedValue(
      existingVerification,
    );

    const result = await handleWebhook({
      verificationId: 'v-123',
      documentId: 'doc-123',
      status: 'verified',
      reason: 'Late verification attempt',
    });

    expect(result).toEqual({
      status: 'ignored',
      message:
        "Verification is not awaiting an automated result. Current state: 'REJECTED'.",
    });
    // Check that we did NOT call transaction or database update methods
    expect(mockPrismaService.verification.updateMany).not.toHaveBeenCalled();
    expect(mockPrismaService.verificationEvent.create).not.toHaveBeenCalled();
  });

  it('should process webhook and update verification state if status is PROCESSING', async () => {
    const existingVerification = {
      id: 'v-123',
      documentId: 'doc-123',
      sellerId: 'seller-123',
      status: 'PROCESSING',
    };
    mockPrismaService.verification.findUnique.mockResolvedValue(
      existingVerification,
    );
    mockPrismaService.verification.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleWebhook({
      verificationId: 'v-123',
      documentId: 'doc-123',
      status: 'verified',
      reason: 'Automated check passed',
    });

    expect(result).toEqual({
      status: 'processed',
      newStatus: 'VERIFIED',
    });

    // Check that transaction callback updated the DB and logged the event
    expect(mockPrismaService.verification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'v-123',
        documentId: 'doc-123',
        status: 'PROCESSING',
      },
      data: {
        status: 'VERIFIED',
        automatedResult: 'VERIFIED',
        reason: 'Automated check passed',
      },
    });

    expect(mockPrismaService.verificationEvent.create).toHaveBeenCalledWith({
      data: {
        verificationId: 'v-123',
        actorType: 'SYSTEM',
        action: 'RECEIVE_RESULT',
        fromStatus: 'PROCESSING',
        toStatus: 'VERIFIED',
        reason: 'Automated check passed',
      },
    });
  });

  it('should ignore automated results while under manual review', async () => {
    mockPrismaService.verification.findUnique.mockResolvedValue({
      id: 'v-123',
      documentId: 'doc-123',
      sellerId: 'seller-123',
      status: 'UNDER_MANUAL_REVIEW',
    });

    const result = await handleWebhook({
      verificationId: 'v-123',
      documentId: 'doc-123',
      status: 'verified',
    });

    expect(result.status).toBe('ignored');
    expect(mockPrismaService.verification.updateMany).not.toHaveBeenCalled();
  });

  it('should reject an invalid webhook signature', async () => {
    await expect(
      controller.handleWebhook(
        {
          verificationId: 'v-123',
          documentId: 'doc-123',
          status: 'verified',
        },
        'invalid',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
