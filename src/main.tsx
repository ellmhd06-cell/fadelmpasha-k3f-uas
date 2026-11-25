import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { cleanupLegacyServiceWorkers, clearAppCacheAndReload } from './utils/pwaRecovery';

if (typeof window !== 'undefined') {
  void cleanupLegacyServiceWorkers();

  window.addEventListener('vite:preloadError', () => {
    try {
      const flag = 'karyaflow_preload_recovered';
      if (!window.sessionStorage.getItem(flag)) {
        window.sessionStorage.setItem(flag, '1');
        void clearAppCacheAndReload();
      }
    } catch {
      void clearAppCacheAndReload();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
