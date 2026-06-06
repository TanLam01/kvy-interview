import type { FormEvent } from 'react';
import type { User } from '../types';

interface LoginViewProps {
  authEmail: string;
  authPassword: string;
  authError: string;
  authLoading: boolean;
  roleToggle: User['role'];
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (role: User['role']) => void;
  onSubmit: (event: FormEvent) => void;
}

export function LoginView({
  authEmail,
  authPassword,
  authError,
  authLoading,
  roleToggle,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
  onSubmit,
}: LoginViewProps) {
  const fillCredentials = (email: string, password: string) => {
    onEmailChange(email);
    onPasswordChange(password);
  };

  return (
    <div className="auth-wrapper">
      <div className="login-card animate-fade-in">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Secure document verification gateway</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={`auth-toggle-btn ${roleToggle === 'SELLER' ? 'active' : ''}`}
            onClick={() => onRoleChange('SELLER')}
          >
            Seller Portal
          </button>
          <button
            type="button"
            className={`auth-toggle-btn ${roleToggle === 'ADMIN' ? 'active' : ''}`}
            onClick={() => onRoleChange('ADMIN')}
          >
            Admin Panel
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder={
                roleToggle === 'SELLER' ? 'seller1@kvy.tech' : 'admin@kvy.tech'
              }
              value={authEmail}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="********"
              value={authPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>

          {authError && (
            <div className="status-reason-text inline-error">{authError}</div>
          )}

          <button type="submit" disabled={authLoading} className="btn btn-primary">
            {authLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <details className="seed-credentials-info">
          <summary>Show Mock Seed Credentials</summary>
          <ul className="seed-list">
            {roleToggle === 'SELLER' ? (
              <>
                <li className="seed-item">
                  Seller 1:{' '}
                  <code
                    onClick={() =>
                      fillCredentials('seller1@kvy.tech', 'password123')
                    }
                  >
                    seller1@kvy.tech
                  </code>{' '}
                  / <code>password123</code>
                </li>
                <li className="seed-item">
                  Seller 2:{' '}
                  <code
                    onClick={() =>
                      fillCredentials('seller2@kvy.tech', 'password123')
                    }
                  >
                    seller2@kvy.tech
                  </code>{' '}
                  / <code>password123</code>
                </li>
              </>
            ) : (
              <li className="seed-item">
                Admin 1:{' '}
                <code
                  onClick={() =>
                    fillCredentials('admin@kvy.tech', 'adminpassword')
                  }
                >
                  admin@kvy.tech
                </code>{' '}
                / <code>adminpassword</code>
              </li>
            )}
          </ul>
        </details>
      </div>
    </div>
  );
}
