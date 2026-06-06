export interface User {
  id: string;
  email: string;
  role: 'SELLER' | 'ADMIN';
  token: string;
}

export interface VerificationEvent {
  id: string;
  verificationId: string;
  actorType: 'SELLER' | 'ADMIN' | 'SYSTEM';
  actorId: string | null;
  action:
    | 'UPLOAD'
    | 'SUBMIT'
    | 'SUBMIT_FAIL'
    | 'RECEIVE_RESULT'
    | 'ADMIN_DECISION'
    | 'SELLER_NOTIFICATION'
    | 'ENQUEUE_FAIL'
    | 'RECONCILE_REQUEUE'
    | 'RECONCILE_TIMEOUT';
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

export interface VerificationDocument {
  id: string;
  fileName: string;
  documentType: string;
  createdAt: string;
}

export interface Verification {
  id: string;
  documentId: string;
  sellerId: string;
  status:
    | 'QUEUED'
    | 'PROCESSING'
    | 'VERIFIED'
    | 'REJECTED'
    | 'UNDER_MANUAL_REVIEW'
    | 'NEEDS_ATTENTION';
  automatedResult: string | null;
  reason: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  document?: VerificationDocument;
  events?: VerificationEvent[];
}

export type VerificationStatus = Verification['status'] | 'UNSUBMITTED';

export interface SellerStatusResponse
  extends Omit<Partial<Verification>, 'status'> {
  status: VerificationStatus;
  message?: string;
  verification?: Verification;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'SELLER' | 'ADMIN';
  };
}

export type AdminDecision = 'verify' | 'reject';
