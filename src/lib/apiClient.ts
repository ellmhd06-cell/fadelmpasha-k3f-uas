import { auth } from './firebase';

const DEMO_TOKEN_KEY = 'karyaflow_demo_session_token';
let inMemoryDemoToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(DEMO_TOKEN_KEY) : null;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function setActiveDemoToken(token: string | null) {
  inMemoryDemoToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem(DEMO_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(DEMO_TOKEN_KEY);
    }
  }
}

export async function getActiveAuthToken(): Promise<string> {
  if (inMemoryDemoToken) {
    return inMemoryDemoToken;
  }
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError('Sesi pengguna tidak ditemukan. Silakan masuk kembali.', 401);
  }
  return user.getIdToken();
}

export function hasStoredDemoToken(): boolean {
  return !!inMemoryDemoToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!skipAuth) {
    const token = await getActiveAuthToken();
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error || `Permintaan gagal dengan status ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}
