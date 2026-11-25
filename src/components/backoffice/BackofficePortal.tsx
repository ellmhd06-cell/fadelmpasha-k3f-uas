import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Banknote,
  Building2,
  CalendarCheck,
  Clock,
  FileBarChart2,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { apiRequest } from '../../lib/apiClient';
import type {
  AnnouncementRecord,
  AttendanceRecord,
  AuditLogRecord,
  DashboardSummary,
  DepartmentRecord,
  EmployeeRecord,
  LeaveRequestRecord,
  NotificationRecord,
  OfficeLocationRecord,
  OvertimeRequestRecord,
  PayrollRecordItem,
  PerformanceReviewRecord,
  WorkShiftRecord,
} from '../../shared/types';
import {
  formatCurrencyIDR,
  formatDateID,
  formatMinutesToDuration,
  formatTimeWIB,
  getAttendanceStatusLabel,
  getEmploymentStatusLabel,
  getLeaveStatusLabel,
  getRoleLabel,
  getTodayISOJakarta,
} from '../../utils/formatters';
import { Avatar } from '../common/Avatar';
import { NotificationCenter } from '../common/NotificationCenter';
import { StatusText, type SemanticTone } from '../common/StatusText';
import { ViewModeToggle } from '../common/ViewModeToggle';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState, ErrorBanner, LoadingSkeleton, SuccessToast } from '../ui/FeedbackStates';
import { DashboardAnalytics } from './DashboardAnalytics';
import { EmployeeFormDrawer } from './EmployeeFormDrawer';
import { LeaveReviewModal } from './LeaveReviewModal';
import { OrganizationPanel } from './OrganizationPanel';
import { PayrollPanel } from './PayrollPanel';
import { PerformancePanel } from './PerformancePanel';
import { AnnouncementsPanel, ReportingPanel } from './ReportingAndAnnouncementsPanel';

type BackofficeSection =
  | 'overview'
  | 'employees'
  | 'attendance'
  | 'approvals'
  | 'payroll'
  | 'performance'
  | 'organization'
  | 'announcements'
  | 'reports';

interface MasterDataResponse {
  departments: DepartmentRecord[];
  workShifts: WorkShiftRecord[];
  officeLocations: OfficeLocationRecord[];
}

function mapLeaveTone(status: LeaveRequestRecord['status']): SemanticTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending_supervisor' || status === 'pending_hr') return 'warning';
  return 'neutral';
}

function mapOvertimeTone(status: OvertimeRequestRecord['status']): SemanticTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function getOvertimeStatusLabel(status: OvertimeRequestRecord['status']): string {
  switch (status) {
    case 'pending_supervisor':
      return 'Menunggu Supervisor';
    case 'pending_hr':
      return 'Menunggu HRD';
    case 'approved':
      return 'Disetujui';
    case 'rejected':
      return 'Ditolak';
  }
}

