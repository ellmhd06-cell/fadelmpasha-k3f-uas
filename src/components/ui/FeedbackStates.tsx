import React from 'react';
import { AlertCircle, CheckCircle2, Inbox, RefreshCw, X } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="py-10 px-6 text-center flex flex-col items-center justify-center">
    <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
      <Inbox className="w-5 h-5" />
    </div>
    <p className="font-display text-sm font-semibold text-slate-900">{title}</p>
    <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 min-h-[38px] px-4 rounded-lg bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

interface LoadingSkeletonProps {
  rows?: number;
  variant?: 'table' | 'cards' | 'list';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 4,
  variant = 'list',
}) => {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="h-7 w-16 rounded bg-slate-200 animate-pulse" />
            <div className="h-2.5 w-32 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="space-y-2 flex-1 max-w-xs">
              <div className="h-3.5 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-28 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="h-3.5 w-20 rounded bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
};

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm font-medium text-red-900 flex items-center justify-between gap-3"
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
      <span className="truncate sm:whitespace-normal">{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 hover:underline shrink-0 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Muat Ulang</span>
      </button>
    )}
  </div>
);

interface SuccessToastProps {
  message: string;
  onDismiss?: () => void;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({ message, onDismiss }) => (
  <div
    role="status"
    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-medium text-emerald-900 flex items-center justify-between gap-3"
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
      <span>{message}</span>
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi"
        className="text-emerald-700 hover:text-emerald-950 p-1 rounded cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);
