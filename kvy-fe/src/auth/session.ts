import type { User } from '../types';

const STORAGE_KEY = 'kvy_user';

export function getStoredUser(): User | null {
  const savedUser = localStorage.getItem(STORAGE_KEY);
  if (!savedUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(savedUser) as Partial<User>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.email === 'string' &&
      typeof parsed.token === 'string' &&
      (parsed.role === 'SELLER' || parsed.role === 'ADMIN')
    ) {
      return {
        id: parsed.id,
        email: parsed.email,
        role: parsed.role,
        token: parsed.token,
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

export function storeUser(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
}
