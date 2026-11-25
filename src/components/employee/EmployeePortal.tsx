import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Banknote,
  Bell,
  CalendarDays,
  Camera,
  Clock,
  FileText,
  Home,
  Image as ImageIcon,
  LogOut,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeEvents } from '../../hooks/useRealtimeEvents';
import { apiRequest } from '../../lib/apiClient';
import type {
  AnnouncementRecord,
  AttendanceRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeRecord,
  NotificationRecord,
  OvertimeRequestRecord,
  PayrollRecordItem,
  PerformanceReviewRecord,
} from '../../shared/types';
import { exportReportToPdfPrint } from '../../utils/exportReports';
import {
  formatCurrencyIDR,
  formatDateID,
  formatLongDateToday,
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
import { CameraSelfieModal, compressImageFileToDataUrl } from './CameraSelfieModal';
import { LeaveRequestModal } from './LeaveRequestModal';

type EmployeeTab = 'home' | 'attendance' | 'leave' | 'profile';

function getBrowserCoordinates(): Promise<{ latitude: number | null; longitude: number | null; geoMessage?: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, geoMessage: 'Perangkat tidak mendukung GPS.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        resolve({
          latitude: null,
          longitude: null,
          geoMessage: 'Izin lokasi tidak aktif — presensi dicatat tanpa koordinat GPS.',
        });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  });
}

function mapLeaveTone(status: LeaveRequestRecord['status']): SemanticTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending_supervisor' || status === 'pending_hr') return 'warning';
  return 'neutral';
}

