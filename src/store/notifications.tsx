import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Notification } from '../types';
import { useStore } from './context';
import { useUI } from './ui';
import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../utils/notifications';
import { startVisiblePolling } from '../utils/visiblePolling';

// How often we re-query the notifications endpoint. The rest of the app keeps
// shared data fresh by polling (roster every 20s, social graph every 25s); a
// tighter 8s cadence here keeps the bell and toasts feeling live.
const POLL_MS = 8000;

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  /** notifications currently shown as floating toasts */
  toasts: Notification[];
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismissToast: (id: string) => void;
}

const NotificationsCtx = createContext<NotificationsState | null>(null);

// Subscribes the signed-in member to their notifications. Data lives in the
// site's Netlify Database; this provider polls the `/api/notifications`
// endpoint and treats any row it hasn't seen before as a fresh INSERT — which
// both feeds the unread badge and pops a toast, the same effect a realtime
// insert event would produce.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  // Ids we've already observed, so a poll only toasts genuinely new rows. The
  // very first load for a user seeds this set without toasting the backlog.
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  // Reset the subscription whenever the signed-in identity changes.
  useEffect(() => {
    seenRef.current = new Set();
    initializedRef.current = false;
    setNotifications([]);
    setToasts([]);

    if (!currentUserId) return;
    let cancelled = false;

    const stopPolling = startVisiblePolling(
      async () => {
        const rows = await loadNotifications(currentUserId);
        if (cancelled || currentUserIdRef.current !== currentUserId) return;
        setNotifications(rows);

        if (!initializedRef.current) {
          // First load — remember everything so the existing backlog never
          // toasts, then start reacting to inserts from here on.
          rows.forEach((r) => seenRef.current.add(r.id));
          initializedRef.current = true;
          return;
        }

        const fresh = rows.filter((r) => !seenRef.current.has(r.id));
        fresh.forEach((r) => seenRef.current.add(r.id));
        if (fresh.length) {
          // Newest first, capped so a burst can't fill the screen.
          setToasts((list) => [...fresh.slice(0, 3), ...list].slice(0, 3));
        }
      },
      { intervalMs: POLL_MS, onError: (error) => console.error('Failed to load notifications', error) },
    );
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [currentUserId]);

  const markAllRead = useCallback(() => {
    if (!currentUserId) return;
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    markAllNotificationsRead(currentUserId).catch((err) =>
      console.error('Failed to mark notifications read', err),
    );
  }, [currentUserId]);

  const markRead = useCallback((id: string) => {
    if (!currentUserIdRef.current || !id) return;
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    markNotificationRead(id).catch((err) =>
      console.error('Failed to mark notification read', err),
    );
  }, []);

  const unreadCount = notifications.reduce((sum, n) => (n.isRead ? sum : sum + 1), 0);
  const value = useMemo(
    () => ({ notifications, unreadCount, toasts, markAllRead, markRead, dismissToast }),
    [dismissToast, markAllRead, markRead, notifications, toasts, unreadCount],
  );

  return (
    <NotificationsCtx.Provider value={value}>
      {children}
    </NotificationsCtx.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

// Resolves a notification into its click-through action, shared by the dropdown
// items and the floating toasts:
//   • a 'like' jumps to the feed and highlights the liked post
//   • a 'message' opens the DM thread with the sender
// The notification is marked read as a side effect of following it.
export function useNotificationNavigate() {
  const { markRead } = useNotifications();
  const { openThreadWith } = useStore();
  const { setView, setOpenThreadId, setFocusedPostId, setRightOpen } = useUI();

  return useCallback(
    (n: Notification) => {
      markRead(n.id);
      if (n.type === 'like' && n.postId) {
        setView('feed');
        setFocusedPostId(n.postId);
      } else if (n.type === 'message') {
        const tid = n.threadId || openThreadWith(n.actorId);
        setOpenThreadId(tid);
        setView('messenger');
      }
      setRightOpen(false);
    },
    [markRead, openThreadWith, setView, setOpenThreadId, setFocusedPostId, setRightOpen],
  );
}
