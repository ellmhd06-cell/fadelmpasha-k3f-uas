export async function cleanupLegacyServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch {
    // Ignore SW unregister errors in restricted iframe or private contexts
  }

  try {
    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignore CacheStorage cleanup errors
  }
}

export async function clearAppCacheAndReload(): Promise<void> {
  if (typeof window === 'undefined') return;

  await cleanupLegacyServiceWorkers();

  try {
    window.sessionStorage.removeItem('karyaflow_demo_session_token');
  } catch {
    // Ignore storage cleanup errors
  }

  try {
    window.location.reload();
  } catch {
    window.location.assign('/');
  }
}

export function isNotFoundProxyMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes('page could not be found') ||
    normalized.includes('not found') ||
    normalized.includes('404')
  );
}
