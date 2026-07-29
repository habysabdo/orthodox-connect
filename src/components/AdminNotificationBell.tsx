import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, ShieldAlert, UserPlus } from 'lucide-react';
import { timeAgo } from '@/utils/format';
import { useUI } from '@/store/ui';
import {
  loadAdminNotifications,
  markAllAdminNotificationsRead,
  type AdminNotificationFeed,
} from '@/utils/adminNotifications';
import { startVisiblePolling } from '@/utils/visiblePolling';

// The member notification bell polls every 8s; admin alerts are lower-frequency
// by nature (a new registration, not a like), so a calmer cadence is plenty.
const POLL_MS = 20000;

const EMPTY_FEED: AdminNotificationFeed = { notifications: [], unreadCount: 0 };

// Admin-only alert bell. Sits beside the member notification bell in the top
// header and surfaces the shared `admin_notifications` feed — currently new user
// registrations. Rendered only for admins by `AppShell`; the endpoint behind it
// is admin-gated too, so this is presentation, not the security boundary.
export function AdminNotificationBell() {
  const { openAdminTab } = useUI();
  const [feed, setFeed] = useState<AdminNotificationFeed>(EMPTY_FEED);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadAdminNotifications();
      if (!cancelledRef.current) setFeed(next);
    } catch (error) {
      console.error('Failed to load admin notifications', error);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const stopPolling = startVisiblePolling(refresh, { intervalMs: POLL_MS });
    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  // Clear the badge immediately, then persist. Alerts are shared across the
  // admin team, so this clears them for every administrator.
  const markAllRead = async () => {
    setFeed((current) => ({
      notifications: current.notifications.map((alert) => ({ ...alert, read: true })),
      unreadCount: 0,
    }));
    try {
      await markAllAdminNotificationsRead();
    } catch (error) {
      console.error('Failed to mark admin notifications read', error);
    }
    void refresh();
  };

  const { notifications, unreadCount } = feed;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 text-gold-200 transition-colors hover:bg-gold-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        title="Admin alerts"
        aria-label={unreadCount > 0 ? `Admin alerts (${unreadCount} unread)` : 'Admin alerts'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <ShieldAlert size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-ink-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
          <div
            className="fixed left-3 right-3 top-14 z-50 mt-2 overflow-hidden rounded-xl border border-gold-400/30 bg-ink-800 shadow-card animate-scale-in sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[22rem] sm:max-w-[90vw]"
            role="dialog"
            aria-label="Admin alerts"
          >
            <div className="flex items-center justify-between gap-2 border-b border-ink-700 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="min-w-0">
                <span className="block text-sm font-bold text-ink-100">Admin Alerts</span>
                <span className="block text-[11px] text-ink-400">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </span>
              </div>
              <button
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0}
                className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-gold-300 transition-colors hover:text-gold-200 disabled:opacity-40 sm:gap-1.5 sm:text-xs"
              >
                <CheckCheck size={14} /> Mark All as Read
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto overscroll-contain scrollbar-thin">
              {loading && notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs leading-5 text-ink-400 sm:px-4 sm:py-10">Loading alerts…</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs leading-5 text-ink-400 sm:px-4 sm:py-10">
                  No admin alerts yet. New member registrations will appear here.
                </div>
              ) : (
                notifications.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => {
                      openAdminTab('auth-users');
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-750 sm:gap-3 sm:px-4 sm:py-3 ${
                      alert.read ? '' : 'bg-gold-400/5'
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-200">
                      <UserPlus size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[13px] leading-5 text-ink-100 sm:text-sm sm:leading-snug">
                        {alert.message || `New user registered: ${alert.subjectEmail}`}
                      </p>
                      {alert.subjectName && alert.subjectName !== alert.subjectEmail && (
                        <p className="mt-0.5 truncate text-xs text-ink-300">{alert.subjectName}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-ink-400">{timeAgo(alert.createdAt)}</p>
                    </div>
                    {!alert.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
                  </button>
                ))
              )}
            </div>
          </div>
      )}
    </div>
  );
}
