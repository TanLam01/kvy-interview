import { useRef, useState } from 'react';
import { getErrorMessage, uploadSellerDocument } from '../api';
import type { SellerStatusResponse, User, VerificationEvent } from '../types';
import {
  formatDocType,
  getCurrentStatus,
  getStepStatus,
} from '../utils/verification';
import { Timeline } from './Timeline';

interface SellerDashboardProps {
  user: User;
  sellerStatus: SellerStatusResponse | null;
  onRefreshStatus: () => void;
}

export function SellerDashboard({
  user,
  sellerStatus,
  onRefreshStatus,
}: SellerDashboardProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('business_license');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = getCurrentStatus(
    sellerStatus?.status,
    sellerStatus?.verification?.status,
  );
  const reason = sellerStatus?.reason || sellerStatus?.verification?.reason;
  const attemptCount =
    sellerStatus?.attemptCount || sellerStatus?.verification?.attemptCount || 0;
  const document = sellerStatus?.document || sellerStatus?.verification?.document;
  const events = (sellerStatus?.events || []) as VerificationEvent[];
  const isPending = ['QUEUED', 'PROCESSING', 'UNDER_MANUAL_REVIEW'].includes(
    status,
  );
  const isVerified = status === 'VERIFIED';

  const validateAndSetFile = (file: File) => {
    setUploadError('');
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExts.includes(fileExt)) {
      setUploadError('Only PDF, PNG, JPG, and JPEG files are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit.');
      return;
    }

    setUploadFile(file);
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files?.[0]) {
      validateAndSetFile(event.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      validateAndSetFile(event.target.files[0]);
    }
  };

  const handleUploadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile) return;

    setUploadError('');
    setUploadLoading(true);

    try {
      await uploadSellerDocument(user.token, uploadFile, uploadType);
      setUploadFile(null);
      onRefreshStatus();
    } catch (error) {
      setUploadError(getErrorMessage(error, 'An error occurred during upload.'));
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>
            Seller Dashboard
          </h1>
          <p className="muted-copy">
            Manage your business credentials to list products
          </p>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-two-col">
        <div className="dashboard-column">
          <div className="card">
            <h3 className="card-title">Verification Status</h3>

            {sellerStatus && (
              <div className="stepper-container">
                <div className="stepper-line">
                  <div
                    className="stepper-line-fill"
                    style={{
                      width:
                        status === 'QUEUED'
                          ? '25%'
                          : status === 'PROCESSING'
                            ? '50%'
                            : status === 'UNDER_MANUAL_REVIEW'
                              ? '75%'
                              : ['VERIFIED', 'REJECTED'].includes(status)
                                ? '100%'
                                : '0%',
                    }}
                  ></div>
                </div>
                {['Uploaded', 'Queued', 'Analyzing', 'Final Decision'].map(
                  (label, index) => (
                    <div
                      key={label}
                      className={`step-node ${getStepStatus(status, index + 1)}`}
                    >
                      <div className="step-circle">
                        {index === 3 ? 'OK' : index + 1}
                      </div>
                      <div className="step-label">{label}</div>
                    </div>
                  ),
                )}
              </div>
            )}

            <div>
              <div className={`seller-status-box status-box-${status}`}>
                <div className="status-header-row">
                  <span className="status-label-text">Current State</span>
                  <span className={`badge badge-status status-${status}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>

                {document && (
                  <div className="document-summary">
                    <strong>File:</strong> {document.fileName} (
                    {formatDocType(document.documentType)})
                    {attemptCount > 0 && (
                      <div>
                        <strong>Attempts:</strong> {attemptCount}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {reason && (
                <div style={{ marginTop: '16px' }}>
                  <label className="feedback-label">Feedback Details</label>
                  <div className="status-reason-text">{reason}</div>
                </div>
              )}
            </div>
          </div>

          {events.length > 0 && (
            <div className="card">
              <h3 className="card-title">Verification Event History</h3>
              <Timeline events={events} />
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3 className="card-title">Upload Business Document</h3>

            {isVerified ? (
              <VerifiedUploadState />
            ) : isPending ? (
              <PendingUploadState />
            ) : (
              <form onSubmit={handleUploadSubmit} className="upload-form">
                <div className="form-group">
                  <label>Document Classification</label>
                  <select
                    className="form-input"
                    value={uploadType}
                    onChange={(event) => setUploadType(event.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="business_license">Business License</option>
                    <option value="tax_registration">Tax Registration</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>File Upload (PDF, PNG, JPG, JPEG - Max 5MB)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".pdf,.png,.jpg,.jpeg"
                  />

                  {!uploadFile ? (
                    <div
                      className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg
                        className="drop-zone-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="drop-zone-text">
                        Drag and drop document file here, or{' '}
                        <strong style={{ color: 'var(--brand-primary)' }}>
                          browse files
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <div className="file-selected-box">
                      <span className="selected-file-name">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {uploadFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadFile(null)}
                        className="file-remove-btn"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div className="status-reason-text inline-error">
                    {uploadError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!uploadFile || uploadLoading}
                  className={`btn ${!uploadFile ? 'btn-disabled' : 'btn-primary'}`}
                >
                  {uploadLoading
                    ? 'Uploading and Queuing...'
                    : 'Submit Verification Document'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifiedUploadState() {
  return (
    <div className="empty-state">
      <svg
        className="empty-state-icon"
        style={{ color: 'var(--success)', opacity: 0.8 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
        Your business document has been verified.
      </p>
      <p style={{ fontSize: '13px', marginTop: '6px' }}>
        You are now cleared to list products on the marketplace.
      </p>
    </div>
  );
}

function PendingUploadState() {
  return (
    <div className="empty-state">
      <div className="loading-spinner"></div>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontWeight: 500,
          marginTop: '12px',
        }}
      >
        Verification in progress...
      </p>
      <p style={{ fontSize: '13px', marginTop: '6px' }}>
        We are reviewing your submission. You will be able to re-upload if your
        document is rejected.
      </p>
    </div>
  );
}
