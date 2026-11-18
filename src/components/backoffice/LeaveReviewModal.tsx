import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import type { LeaveRequestRecord } from '../../shared/types';
import { formatDateID } from '../../utils/formatters';

interface LeaveReviewModalProps {
  request: LeaveRequestRecord | null;
  decision: 'approved' | 'rejected' | null;
  onClose: () => void;
  onReviewed: (updated: LeaveRequestRecord) => void;
}

export const LeaveReviewModal: React.FC<LeaveReviewModalProps> = ({
  request,
  decision,
  onClose,
  onReviewed,
}) => {
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!request || !decision) return null;

  const isApprove = decision === 'approved';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApprove && !reviewNote.trim()) {
      setErrorMsg('Alasan penolakan wajib diisi agar karyawan mengetahui tindak lanjutnya.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const updated = await apiRequest<LeaveRequestRecord>(
        `/leaves/requests/${request.id}/review`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            decision,
            reviewNote: reviewNote.trim(),
          }),
        },
      );
      setReviewNote('');
      onReviewed(updated);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses keputusan approval.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {isApprove ? 'Konfirmasi Persetujuan Cuti' : 'Tolak Pengajuan Cuti'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs">
            <p className="text-sm font-semibold text-slate-900">{request.employeeName}</p>
            <p className="text-slate-600">
              {request.leaveTypeName} · <span className="font-mono tabular-nums">{formatDateID(request.startDate)}</span> s.d.{' '}
              <span className="font-mono tabular-nums">{formatDateID(request.endDate)}</span> ({request.totalDays} hari)
            </p>
            <p className="text-slate-700 pt-1">{request.reason}</p>
            {request.status === 'pending_supervisor' && (
              <p className="text-blue-700 font-medium pt-1">
                Tahap 1/2: Persetujuan Supervisor sebelum diteruskan ke HRD.
              </p>
            )}
            {request.supervisorNote && (
              <p className="text-emerald-800 pt-1">
                Catatan Supervisor ({request.supervisorReviewerName || 'Atasan'}): {request.supervisorNote}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {isApprove ? 'Catatan Persetujuan (Opsional)' : 'Alasan Penolakan (Wajib)'}
            </label>
            <textarea
              rows={3}
              required={!isApprove}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={
                isApprove
                  ? 'Contoh: Disetujui, harap delegasikan tugas harian ke rekan tim.'
                  : 'Contoh: Jadwal berbenturan dengan rilis proyek kuartal ini.'
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`min-h-[40px] px-5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 cursor-pointer ${
                isApprove ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'
              }`}
            >
              {submitting
                ? 'Memproses...'
                : isApprove
                  ? 'Setujui Pengajuan'
                  : 'Tolak Pengajuan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
