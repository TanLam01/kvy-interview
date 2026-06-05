import { VerificationReconciliationService } from './verification-reconciliation.service';

describe('VerificationReconciliationService', () => {
  it('moves stale processing verifications to needs attention with an audit event', async () => {
    const mockQueue = {
      getJob: jest.fn(),
      add: jest.fn(),
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createEvent = jest.fn();
    const mockTx = {
      verification: {
        updateMany,
      },
      verificationEvent: {
        create: createEvent,
      },
    };
    const mockPrisma = {
      verification: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'verification-1' }]),
      },
      $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) =>
        callback(mockTx),
      ),
    };

    const service = new VerificationReconciliationService(
      mockQueue as never,
      mockPrisma as never,
    );

    await service.reconcile();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'verification-1',
        status: 'PROCESSING',
        // Jest asymmetric matchers are intentionally typed as any.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        updatedAt: { lt: expect.any(Date) },
      },
      data: {
        status: 'NEEDS_ATTENTION',
        reason: 'Verification timed out while awaiting external result.',
      },
    });
    expect(createEvent).toHaveBeenCalledWith({
      data: {
        verificationId: 'verification-1',
        actorType: 'SYSTEM',
        action: 'RECONCILE_TIMEOUT',
        fromStatus: 'PROCESSING',
        toStatus: 'NEEDS_ATTENTION',
        reason: 'Verification timed out while awaiting external result.',
      },
    });
  });
});
