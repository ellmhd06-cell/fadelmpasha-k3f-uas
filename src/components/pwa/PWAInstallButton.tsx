import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-medium transition-colors hover:bg-blue-100 whitespace-nowrap shrink-0 cursor-pointer ${
          variant === 'full' ? 'w-full min-h-[44px] px-4 py-2.5 text-sm' : 'min-h-[40px] px-3 py-1.5 text-xs'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer ${
            variant === 'full' ? 'w-full min-h-[44px] px-4 py-2.5 text-sm' : 'min-h-[40px] px-3 py-1.5 text-xs'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Pasang KaryaFlow di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan"
                  className="min-h-[40px] min-w-[40px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-blue-700 mt-0.5">01</span>
                  <span>
                    Ketuk ikon <strong className="inline-flex items-center gap-1 text-slate-900"><Share className="w-3.5 h-3.5" /> Bagikan (Share)</strong> di bilah Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-blue-700 mt-0.5">02</span>
                  <span>
                    Gulir ke bawah lalu pilih <strong className="text-slate-900">Tambah ke Layar Utama</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
