import { auth } from './firebase';
import { isNotFoundProxyMessage } from '../utils/pwaRecovery';

const LEGACY_DEMO_TOKEN_KEY = 'karyaflow_demo_session_token';

// Clear any legacy sessionStorage token so auth tokens remain strictly in memory
if (typeof window !== 'undefined') {
  try {
    window.sessionStorage.removeItem(LEGACY_DEMO_TOKEN_KEY);
  } catch {
    // Ignore Storage / SecurityError in strict iframe or privacy contexts
  }
}

let inMemoryDemoToken: string | null = null;

export class ApiError extends Error {
  status: number;
  isRoutingOrCacheError: boolean;
  constructor(message: string, status: number, isRoutingOrCacheError = false) {
    super(message);
    this.status = status;
    this.isRoutingOrCacheError = isRoutingOrCacheError;
  }
}

export function setActiveDemoToken(token: string | null) {
  inMemoryDemoToken = token;
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

async function isApiBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
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
      cache: options.cache ?? 'no-store',
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Waktu koneksi ke server habis. Silakan coba lagi.', 408);
    }
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0, true);
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
        textFallback = (await response.text()).slice(0, 180).trim();
      }
    } catch {
      textFallback = '';
    }

    if (response.status === 404 || isNotFoundProxyMessage(textFallback)) {
      const backendOk = path !== '/health' ? await isApiBackendReachable() : false;
      const recoveryMsg = backendOk
        ? 'Rute login tidak cocok dengan cache aplikasi di browser. Klik "Muat Ulang & Bersihkan Cache" lalu coba masuk kembali.'
        : 'Halaman atau layanan autentikasi tidak ditemukan (404). Server mungkin sedang memuat ulang atau cache aplikasi usang — klik "Muat Ulang & Bersihkan Cache" lalu coba lagi.';
      throw new ApiError(recoveryMsg, response.status, true);
    }

    const cleanText = textFallback && !textFallback.startsWith('<') ? textFallback : '';
    throw new ApiError(
      cleanText || `Permintaan gagal dengan status ${response.status}.`,
      response.status,
      response.status >= 502,
    );
  }

  if (!contentType.includes('application/json') && path !== '/health') {
    throw new ApiError(
      'Server mengembalikan respons yang tidak sesuai (kemungkinan cache usang). Klik "Muat Ulang & Bersihkan Cache".',
      502,
      true,
    );
  }

  return data as T;
}
