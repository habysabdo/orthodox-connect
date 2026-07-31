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

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    seenRef.current = new Set();
    initializedRef.current = false;
    setNotifications([]);
    setToasts([]);

    if (!currentUserId) return;
    let cancelled = false;

    const stopPolling = startVisiblePolling(
      async () => {
        try {
          const rows = await loadNotifications(currentUserId);
          if (cancelled || currentUserIdRef.current !== currentUserId) return;
          setNotifications(rows);

          if (!initializedRef.current) {
            rows.forEach((r) => seenRef.current.add(r.id));
            initializedRef.current = true;
            return;
          }

          const fresh = rows.filter((r) => !seenRef.current.has(r.id));
          fresh.forEach((r) => seenRef.current.add(r.id));
          if (fresh.length) {
            setToasts((list) => [...fresh.slice(0, 3), ...list].slice(0, 3));
          }
        } catch (err) {
          console.error('[Notifications] Failed to poll notifications:', err);
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
    const userId = currentUserIdRef.current;
    if (!userId) return;
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    markAllNotificationsRead(userId).catch((err) =>
      console.error('Failed to mark notifications read', err),
    );
  }, []);

  const markRead = useCallback((id: string) => {
    if (!currentUserIdRef.current || !id) return;
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    markNotificationRead(id).catch((err) =>
      console.error('Failed to mark notification read', err),
    );
  }, []);

  const unreadCount = useMemo(
    () => notifications.reduce((sum, n) => (n.isRead ? sum : sum + 1), 0),
    [notifications],
  );

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
