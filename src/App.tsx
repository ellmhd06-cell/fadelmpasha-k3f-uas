import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { BackofficePortal } from './components/backoffice/BackofficePortal';
import { EmployeePortal } from './components/employee/EmployeePortal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

function AppRouter() {
  const { session, loading, portalMode, viewMode } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <img src="/icon.svg" alt="KaryaFlow" className="w-11 h-11 rounded-xl mb-4" />
        <p className="font-display text-sm font-semibold text-slate-900">
          Menyiapkan ruang kerja KaryaFlow...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Memverifikasi hak akses dan sinkronisasi database terpusat
        </p>
      </div>
    );
  }

  if (!session) {
    return <LoginView />;
  }

  if (viewMode === 'desktop' && portalMode === 'backoffice' && session.permissions.canAccessBackoffice) {
    return <BackofficePortal />;
  }

  return <EmployeePortal />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppRouter />
        <OfflineIndicator />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
