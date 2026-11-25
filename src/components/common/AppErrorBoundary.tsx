import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clearAppCacheAndReload } from '../../utils/pwaRecovery';

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const msg =
      error instanceof Error && error.message
        ? error.message
        : 'Terjadi kendala saat memuat halaman aplikasi.';
    return {
      hasError: true,
      errorMessage: msg,
    };
  }

  override componentDidCatch(error: unknown) {
    console.error('Uncaught application error:', error);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs text-center">
          <div className="w-11 h-11 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h1 className="mt-4 font-display text-lg font-bold text-slate-900">
            Halaman Tidak Dapat Dimuat
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Aplikasi mengalami gangguan tampilan atau file cache lama yang tidak sinkron. Anda dapat memuat ulang halaman atau membersihkan cache aplikasi.
          </p>
          {this.state.errorMessage && (
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 break-words">
              {this.state.errorMessage}
            </p>
          )}
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>Coba Muat Ulang</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void clearAppCacheAndReload();
              }}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Bersihkan Cache & Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
