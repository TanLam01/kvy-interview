import { useState } from 'react';
import {
  getAllVerifications,
  getErrorMessage,
  getPendingVerifications,
  getVerificationHistory,
  openVerificationDocument,
  submitAdminDecision,
} from '../api';
import type {
  AdminDecision,
  User,
  Verification,
  VerificationEvent,
} from '../types';
import { formatDocType } from '../utils/verification';
import { Timeline } from './Timeline';

interface AdminDashboardProps {
  user: User;
  adminPending: Verification[];
  allVerifications: Verification[];
  adminLoading: boolean;
  adminError: string;
  onPendingChange: (items: Verification[]) => void;
  onAllVerificationsChange: (items: Verification[]) => void;
  onAdminErrorChange: (message: string) => void;
  onAdminLoadingChange: (loading: boolean) => void;
}

export function AdminDashboard({
  user,
  adminPending,
  allVerifications,
  adminLoading,
  adminError,
  onPendingChange,
  onAllVerificationsChange,
  onAdminErrorChange,
  onAdminLoadingChange,
}: AdminDashboardProps) {
  const [activeList, setActiveList] = useState<'all' | 'pending'>('all');
  const [selectedReview, setSelectedReview] = useState<Verification | null>(
    null,
  );
  const [reviewHistory, setReviewHistory] = useState<VerificationEvent[]>([]);
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const visibleVerifications =
    activeList === 'pending' ? adminPending : allVerifications;

  const refreshAdminData = async () => {
    onAdminErrorChange('');
    onAdminLoadingChange(true);

    try {
      const [pending, all] = await Promise.all([
        getPendingVerifications(user.token),
        getAllVerifications(user.token),
      ]);
      onPendingChange(pending);
      onAllVerificationsChange(all);
    } catch (error) {
      onAdminErrorChange(getErrorMessage(error, 'Failed to fetch admin data'));
    } finally {
      onAdminLoadingChange(false);
    }
  };

  const handleSelectReview = async (verification: Verification) => {
    setSelectedReview(verification);
    setDecisionReason('');

    try {
      const data = await getVerificationHistory(user.token, verification.id);
      setReviewHistory(data.events || []);
    } catch (error) {
      console.error('Failed to fetch history', error);
    }
  };

  const handleAdminDecision = async (action: AdminDecision) => {
    if (!selectedReview) return;
    if (action === 'reject' && !decisionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setSubmittingDecision(true);

    try {
      await submitAdminDecision(
        user.token,
        selectedReview.id,
        action,
        decisionReason,
      );
      setSelectedReview(null);
      setDecisionReason('');
      setReviewHistory([]);
      await refreshAdminData();
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleOpenDocument = async () => {
    if (!selectedReview) return;

    try {
      await openVerificationDocument(user.token, selectedReview.id);
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to load document.'));
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>
            Admin manual reviews
          </h1>
          <p className="muted-copy">
            Inspect every verification attempt and resolve manual reviews
          </p>
        </div>
        <button
          onClick={() => void refreshAdminData()}
          className="btn btn-secondary refresh-action"
          disabled={adminLoading}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={adminLoading ? 'animate-spin' : ''}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="admin-layout">
        <div className="card admin-sidebar-card">
          <h3 className="admin-sidebar-title">
            Verification Attempts
          </h3>
          <div className="admin-list-tabs">
            <button
              type="button"
              className={`auth-toggle-btn ${activeList === 'all' ? 'active' : ''}`}
              onClick={() => setActiveList('all')}
            >
              All ({allVerifications.length})
            </button>
            <button
              type="button"
              className={`auth-toggle-btn ${
                activeList === 'pending' ? 'active' : ''
              }`}
              onClick={() => setActiveList('pending')}
            >
              Manual ({adminPending.length})
            </button>
          </div>
          {adminError && (
            <div className="status-reason-text inline-error">{adminError}</div>
          )}
          <VerificationList
            loading={adminLoading}
            verifications={visibleVerifications}
            emptyMessage={
              activeList === 'pending'
                ? 'Queue is clean. No manual reviews pending.'
                : 'No verification attempts found.'
            }
            selectedId={selectedReview?.id}
            onSelect={(verification) => void handleSelectReview(verification)}
          />
        </div>

        <div className="dashboard-column">
          {selectedReview ? (
            <>
              <ReviewDetails
                verification={selectedReview}
                decisionReason={decisionReason}
                submittingDecision={submittingDecision}
                onDecisionReasonChange={setDecisionReason}
                onOpenDocument={() => void handleOpenDocument()}
                onDecision={(action) => void handleAdminDecision(action)}
              />

              {reviewHistory.length > 0 && (
                <div className="card">
                  <h3 className="card-title">Detailed Audit Event Log</h3>
                  <Timeline events={reviewHistory} showActorId />
                </div>
              )}
            </>
          ) : (
            <EmptyReviewState />
          )}
        </div>
      </div>
    </div>
  );
}

interface VerificationListProps {
  loading: boolean;
  verifications: Verification[];
  emptyMessage: string;
  selectedId?: string;
  onSelect: (verification: Verification) => void;
}

function VerificationList({
  loading,
  verifications,
  emptyMessage,
  selectedId,
  onSelect,
}: VerificationListProps) {
  if (loading && verifications.length === 0) {
    return <div className="loading-spinner"></div>;
  }

  if (verifications.length === 0) {
    return (
      <div className="empty-state compact-empty-state">
        <svg
          className="empty-state-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        <p style={{ fontSize: '13px' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="pending-list">
      {verifications.map((verification) => (
        <button
          key={verification.id}
          className={`pending-item ${
            selectedId === verification.id ? 'active' : ''
          }`}
          onClick={() => onSelect(verification)}
        >
          <div className="pending-item-header">
            <span className="pending-item-title">
              {formatDocType(verification.document?.documentType || '')}
            </span>
            <span
              className={`badge badge-status status-${verification.status} compact-badge`}
            >
              {verification.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="pending-item-sub">Seller: {verification.sellerId}</div>
          {verification.automatedResult && (
            <div className="pending-item-sub">
              Automated: {verification.automatedResult}
            </div>
          )}
          <div className="pending-item-sub pending-date">
            Uploaded: {new Date(verification.createdAt).toLocaleString()}
          </div>
        </button>
      ))}
    </div>
  );
}

interface ReviewDetailsProps {
  verification: Verification;
  decisionReason: string;
  submittingDecision: boolean;
  onDecisionReasonChange: (value: string) => void;
  onOpenDocument: () => void;
  onDecision: (action: AdminDecision) => void;
}

function ReviewDetails({
  verification,
  decisionReason,
  submittingDecision,
  onDecisionReasonChange,
  onOpenDocument,
  onDecision,
}: ReviewDetailsProps) {
  return (
    <div className="card">
      <h3 className="card-title">
        Document Inspection: {verification.id.substring(0, 8)}...
      </h3>

      <div className="review-panel-grid">
        <div className="document-preview-card">
          <div className="doc-info-row">
            <span className="doc-info-label">Seller ID</span>
            <span className="doc-info-val">{verification.sellerId}</span>
          </div>
          <div className="doc-info-row">
            <span className="doc-info-label">Document Class</span>
            <span className="doc-info-val">
              {formatDocType(verification.document?.documentType || '')}
            </span>
          </div>
          <div className="doc-info-row">
            <span className="doc-info-label">Stored File Target</span>
            <span className="doc-info-val monospace-value">
              {verification.document?.fileName}
            </span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onOpenDocument}>
            Open uploaded document
          </button>
          <div className="doc-info-row">
            <span className="doc-info-label">Automated System Check</span>
            <span className="doc-info-val">
              {verification.automatedResult || 'PENDING'}
            </span>
          </div>
          <div className="doc-info-row">
            <span className="doc-info-label">Current Status</span>
            <span className={`badge badge-status status-${verification.status}`}>
              {verification.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="doc-info-row">
            <span className="doc-info-label">Attempts</span>
            <span className="doc-info-val">{verification.attemptCount}</span>
          </div>

          {verification.reason && (
            <div style={{ fontSize: '12px', marginTop: '8px' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>
                Verification Details:
              </strong>
              <p className="warning-detail">{verification.reason}</p>
            </div>
          )}
        </div>

        <div className="decision-card">
          {verification.status === 'UNDER_MANUAL_REVIEW' ? (
            <>
              <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                Manual Review Decision Override
              </h4>

              <div className="form-group">
                <label>Decision Reason / Audit Note (Required for Rejection)</label>
                <textarea
                  className="form-input"
                  placeholder="State the reason for accepting or rejecting this business entity..."
                  rows={4}
                  style={{ resize: 'none' }}
                  value={decisionReason}
                  onChange={(event) => onDecisionReasonChange(event.target.value)}
                />
              </div>

              <div className="decision-actions">
                <button
                  onClick={() => onDecision('reject')}
                  className="btn btn-reject"
                  disabled={submittingDecision}
                >
                  {submittingDecision ? 'Submitting...' : 'Reject Business'}
                </button>
                <button
                  onClick={() => onDecision('verify')}
                  className="btn btn-verify"
                  disabled={submittingDecision}
                >
                  {submittingDecision ? 'Submitting...' : 'Verify Business'}
                </button>
              </div>
            </>
          ) : (
            <div className="status-reason-text">
              This attempt is not awaiting a manual decision. Admin can inspect
              the uploaded document and full audit history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyReviewState() {
  return (
    <div className="card empty-state large-empty-state">
      <svg
        className="empty-state-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <h3>Select a verification request</h3>
      <p style={{ fontSize: '13px', marginTop: '6px' }}>
        Click a pending item on the left panel to review its document, timeline
        history, and perform decisions.
      </p>
    </div>
  );
}
