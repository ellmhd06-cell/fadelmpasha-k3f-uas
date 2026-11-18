import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationRecord } from '../../shared/types';
import { formatDateID, formatTimeWIB } from '../../utils/formatters';

interface NotificationCenterProps {
  notifications: NotificationRecord[];
  onMarkRead: (id: number) => void;
  onMarkAllRead?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const visibleItems = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, filter],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Pusat Notifikasi"
        className="relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-700 text-[10px] font-mono font-bold text-white flex items-center justify-center tabular-nums">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold text-slate-900">
                Pusat Notifikasi
              </span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllRead && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai semua</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  filter === 'unread' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {visibleItems.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  {filter === 'unread'
                    ? 'Semua notifikasi sudah dibaca.'
                    : 'Belum ada notifikasi sistem.'}
                </p>
              ) : (
                visibleItems.slice(0, 15).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className={`w-full text-left p-3.5 text-xs space-y-1 cursor-pointer hover:bg-slate-50 transition-colors ${
                      n.isRead ? 'opacity-65' : 'bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 truncate">{n.title}</p>
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                        {formatDateID(n.createdAt)} {formatTimeWIB(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{n.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
