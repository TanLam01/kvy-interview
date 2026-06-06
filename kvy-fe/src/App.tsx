import { useCallback, useEffect, useState } from 'react';
import {
  getAllVerifications,
  getErrorMessage,
  getPendingVerifications,
  getSellerStatus,
  login,
} from './api';
import { clearStoredUser, getStoredUser, storeUser } from './auth/session';
import './App.css';
import { AdminDashboard } from './components/AdminDashboard';
import { AppHeader } from './components/AppHeader';
import { LoginView } from './components/LoginView';
import { SellerDashboard } from './components/SellerDashboard';
import type { SellerStatusResponse, User, Verification } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [roleToggle, setRoleToggle] = useState<User['role']>('SELLER');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [sellerStatus, setSellerStatus] =
    useState<SellerStatusResponse | null>(null);

  const [adminPending, setAdminPending] = useState<Verification[]>([]);
  const [allVerifications, setAllVerifications] = useState<Verification[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const fetchSellerStatus = useCallback(async (token: string) => {
    try {
      setSellerStatus(await getSellerStatus(token));
    } catch (error) {
      console.error('Failed to fetch seller status', error);
    }
  }, []);

  const fetchAdminData = useCallback(async (token: string) => {
    setAdminError('');
    setAdminLoading(true);

    try {
      const [pending, all] = await Promise.all([
        getPendingVerifications(token),
        getAllVerifications(token),
      ]);
      setAdminPending(pending);
      setAllVerifications(all);
    } catch (error) {
      setAdminError(getErrorMessage(error, 'Failed to fetch admin data'));
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (user.role === 'SELLER') {
        void fetchSellerStatus(user.token);
      } else {
        void fetchAdminData(user.token);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchAdminData, fetchSellerStatus, user]);

  useEffect(() => {
    if (!user || user.role !== 'SELLER') {
      return;
    }

    const status = sellerStatus?.status || sellerStatus?.verification?.status;
    const isPending = ['QUEUED', 'PROCESSING', 'UNDER_MANUAL_REVIEW'].includes(
      status || '',
    );

    if (!isPending) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchSellerStatus(user.token);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [fetchSellerStatus, sellerStatus, user]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      const data = await login(authEmail, authPassword);
      const authenticatedUser: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        token: data.token,
      };

      setUser(authenticatedUser);
      storeUser(authenticatedUser);
      setAuthEmail('');
      setAuthPassword('');

      if (authenticatedUser.role === 'SELLER') {
        void fetchSellerStatus(authenticatedUser.token);
      } else {
        void fetchAdminData(authenticatedUser.token);
      }
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    clearStoredUser();
    setSellerStatus(null);
    setAdminPending([]);
    setAllVerifications([]);
    setAdminError('');
  };

  const handleRoleChange = (role: User['role']) => {
    setRoleToggle(role);
    setAuthError('');
  };

  return (
    <div className="app-container">
      <AppHeader user={user} onLogout={handleLogout} />

      {!user ? (
        <LoginView
          authEmail={authEmail}
          authPassword={authPassword}
          authError={authError}
          authLoading={authLoading}
          roleToggle={roleToggle}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onRoleChange={handleRoleChange}
          onSubmit={handleLogin}
        />
      ) : (
        <main className="main-content">
          {user.role === 'SELLER' ? (
            <SellerDashboard
              user={user}
              sellerStatus={sellerStatus}
              onRefreshStatus={() => void fetchSellerStatus(user.token)}
            />
          ) : (
            <AdminDashboard
              user={user}
              adminPending={adminPending}
              allVerifications={allVerifications}
              adminLoading={adminLoading}
              adminError={adminError}
              onPendingChange={setAdminPending}
              onAllVerificationsChange={setAllVerifications}
              onAdminErrorChange={setAdminError}
              onAdminLoadingChange={setAdminLoading}
            />
          )}
        </main>
      )}
    </div>
  );
}
