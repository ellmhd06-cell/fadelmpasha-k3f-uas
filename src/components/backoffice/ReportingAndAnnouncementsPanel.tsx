import React, { useMemo, useState } from 'react';
import { BellRing, FileSpreadsheet, Megaphone, Pin, Printer, Send } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type {
  AnnouncementRecord,
  AttendanceRecord,
  EmployeeRecord,
  LeaveRequestRecord,
  PayrollRecordItem,
} from '../../shared/types';
import { downloadExcelSpreadsheet, exportReportToPdfPrint } from '../../utils/exportReports';
import {
  formatCurrencyIDR,
  formatDateID,
  formatMinutesToDuration,
  formatTimeWIB,
  getAttendanceStatusLabel,
  getEmploymentStatusLabel,
  getLeaveStatusLabel,
  getRoleLabel,
} from '../../utils/formatters';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState, ErrorBanner } from '../ui/FeedbackStates';

interface AnnouncementsPanelProps {
  announcements: AnnouncementRecord[];
  canPublish: boolean;
  canRemindAttendance: boolean;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export const AnnouncementsPanel: React.FC<AnnouncementsPanelProps> = ({
  announcements,
  canPublish,
  canRemindAttendance,
  onRefresh,
  onNotify,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'company' | 'hr_info' | 'policy'>('company');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [confirmReminderOpen, setConfirmReminderOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const categoryLabel: Record<AnnouncementRecord['category'], string> = {
    company: 'Pengumuman Perusahaan',
    hr_info: 'Informasi HR',
    policy: 'Kebijakan Internal',
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await apiRequest('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category,
          content: content.trim(),
          isPinned,
        }),
      });
      setTitle('');
      setContent('');
      setIsPinned(false);
      onNotify('Pengumuman resmi berhasil diterbitkan ke seluruh karyawan.');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menerbitkan pengumuman.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async () => {
    try {
      setReminding(true);
      setErrorMsg(null);
      const res = await apiRequest<{ sentCount: number }>('/notifications/remind-attendance', {
        method: 'POST',
      });
      setConfirmReminderOpen(false);
      onNotify(`Pengingat presensi dikirimkan ke ${res.sentCount} karyawan yang belum clock-in hari ini.`);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pengingat presensi.');
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Pengumuman & Informasi HR
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Siaran pengumuman perusahaan, pembaruan kebijakan, dan pengingat presensi otomatis
          </p>
        </div>

        {canRemindAttendance && (
          <button
            type="button"
            disabled={reminding}
            onClick={() => setConfirmReminderOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{reminding ? 'Mengirim Pengingat...' : 'Kirim Pengingat Presensi'}</span>
          </button>
        )}
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={onRefresh} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {canPublish && (
          <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-4 h-4 text-blue-700" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Terbitkan Pengumuman Baru
              </h2>
            </div>

            <form onSubmit={handlePublish} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Jadwal Townhall & Libur Bersama"
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'company' | 'hr_info' | 'policy')}
                  className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="company">Pengumuman Perusahaan</option>
                  <option value="hr_info">Informasi HR</option>
                  <option value="policy">Kebijakan Internal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Isi Pesan</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tulis informasi lengkap untuk karyawan..."
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                <span>Sematkan di Beranda Karyawan (Pinned)</span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Menerbitkan...' : 'Terbitkan Pengumuman'}</span>
              </button>
            </form>
          </section>
        )}

        <section className={`${canPublish ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          {announcements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <EmptyState
                title="Belum ada pengumuman perusahaan"
                description="Pengumuman resmi dari HR atau Manajemen yang diterbitkan akan muncul di sini dan di beranda karyawan."
              />
            </div>
          ) : (
            announcements.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-blue-700">{categoryLabel[item.category]}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{formatDateID(item.createdAt)}</span>
                      <span>·</span>
                      <span>Oleh {item.authorName}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900 mt-1">
                      {item.title}
                    </h3>
                  </div>
                  {item.isPinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 shrink-0">
                      <Pin className="w-3 h-3" />
                      Disematkan
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.content}</p>
              </article>
            ))
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmReminderOpen}
        title="Kirim Pengingat Presensi Massal"
        description="Sistem akan mengirimkan notifikasi pengingat clock-in ke seluruh karyawan aktif yang belum mencatat kehadiran hari ini."
        confirmLabel="Ya, Kirim Pengingat"
        tone="warning"
        busy={reminding}
        onConfirm={handleSendReminder}
        onClose={() => setConfirmReminderOpen(false)}
      />
    </div>
  );
};

type ReportKind = 'attendance' | 'leave' | 'employees' | 'lateness' | 'payroll';

interface ReportingPanelProps {
  employees: EmployeeRecord[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequestRecord[];
  payrollRecords: PayrollRecordItem[];
  canViewPayroll: boolean;
}

export const ReportingPanel: React.FC<ReportingPanelProps> = ({
  employees,
  attendance,
  leaveRequests,
  payrollRecords,
  canViewPayroll,
}) => {
  const [reportType, setReportType] = useState<ReportKind>('attendance');

  const reportTabs: { id: ReportKind; label: string; visible: boolean }[] = [
    { id: 'attendance', label: 'Laporan Presensi', visible: true },
    { id: 'lateness', label: 'Laporan Keterlambatan', visible: true },
    { id: 'leave', label: 'Laporan Cuti', visible: true },
    { id: 'employees', label: 'Laporan Karyawan', visible: true },
    { id: 'payroll', label: 'Laporan Payroll', visible: canViewPayroll },
  ];

  const reportData = useMemo(() => {
    switch (reportType) {
      case 'attendance':
        return {
          title: 'Laporan Rekap Presensi Karyawan',
          filename: 'laporan-presensi-karyaflow',
          headers: ['Tanggal', 'NIP', 'Nama Karyawan', 'Departemen', 'Masuk (WIB)', 'Pulang (WIB)', 'Durasi Kerja', 'Status'],
          rows: attendance.map((a) => [
            formatDateID(a.workDate),
            a.employeeCode,
            a.employeeName,
            a.departmentName || 'Umum',
            formatTimeWIB(a.clockInAt),
            a.clockOutAt ? formatTimeWIB(a.clockOutAt) : '—',
            formatMinutesToDuration(a.workMinutes),
            getAttendanceStatusLabel(a.status),
          ]),
        };
      case 'lateness': {
        const lateRows = attendance.filter((a) => a.status === 'late' || a.status === 'early_leave');
        return {
          title: 'Laporan Keterlambatan & Pulang Lebih Awal',
          filename: 'laporan-keterlambatan-karyaflow',
          headers: ['Tanggal', 'NIP', 'Nama Karyawan', 'Departemen', 'Jam Masuk', 'Jam Pulang', 'Pulang Awal (mnt)', 'Status'],
          rows: lateRows.map((a) => [
            formatDateID(a.workDate),
            a.employeeCode,
            a.employeeName,
            a.departmentName || 'Umum',
            formatTimeWIB(a.clockInAt),
            a.clockOutAt ? formatTimeWIB(a.clockOutAt) : '—',
            a.earlyLeaveMinutes,
            getAttendanceStatusLabel(a.status),
          ]),
        };
      }
      case 'leave':
        return {
          title: 'Laporan Pengajuan Cuti & Izin',
          filename: 'laporan-cuti-karyaflow',
          headers: ['NIP', 'Nama Karyawan', 'Departemen', 'Jenis Cuti', 'Mulai', 'Selesai', 'Hari', 'Status'],
          rows: leaveRequests.map((l) => [
            l.employeeCode,
            l.employeeName,
            l.departmentName || 'Umum',
            l.leaveTypeName,
            formatDateID(l.startDate),
            formatDateID(l.endDate),
            l.totalDays,
            getLeaveStatusLabel(l.status),
          ]),
        };
      case 'employees':
        return {
          title: 'Laporan Data Induk Karyawan',
          filename: 'laporan-karyawan-karyaflow',
          headers: ['NIP', 'Nama Lengkap', 'Email', 'Departemen', 'Jabatan', 'Peran', 'Tanggal Masuk', 'Status'],
          rows: employees.map((e) => [
            e.employeeCode,
            e.fullName,
            e.email,
            e.departmentName || 'Umum',
            e.jobTitle,
            getRoleLabel(e.role),
            formatDateID(e.joinDate),
            getEmploymentStatusLabel(e.employmentStatus),
          ]),
        };
      case 'payroll':
        return {
          title: 'Laporan Rekap Penggajian (Payroll)',
          filename: 'laporan-payroll-karyaflow',
          headers: ['Periode', 'NIP', 'Nama Karyawan', 'Gaji Pokok', 'Tunjangan', 'Lembur', 'Potongan', 'Gaji Bersih', 'Status'],
          rows: payrollRecords.map((p) => [
            p.periodMonth,
            p.employeeCode,
            p.employeeName,
            formatCurrencyIDR(p.baseSalary),
            formatCurrencyIDR(p.allowances),
            formatCurrencyIDR(p.overtimePay),
            formatCurrencyIDR(p.deductions),
            formatCurrencyIDR(p.netSalary),
            p.status === 'published' ? 'Diterbitkan' : 'Draft',
          ]),
        };
    }
  }, [reportType, attendance, leaveRequests, employees, payrollRecords]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Pusat Laporan & Ekspor Data
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Unduh rekap presensi, keterlambatan, cuti, data karyawan, dan payroll ke Excel atau PDF
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              downloadExcelSpreadsheet(
                reportData.filename,
                reportData.title,
                reportData.headers,
                reportData.rows,
              )
            }
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xls)</span>
          </button>
          <button
            type="button"
            onClick={exportReportToPdfPrint}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Export PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg w-fit no-print">
        {reportTabs
          .filter((t) => t.visible)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                reportType === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">{reportData.title}</h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {reportData.rows.length} baris data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                {reportData.headers.map((h) => (
                  <th key={h} className="py-3 px-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportData.headers.length} className="py-10 text-center text-sm text-slate-500">
                    Tidak ada data yang tersedia untuk laporan ini.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/70">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-2.5 px-4 text-slate-800 whitespace-nowrap font-mono tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