export const BackofficePortal: React.FC = () => {
  const { session, viewMode, setViewMode, signOut, updateOwnName } = useAuth();
  const permissions = session!.permissions;
  const currentEmployee = session!.employee;

  const [section, setSection] = useState<BackofficeSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{
    url: string;
    type: 'CLOCK IN' | 'CLOCK OUT';
    employeeName: string;
    workDate: string;
    timeWIB: string;
    reason: string;
  } | null>(null);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [editingOwnName, setEditingOwnName] = useState(false);
  const [ownNameDraft, setOwnNameDraft] = useState('');
  const [savingOwnName, setSavingOwnName] = useState(false);
  const [ownNameError, setOwnNameError] = useState<string | null>(null);
  const [overtimeConfirm, setOvertimeConfirm] = useState<{
    ot: OvertimeRequestRecord;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [overtimeBusy, setOvertimeBusy] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecordItem[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReviewRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [shifts, setShifts] = useState<WorkShiftRecord[]>([]);
  const [locations, setLocations] = useState<OfficeLocationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'active' | 'probation' | 'inactive'>('all');
  const [empDeptFilter, setEmpDeptFilter] = useState<string>('all');

  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>(getTodayISOJakarta());
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceTab, setAttendanceTab] = useState<'logs' | 'overtime'>('logs');

  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Modals / Drawers
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    request: LeaveRequestRecord;
    decision: 'approved' | 'rejected';
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const loadBackofficeData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const scope = permissions.canViewAllAttendance ? 'all' : 'team';
      const [
        sumRes,
        empRes,
        attRes,
        otRes,
        leaveRes,
        payRes,
        perfRes,
        annRes,
        notifRes,
        masterRes,
        auditRes,
      ] = await Promise.all([
        apiRequest<DashboardSummary>('/dashboard/summary'),
        apiRequest<EmployeeRecord[]>('/employees'),
        apiRequest<AttendanceRecord[]>(`/attendance?scope=${scope}`),
        apiRequest<OvertimeRequestRecord[]>(`/overtime?scope=${scope}`),
        apiRequest<LeaveRequestRecord[]>(`/leaves/requests?scope=${scope}`),
        permissions.canManagePayroll
          ? apiRequest<PayrollRecordItem[]>('/payroll')
          : Promise.resolve([] as PayrollRecordItem[]),
        apiRequest<PerformanceReviewRecord[]>('/performance'),
        apiRequest<AnnouncementRecord[]>('/announcements'),
        apiRequest<NotificationRecord[]>('/notifications'),
        apiRequest<MasterDataResponse>('/organization/master'),
        permissions.canManageSettings
          ? apiRequest<AuditLogRecord[]>('/audit-logs')
          : Promise.resolve([] as AuditLogRecord[]),
      ]);

      setSummary(sumRes);
      setEmployees(empRes);
      setAttendance(attRes);
      setOvertimeRequests(otRes);
      setLeaveRequests(leaveRes);
      setPayrollRecords(payRes);
      setPerformanceReviews(perfRes);
      setAnnouncements(annRes);
      setNotifications(notifRes);
      setDepartments(masterRes.departments);
      setShifts(masterRes.workShifts);
      setLocations(masterRes.officeLocations);
      setAuditLogs(auditRes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data Backoffice.');
    } finally {
      setLoading(false);
    }
  }, [permissions.canViewAllAttendance, permissions.canManageSettings, permissions.canManagePayroll]);

  useEffect(() => {
    loadBackofficeData();
  }, [loadBackofficeData]);

  useRealtimeEvents(true, (event) => {
    loadBackofficeData();
    if (event.payload.message) {
      showToast(event.payload.message);
    }
  });

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // Ignore silent read error
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await Promise.all(
      unreadIds.map((id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => null)),
    );
  };

  const handleConfirmOvertimeReview = async () => {
    if (!overtimeConfirm) return;
    try {
      setOvertimeBusy(true);
      await apiRequest(`/overtime/${overtimeConfirm.ot.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: overtimeConfirm.decision,
          reviewNote: overtimeConfirm.decision === 'approved' ? 'Disetujui' : 'Ditolak oleh peninjau',
        }),
      });
      showToast(
        `Pengajuan lembur ${overtimeConfirm.ot.employeeName} berhasil ${
          overtimeConfirm.decision === 'approved' ? 'disetujui' : 'ditolak'
        }.`,
      );
      setOvertimeConfirm(null);
      loadBackofficeData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses lembur.');
    } finally {
      setOvertimeBusy(false);
    }
  };

  const canReviewLeave = (req: LeaveRequestRecord) => {
    if (req.employeeId === currentEmployee.id && currentEmployee.role !== 'super_admin') {
      return false;
    }
    if (currentEmployee.role === 'supervisor') {
      return req.status === 'pending_supervisor';
    }
    return req.status === 'pending_supervisor' || req.status === 'pending_hr';
  };

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees.filter((e) => {
      if (empStatusFilter !== 'all' && e.employmentStatus !== empStatusFilter) return false;
      if (empDeptFilter !== 'all' && String(e.departmentId) !== empDeptFilter) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.jobTitle.toLowerCase().includes(q)
      );
    });
  }, [employees, empSearch, empStatusFilter, empDeptFilter]);

  const filteredAttendance = useMemo(() => {
    const q = attendanceSearch.trim().toLowerCase();
    return attendance.filter((a) => {
      if (attendanceDateFilter && a.workDate !== attendanceDateFilter) return false;
      if (!q) return true;
      return (
        a.employeeName.toLowerCase().includes(q) ||
        a.employeeCode.toLowerCase().includes(q) ||
        (a.departmentName || '').toLowerCase().includes(q)
      );
    });
  }, [attendance, attendanceDateFilter, attendanceSearch]);

  const filteredLeaves = useMemo(() => {
    if (leaveStatusFilter === 'all') return leaveRequests;
    if (leaveStatusFilter === 'pending') {
      return leaveRequests.filter((r) => r.status === 'pending_supervisor' || r.status === 'pending_hr');
    }
    return leaveRequests.filter((r) => r.status === leaveStatusFilter);
  }, [leaveRequests, leaveStatusFilter]);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((r) => r.status === 'pending_supervisor' || r.status === 'pending_hr'),
    [leaveRequests],
  );

  const navItems: {
    id: BackofficeSection;
    label: string;
    Icon: React.FC<{ className?: string }>;
    visible: boolean;
  }[] = [
    { id: 'overview', label: 'Ringkasan', Icon: LayoutDashboard, visible: true },
    { id: 'employees', label: 'Karyawan', Icon: Users, visible: true },
    { id: 'attendance', label: 'Kehadiran & Lembur', Icon: Clock, visible: true },
    { id: 'approvals', label: 'Cuti & Approval', Icon: CalendarCheck, visible: true },
    { id: 'payroll', label: 'Payroll', Icon: Banknote, visible: permissions.canManagePayroll },
    { id: 'performance', label: 'Kinerja (KPI)', Icon: Award, visible: permissions.canManagePerformance },
    { id: 'organization', label: 'Organisasi', Icon: Building2, visible: true },
    { id: 'announcements', label: 'Pengumuman', Icon: Megaphone, visible: true },
    { id: 'reports', label: 'Laporan', Icon: FileBarChart2, visible: true },
  ];

  const sectionTitle = navItems.find((n) => n.id === section)?.label ?? 'Ringkasan';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Fixed Sidebar (256px) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="overflow-y-auto">
          <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="KaryaFlow" className="w-7 h-7 rounded-lg shrink-0" />
              <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                KaryaFlow
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup menu"
              className="lg:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1" aria-label="Menu Backoffice">
            {navItems
              .filter((item) => item.visible)
              .map(({ id, label, Icon }) => {
                const active = section === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSection(id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full min-h-[40px] px-3.5 rounded-lg flex items-center justify-between text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                    </span>
                    {id === 'approvals' && pendingLeaves.length > 0 && (
                      <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                        {pendingLeaves.length}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2.5 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={currentEmployee.fullName} src={currentEmployee.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {currentEmployee.fullName}
                </p>
                <p className="text-xs text-slate-500 truncate">{getRoleLabel(currentEmployee.role)}</p>
              </div>
            </div>
            {!editingOwnName && (
              <button
                type="button"
                onClick={() => {
                  setOwnNameDraft(currentEmployee.fullName);
                  setOwnNameError(null);
                  setEditingOwnName(true);
                }}
                title="Ubah nama akun saya"
                aria-label="Ubah nama akun saya"
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {editingOwnName && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = ownNameDraft.trim();
                if (trimmed.length < 2) {
                  setOwnNameError('Minimal 2 karakter.');
                  return;
                }
                try {
                  setSavingOwnName(true);
                  setOwnNameError(null);
                  await updateOwnName(trimmed);
                  setEditingOwnName(false);
                  showToast('Nama akun Anda berhasil diperbarui.');
                  loadBackofficeData();
                } catch (err) {
                  setOwnNameError(err instanceof Error ? err.message : 'Gagal memperbarui nama.');
                } finally {
                  setSavingOwnName(false);
                }
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2"
            >
              <label
                htmlFor="backoffice-own-name"
                className="block text-[11px] font-medium text-slate-600"
              >
                Ubah Nama Saya
              </label>
              <input
                id="backoffice-own-name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={ownNameDraft}
                onChange={(e) => setOwnNameDraft(e.target.value)}
                className="w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {ownNameError && <p className="text-[11px] text-red-700">{ownNameError}</p>}
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={savingOwnName}
                  className="flex-1 min-h-[30px] rounded-lg bg-blue-700 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingOwnName ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  disabled={savingOwnName}
                  onClick={() => {
                    setEditingOwnName(false);
                    setOwnNameError(null);
                  }}
                  className="min-h-[30px] px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          <ViewModeToggle mode={viewMode} onChange={setViewMode} fullWidth />

          <button
            type="button"
            onClick={() => setConfirmSignOutOpen(true)}
            className="w-full min-h-[38px] px-3 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb Left — Primary Action Right */}
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden min-h-[40px] min-w-[40px] -ml-2 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400">Backoffice</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">{sectionTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            <div className="hidden md:block">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>

            <PWAInstallButton variant="compact" />

            <NotificationCenter
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />

            {permissions.canManageEmployees && (
              <button
                type="button"
                onClick={() => {
                  setEditingEmployee(null);
                  setDrawerOpen(true);
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Tambah Karyawan</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {toastMsg && (
            <div className="no-print">
              <SuccessToast message={toastMsg} onDismiss={() => setToastMsg(null)} />
            </div>
          )}

          {errorMsg && (
            <div className="no-print">
              <ErrorBanner message={errorMsg} onRetry={loadBackofficeData} />
            </div>
          )}

          {/* SECTION 1: OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Ringkasan Operasional SDM
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Pantauan kehadiran, approval, dan payroll terpusat per tanggal{' '}
                  <span className="font-mono tabular-nums">
                    {formatDateID(summary?.workDate ?? getTodayISOJakarta())}
                  </span>
                </p>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Karyawan Aktif</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : (summary?.totalActiveEmployees ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {permissions.canViewAllAttendance ? 'Seluruh perusahaan' : 'Dalam supervisi Anda'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Hadir Hari Ini</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-emerald-700 tabular-nums">
                    {loading ? '—' : (summary?.presentTodayCount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Terlambat: <span className="font-mono tabular-nums">{summary?.lateTodayCount ?? 0}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Menunggu Approval</p>
                  <p className="mt-2 font-mono text-3xl font-bold text-amber-700 tabular-nums">
                    {loading ? '—' : (summary?.pendingApprovalsCount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Cuti hari ini: <span className="font-mono tabular-nums">{summary?.onLeaveTodayCount ?? 0}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-medium text-slate-500">Payroll Bulan Ini</p>
                  <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-blue-700 tabular-nums truncate">
                    {loading
                      ? '—'
                      : permissions.canManagePayroll
                        ? formatCurrencyIDR(summary?.publishedPayrollTotal ?? 0)
                        : `${performanceReviews.length} KPI`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {permissions.canManagePayroll ? 'Total net payroll periode aktif' : 'Evaluasi kinerja tercatat'}
                  </p>
                </div>
              </div>

              {/* Analytics & Charts */}
              {!loading && (
                <DashboardAnalytics
                  employees={employees}
                  departments={departments}
                  attendance={attendance}
                  leaveRequests={leaveRequests}
                />
              )}

              {/* Two-column Operational Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Pending Leave Queue */}
                <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold text-slate-900">
                        Antrean Persetujuan Cuti
                      </h2>
                      <p className="text-xs text-slate-500">Alur berjenjang Supervisor → HRD</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('approvals')}
                      className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {loading ? (
                      <LoadingSkeleton rows={3} />
                    ) : pendingLeaves.length === 0 ? (
                      <EmptyState
                        title="Antrean persetujuan bersih"
                        description="Tidak ada pengajuan cuti atau izin yang menunggu keputusan saat ini."
                      />
                    ) : (
                      pendingLeaves.slice(0, 5).map((req) => (
                        <div key={req.id} className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={req.employeeName} src={req.employeeAvatarUrl} size="md" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {req.employeeName}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {req.leaveTypeName} · {formatDateID(req.startDate)} – {formatDateID(req.endDate)} ({req.totalDays} hari)
                                </p>
                              </div>
                            </div>
                            <StatusText tone={mapLeaveTone(req.status)} label={getLeaveStatusLabel(req.status)} />
                          </div>
                          <p className="text-xs text-slate-600">{req.reason}</p>
                          {canReviewLeave(req) && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setReviewTarget({ request: req, decision: 'approved' })}
                                className="min-h-[36px] px-3.5 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewTarget({ request: req, decision: 'rejected' })}
                                className="min-h-[36px] px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Live Attendance Today */}
                <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold text-slate-900">
                        Aktivitas Presensi Hari Ini
                      </h2>
                      <p className="text-xs text-slate-500">Pembaruan otomatis secara realtime</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('attendance')}
                      className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      Lihat Log
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {loading ? (
                      <div className="p-5 space-y-3">
                        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                        <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                      </div>
                    ) : (
                      (() => {
                        const todayLogs = attendance.filter(
                          (a) => a.workDate === (summary?.workDate ?? getTodayISOJakarta()),
                        );
                        if (todayLogs.length === 0) {
                          return (
                            <div className="p-8 text-center text-sm text-slate-500">
                              Belum ada karyawan yang mencatat kehadiran hari ini.
                            </div>
                          );
                        }
                        return todayLogs.slice(0, 6).map((log) => (
                          <div
                            key={log.id}
                            className="px-5 py-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={log.employeeName} src={log.employeeAvatarUrl} size="sm" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {log.employeeName}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {log.departmentName || 'Umum'}
                                  {log.clockInDistanceMeters !== null
                                    ? ` · ${log.clockInDistanceMeters} m`
                                    : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                                {formatTimeWIB(log.clockInAt)}
                                {log.clockOutAt ? ` – ${formatTimeWIB(log.clockOutAt)}` : ''}
                              </p>
                              <StatusText
                                tone={log.status === 'on_time' ? 'success' : 'warning'}
                                label={getAttendanceStatusLabel(log.status)}
                              />
                            </div>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* SECTION 2: EMPLOYEES DIRECTORY */}
          {section === 'employees' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Direktori Karyawan & Data Induk
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Kelola NIK/NIP, profil lengkap, dokumen, riwayat karier, departemen, dan peran RBAC
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Cari nama, NIP, email, atau jabatan..."
                    className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={empDeptFilter}
                    onChange={(e) => setEmpDeptFilter(e.target.value)}
                    className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                  >
                    <option value="all">Semua Departemen</option>
                    {departments.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'Semua' },
                        { id: 'active', label: 'Aktif' },
                        { id: 'probation', label: 'Percobaan' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEmpStatusFilter(tab.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          empStatusFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-3 px-4">NIP</th>
                        <th className="py-3 px-4">Karyawan</th>
                        <th className="py-3 px-4">Departemen & Divisi</th>
                        <th className="py-3 px-4">Atasan</th>
                        <th className="py-3 px-4">Peran (RBAC)</th>
                        <th className="py-3 px-4">Status</th>
                        {permissions.canManageEmployees && <th className="py-3 px-4 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={permissions.canManageEmployees ? 7 : 6}
                            className="py-10 text-center text-sm text-slate-500"
                          >
                            Tidak ada karyawan yang sesuai dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                              {emp.employeeCode}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={emp.fullName} src={emp.avatarUrl} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate">{emp.fullName}</p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {emp.jobTitle} · {emp.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                              <p>{emp.departmentName || '—'}</p>
                              {emp.divisionName && (
                                <p className="text-[11px] text-slate-500">{emp.divisionName}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {emp.managerName || '—'}
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                              {getRoleLabel(emp.role)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <StatusText
                                tone={
                                  emp.employmentStatus === 'active'
                                    ? 'success'
                                    : emp.employmentStatus === 'probation'
                                      ? 'warning'
                                      : 'neutral'
                                }
                                label={getEmploymentStatusLabel(emp.employmentStatus)}
                              />
                            </td>
                            {permissions.canManageEmployees && (
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmployee(emp);
                                    setDrawerOpen(true);
                                  }}
                                  className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                                >
                                  Ubah / Dokumen
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: ATTENDANCE & OVERTIME MONITORING */}
          {section === 'attendance' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    Monitoring Kehadiran, Geofence & Lembur
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Rekap presensi masuk/pulang, jam kerja, pulang awal, validasi GPS, foto bukti, dan lembur
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => setAttendanceTab('logs')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      attendanceTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Log Presensi ({filteredAttendance.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceTab('overtime')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      attendanceTab === 'overtime' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Pengajuan Lembur ({overtimeRequests.length})
                  </button>
                </div>
              </div>

              {attendanceTab === 'logs' ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={attendanceSearch}
                        onChange={(e) => setAttendanceSearch(e.target.value)}
                        placeholder="Cari nama atau NIP karyawan..."
                        className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="att-date" className="text-xs font-medium text-slate-600">
                        Tanggal:
                      </label>
                      <input
                        id="att-date"
                        type="date"
                        value={attendanceDateFilter}
                        onChange={(e) => setAttendanceDateFilter(e.target.value)}
                        className="min-h-[40px] rounded-lg border border-slate-200 px-3 text-xs font-mono tabular-nums"
                      />
                      {attendanceDateFilter && (
                        <button
                          type="button"
                          onClick={() => setAttendanceDateFilter('')}
                          className="text-xs font-medium text-blue-700 hover:underline px-2 cursor-pointer"
                        >
                          Semua Tanggal
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                            <th className="py-3 px-4">Tanggal</th>
                            <th className="py-3 px-4">Karyawan</th>
                            <th className="py-3 px-4">Masuk / Pulang</th>
                            <th className="py-3 px-4">Jam Kerja</th>
                            <th className="py-3 px-4 text-right">Jarak GPS</th>
                            <th className="py-3 px-4">Foto</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAttendance.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                                Tidak ada catatan presensi pada tanggal yang dipilih.
                              </td>
                            </tr>
                          ) : (
                            filteredAttendance.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                                  {formatDateID(log.workDate)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <Avatar name={log.employeeName} src={log.employeeAvatarUrl} size="sm" />
                                    <div>
                                      <p className="font-medium text-slate-900">{log.employeeName}</p>
                                      <p className="text-xs text-slate-500">
                                        {log.employeeCode} · {log.departmentName || 'Umum'}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-900 tabular-nums whitespace-nowrap">
                                  <strong>{formatTimeWIB(log.clockInAt)}</strong>
                                  <span className="mx-1.5 text-slate-300">–</span>
                                  <span>{log.clockOutAt ? formatTimeWIB(log.clockOutAt) : '—'}</span>
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                                  <p>{formatMinutesToDuration(log.workMinutes)}</p>
                                  {log.earlyLeaveMinutes > 0 && (
                                    <p className="text-[11px] text-amber-700">
                                      Pulang awal {log.earlyLeaveMinutes}m
                                    </p>
                                  )}
                                  {log.overtimeMinutes > 0 && (
                                    <p className="text-[11px] text-emerald-700">
                                      Lembur +{log.overtimeMinutes}m
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right tabular-nums whitespace-nowrap">
                                  <p>{log.clockInDistanceMeters !== null ? `${log.clockInDistanceMeters} m` : '—'}</p>
                                  <p className="text-[11px] text-slate-500">
                                    {log.isWithinGeofence ? 'Dalam Radius' : 'Luar / No GPS'}
                                  </p>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    {log.clockInPhotoUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPhotoPreview({
                                            url: log.clockInPhotoUrl,
                                            type: 'CLOCK IN',
                                            employeeName: log.employeeName,
                                            workDate: log.workDate,
                                            timeWIB: formatTimeWIB(log.clockInAt),
                                            reason: log.clockInReason || log.notes || '',
                                          })
                                        }
                                        className="min-h-[30px] inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap shrink-0 cursor-pointer"
                                      >
                                        <ImageIcon className="w-3 h-3 shrink-0" />
                                        <span>CLOCK IN</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">CLOCK IN: —</span>
                                    )}

                                    {log.clockOutPhotoUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPhotoPreview({
                                            url: log.clockOutPhotoUrl,
                                            type: 'CLOCK OUT',
                                            employeeName: log.employeeName,
                                            workDate: log.workDate,
                                            timeWIB: log.clockOutAt ? formatTimeWIB(log.clockOutAt) : '—',
                                            reason: log.clockOutReason || '',
                                          })
                                        }
                                        className="min-h-[30px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                                      >
                                        <ImageIcon className="w-3 h-3 shrink-0" />
                                        <span>CLOCK OUT</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">CLOCK OUT: —</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <StatusText
                                    tone={log.status === 'on_time' ? 'success' : 'warning'}
                                    label={getAttendanceStatusLabel(log.status)}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {overtimeRequests.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Belum ada pengajuan lembur yang tercatat.
                    </div>
                  ) : (
                    overtimeRequests.map((ot) => (
                      <div
                        key={ot.id}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{ot.employeeName}</p>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-mono text-slate-600 tabular-nums">
                              {formatDateID(ot.workDate)} ({ot.hours} jam)
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <StatusText
                              tone={mapOvertimeTone(ot.status)}
                              label={getOvertimeStatusLabel(ot.status)}
                            />
                          </div>
                          <p className="text-xs text-slate-600">{ot.reason}</p>
                        </div>

                        {(ot.status === 'pending_supervisor' || ot.status === 'pending_hr') &&
                          ot.employeeId !== currentEmployee.id && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setOvertimeConfirm({ ot, decision: 'approved' })}
                                className="min-h-[36px] px-3.5 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setOvertimeConfirm({ ot, decision: 'rejected' })}
                                className="min-h-[36px] px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: LEAVE & APPROVALS (2-STAGE) */}
          {section === 'approvals' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">
                    Pusat Persetujuan Cuti & Izin
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Alur persetujuan 2 tahap (Supervisor → HRD) dengan pemotongan saldo kuota otomatis
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
                  {(
                    [
                      { id: 'pending', label: 'Menunggu' },
                      { id: 'approved', label: 'Disetujui' },
                      { id: 'rejected', label: 'Ditolak' },
                      { id: 'all', label: 'Semua' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLeaveStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        leaveStatusFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {filteredLeaves.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    Tidak ada pengajuan cuti pada kategori ini.
                  </div>
                ) : (
                  filteredLeaves.map((req) => (
                    <div
                      key={req.id}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <Avatar name={req.employeeName} src={req.employeeAvatarUrl} size="md" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{req.employeeName}</p>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">{req.departmentName || 'Umum'}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <StatusText
                              tone={mapLeaveTone(req.status)}
                              label={getLeaveStatusLabel(req.status)}
                            />
                          </div>
                          <p className="text-xs font-medium text-slate-800">
                            {req.leaveTypeName} —{' '}
                            <span className="font-mono tabular-nums">
                              {formatDateID(req.startDate)} s.d. {formatDateID(req.endDate)}
                            </span>{' '}
                            ({req.totalDays} hari)
                          </p>
                          <p className="text-xs text-slate-600">{req.reason}</p>
                          {req.supervisorNote && (
                            <p className="text-xs text-emerald-700">
                              Tahap Supervisor ({req.supervisorReviewerName || 'Atasan'}): {req.supervisorNote}
                            </p>
                          )}
                          {req.reviewNote && (
                            <p className="text-xs text-slate-500">
                              Tahap HRD ({req.reviewerName || 'Peninjau'}): {req.reviewNote}
                            </p>
                          )}
                        </div>
                      </div>

                      {canReviewLeave(req) && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setReviewTarget({ request: req, decision: 'approved' })}
                            className="min-h-[38px] px-4 rounded-lg bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap cursor-pointer"
                          >
                            {req.status === 'pending_supervisor' && currentEmployee.role === 'supervisor'
                              ? 'Setujui (Teruskan HR)'
                              : 'Setujui Final'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewTarget({ request: req, decision: 'rejected' })}
                            className="min-h-[38px] px-4 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SECTION 5: PAYROLL */}
          {section === 'payroll' && permissions.canManagePayroll && (
            <PayrollPanel
              records={payrollRecords}
              canManagePayroll={permissions.canManagePayroll}
              onRefresh={loadBackofficeData}
              onNotify={showToast}
            />
          )}

          {/* SECTION 6: PERFORMANCE KPI */}
          {section === 'performance' && permissions.canManagePerformance && (
            <PerformancePanel
              reviews={performanceReviews}
              employees={employees}
              onRefresh={loadBackofficeData}
              onNotify={showToast}
            />
          )}

          {/* SECTION 7: ORGANIZATION & HIERARCHY */}
          {section === 'organization' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Struktur Organisasi, Geofence & Audit Trail
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Hubungan hierarki atasan-bawahan, departemen, divisi, jabatan, serta lokasi kerja
                </p>
              </div>
              <OrganizationPanel
                departments={departments}
                locations={locations}
                shifts={shifts}
                employees={employees}
                auditLogs={auditLogs}
                canManageSettings={permissions.canManageSettings}
                onRefresh={loadBackofficeData}
                onNotify={showToast}
              />
            </div>
          )}

          {/* SECTION 8: ANNOUNCEMENTS & NOTIFICATIONS */}
          {section === 'announcements' && (
            <AnnouncementsPanel
              announcements={announcements}
              canPublish={permissions.canPublishAnnouncements}
              canRemindAttendance={permissions.canManageEmployees}
              onRefresh={loadBackofficeData}
              onNotify={showToast}
            />
          )}

          {/* SECTION 9: REPORTING & EXPORT */}
          {section === 'reports' && (
            <ReportingPanel
              employees={employees}
              attendance={attendance}
              leaveRequests={leaveRequests}
              payrollRecords={payrollRecords}
              canViewPayroll={permissions.canManagePayroll}
            />
          )}
        </main>
      </div>

      {/* Photo Verification Lightbox */}
      {photoPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Dokumentasi Foto {photoPreview.type}
                </p>
                <p className="text-xs text-slate-500">
                  {photoPreview.employeeName} · {formatDateID(photoPreview.workDate)} ·{' '}
                  <span className="font-mono tabular-nums">{photoPreview.timeWIB} WIB</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                aria-label="Tutup pratinjau foto"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex flex-col items-center gap-3">
              <img
                src={photoPreview.url}
                alt={`Dokumentasi foto ${photoPreview.type} ${photoPreview.employeeName}`}
                className="max-h-96 rounded-xl object-contain"
              />
              <div className="w-full rounded-xl border border-slate-200 bg-white p-3.5 space-y-1 text-left">
                <p className="text-xs font-semibold text-slate-900">
                  Keterangan: {photoPreview.type}
                </p>
                <p className="text-xs text-slate-500">
                  Alasan Presensi {photoPreview.type}:
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {photoPreview.reason || 'Tidak ada alasan tertulis.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <EmployeeFormDrawer
        open={drawerOpen}
        editingEmployee={editingEmployee}
        employees={employees}
        departments={departments}
        shifts={shifts}
        locations={locations}
        onClose={() => setDrawerOpen(false)}
        onSaved={(saved, isNew) => {
          setEmployees((prev) =>
            isNew ? [...prev, saved] : prev.map((e) => (e.id === saved.id ? saved : e)),
          );
          showToast(
            isNew
              ? `Karyawan ${saved.fullName} berhasil ditambahkan.`
              : `Data ${saved.fullName} berhasil diperbarui.`,
          );
          loadBackofficeData();
        }}
      />

      <LeaveReviewModal
        request={reviewTarget?.request ?? null}
        decision={reviewTarget?.decision ?? null}
        onClose={() => setReviewTarget(null)}
        onReviewed={(updated) => {
          setLeaveRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          showToast(
            `Pengajuan ${updated.employeeName} diperbarui (${getLeaveStatusLabel(updated.status)}).`,
          );
          loadBackofficeData();
        }}
      />

      <ConfirmDialog
        open={!!overtimeConfirm}
        title={overtimeConfirm?.decision === 'approved' ? 'Setujui Pengajuan Lembur' : 'Tolak Pengajuan Lembur'}
        description={
          overtimeConfirm
            ? `Konfirmasi ${overtimeConfirm.decision === 'approved' ? 'persetujuan' : 'penolakan'} lembur untuk ${overtimeConfirm.ot.employeeName} (${overtimeConfirm.ot.hours} jam pada ${formatDateID(overtimeConfirm.ot.workDate)}).`
            : ''
        }
        confirmLabel={overtimeConfirm?.decision === 'approved' ? 'Ya, Setujui Lembur' : 'Ya, Tolak Lembur'}
        tone={overtimeConfirm?.decision === 'rejected' ? 'danger' : 'primary'}
        busy={overtimeBusy}
        onConfirm={handleConfirmOvertimeReview}
        onClose={() => setOvertimeConfirm(null)}
      />

      <ConfirmDialog
        open={confirmSignOutOpen}
        title="Keluar dari Sesi Backoffice"
        description="Apakah Anda yakin ingin keluar dari akun demo saat ini? Anda dapat memilih akun demo lain pada halaman login."
        confirmLabel="Ya, Keluar"
        tone="warning"
        onConfirm={signOut}
        onClose={() => setConfirmSignOutOpen(false)}
      />
    </div>
  );
};
