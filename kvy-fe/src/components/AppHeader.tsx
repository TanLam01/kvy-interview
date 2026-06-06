import type { User } from '../types';

interface AppHeaderProps {
  user: User | null;
  onLogout: () => void;
}

export function AppHeader({ user, onLogout }: AppHeaderProps) {
  return (
    <header className="nav-header">
      <div className="logo-section">
        <svg
          className="logo-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M9 17V7L15 17V7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="logo-text">KVY Tech Marketplace</span>
      </div>
      {user && (
        <div className="user-profile">
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <span
              className={`badge badge-role ${
                user.role === 'ADMIN' ? 'badge-admin' : ''
              }`}
            >
              {user.role}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="btn btn-secondary compact-action"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
