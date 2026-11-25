import { auth } from './firebase';

const DEMO_TOKEN_KEY = 'karyaflow_demo_session_token';

function readStoredDemoToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(DEMO_TOKEN_KEY);
  } catch {
    return null;
  }
}

let inMemoryDemoToken: string | null = readStoredDemoToken();

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
    try {
      if (token) {
        window.sessionStorage.setItem(DEMO_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(DEMO_TOKEN_KEY);
      }
    } catch {
      // Ignore Storage / SecurityError in strict iframe or privacy contexts
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Waktu koneksi ke server habis. Silakan coba lagi.', 408);
    }
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const jsonErr =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null;
    if (jsonErr) {
      throw new ApiError(jsonErr, response.status);
    }
    let textFallback = '';
    try {
      if (!contentType.includes('application/json')) {
        textFallback = (await response.text()).slice(0, 140).trim();
      }
    } catch {
      textFallback = '';
    }
    const cleanText = textFallback && !textFallback.startsWith('<') ? textFallback : '';
    throw new ApiError(
      cleanText || `Permintaan gagal dengan status ${response.status}.`,
      response.status,
    );
  }

  return data as T;
}
