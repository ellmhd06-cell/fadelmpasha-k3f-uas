import type { AttendanceStatus, EmploymentStatus, LeaveStatus, UserRole } from '../shared/types';

export function formatTimeWIB(isoString: string | null): string {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoString));
}

const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function formatDateID(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  const isoJakarta = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, monthStr, day] = isoJakarta.split('-');
  const monthLabel = SHORT_MONTHS_ID[Number(monthStr) - 1] ?? monthStr;
  return `${day} ${monthLabel} ${year}`;
}

export function formatLongDateToday(): string {
  const weekday = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  }).format(new Date());
  return `${weekday}, ${formatDateID(getTodayISOJakarta())}`;
}

export function getTodayISOJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getCurrentMonthJakarta(): string {
  return getTodayISOJakarta().slice(0, 7);
}

export function formatCurrencyIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMinutesToDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'hr_admin':
      return 'HR Admin';
    case 'management':
      return 'Manajemen';
    case 'supervisor':
      return 'Supervisor';
    case 'employee':
    default:
      return 'Karyawan';
  }
}

export function getEmploymentStatusLabel(status: EmploymentStatus): string {
  switch (status) {
    case 'active':
      return 'Aktif';
    case 'probation':
      return 'Masa Percobaan';
    case 'inactive':
      return 'Nonaktif';
  }
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'on_time':
      return 'Tepat Waktu';
    case 'late':
      return 'Terlambat';
    case 'early_leave':
      return 'Pulang Awal';
  }
}

export function getLeaveStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'pending_supervisor':
      return 'Menunggu Supervisor';
    case 'pending_hr':
      return 'Menunggu HRD';
    case 'approved':
      return 'Disetujui';
    case 'rejected':
      return 'Ditolak';
    case 'cancelled':
      return 'Dibatalkan';
  }
}
