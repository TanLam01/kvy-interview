import type {
  AdminDecision,
  LoginResponse,
  SellerStatusResponse,
  Verification,
} from './types';

export const API_BASE = 'http://localhost:3000/api';

export async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

export function getErrorMessage(error: unknown, fallback = 'An error occurred.') {
  return error instanceof Error ? error.message : fallback;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Login failed.'));
  }

  return (await response.json()) as LoginResponse;
}

export async function getSellerStatus(token: string) {
  const response = await fetch(`${API_BASE}/seller/documents/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch status.'));
  }

  return (await response.json()) as SellerStatusResponse;
}

export async function uploadSellerDocument(
  token: string,
  file: File,
  documentType: string,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await fetch(`${API_BASE}/seller/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Upload failed.'));
  }

  return response.json() as Promise<unknown>;
}

export async function getPendingVerifications(token: string) {
  const response = await fetch(`${API_BASE}/admin/verifications/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch pending list.'));
  }

  return (await response.json()) as Verification[];
}

export async function getAllVerifications(token: string) {
  const response = await fetch(`${API_BASE}/admin/verifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch verifications.'));
  }

  return (await response.json()) as Verification[];
}

export async function getVerificationHistory(token: string, verificationId: string) {
  const response = await fetch(
    `${API_BASE}/admin/verifications/${verificationId}/history`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to fetch history.'));
  }

  return (await response.json()) as Verification;
}

export async function submitAdminDecision(
  token: string,
  verificationId: string,
  action: AdminDecision,
  reason: string,
) {
  const response = await fetch(
    `${API_BASE}/admin/verifications/${verificationId}/decision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, reason }),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to submit decision.'));
  }

  return response.json() as Promise<unknown>;
}

export async function openVerificationDocument(
  token: string,
  verificationId: string,
) {
  const response = await fetch(
    `${API_BASE}/admin/verifications/${verificationId}/document`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Failed to load document.'));
  }

  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
