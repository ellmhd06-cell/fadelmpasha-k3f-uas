import React, { useMemo, useState } from 'react';
import { Calculator, Send } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { PayrollRecordItem } from '../../shared/types';
import { formatCurrencyIDR, getCurrentMonthJakarta } from '../../utils/formatters';
import { StatusText } from '../common/StatusText';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState, ErrorBanner } from '../ui/FeedbackStates';

interface PayrollPanelProps {
  records: PayrollRecordItem[];
  canManagePayroll: boolean;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export const PayrollPanel: React.FC<PayrollPanelProps> = ({
  records,
  canManagePayroll,
  onRefresh,
  onNotify,
}) => {
  const [periodMonth, setPeriodMonth] = useState(getCurrentMonthJakarta());
  const [busy, setBusy] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const periodRecords = useMemo(
    () => records.filter((r) => r.periodMonth === periodMonth),
    [records, periodMonth],
  );

  const totalNet = useMemo(
    () => periodRecords.reduce((acc, r) => acc + r.netSalary, 0),
    [periodRecords],
  );

  const handleGenerate = async () => {
    try {
      setBusy(true);
      setErrorMsg(null);
      await apiRequest('/payroll/generate', {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      });
      onNotify(`Kalkulasi payroll periode ${periodMonth} berhasil dihitung.`);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghitung payroll.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishConfirmed = async () => {
    try {
      setBusy(true);
      setErrorMsg(null);
      await apiRequest('/payroll/publish', {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      });
      setConfirmPublishOpen(false);
      onNotify(`Slip gaji periode ${periodMonth} telah diterbitkan ke seluruh karyawan.`);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menerbitkan slip gaji.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Payroll & Penggajian
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kalkulasi gaji pokok, tunjangan, lembur disetujui, potongan, dan penerbitan slip gaji
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono tabular-nums"
          />
          {canManagePayroll && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleGenerate}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Hitung Payroll</span>
              </button>
              <button
                type="button"
                disabled={busy || periodRecords.length === 0}
                onClick={() => setConfirmPublishOpen(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Terbitkan Slip Gaji</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={onRefresh} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Periode Aktif</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {periodMonth}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Jumlah Penerima</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {periodRecords.length} karyawan
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Take-Home Pay</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-blue-700 tabular-nums">
            {formatCurrencyIDR(totalNet)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {periodRecords.length === 0 ? (
          <EmptyState
            title={`Belum ada data payroll periode ${periodMonth}`}
            description="Jalankan kalkulasi untuk menghitung gaji pokok, tunjangan, lembur disetujui, serta potongan kehadiran."
            actionLabel={canManagePayroll ? 'Hitung Payroll Sekarang' : undefined}
            onAction={canManagePayroll ? handleGenerate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4 text-right">Gaji Pokok</th>
                  <th className="py-3 px-4 text-right">Tunjangan</th>
                  <th className="py-3 px-4 text-right">Lembur</th>
                  <th className="py-3 px-4 text-right">Potongan</th>
                  <th className="py-3 px-4 text-right">Gaji Bersih</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{item.employeeName}</p>
                      <p className="text-xs text-slate-500">
                        {item.employeeCode} · {item.departmentName || 'Umum'} · Hadir {item.attendanceDays}h
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatCurrencyIDR(item.baseSalary)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatCurrencyIDR(item.allowances)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700 tabular-nums">
                      +{formatCurrencyIDR(item.overtimePay)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-red-700 tabular-nums">
                      -{formatCurrencyIDR(item.deductions)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-900 tabular-nums">
                      {formatCurrencyIDR(item.netSalary)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusText
                        tone={item.status === 'published' ? 'success' : 'warning'}
                        label={item.status === 'published' ? 'Diterbitkan' : 'Draft'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmPublishOpen}
        title="Konfirmasi Penerbitan Slip Gaji"
        description={`Anda akan menerbitkan ${periodRecords.length} slip gaji untuk periode ${periodMonth} dengan total ${formatCurrencyIDR(totalNet)}. Slip gaji yang sudah terbit langsung dapat diakses oleh masing-masing karyawan.`}
        confirmLabel="Ya, Terbitkan Slip Gaji"
        busy={busy}
        onConfirm={handlePublishConfirmed}
        onClose={() => setConfirmPublishOpen(false)}
      />
    </div>
  );
};
