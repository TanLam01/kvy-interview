export function formatDocType(type: string) {
  return type === 'business_license' ? 'Business License' : 'Tax Registration';
}

export function getStepStatus(status: string, stepIndex: number) {
  const statusIndices: Record<string, number> = {
    UNSUBMITTED: 0,
    QUEUED: 1,
    PROCESSING: 2,
    UNDER_MANUAL_REVIEW: 3,
    VERIFIED: 4,
    REJECTED: 4,
  };

  const currentIndex = statusIndices[status] || 0;

  if (status === 'REJECTED' && stepIndex === 4) {
    return 'rejected';
  }

  if (currentIndex >= stepIndex) {
    return currentIndex === stepIndex ? 'active' : 'completed';
  }

  return 'inactive';
}

export function getCurrentStatus(status?: string, nestedStatus?: string) {
  return status || nestedStatus || 'UNSUBMITTED';
}
