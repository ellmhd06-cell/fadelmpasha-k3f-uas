import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Lock,
  Mail,
  RefreshCw,
} from 'lucide-react';
import loginOfficeHero from '../../assets/images/login_office_architecture_1794971297485.jpg';
import { useAuth } from '../../contexts/AuthContext';
import { clearAppCacheAndReload } from '../../utils/pwaRecovery';
import { ViewModeToggle } from '../common/ViewModeToggle';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface RoleQuickOption {
  label: string;
  subtitle: string;
  email: string;
}

const INSTANT_ROLES: RoleQuickOption[] = [
  { label: 'HR Admin', subtitle: 'Backoffice SDM & Payroll', email: 'hr.admin@karyaflow.id' },
  { label: 'Manajemen', subtitle: 'Ringkasan Eksekutif', email: 'manajemen@karyaflow.id' },
  { label: 'Supervisor', subtitle: 'Persetujuan & Tim', email: 'supervisor@karyaflow.id' },
  { label: 'Karyawan', subtitle: 'Presensi & Pengajuan', email: 'karyawan@karyaflow.id' },
];

export const LoginView: React.FC = () => {
  const {
    signInWithDemo,
    authError,
    authNeedsCacheRecovery,
    clearAuthError,
    submitting,
    viewMode,
    setViewMode,
  } = useAuth();

  const [email, setEmail] = useState(INSTANT_ROLES[0].email);
  const [password, setPassword] = useState('demo123');
  const [activeInstantEmail, setActiveInstantEmail] = useState<string | null>(null);
  const [backendIssue, setBackendIssue] = useState<'none' | 'proxy_redirect' | 'api_404' | 'network'>('none');

  const checkBackendHealth = useCallback(async () => {
    setBackendIssue('none');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'manual',
        signal: controller.signal,
      });
      if (
        response.type === 'opaqueredirect' ||
        response.status === 301 ||
        response.status === 302 ||
        response.status === 307 ||
        response.status === 308
      ) {
        setBackendIssue('proxy_redirect');
        return;
      }
      const contentType = response.headers.get('content-type') || '';
      if (response.status === 404 || !contentType.includes('application/json')) {
        setBackendIssue('api_404');
        return;
      }
      if (!response.ok) {
        setBackendIssue('network');
      }
    } catch {
      setBackendIssue('network');
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    void checkBackendHealth();
  }, [checkBackendHealth]);

  const handleInstantLogin = async (roleOpt: RoleQuickOption) => {
    if (submitting) return;
    clearAuthError();
    setEmail(roleOpt.email);
    setPassword('demo123');
    setActiveInstantEmail(roleOpt.email);
    try {
      await signInWithDemo(roleOpt.email, 'demo123');
    } finally {
      setActiveInstantEmail(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setActiveInstantEmail(null);
    await signInWithDemo(email.trim().toLowerCase(), password);
  };

  const showDesktopSplit = viewMode === 'desktop';

  return (
    <div
      className={
        showDesktopSplit
          ? 'min-h-screen bg-white lg:grid lg:grid-cols-12 lg:items-stretch'
          : 'min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8'
      }
    >
      <div
        className={
          showDesktopSplit
            ? 'lg:col-span-6 xl:col-span-5 flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12'
            : 'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs'
        }
      >
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/icon.svg"
              alt="Logo KaryaFlow"
              className="w-11 h-11 rounded-xl shrink-0"
            />
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-900">
              KaryaFlow HRM
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Portal HR Enterprise &amp; Presensi Karyawan
            </p>
          </div>

          {/* Desktop / Mobile View Mode Toggle */}
          <ViewModeToggle mode={viewMode} onChange={setViewMode} fullWidth />

          {/* Backend Health Recovery Banner (only shown if /api/health fails) */}
          {backendIssue !== 'none' && !authError && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {backendIssue === 'proxy_redirect'
                    ? 'Sesi akses halaman perlu disegarkan agar terhubung ke server.'
                    : backendIssue === 'api_404'
                      ? 'Server API belum aktif di tautan ini (404). Jika membuka Shared App URL, terbitkan ulang lewat tombol Share App lalu bersihkan cache.'
                      : 'Koneksi ke server sedang terganggu. Coba muat ulang halaman.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void clearAppCacheAndReload();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 shrink-0" />
                  <span>Muat Ulang &amp; Bersihkan Cache</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void checkBackendHealth();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:underline px-1.5 py-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Coba Lagi</span>
                </button>
              </div>
            </div>
          )}

          {/* One-Click Instant Role Access */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Masuk Instan Sesuai Peran
              </span>
              <span className="text-[11px] text-slate-500">
                Klik untuk langsung masuk
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {INSTANT_ROLES.map((roleOpt) => {
                const isBusyThis = submitting && activeInstantEmail === roleOpt.email;
                const isSelected = email.trim().toLowerCase() === roleOpt.email;
                return (
                  <button
                    key={roleOpt.email}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      void handleInstantLogin(roleOpt);
                    }}
                    className={`min-h-[58px] rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-between gap-2 ${
                      isBusyThis || isSelected
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                        : 'border-slate-200 bg-slate-50/70 text-slate-900 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {isBusyThis ? 'Masuk...' : roleOpt.label}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {roleOpt.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auth Error Feedback */}
          {authError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 space-y-2.5"
            >
              <p>{authError}</p>
              {authNeedsCacheRecovery && (
                <button
                  type="button"
                  onClick={() => {
                    void clearAppCacheAndReload();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Muat Ulang &amp; Bersihkan Cache</span>
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
              Atau masuk manual
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Minimal Manual Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="demo-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    clearAuthError();
                    setEmail(e.target.value);
                  }}
                  placeholder="nama@karyaflow.id"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="demo-password" className="block text-xs font-medium text-slate-700">
                  Kata Sandi
                </label>
                <span className="font-mono text-[11px] text-slate-500">demo123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="demo-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    clearAuthError();
                    setPassword(e.target.value);
                  }}
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <span>{submitting && !activeInstantEmail ? 'Memproses...' : 'Masuk'}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">KaryaFlow Enterprise HRM</span>
            <PWAInstallButton variant="compact" />
          </div>
        </div>
      </div>

      {/* Desktop-only Office Hero Photo (hidden on mobile screens and omitted in Mobile Mode) */}
      {showDesktopSplit && (
        <div className="hidden lg:block lg:col-span-6 xl:col-span-7 relative bg-slate-100 overflow-hidden">
          <img
            src={loginOfficeHero}
            alt="Interior ruang kerja modern KaryaFlow"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 max-w-xl text-white">
            <p className="text-xs font-medium text-blue-200">
              8 Modul HRM Terintegrasi
            </p>
            <p className="mt-2 font-display text-2xl font-semibold leading-snug text-balance">
              Employee, Attendance GPS, Leave 2-Tahap, Payroll, Organisasi, Kinerja KPI, Pengumuman, dan Reporting dalam satu platform.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
