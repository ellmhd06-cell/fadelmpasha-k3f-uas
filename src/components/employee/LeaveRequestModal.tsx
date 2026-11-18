import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { LeaveBalanceRecord, LeaveRequestRecord, LeaveTypeRecord } from '../../shared/types';
import { getTodayISOJakarta } from '../../utils/formatters';

interface LeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  leaveTypes: LeaveTypeRecord[];
  balances: LeaveBalanceRecord[];
  onSubmitted: (created: LeaveRequestRecord) => void;
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  open,
  onClose,
  leaveTypes,
  balances,
  onSubmitted,
}) => {
  const today = getTodayISOJakarta();
  const [leaveTypeId, setLeaveTypeId] = useState<number>(leaveTypes[0]?.id ?? 1);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId),
    [balances, leaveTypeId],
  );

  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    const s = new Date(`${startDate}T00:00:00Z`).getTime();
    const e = new Date(`${endDate}T00:00:00Z`).getTime();
    return Math.round((e - s) / 86400000) + 1;
  }, [startDate, endDate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setErrorMsg('Tuliskan alasan pengajuan minimal 5 karakter.');
      return;
    }
    if (estimatedDays <= 0) {
      setErrorMsg('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const created = await apiRequest<LeaveRequestRecord>('/leaves/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          reason: reason.trim(),
        }),
      });
      setReason('');
      onSubmitted(created);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim pengajuan cuti.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Ajukan Cuti atau Izin
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pengajuan langsung diteruskan ke supervisor & HRD
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label htmlFor="leave-type" className="block text-xs font-medium text-slate-700 mb-1.5">
              Jenis Cuti / Izin
            </label>
            <select
              id="leave-type"
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
            {selectedBalance && (
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                Sisa kuota tahun ini: <strong className="text-slate-900">{selectedBalance.remainingDays} hari</strong> dari {selectedBalance.allocatedDays} hari
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="leave-start" className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Mulai
              </label>
              <input
                id="leave-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="leave-end" className="block text-xs font-medium text-slate-700 mb-1.5">
                Tanggal Selesai
              </label>
              <input
                id="leave-end"
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs">
            <span className="text-slate-600">Estimasi Durasi Pengajuan</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {estimatedDays} hari kalender
            </span>
          </div>

          <div>
            <label htmlFor="leave-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
              Alasan Pengajuan
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              required
              placeholder="Contoh: Keperluan keluarga atau pemeriksaan kesehatan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] min-h-[48px] rounded-xl bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
