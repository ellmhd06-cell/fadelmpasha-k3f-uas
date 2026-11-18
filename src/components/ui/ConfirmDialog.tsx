import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'primary',
  busy = false,
  onConfirm,
  onClose,
}) => {
  if (!open) return null;

  const confirmStyle =
    tone === 'danger'
      ? 'bg-red-700 hover:bg-red-800 text-white'
      : tone === 'warning'
        ? 'bg-amber-700 hover:bg-amber-800 text-white'
        : 'bg-blue-700 hover:bg-blue-800 text-white';

  const iconWrapStyle =
    tone === 'danger'
      ? 'bg-red-50 text-red-700 border-red-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconWrapStyle}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 id="confirm-dialog-title" className="font-display text-base font-semibold text-slate-900 truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[40px] px-4 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-60 cursor-pointer ${confirmStyle}`}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
