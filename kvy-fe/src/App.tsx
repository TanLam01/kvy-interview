import { useState, useEffect, useRef } from 'react';
import './App.css';

interface User {
  id: string;
  email: string;
  role: 'SELLER' | 'ADMIN';
  token: string;
}

interface VerificationEvent {
  id: string;
  verificationId: string;
  actorType: 'SELLER' | 'ADMIN' | 'SYSTEM';
  actorId: string | null;
  action: 'UPLOAD' | 'SUBMIT' | 'SUBMIT_FAIL' | 'RECEIVE_RESULT' | 'ADMIN_DECISION';
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: string;
}

interface Verification {
  id: string;
  documentId: string;
  sellerId: string;
  status: 'QUEUED' | 'PROCESSING' | 'VERIFIED' | 'REJECTED' | 'UNDER_MANUAL_REVIEW';
  automatedResult: string | null;
  reason: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  document?: {
    id: string;
    fileName: string;
    documentType: string;
    createdAt: string;
  };
  events?: VerificationEvent[];
}

const API_BASE = 'http://localhost:3000/api';

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [roleToggle, setRoleToggle] = useState<'SELLER' | 'ADMIN'>('SELLER');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Seller Dashboard State
  const [sellerStatus, setSellerStatus] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('business_license');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Dashboard State
  const [adminPending, setAdminPending] = useState<Verification[]>([]);
  const [selectedReview, setSelectedReview] = useState<Verification | null>(null);
  const [reviewHistory, setReviewHistory] = useState<VerificationEvent[]>([]);
  const [decisionReason, setDecisionReason] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('kvy_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        if (parsed.role === 'SELLER') {
          fetchSellerStatus(parsed.token);
        } else {
          fetchAdminPending(parsed.token);
        }
      } catch (e) {
        localStorage.removeItem('kvy_user');
      }
    }
  }, []);

  // Poll seller status while active (not verified/rejected/unsubmitted)
  useEffect(() => {
    if (!user || user.role !== 'SELLER') return;
    
    const status = sellerStatus?.status || sellerStatus?.verification?.status;
    const isPending = ['QUEUED', 'PROCESSING', 'UNDER_MANUAL_REVIEW'].includes(status);
    
    if (!isPending) return;

    const interval = setInterval(() => {
      fetchSellerStatus(user.token);
    }, 3000);

    return () => clearInterval(interval);
  }, [user, sellerStatus]);

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed.');
      }

      const data = await response.json();
      const authenticatedUser: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        token: data.token,
      };

      setUser(authenticatedUser);
      localStorage.setItem('kvy_user', JSON.stringify(authenticatedUser));
      
      // Clear inputs
      setAuthEmail('');
      setAuthPassword('');

      // Redirects / Fetch
      if (authenticatedUser.role === 'SELLER') {
        fetchSellerStatus(authenticatedUser.token);
      } else {
        fetchAdminPending(authenticatedUser.token);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('kvy_user');
    setSellerStatus(null);
    setAdminPending([]);
    setSelectedReview(null);
    setReviewHistory([]);
    setDecisionReason('');
  };

  // Seller Dashboard Operations
  const fetchSellerStatus = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/seller/documents/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSellerStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch seller status', e);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

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

  const removeSelectedFile = () => {
    setUploadFile(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFile) return;

    setUploadError('');
    setUploadLoading(true);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('documentType', uploadType);

    try {
      const response = await fetch(`${API_BASE}/seller/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed.');
      }

      setUploadFile(null);
      fetchSellerStatus(user.token);
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Admin Dashboard Operations
  const fetchAdminPending = async (token: string) => {
    setAdminError('');
    setAdminLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/verifications/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch pending list');
      const data = await response.json();
      setAdminPending(data);
    } catch (e: any) {
      setAdminError(e.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSelectReview = async (verification: Verification) => {
    setSelectedReview(verification);
    setDecisionReason('');
    
    if (!user) return;
    
    // Fetch detailed events / history
    try {
      const response = await fetch(`${API_BASE}/admin/verifications/${verification.id}/history`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setReviewHistory(data.events || []);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleAdminDecision = async (action: 'verify' | 'reject') => {
    if (!user || !selectedReview) return;
    if (action === 'reject' && !decisionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setSubmittingDecision(true);

    try {
      const response = await fetch(`${API_BASE}/admin/verifications/${selectedReview.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ action, reason: decisionReason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit decision.');
      }

      setSelectedReview(null);
      setDecisionReason('');
      setReviewHistory([]);
      fetchAdminPending(user.token);
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Render helpers
  const getStepStatus = (status: string, stepIndex: number) => {
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
  };

  const formatDocType = (type: string) => {
    return type === 'business_license' ? 'Business License' : 'Tax Registration';
  };

  const fillCredentials = (email: string, pass: string) => {
    setAuthEmail(email);
    setAuthPassword(pass);
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="nav-header">
        <div className="logo-section">
          <svg className="logo-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M9 17V7L15 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logo-text">KVY Tech Marketplace</span>
        </div>
        {user && (
          <div className="user-profile">
            <div className="user-info">
              <span className="user-email">{user.email}</span>
              <span className={`badge badge-role ${user.role === 'ADMIN' ? 'badge-admin' : ''}`}>
                {user.role}
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }}>
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Guest Login View */}
      {!user ? (
        <div className="auth-wrapper">
          <div className="login-card animate-fade-in">
            <div className="auth-header">
              <h2>Welcome Back</h2>
              <p>Secure document verification gateway</p>
            </div>

            {/* Role Toggle Selector */}
            <div className="auth-toggle">
              <button
                type="button"
                className={`auth-toggle-btn ${roleToggle === 'SELLER' ? 'active' : ''}`}
                onClick={() => {
                  setRoleToggle('SELLER');
                  setAuthError('');
                }}
              >
                Seller Portal
              </button>
              <button
                type="button"
                className={`auth-toggle-btn ${roleToggle === 'ADMIN' ? 'active' : ''}`}
                onClick={() => {
                  setRoleToggle('ADMIN');
                  setAuthError('');
                }}
              >
                Admin Panel
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder={roleToggle === 'SELLER' ? 'seller1@kvy.tech' : 'admin@kvy.tech'}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              {authError && <div className="status-reason-text" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: '20px' }}>{authError}</div>}

              <button type="submit" disabled={authLoading} className="btn btn-primary">
                {authLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Collapsible Seed Credentials Info */}
            <details className="seed-credentials-info">
              <summary>Show Mock Seed Credentials</summary>
              <ul className="seed-list">
                {roleToggle === 'SELLER' ? (
                  <>
                    <li className="seed-item">
                      Seller 1: <code onClick={() => fillCredentials('seller1@kvy.tech', 'password123')}>seller1@kvy.tech</code> / <code>password123</code>
                    </li>
                    <li className="seed-item">
                      Seller 2: <code onClick={() => fillCredentials('seller2@kvy.tech', 'password123')}>seller2@kvy.tech</code> / <code>password123</code>
                    </li>
                  </>
                ) : (
                  <li className="seed-item">
                    Admin 1: <code onClick={() => fillCredentials('admin@kvy.tech', 'adminpassword')}>admin@kvy.tech</code> / <code>adminpassword</code>
                  </li>
                )}
              </ul>
            </details>
          </div>
        </div>
      ) : (
        /* Authenticated Panels */
        <main className="main-content">
          {user.role === 'SELLER' ? (
            /* Seller Dashboard View */
            <div className="animate-fade-in">
              <div className="dashboard-header">
                <div>
                  <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>Seller Dashboard</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>Manage your business credentials to list products</p>
                </div>
              </div>

              <div className="dashboard-grid dashboard-grid-two-col">
                {/* Status Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="card">
                    <h3 className="card-title">Verification Status</h3>

                    {/* Simple stepper for active verification status mapping */}
                    {sellerStatus && (
                      <div className="stepper-container">
                        <div className="stepper-line">
                          <div 
                            className="stepper-line-fill" 
                            style={{ 
                              width: 
                                (sellerStatus.status || sellerStatus.verification?.status) === 'QUEUED' ? '25%' :
                                (sellerStatus.status || sellerStatus.verification?.status) === 'PROCESSING' ? '50%' :
                                (sellerStatus.status || sellerStatus.verification?.status) === 'UNDER_MANUAL_REVIEW' ? '75%' :
                                ['VERIFIED', 'REJECTED'].includes(sellerStatus.status || sellerStatus.verification?.status) ? '100%' : '0%'
                            }}
                          ></div>
                        </div>
                        <div className={`step-node ${getStepStatus(sellerStatus.status || sellerStatus.verification?.status || 'UNSUBMITTED', 1)}`}>
                          <div className="step-circle">1</div>
                          <div className="step-label">Uploaded</div>
                        </div>
                        <div className={`step-node ${getStepStatus(sellerStatus.status || sellerStatus.verification?.status || 'UNSUBMITTED', 2)}`}>
                          <div className="step-circle">2</div>
                          <div className="step-label">Queued</div>
                        </div>
                        <div className={`step-node ${getStepStatus(sellerStatus.status || sellerStatus.verification?.status || 'UNSUBMITTED', 3)}`}>
                          <div className="step-circle">3</div>
                          <div className="step-label">Analyzing</div>
                        </div>
                        <div className={`step-node ${getStepStatus(sellerStatus.status || sellerStatus.verification?.status || 'UNSUBMITTED', 4)}`}>
                          <div className="step-circle">✓</div>
                          <div className="step-label">Final Decision</div>
                        </div>
                      </div>
                    )}

                    {/* Status Info Bubble */}
                    {(() => {
                      const status = sellerStatus?.status || sellerStatus?.verification?.status || 'UNSUBMITTED';
                      const reason = sellerStatus?.reason || sellerStatus?.verification?.reason;
                      const attemptCount = sellerStatus?.attemptCount || sellerStatus?.verification?.attemptCount || 0;
                      const document = sellerStatus?.document || sellerStatus?.verification?.document;

                      return (
                        <div>
                          <div className={`seller-status-box status-box-${status}`}>
                            <div className="status-header-row">
                              <span className="status-label-text">Current State</span>
                              <span className={`badge badge-status status-${status}`}>
                                {status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            
                            {document && (
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                <strong>File:</strong> {document.fileName} ({formatDocType(document.documentType)})
                                {attemptCount > 0 && <div><strong>Attempts:</strong> {attemptCount}</div>}
                              </div>
                            )}
                          </div>

                          {reason && (
                            <div style={{ marginTop: '16px' }}>
                              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Feedback Details</label>
                              <div className="status-reason-text">
                                {reason}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Submission Timeline for Seller */}
                  {sellerStatus?.events && sellerStatus.events.length > 0 && (
                    <div className="card">
                      <h3 className="card-title">Verification Event History</h3>
                      <div className="timeline-wrapper">
                        {sellerStatus.events.map((event: VerificationEvent) => (
                          <div key={event.id} className={`timeline-event event-${event.action}`}>
                            <div className="timeline-node"></div>
                            <div className="timeline-content">
                              <div className="timeline-event-header">
                                <span className="timeline-action-name">{event.action.replace(/_/g, ' ')}</span>
                                <span className="timeline-time">
                                  {new Date(event.createdAt).toLocaleTimeString()} ({new Date(event.createdAt).toLocaleDateString()})
                                </span>
                              </div>
                              <div className="timeline-actor-row">
                                <span>Actor: <strong>{event.actorType}</strong></span>
                                {event.fromStatus && (
                                  <span className="timeline-transition-row">
                                    {event.fromStatus} → {event.toStatus}
                                  </span>
                                )}
                              </div>
                              {event.reason && <div className="timeline-reason-bubble">{event.reason}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Section */}
                <div>
                  <div className="card">
                    <h3 className="card-title">Upload Business Document</h3>

                    {(() => {
                      const status = sellerStatus?.status || sellerStatus?.verification?.status || 'UNSUBMITTED';
                      const isPending = ['QUEUED', 'PROCESSING', 'UNDER_MANUAL_REVIEW'].includes(status);
                      const isVerified = status === 'VERIFIED';

                      if (isVerified) {
                        return (
                          <div className="empty-state">
                            <svg className="empty-state-icon" style={{ color: 'var(--success)', opacity: 0.8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Your business document has been verified.</p>
                            <p style={{ fontSize: '13px', marginTop: '6px' }}>You are now cleared to list products on the marketplace.</p>
                          </div>
                        );
                      }

                      if (isPending) {
                        return (
                          <div className="empty-state">
                            <div className="loading-spinner"></div>
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 500, marginTop: '12px' }}>Verification in progress...</p>
                            <p style={{ fontSize: '13px', marginTop: '6px' }}>We are reviewing your submission. You will be able to re-upload if your document is rejected.</p>
                          </div>
                        );
                      }

                      return (
                        <form onSubmit={handleUploadSubmit} className="upload-form">
                          <div className="form-group">
                            <label>Document Classification</label>
                            <select 
                              className="form-input" 
                              value={uploadType} 
                              onChange={(e) => setUploadType(e.target.value)}
                              style={{ cursor: 'pointer' }}
                            >
                              <option value="business_license">Business License</option>
                              <option value="tax_registration">Tax Registration</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>File Upload (PDF, PNG, JPG, JPEG — Max 5MB)</label>
                            
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
                                <svg className="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="drop-zone-text">
                                  Drag and drop document file here, or <strong style={{ color: 'var(--brand-primary)' }}>browse files</strong>
                                </p>
                              </div>
                            ) : (
                              <div className="file-selected-box">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                  {uploadFile.name}
                                </span>
                                <button type="button" onClick={removeSelectedFile} className="file-remove-btn">
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>

                          {uploadError && <div className="status-reason-text" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>{uploadError}</div>}

                          <button 
                            type="submit" 
                            disabled={!uploadFile || uploadLoading} 
                            className={`btn ${!uploadFile ? 'btn-disabled' : 'btn-primary'}`}
                          >
                            {uploadLoading ? 'Uploading and Queuing...' : 'Submit Verification Document'}
                          </button>
                        </form>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Admin Dashboard View */
            <div className="animate-fade-in">
              <div className="dashboard-header">
                <div>
                  <h1 style={{ fontSize: '28px', marginBottom: '4px' }}>Admin manual reviews</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>Review and resolve inconclusive automated verifications</p>
                </div>
                <button 
                  onClick={() => fetchAdminPending(user.token)} 
                  className="btn btn-secondary" 
                  disabled={adminLoading}
                  style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={adminLoading ? 'animate-spin' : ''}>
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
                  </svg>
                  Refresh Queue
                </button>
              </div>

              <div className="admin-layout">
                {/* Pending List Sidebar */}
                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '15px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.05em' }}>
                    Pending Reviews ({adminPending.length})
                  </h3>
                  {adminError && (
                    <div className="status-reason-text" style={{ color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', marginBottom: '12px' }}>
                      {adminError}
                    </div>
                  )}
                  {adminLoading && adminPending.length === 0 ? (
                    <div className="loading-spinner"></div>
                  ) : adminPending.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 10px' }}>
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <p style={{ fontSize: '13px' }}>Queue is clean. No manual reviews pending!</p>
                    </div>
                  ) : (
                    <div className="pending-list">
                      {adminPending.map((v) => (
                        <button
                          key={v.id}
                          className={`pending-item ${selectedReview?.id === v.id ? 'active' : ''}`}
                          onClick={() => handleSelectReview(v)}
                        >
                          <div className="pending-item-header">
                            <span className="pending-item-title">
                              {formatDocType(v.document?.documentType || '')}
                            </span>
                            <span className="badge badge-status status-UNDER_MANUAL_REVIEW" style={{ fontSize: '9px', padding: '3px 6px' }}>
                              Inconclusive
                            </span>
                          </div>
                          <div className="pending-item-sub">Seller: {v.sellerId}</div>
                          <div className="pending-item-sub" style={{ fontSize: '10px', marginTop: '4px' }}>
                            Uploaded: {new Date(v.createdAt).toLocaleString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Review Details Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {selectedReview ? (
                    <>
                      <div className="card">
                        <h3 className="card-title">Document Inspection: {selectedReview.id.substring(0, 8)}...</h3>
                        
                        <div className="review-panel-grid">
                          {/* Left: Document Info */}
                          <div className="document-preview-card">
                            <div className="doc-info-row">
                              <span className="doc-info-label">Seller ID</span>
                              <span className="doc-info-val">{selectedReview.sellerId}</span>
                            </div>
                            <div className="doc-info-row">
                              <span className="doc-info-label">Document Class</span>
                              <span className="doc-info-val">{formatDocType(selectedReview.document?.documentType || '')}</span>
                            </div>
                            <div className="doc-info-row">
                              <span className="doc-info-label">Stored File Target</span>
                              <span className="doc-info-val" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                {selectedReview.document?.fileName}
                              </span>
                            </div>
                            <div className="doc-info-row">
                              <span className="doc-info-label">Automated System Check</span>
                              <span className="doc-info-val" style={{ color: 'var(--warning)' }}>INCONCLUSIVE</span>
                            </div>
                            
                            {selectedReview.reason && (
                              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>Automated Warning Details:</strong>
                                <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px' }}>
                                  {selectedReview.reason}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Right: Decision and Override forms */}
                          <div className="decision-card">
                            <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Manual Review Decision Override</h4>
                            
                            <div className="form-group">
                              <label>Decision Reason / Audit Note (Required for Rejection)</label>
                              <textarea
                                className="form-input"
                                placeholder="State the reason for accepting or rejecting this business entity..."
                                rows={4}
                                style={{ resize: 'none' }}
                                value={decisionReason}
                                onChange={(e) => setDecisionReason(e.target.value)}
                              />
                            </div>

                            <div className="decision-actions">
                              <button
                                onClick={() => handleAdminDecision('reject')}
                                className="btn btn-reject"
                                disabled={submittingDecision}
                              >
                                {submittingDecision ? 'Submitting...' : 'Reject Business'}
                              </button>
                              <button
                                onClick={() => handleAdminDecision('verify')}
                                className="btn btn-verify"
                                disabled={submittingDecision}
                              >
                                {submittingDecision ? 'Submitting...' : 'Verify Business'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timeline component for detailed auditing of this review item */}
                      {reviewHistory.length > 0 && (
                        <div className="card">
                          <h3 className="card-title">Detailed Audit Event Log</h3>
                          <div className="timeline-wrapper">
                            {reviewHistory.map((event) => (
                              <div key={event.id} className={`timeline-event event-${event.action}`}>
                                <div className="timeline-node"></div>
                                <div className="timeline-content">
                                  <div className="timeline-event-header">
                                    <span className="timeline-action-name">{event.action.replace(/_/g, ' ')}</span>
                                    <span className="timeline-time">
                                      {new Date(event.createdAt).toLocaleTimeString()} ({new Date(event.createdAt).toLocaleDateString()})
                                    </span>
                                  </div>
                                  <div className="timeline-actor-row">
                                    <span>Actor: <strong>{event.actorType}</strong> (ID: {event.actorId || 'N/A'})</span>
                                    {event.fromStatus && (
                                      <span className="timeline-transition-row">
                                        Transition: {event.fromStatus} → {event.toStatus}
                                      </span>
                                    )}
                                  </div>
                                  {event.reason && <div className="timeline-reason-bubble">{event.reason}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="card empty-state" style={{ padding: '60px 20px' }}>
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <h3>Select a verification request</h3>
                      <p style={{ fontSize: '13px', marginTop: '6px' }}>
                        Click a pending item on the left panel to review its document, timeline history, and perform decisions.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