export const EmployeePortal: React.FC = () => {
  const { session, viewMode, setViewMode, signOut, updateOwnName } = useAuth();
  const isMobileView = viewMode === 'mobile';
  const [activeTab, setActiveTab] = useState<EmployeeTab>('home');
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [overtimeList, setOvertimeList] = useState<OvertimeRequestRecord[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [payrollList, setPayrollList] = useState<PayrollRecordItem[]>([]);
  const [performanceList, setPerformanceList] = useState<PerformanceReviewRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [clockNotes, setClockNotes] = useState('');
  const [clockPhotoDataUrl, setClockPhotoDataUrl] = useState<string>('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [clockBusy, setClockBusy] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [confirmClockOutOpen, setConfirmClockOutOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [attendancePhotoPreview, setAttendancePhotoPreview] = useState<{
    url: string;
    type: 'CLOCK IN' | 'CLOCK OUT';
    workDate: string;
    timeWIB: string;
    reason: string;
  } | null>(null);

  // Self-service name edit (logged-in account only)
  const [editingOwnName, setEditingOwnName] = useState(false);
  const [ownNameDraft, setOwnNameDraft] = useState('');
  const [savingOwnName, setSavingOwnName] = useState(false);
  const [ownNameError, setOwnNameError] = useState<string | null>(null);

  // Overtime request form
  const [otOpen, setOtOpen] = useState(false);
  const [otDate, setOtDate] = useState(getTodayISOJakarta());
  const [otHours, setOtHours] = useState('2');
  const [otReason, setOtReason] = useState('');
  const [otError, setOtError] = useState<string | null>(null);
  const [otBusy, setOtBusy] = useState(false);

  const employee = session!.employee;
  const todayISO = getTodayISOJakarta();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const loadEmployeeData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [att, ot, bal, reqs, types, pays, perfs, anns, notifs] = await Promise.all([
        apiRequest<AttendanceRecord[]>('/attendance?scope=mine'),
        apiRequest<OvertimeRequestRecord[]>('/overtime?scope=mine'),
        apiRequest<LeaveBalanceRecord[]>('/leaves/balances'),
        apiRequest<LeaveRequestRecord[]>('/leaves/requests?scope=mine'),
        apiRequest<LeaveTypeRecord[]>('/leaves/types'),
        apiRequest<PayrollRecordItem[]>('/payroll'),
        apiRequest<PerformanceReviewRecord[]>('/performance'),
        apiRequest<AnnouncementRecord[]>('/announcements'),
        apiRequest<NotificationRecord[]>('/notifications'),
      ]);
      setAttendanceList(att);
      setOvertimeList(ot);
      setLeaveBalances(bal);
      setLeaveRequests(reqs);
      setLeaveTypes(types);
      setPayrollList(pays);
      setPerformanceList(perfs);
      setAnnouncements(anns);
      setNotifications(notifs);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data karyawan.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadEmployeeData();
  }, [loadEmployeeData]);

  useRealtimeEvents(true, (event) => {
    if (
      event.payload.employeeId === employee.id ||
      event.type === 'leave:reviewed' ||
      event.type === 'employee:updated' ||
      event.type === 'announcement:published' ||
      event.type === 'payroll:published' ||
      event.type === 'performance:updated'
    ) {
      loadEmployeeData();
      if (event.payload.message) {
        showToast(event.payload.message);
      }
    }
  });

  const todayAttendance = useMemo(
    () => attendanceList.find((item) => item.workDate === todayISO) ?? null,
    [attendanceList, todayISO],
  );

  const annualBalance = useMemo(
    () => leaveBalances.find((b) => b.leaveTypeCode === 'ANNUAL') ?? leaveBalances[0] ?? null,
    [leaveBalances],
  );

  const unreadNotifs = useMemo(() => notifications.filter((n) => !n.isRead), [notifications]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setClockPhotoDataUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses foto.');
    }
  };

  const handleClockAction = async (mode: 'in' | 'out') => {
    const trimmedReason = clockNotes.trim();
    if (trimmedReason.length < 3) {
      setErrorMsg(
        mode === 'in'
          ? 'Alasan presensi CLOCK IN wajib diisi minimal 3 karakter sebelum mencatat masuk.'
          : 'Alasan presensi CLOCK OUT wajib diisi minimal 3 karakter sebelum mencatat pulang.',
      );
      return;
    }

    if (!clockPhotoDataUrl) {
      setErrorMsg(
        mode === 'in'
          ? 'Foto selfie CLOCK IN wajib diambil sebelum mencatat presensi masuk.'
          : 'Foto selfie CLOCK OUT wajib diambil sebelum mencatat presensi pulang.',
      );
      return;
    }

    try {
      setClockBusy(true);
      setErrorMsg(null);
      const coords = await getBrowserCoordinates();
      const endpoint = mode === 'in' ? '/attendance/clock-in' : '/attendance/clock-out';
      const payload =
        mode === 'in'
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
              clockInPhotoUrl: clockPhotoDataUrl,
              clockInReason: trimmedReason,
              notes: trimmedReason,
            }
          : {
              latitude: coords.latitude,
              longitude: coords.longitude,
              clockOutPhotoUrl: clockPhotoDataUrl,
              clockOutReason: trimmedReason,
              notes: trimmedReason,
            };

      const recorded = await apiRequest<AttendanceRecord>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setClockNotes('');
      setClockPhotoDataUrl('');
      setAttendanceList((prev) => {
        const filtered = prev.filter((p) => p.id !== recorded.id);
        return [recorded, ...filtered];
      });
      const note = coords.geoMessage ? ` (${coords.geoMessage})` : '';
      showToast(
        mode === 'in'
          ? `Presensi masuk (CLOCK IN) tercatat pukul ${formatTimeWIB(recorded.clockInAt)} WIB${note}`
          : `Presensi pulang (CLOCK OUT) tercatat pukul ${formatTimeWIB(recorded.clockOutAt)} WIB${note}`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mencatat kehadiran.');
    } finally {
      setClockBusy(false);
    }
  };

  const handleSubmitOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = otReason.trim();
    if (trimmedReason.length < 5) {
      setOtError('Alasan atau catatan pengajuan lembur wajib diisi minimal 5 karakter.');
      return;
    }
    try {
      setOtBusy(true);
      setOtError(null);
      setErrorMsg(null);
      const created = await apiRequest<OvertimeRequestRecord>('/overtime', {
        method: 'POST',
        body: JSON.stringify({
          workDate: otDate,
          hours: Number(otHours),
          reason: trimmedReason,
        }),
      });
      setOvertimeList((prev) => [created, ...prev]);
      setOtReason('');
      setOtError(null);
      setOtOpen(false);
      showToast('Pengajuan lembur berhasil dikirim untuk persetujuan.');
    } catch (err) {
      setOtError(err instanceof Error ? err.message : 'Gagal mengirim pengajuan lembur.');
    } finally {
      setOtBusy(false);
    }
  };

  const handleMarkNotifRead = async (id: number) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // ignore
    }
  };

  const navItems: { id: EmployeeTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Beranda', Icon: Home },
    { id: 'attendance', label: 'Presensi', Icon: Clock },
    { id: 'leave', label: 'Cuti', Icon: CalendarDays },
    { id: 'profile', label: 'Profil', Icon: UserIcon },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 ${isMobileView ? 'pb-20' : 'pb-20 md:pb-10'}`}>
      {/* Sticky Top App Bar (compact 52px to respect <=15% mobile sticky cap) */}
      <header className="sticky top-0 z-30 h-13 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 no-print">
        <div
          className={`${
            isMobileView ? 'max-w-lg' : 'max-w-5xl'
          } mx-auto h-full flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/icon.svg" alt="KaryaFlow" className="w-7 h-7 rounded-lg shrink-0" />
            <span className="font-display text-base font-bold text-slate-900 whitespace-nowrap">
              KaryaFlow
            </span>
          </div>

          <nav
            className={`${
              isMobileView ? 'hidden' : 'hidden md:flex'
            } items-center gap-6 text-sm font-medium`}
          >
            {navItems.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === id
                    ? 'text-blue-700 font-semibold border-b-2 border-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            <NotificationCenter
              notifications={notifications}
              onMarkRead={handleMarkNotifRead}
              onMarkAllRead={async () => {
                const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                await Promise.all(unreadIds.map((id) => handleMarkNotifRead(id)));
              }}
            />
            <PWAInstallButton variant="compact" />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        className={`${
          isMobileView ? 'max-w-lg' : 'max-w-5xl'
        } mx-auto px-4 sm:px-6 pt-5 sm:pt-8 space-y-6`}
      >
        {toastMsg && (
          <div className="no-print">
            <SuccessToast message={toastMsg} onDismiss={() => setToastMsg(null)} />
          </div>
        )}

        {errorMsg && (
          <div className="no-print">
            <ErrorBanner message={errorMsg} onRetry={loadEmployeeData} />
          </div>
        )}

        {/* TAB 1: BERANDA */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">{formatLongDateToday()}</p>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  Halo, {employee.fullName.split(' ')[0]}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {employee.jobTitle} · {employee.departmentName || 'Umum'}
                </p>
              </div>
              <Avatar name={employee.fullName} src={employee.avatarUrl} size="lg" />
            </div>

            <div
              className={`grid grid-cols-1 ${
                isMobileView ? '' : 'lg:grid-cols-12'
              } gap-5 items-stretch`}
            >
              {/* Primary Attendance Action Card */}
              <section
                className={`${
                  isMobileView ? '' : 'lg:col-span-7'
                } rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Presensi Hari Ini
                    </h2>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      Shift {employee.shiftStartTime || '08:30'} – {employee.shiftEndTime || '17:30'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500">Jam Masuk</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {todayAttendance ? formatTimeWIB(todayAttendance.clockInAt) : '--:--'}
                      </p>
                      {todayAttendance && (
                        <div className="mt-1">
                          <StatusText
                            tone={todayAttendance.status === 'on_time' ? 'success' : 'warning'}
                            label={getAttendanceStatusLabel(todayAttendance.status)}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Jam Pulang</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {todayAttendance?.clockOutAt
                          ? formatTimeWIB(todayAttendance.clockOutAt)
                          : '--:--'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {todayAttendance?.clockOutAt
                          ? `Durasi ${formatMinutesToDuration(todayAttendance.workMinutes)}`
                          : todayAttendance
                            ? 'Sedang bekerja'
                            : 'Belum check-in'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 text-xs text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Lokasi tugas:{' '}
                      <strong className="text-slate-900">{employee.officeLocationName || 'Kantor Pusat'}</strong>
                      {todayAttendance?.clockInDistanceMeters !== null &&
                        todayAttendance?.clockInDistanceMeters !== undefined && (
                          <>
                            {' '}
                            · Jarak tercatat{' '}
                            <span className="font-mono tabular-nums font-medium">
                              {todayAttendance.clockInDistanceMeters} m
                            </span>
                          </>
                        )}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(!todayAttendance || !todayAttendance.clockOutAt) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="clock-reason-input"
                          className="text-xs font-semibold text-slate-700"
                        >
                          {!todayAttendance
                            ? 'Alasan / Catatan Presensi CLOCK IN (Wajib)'
                            : 'Alasan / Catatan Presensi CLOCK OUT (Wajib)'}
                        </label>
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            clockNotes.trim().length >= 3 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {clockNotes.trim().length}/3 min. kar
                        </span>
                      </div>
                      <input
                        id="clock-reason-input"
                        type="text"
                        required
                        minLength={3}
                        maxLength={240}
                        value={clockNotes}
                        onChange={(e) => setClockNotes(e.target.value)}
                        placeholder={
                          !todayAttendance
                            ? 'Contoh: Hadir WFO di Kantor SCBD / Kunjungan klien'
                            : 'Contoh: Pekerjaan shift selesai & laporan terkirim'
                        }
                        className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  )}

                  {(!todayAttendance || !todayAttendance.clockOutAt) && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {!todayAttendance
                            ? 'Foto Selfie CLOCK IN (Wajib)'
                            : 'Foto Selfie CLOCK OUT (Wajib)'}
                        </span>
                        <span className="text-[11px] font-medium text-amber-700">
                          {clockPhotoDataUrl ? 'Foto siap dikirim' : 'Belum diambil'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCameraModalOpen(true)}
                          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                        >
                          <Camera className="w-4 h-4 shrink-0" />
                          <span>
                            {clockPhotoDataUrl
                              ? !todayAttendance
                                ? 'Ambil Ulang Selfie CLOCK IN'
                                : 'Ambil Ulang Selfie CLOCK OUT'
                              : !todayAttendance
                                ? 'Ambil Selfie CLOCK IN (Kamera)'
                                : 'Ambil Selfie CLOCK OUT (Kamera)'}
                          </span>
                        </button>

                        <label className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Galeri</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={handlePhotoSelect}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {clockPhotoDataUrl && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={clockPhotoDataUrl}
                              alt={
                                !todayAttendance
                                  ? 'Pratinjau foto selfie CLOCK IN'
                                  : 'Pratinjau foto selfie CLOCK OUT'
                              }
                              className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {!todayAttendance
                                  ? 'Foto selfie CLOCK IN siap dilampirkan'
                                  : 'Foto selfie CLOCK OUT siap dilampirkan'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {!todayAttendance
                                  ? 'Akan disimpan sebagai bukti CLOCK IN'
                                  : 'Akan disimpan sebagai bukti CLOCK OUT'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setClockPhotoDataUrl('')}
                            className="text-xs font-medium text-red-700 hover:underline px-2 shrink-0 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!todayAttendance ? (
                    <button
                      type="button"
                      disabled={clockBusy}
                      onClick={() => handleClockAction('in')}
                      className="w-full min-h-[48px] rounded-xl bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {clockBusy ? 'Mengambil lokasi & mencatat...' : 'Catat Presensi Masuk (CLOCK IN)'}
                    </button>
                  ) : !todayAttendance.clockOutAt ? (
                    <button
                      type="button"
                      disabled={clockBusy}
                      onClick={() => {
                        if (clockNotes.trim().length < 3) {
                          setErrorMsg(
                            'Alasan presensi CLOCK OUT wajib diisi minimal 3 karakter sebelum mencatat pulang.',
                          );
                          return;
                        }
                        if (!clockPhotoDataUrl) {
                          setErrorMsg(
                            'Foto selfie CLOCK OUT wajib diambil sebelum mencatat presensi pulang.',
                          );
                          return;
                        }
                        setConfirmClockOutOpen(true);
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {clockBusy ? 'Mengambil lokasi & mencatat...' : 'Catat Presensi Pulang (CLOCK OUT)'}
                    </button>
                  ) : (
                    <div className="min-h-[48px] rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center text-sm font-medium text-emerald-800">
                      Kehadiran hari ini telah selesai tercatat
                    </div>
                  )}
                </div>
              </section>

              {/* Leave Quota & Quick Actions Summary */}
              <section
                className={`${
                  isMobileView ? '' : 'lg:col-span-5'
                } rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between gap-5`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Ringkasan Cuti
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('leave')}
                      className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                      <p className="text-xs text-slate-500">Sisa Cuti Tahunan</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {annualBalance ? annualBalance.remainingDays : 0}
                        <span className="text-xs font-sans font-normal text-slate-500 ml-1">hari</span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
                      <p className="text-xs text-slate-500">Dalam Proses</p>
                      <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {
                          leaveRequests.filter(
                            (r) => r.status === 'pending_supervisor' || r.status === 'pending_hr',
                          ).length
                        }
                        <span className="text-xs font-sans font-normal text-slate-500 ml-1">ajukan</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <p className="text-xs font-medium text-slate-500">Pengajuan Terbaru</p>
                    {loadingData ? (
                      <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                    ) : leaveRequests.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">Belum ada pengajuan cuti tahun ini.</p>
                    ) : (
                      leaveRequests.slice(0, 2).map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {req.leaveTypeName}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {formatDateID(req.startDate)} · {req.totalDays} hari
                            </p>
                          </div>
                          <StatusText tone={mapLeaveTone(req.status)} label={getLeaveStatusLabel(req.status)} />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(true)}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajukan Cuti / Izin / Sakit</span>
                </button>
              </section>
            </div>

            {/* Announcements & Notifications Feed (Module G) */}
            <div className={`grid grid-cols-1 ${isMobileView ? '' : 'lg:grid-cols-12'} gap-5`}>
              <section
                className={`${
                  isMobileView ? '' : 'lg:col-span-7'
                } rounded-2xl border border-slate-200 bg-white p-5 space-y-3`}
              >
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-700" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Pengumuman & Informasi HR
                  </h2>
                </div>
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Belum ada pengumuman terbaru.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {announcements.slice(0, 3).map((ann) => (
                      <div key={ann.id} className="py-3 first:pt-1 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{ann.title}</p>
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                            {formatDateID(ann.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section
                className={`${
                  isMobileView ? '' : 'lg:col-span-5'
                } rounded-2xl border border-slate-200 bg-white p-5 space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-700" />
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Notifikasi Saya
                    </h2>
                  </div>
                  {unreadNotifs.length > 0 && (
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {unreadNotifs.length} baru
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Tidak ada notifikasi masuk.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.slice(0, 4).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleMarkNotifRead(n.id)}
                        className={`w-full text-left py-2.5 first:pt-1 last:pb-0 space-y-0.5 cursor-pointer ${
                          n.isRead ? 'opacity-60' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-600">{n.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: PRESENSI & LEMBUR */}
        {activeTab === 'attendance' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Riwayat Presensi & Lembur
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Log presensi tervalidasi waktu server, durasi kerja, dan pengajuan lembur
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOtOpen((prev) => !prev)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajukan Lembur</span>
                </button>
                <button
                  type="button"
                  onClick={loadEmployeeData}
                  aria-label="Segarkan log presensi"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {otOpen && (
              <form
                onSubmit={handleSubmitOvertime}
                noValidate
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
              >
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Form Pengajuan Lembur
                </h2>
                {otError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
                  >
                    {otError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={otDate}
                      onChange={(e) => setOtDate(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Durasi (Jam)</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={12}
                      required
                      value={otHours}
                      onChange={(e) => setOtHours(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="overtime-reason-input" className="text-xs font-medium text-slate-700">
                      Alasan / Catatan Pengajuan Lembur (Wajib)
                    </label>
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        otReason.trim().length >= 5 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {otReason.trim().length}/5 min. kar
                    </span>
                  </div>
                  <input
                    id="overtime-reason-input"
                    type="text"
                    required
                    minLength={5}
                    placeholder="Contoh: Penyelesaian deployment sistem produksi & rekonsiliasi data"
                    value={otReason}
                    onChange={(e) => {
                      setOtReason(e.target.value);
                      if (otError && e.target.value.trim().length >= 5) setOtError(null);
                    }}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtOpen(false);
                      setOtError(null);
                    }}
                    className="min-h-[40px] px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={otBusy}
                    className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                  >
                    {otBusy ? 'Mengirim...' : 'Kirim Lembur'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
              {loadingData ? (
                <LoadingSkeleton rows={4} />
              ) : attendanceList.length === 0 ? (
                <EmptyState
                  title="Belum ada catatan presensi"
                  description="Mulai presensi masuk dari tab Beranda untuk merekam kehadiran pertama Anda."
                  actionLabel="Ke Beranda"
                  onAction={() => setActiveTab('home')}
                />
              ) : (
                attendanceList.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDateID(log.workDate)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.isWithinGeofence ? 'Dalam area kantor' : 'Di luar radius / tanpa GPS'}
                        {log.clockInDistanceMeters !== null ? ` · ${log.clockInDistanceMeters} m` : ''}
                        {log.workMinutes > 0 ? ` · Kerja ${formatMinutesToDuration(log.workMinutes)}` : ''}
                        {log.earlyLeaveMinutes > 0 ? ` · Pulang awal ${log.earlyLeaveMinutes}m` : ''}
                        {log.notes ? ` · ${log.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
                      <div className="font-mono text-xs text-slate-700 tabular-nums">
                        Masuk <strong className="text-slate-900">{formatTimeWIB(log.clockInAt)}</strong>
                        <span className="mx-2 text-slate-300">/</span>
                        Pulang{' '}
                        <strong className="text-slate-900">
                          {log.clockOutAt ? formatTimeWIB(log.clockOutAt) : '—'}
                        </strong>
                      </div>
                      {(log.clockInPhotoUrl || log.clockOutPhotoUrl) && (
                        <div className="flex items-center gap-1.5">
                          {log.clockInPhotoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setAttendancePhotoPreview({
                                  url: log.clockInPhotoUrl,
                                  type: 'CLOCK IN',
                                  workDate: log.workDate,
                                  timeWIB: formatTimeWIB(log.clockInAt),
                                  reason: log.clockInReason || log.notes || '',
                                })
                              }
                              className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3 shrink-0" />
                              <span>CLOCK IN</span>
                            </button>
                          )}
                          {log.clockOutPhotoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setAttendancePhotoPreview({
                                  url: log.clockOutPhotoUrl,
                                  type: 'CLOCK OUT',
                                  workDate: log.workDate,
                                  timeWIB: log.clockOutAt ? formatTimeWIB(log.clockOutAt) : '—',
                                  reason: log.clockOutReason || '',
                                })
                              }
                              className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3 shrink-0" />
                              <span>CLOCK OUT</span>
                            </button>
                          )}
                        </div>
                      )}
                      <StatusText
                        tone={log.status === 'on_time' ? 'success' : 'warning'}
                        label={getAttendanceStatusLabel(log.status)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {overtimeList.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h2 className="font-display text-sm font-semibold text-slate-900">
                    Riwayat Pengajuan Lembur Saya
                  </h2>
                </div>
                {overtimeList.map((ot) => (
                  <div key={ot.id} className="p-4 sm:px-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDateID(ot.workDate)} · <span className="font-mono">{ot.hours} jam</span>
                      </p>
                      <p className="text-xs text-slate-500">{ot.reason}</p>
                    </div>
                    <StatusText
                      tone={
                        ot.status === 'approved'
                          ? 'success'
                          : ot.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                      label={
                        ot.status === 'approved'
                          ? 'Disetujui'
                          : ot.status === 'rejected'
                            ? 'Ditolak'
                            : ot.status === 'pending_hr'
                              ? 'Menunggu HRD'
                              : 'Menunggu Supervisor'
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUTI */}
        {activeTab === 'leave' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Cuti, Izin & Sakit
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pantau saldo kuota dan status persetujuan berjenjang (Supervisor → HRD)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveModalOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs sm:text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Cuti / Izin</span>
              </button>
            </div>

            <div className={`grid grid-cols-1 ${isMobileView ? '' : 'sm:grid-cols-3'} gap-4`}>
              {leaveBalances.map((bal) => (
                <div
                  key={bal.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                >
                  <p className="text-xs font-medium text-slate-500">{bal.leaveTypeName}</p>
                  <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {bal.remainingDays}
                    <span className="text-xs font-sans font-normal text-slate-500 ml-1.5">
                      hari tersisa
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    Terpakai {bal.usedDays} dari {bal.allocatedDays} hari
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
              {leaveRequests.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-slate-900">Belum ada riwayat cuti</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ketuk tombol Ajukan Cuti di atas untuk membuat permohonan baru.
                  </p>
                </div>
              ) : (
                leaveRequests.map((req) => (
                  <div key={req.id} className="p-4 sm:px-6 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{req.leaveTypeName}</p>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          {formatDateID(req.startDate)} – {formatDateID(req.endDate)} · {req.totalDays} hari
                        </p>
                      </div>
                      <StatusText tone={mapLeaveTone(req.status)} label={getLeaveStatusLabel(req.status)} />
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{req.reason}</p>
                    {req.supervisorNote && (
                      <p className="text-xs text-emerald-700">
                        Supervisor ({req.supervisorReviewerName || 'Atasan'}): {req.supervisorNote}
                      </p>
                    )}
                    {req.reviewNote && (
                      <p className="text-xs text-slate-500">
                        HRD ({req.reviewerName || 'Peninjau'}): {req.reviewNote}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROFIL, SLIP GAJI, KPI & DOKUMEN */}
        {activeTab === 'profile' && (
          <div className={`space-y-6 ${isMobileView ? '' : 'max-w-3xl'}`}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar name={employee.fullName} src={employee.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <h1 className="font-display text-lg font-bold text-slate-900 truncate">
                      {employee.fullName}
                    </h1>
                    <p className="text-sm text-slate-600 truncate">{employee.jobTitle}</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                      {employee.employeeCode} · {getRoleLabel(employee.role)} ·{' '}
                      {getEmploymentStatusLabel(employee.employmentStatus)}
                    </p>
                  </div>
                </div>
                {!editingOwnName && (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnNameDraft(employee.fullName);
                      setOwnNameError(null);
                      setEditingOwnName(true);
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer no-print"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Ubah Nama</span>
                  </button>
                )}
              </div>

              {editingOwnName && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = ownNameDraft.trim();
                    if (trimmed.length < 2) {
                      setOwnNameError('Nama lengkap minimal 2 karakter.');
                      return;
                    }
                    try {
                      setSavingOwnName(true);
                      setOwnNameError(null);
                      await updateOwnName(trimmed);
                      setEditingOwnName(false);
                      showToast('Nama akun Anda berhasil diperbarui.');
                    } catch (err) {
                      setOwnNameError(
                        err instanceof Error ? err.message : 'Gagal memperbarui nama akun.',
                      );
                    } finally {
                      setSavingOwnName(false);
                    }
                  }}
                  className="pt-3 border-t border-slate-100 space-y-2.5 no-print"
                >
                  <label
                    htmlFor="employee-own-name-input"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Ubah Nama Akun Saya ({employee.email})
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="employee-own-name-input"
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={ownNameDraft}
                      onChange={(e) => setOwnNameDraft(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      className="flex-1 min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingOwnName}
                        className="min-h-[40px] px-4 rounded-xl bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
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
                        className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                  {ownNameError && (
                    <p className="text-xs font-medium text-red-700">{ownNameError}</p>
                  )}
                </form>
              )}
            </div>

            {/* Identitas & Struktur Organisasi */}
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 text-sm">
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Email & Telepon</span>
                <span className="font-medium text-slate-900 text-right">
                  {employee.email} {employee.phone ? `· ${employee.phone}` : ''}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">No. Identitas (NIK)</span>
                <span className="font-mono font-medium text-slate-900">
                  {employee.identityNumber || '—'}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Alamat Domisili</span>
                <span className="font-medium text-slate-900 text-right">{employee.address || '—'}</span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Departemen & Divisi</span>
                <span className="font-medium text-slate-900 text-right">
                  {employee.departmentName || '—'}
                  {employee.divisionName ? ` (${employee.divisionName})` : ''}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Atasan Langsung</span>
                <span className="font-medium text-slate-900">{employee.managerName || '—'}</span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Shift & Lokasi</span>
                <span className="font-medium text-slate-900 text-right">
                  {employee.shiftName || 'Reguler'} · {employee.officeLocationName || 'Pusat'}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500">Tanggal Bergabung</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {formatDateID(employee.joinDate)}
                </span>
              </div>
            </div>

            {/* Slip Gaji Saya (Module D) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-blue-700" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Slip Gaji Saya
                  </h2>
                </div>
                {payrollList.length > 0 && (
                  <button
                    type="button"
                    onClick={exportReportToPdfPrint}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline cursor-pointer no-print"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Slip</span>
                  </button>
                )}
              </div>

              {payrollList.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada slip gaji yang diterbitkan untuk akun Anda.</p>
              ) : (
                <div className="space-y-3">
                  {payrollList.map((slip) => (
                    <div
                      key={slip.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          Periode {slip.periodMonth}
                        </span>
                        <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                          {formatCurrencyIDR(slip.netSalary)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200 text-slate-600">
                        <div>
                          <span className="block text-[11px] text-slate-400">Gaji Pokok</span>
                          <span className="font-mono tabular-nums">{formatCurrencyIDR(slip.baseSalary)}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Tunjangan</span>
                          <span className="font-mono tabular-nums">{formatCurrencyIDR(slip.allowances)}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Lembur</span>
                          <span className="font-mono text-emerald-700 tabular-nums">
                            +{formatCurrencyIDR(slip.overtimePay)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Potongan</span>
                          <span className="font-mono text-red-700 tabular-nums">
                            -{formatCurrencyIDR(slip.deductions)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Penilaian Kinerja & KPI (Module F) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Evaluasi Kinerja & KPI
                </h2>
              </div>
              {performanceList.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada hasil evaluasi kinerja yang tercatat.</p>
              ) : (
                <div className="space-y-3">
                  {performanceList.map((rev) => (
                    <div key={rev.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Periode {rev.periodLabel}</p>
                          <p className="text-xs text-slate-500">Penilai: {rev.reviewerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xl font-bold text-blue-700 tabular-nums">
                            {rev.overallScore.toFixed(1)}
                          </p>
                          <p className="text-xs font-semibold text-slate-700">{rev.ratingLabel}</p>
                        </div>
                      </div>
                      {rev.supervisorNotes && (
                        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">
                          {rev.supervisorNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Riwayat Pekerjaan & Dokumen Karyawan (Module A) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Riwayat Pekerjaan & Dokumen Kepegawaian
                </h2>
              </div>

              {employee.employmentHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Riwayat Karier
                  </p>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl px-3">
                    {employee.employmentHistory.map((h, i) => (
                      <div key={i} className="py-2.5 text-xs">
                        <p className="font-semibold text-slate-900">
                          {h.title} · {h.department}
                        </p>
                        <p className="text-slate-500 font-mono">{h.period}</p>
                        {h.note && <p className="text-slate-600 mt-0.5">{h.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Dokumen Tersimpan
                </p>
                {employee.documents.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada dokumen yang diunggah oleh HR.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl px-3">
                    {employee.documents.map((doc) => (
                      <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-medium text-slate-900">{doc.title}</p>
                          <p className="text-slate-500">
                            {doc.category} · {formatDateID(doc.uploadedAt)}
                          </p>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-700 font-medium">
                          Terverifikasi
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-3 no-print">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Mode Tampilan Aplikasi
                  {session?.permissions.canAccessBackoffice
                    ? ' (Mode Desktop membuka Backoffice)'
                    : ''}
                </p>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} fullWidth />
              </div>

              <PWAInstallButton variant="full" />

              <button
                type="button"
                onClick={() => setConfirmSignOutOpen(true)}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Tab Bar for Mobile Thumb-Zone (60px height) */}
      <nav
        aria-label="Navigasi Karyawan"
        className={`${
          isMobileView ? '' : 'md:hidden'
        } fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print`}
      >
        <div
          className={`grid grid-cols-4 h-15 items-center ${
            isMobileView ? 'max-w-lg mx-auto' : ''
          }`}
        >
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <LeaveRequestModal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        leaveTypes={leaveTypes}
        balances={leaveBalances}
        onSubmitted={(created) => {
          setLeaveRequests((prev) => [created, ...prev]);
          showToast('Pengajuan cuti/izin berhasil dikirim untuk persetujuan Supervisor & HRD.');
        }}
      />

      <CameraSelfieModal
        open={cameraModalOpen}
        mode={todayAttendance ? 'clock_out' : 'clock_in'}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(dataUrl) => {
          setClockPhotoDataUrl(dataUrl);
          setErrorMsg(null);
          showToast(
            todayAttendance
              ? 'Foto selfie CLOCK OUT berhasil diambil.'
              : 'Foto selfie CLOCK IN berhasil diambil.',
          );
        }}
      />

      {attendancePhotoPreview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setAttendancePhotoPreview(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Dokumentasi Foto {attendancePhotoPreview.type}
                </p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {formatDateID(attendancePhotoPreview.workDate)} · {attendancePhotoPreview.timeWIB} WIB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendancePhotoPreview(null)}
                aria-label="Tutup pratinjau foto"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex flex-col items-center gap-3">
              <img
                src={attendancePhotoPreview.url}
                alt={`Foto presensi ${attendancePhotoPreview.type}`}
                className="max-h-96 rounded-xl object-contain"
              />
              <div className="w-full rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-left">
                <p className="text-xs font-semibold text-slate-900">
                  Keterangan: {attendancePhotoPreview.type}
                </p>
                <p className="text-xs text-slate-500">
                  Alasan Presensi {attendancePhotoPreview.type}:
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {attendancePhotoPreview.reason || 'Tidak ada alasan tertulis.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClockOutOpen}
        title="Konfirmasi Presensi Pulang (CLOCK OUT)"
        description="Pastikan jam kerja shift Anda sudah selesai dan foto selfie CLOCK OUT sudah sesuai. Sistem akan merekam jam pulang serta total durasi kerja hari ini."
        confirmLabel="Ya, Catat Pulang"
        busy={clockBusy}
        onConfirm={async () => {
          setConfirmClockOutOpen(false);
          await handleClockAction('out');
        }}
        onClose={() => setConfirmClockOutOpen(false)}
      />

      <ConfirmDialog
        open={confirmSignOutOpen}
        title="Keluar dari Akun"
        description="Anda akan kembali ke halaman pemilihan akun demo. Pastikan aktivitas presensi hari ini sudah tersimpan."
        confirmLabel="Ya, Keluar"
        tone="warning"
        onConfirm={signOut}
        onClose={() => setConfirmSignOutOpen(false)}
      />
    </div>
  );
};
