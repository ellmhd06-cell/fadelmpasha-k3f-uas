import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock, Mail, RefreshCw, Search } from 'lucide-react';
import loginOfficeHero from '../../assets/images/login_office_architecture_1794971297485.jpg';
import { useAuth } from '../../contexts/AuthContext';
import type { EmploymentStatus, UserRole } from '../../shared/types';
import { getRoleLabel } from '../../utils/formatters';
import { clearAppCacheAndReload } from '../../utils/pwaRecovery';
import { Avatar } from '../common/Avatar';
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
  avatarUrl?: string;
  role: UserRole;
  employmentStatus: EmploymentStatus;
}

const ROLE_BUTTONS: RoleQuickOption[] = [
  { label: 'HR Admin', email: 'hr.admin@karyaflow.id' },
  { label: 'Manajemen', email: 'manajemen@karyaflow.id' },
  { label: 'Supervisor', email: 'supervisor@karyaflow.id' },
  { label: 'Karyawan', email: 'karyawan@karyaflow.id' },
];

const CORE_FALLBACK_ACCOUNTS: DirectoryDemoAccount[] = [
  {
    id: -1,
    employeeCode: 'KF-001',
    fullName: 'Ratna Pratiwi',
    email: 'hr.admin@karyaflow.id',
    jobTitle: 'Head of People Operations',
    departmentName: 'Human Resources & People Ops',
    avatarUrl: '/src/assets/images/avatar_hr_director_1794971297186.jpg',
    role: 'hr_admin',
    employmentStatus: 'active',
  },
  {
    id: -2,
    employeeCode: 'KF-000',
    fullName: 'Hendra Gunawan',
    email: 'manajemen@karyaflow.id',
    jobTitle: 'VP of Corporate Operations',
    departmentName: 'Operations & Management',
    avatarUrl: '/src/assets/images/avatar_vp_operations_1795591348457.jpg',
    role: 'management',
    employmentStatus: 'active',
  },
  {
    id: -3,
    employeeCode: 'KF-002',
    fullName: 'Budi Santoso',
    email: 'supervisor@karyaflow.id',
    jobTitle: 'Engineering Manager',
    departmentName: 'Technology & Engineering',
    avatarUrl: '/src/assets/images/avatar_tech_supervisor_1794971297687.jpg',
    role: 'supervisor',
    employmentStatus: 'active',
  },
  {
    id: -4,
    employeeCode: 'KF-003',
    fullName: 'Nadia Kusuma',
    email: 'karyawan@karyaflow.id',
    jobTitle: 'Senior Product Designer',
    departmentName: 'Technology & Engineering',
    avatarUrl: '/src/assets/images/avatar_staff_employee_1794971297453.jpg',
    role: 'employee',
    employmentStatus: 'active',
  },
];

export const LoginView: React.FC = () => {
  const { signInWithDemo, authError, authNeedsCacheRecovery, submitting, viewMode, setViewMode } =
    useAuth();
  const [email, setEmail] = useState(ROLE_BUTTONS[0].email);
  const [password, setPassword] = useState('demo123');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [directoryAccounts, setDirectoryAccounts] = useState<DirectoryDemoAccount[]>(
    CORE_FALLBACK_ACCOUNTS,
  );
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryWarning, setDirectoryWarning] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    setDirectoryWarning(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/auth/demo-accounts', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setDirectoryAccounts(data);
      } else {
        setDirectoryAccounts(CORE_FALLBACK_ACCOUNTS);
      }
    } catch {
      setDirectoryWarning(true);
      setDirectoryAccounts((prev) => (prev.length > 0 ? prev : CORE_FALLBACK_ACCOUNTS));
    } finally {
      clearTimeout(timeoutId);
      setLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const filteredDirectory = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return directoryAccounts;
    return directoryAccounts.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeCode.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q),
    );
  }, [directoryAccounts, employeeSearch]);

  const selectedAccount = useMemo(
    () =>
      directoryAccounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase()) ?? null,
    [directoryAccounts, email],
  );

  const selectedDirectoryEmail = selectedAccount ? selectedAccount.email : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
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
        <div className="max-w-md w-full mx-auto space-y-5">
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

          {/* 4 Concise Role Buttons + Search + Employee Directory Dropdown */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Pilih Peran Cepat
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLE_BUTTONS.map((roleOpt) => {
                  const selected = email.trim().toLowerCase() === roleOpt.email;
                  return (
                    <button
                      key={roleOpt.email}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setEmail(roleOpt.email);
                        setPassword('demo123');
                      }}
                      className={`min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="demo-employee-select"
                  className="block text-xs font-medium text-slate-600"
                >
                  Pilih Karyawan ({filteredDirectory.length})
                </label>
                {directoryWarning && (
                  <button
                    type="button"
                    onClick={loadDirectory}
                    disabled={loadingDirectory}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Muat Ulang</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => {
                    const nextQ = e.target.value;
                    setEmployeeSearch(nextQ);
                    const qLower = nextQ.trim().toLowerCase();
                    if (qLower) {
                      const matches = directoryAccounts.filter(
                        (emp) =>
                          emp.fullName.toLowerCase().includes(qLower) ||
                          emp.employeeCode.toLowerCase().includes(qLower) ||
                          emp.email.toLowerCase().includes(qLower) ||
                          emp.jobTitle.toLowerCase().includes(qLower),
                      );
                      if (matches.length === 1) {
                        setEmail(matches[0].email);
                        setPassword('demo123');
                      }
                    }
                  }}
                  placeholder="Cari nama, NIP, atau jabatan..."
                  aria-label="Cari karyawan"
                  className="w-full min-h-[38px] pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

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
                <option value="">
                  {filteredDirectory.length === 0
                    ? '— Tidak ada karyawan yang cocok —'
                    : '— Pilih karyawan dari daftar —'}
                </option>
                {filteredDirectory.map((emp) => (
                  <option key={emp.id} value={emp.email}>
                    {emp.employeeCode} — {emp.fullName} ({getRoleLabel(emp.role)})
                  </option>
                ))}
              </select>

              {selectedAccount && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <Avatar
                    name={selectedAccount.fullName}
                    src={selectedAccount.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {selectedAccount.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {selectedAccount.employeeCode} · {selectedAccount.jobTitle}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-blue-700 shrink-0">
                    {getRoleLabel(selectedAccount.role)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Simplified Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100/60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Muat Ulang & Bersihkan Cache</span>
                  </button>
                )}
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
              disabled={submitting}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              <span>{submitting ? 'Memproses...' : 'Masuk'}</span>
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
