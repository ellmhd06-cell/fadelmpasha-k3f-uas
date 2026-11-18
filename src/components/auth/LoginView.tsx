import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import loginOfficeHero from '../../assets/images/login_office_architecture_1794971297485.jpg';
import { useAuth } from '../../contexts/AuthContext';
import type { EmploymentStatus, UserRole } from '../../shared/types';
import { getRoleLabel } from '../../utils/formatters';
import { ViewModeToggle } from '../common/ViewModeToggle';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface RoleQuickOption {
  label: string;
  email: string;
}

interface DirectoryDemoAccount {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  jobTitle: string;
  departmentName: string | null;
  role: UserRole;
  employmentStatus: EmploymentStatus;
}

const ROLE_BUTTONS: RoleQuickOption[] = [
  { label: 'HR Admin', email: 'hr.admin@karyaflow.id' },
  { label: 'Manajemen', email: 'manajemen@karyaflow.id' },
  { label: 'Supervisor', email: 'supervisor@karyaflow.id' },
  { label: 'Karyawan', email: 'karyawan@karyaflow.id' },
];

export const LoginView: React.FC = () => {
  const { signInWithDemo, authError, loading, viewMode, setViewMode } = useAuth();
  const [email, setEmail] = useState(ROLE_BUTTONS[0].email);
  const [password, setPassword] = useState('demo123');
  const [directoryAccounts, setDirectoryAccounts] = useState<DirectoryDemoAccount[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/demo-accounts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) {
          setDirectoryAccounts(data);
        }
      })
      .catch(() => {
        // Fallback smoothly to core role buttons if offline
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithDemo(email.trim(), password);
  };

  const selectedDirectoryEmail = directoryAccounts.some(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  )
    ? directoryAccounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())!.email
    : '';

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
          {/* Centered Logo & Brand Header */}
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
              Portal HR Enterprise & Presensi Karyawan
            </p>
          </div>

          {/* Desktop / Mobile View Mode Toggle */}
          <ViewModeToggle mode={viewMode} onChange={setViewMode} fullWidth />

          {/* 4 Concise Role Buttons + Employee Directory Dropdown */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Pilih Peran Demo
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLE_BUTTONS.map((roleOpt) => {
                  const selected = email.trim().toLowerCase() === roleOpt.email;
                  return (
                    <button
                      key={roleOpt.email}
                      type="button"
                      onClick={() => {
                        setEmail(roleOpt.email);
                        setPassword('demo123');
                      }}
                      className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-blue-700 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {roleOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="demo-employee-select"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Atau Pilih Karyawan Terdaftar / Baru ({directoryAccounts.length})
              </label>
              <select
                id="demo-employee-select"
                value={selectedDirectoryEmail}
                onChange={(e) => {
                  if (e.target.value) {
                    setEmail(e.target.value);
                    setPassword('demo123');
                  }
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">— Pilih dari direktori karyawan —</option>
                {directoryAccounts.map((emp) => (
                  <option key={emp.id} value={emp.email}>
                    {emp.employeeCode} — {emp.fullName} ({getRoleLabel(emp.role)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Simplified Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
              >
                {authError}
              </div>
            )}

            <div>
              <label htmlFor="demo-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email Akun
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="demo-password" className="block text-xs font-medium text-slate-700">
                  Kata Sandi Demo
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'Memproses...' : 'Masuk'}</span>
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
