import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, Heart, Loader2, MessageCircle, Share, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore, getUser } from '@/store/context';
import { useNotifications, useNotificationNavigate } from '@/store/notifications';
import { timeAgo } from '@/utils/format';
import type { Notification as AppNotification } from '@/types';
import {
  enablePushNotifications,
  getPushStatus,
  updatePushPresence,
  type PushStatus,
} from '@/utils/pushNotifications';

const PUSH_PROMPT_DISMISSED_KEY = 'oc.pushPromptDismissed';
const IOS_DISMISS_KEY = 'oc.iosPushInstallDismissed';

export function NotificationBell({ activeThreadId }: { activeThreadId: string | null }) {
  const store = useStore();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNotificationNavigate();
  const [open, setOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('disabled');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshPushStatus = useCallback(async () => {
    const nextStatus = await getPushStatus();
    setPushStatus(nextStatus);
    return nextStatus;
  }, []);

  useEffect(() => {
    void refreshPushStatus().then((nextStatus) => {
      if (nextStatus === 'unavailable') {
        setShowIosBanner(localStorage.getItem(IOS_DISMISS_KEY) !== '1');
        return;
      }
      if (nextStatus === 'disabled' && window.Notification.permission === 'granted') {
        void enablePushNotifications()
          .then((syncedStatus) => setPushStatus(syncedStatus))
          .catch(() => undefined);
        return;
      }
      if (
        nextStatus === 'disabled' &&
        window.Notification.permission === 'default' &&
        sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) !== '1'
      ) {
        setShowPushPrompt(true);
      }
    }).catch(() => setPushMessage('Unable to check lock-screen alert settings.'));
  }, [refreshPushStatus]);

  useEffect(() => {
    const sendPresence = () => void updatePushPresence(activeThreadId).catch(() => undefined);
    sendPresence();
    const interval = window.setInterval(sendPresence, 45_000);
    window.addEventListener('focus', sendPresence);
    document.addEventListener('visibilitychange', sendPresence);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', sendPresence);
      document.removeEventListener('visibilitychange', sendPresence);
    };
  }, [activeThreadId]);

  useEffect(() => {
    if (!pushMessage) return;
    const timeout = window.setTimeout(() => setPushMessage(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [pushMessage]);

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

  const follow = (n: AppNotification) => {
    navigate(n);
    setOpen(false);
  };

  const enablePush = async () => {
    if (pushBusy || pushStatus === 'enabled') return;
    if (pushStatus === 'unavailable') {
      setShowIosBanner(true);
      return;
    }
    setPushBusy(true);
    setPushMessage('');
    try {
      const nextStatus = await enablePushNotifications();
      setPushStatus(nextStatus);
      setShowPushPrompt(false);
      if (nextStatus === 'enabled') {
        setPushMessage('Lock-screen alerts are enabled on this device.');
        void updatePushPresence(activeThreadId).catch(() => undefined);
      } else if (nextStatus === 'unconfigured') {
        setPushMessage('Lock-screen alerts are not configured yet.');
      } else if (nextStatus === 'denied') {
        setPushMessage('Notifications are blocked in your browser settings.');
      } else if (nextStatus === 'unavailable') {
        setShowIosBanner(true);
      }
    } catch (caught) {
      setPushMessage(caught instanceof Error ? caught.message : 'Unable to enable lock-screen alerts.');
    } finally {
      setPushBusy(false);
    }
  };

  const toggleNotifications = () => {
    setOpen((value) => !value);
    void refreshPushStatus().catch(() => undefined);
  };

  const dismissPushPrompt = () => {
    setShowPushPrompt(false);
    sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1');
  };

  const dismissIosBanner = () => {
    setShowIosBanner(false);
    localStorage.setItem(IOS_DISMISS_KEY, '1');
  };

  const pushLabel: Record<PushStatus, string> = {
    unsupported: 'Lock-screen alerts are not supported by this browser.',
    unavailable: 'Add OrthodoxConnect to your Home Screen to enable lock-screen alerts.',
    unconfigured: 'Lock-screen alerts are not configured yet.',
    denied: 'Notifications are blocked in your browser settings.',
    disabled: 'Enable lock-screen alerts for new messages.',
    enabled: 'Lock-screen alerts are enabled on this device.',
  };

  return (
    <>
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleNotifications}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-ink-800 hover:text-gold-200"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-ink-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-3 right-3 top-14 z-50 mt-2 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-card animate-scale-in sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[22rem] sm:max-w-[90vw]"
          role="dialog"
          aria-label="Notifications"
        >
            <div className="flex items-center justify-between gap-2 border-b border-ink-700 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="text-sm font-bold text-ink-100">Notifications</span>
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-gold-300 transition-colors hover:text-gold-200 disabled:opacity-40 sm:gap-1.5 sm:text-xs"
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto overscroll-contain scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs leading-5 text-ink-400 sm:px-4 sm:py-10">
                  You have no notifications yet.
                </div>
              ) : (
                notifications.map((n) => {
                  const actor = getUser(store, n.actorId);
                  return (
                    <button
                      key={n.id}
                      onClick={() => follow(n)}
                      className={`group flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-750 sm:gap-3 sm:px-4 sm:py-3 ${
                        n.isRead ? '' : 'bg-gold-400/5'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar src={actor?.photo ?? ''} name={n.actorName || 'Member'} size={38} />
                        <span
                          className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-white ${
                            n.type === 'like' ? 'bg-red-500' : 'bg-gold-500'
                          }`}
                        >
                          {n.type === 'like' ? <Heart size={9} className="fill-white" /> : <MessageCircle size={9} />}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-5 text-ink-100 sm:text-sm sm:leading-snug">
                          <span className="font-semibold">{n.actorName || 'A member'}</span>{' '}
                          <span className="text-ink-300">{n.content ?? ''}</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-400">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-ink-700 bg-ink-850 px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  pushStatus === 'enabled' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-ink-700 text-gold-200'
                }`}>
                  {pushBusy ? <Loader2 size={16} className="animate-spin" /> : pushStatus === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
                </span>
                <p className="min-w-0 flex-1 text-[11px] leading-4 text-ink-300">{pushLabel[pushStatus]}</p>
                {(pushStatus === 'disabled' || pushStatus === 'unconfigured') && (
                  <button
                    type="button"
                    onClick={() => void enablePush()}
                    disabled={pushBusy}
                    className="shrink-0 rounded-full bg-gold-400 px-3 py-1.5 text-[11px] font-bold text-ink-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
                  >
                    Enable
                  </button>
                )}
              </div>
              {pushMessage && <p className="mt-2 text-[11px] leading-4 text-gold-100">{pushMessage}</p>}
            </div>
          </div>
      )}
    </div>

    {showPushPrompt && (
      <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-gold-400/40 bg-ink-900/95 p-3 shadow-card backdrop-blur-md animate-slide-up sm:bottom-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400/15 text-gold-200">
          <Bell size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-100">Enable lock-screen alerts for new messages?</p>
          <p className="mt-0.5 text-xs leading-4 text-ink-400">Stay notified even when OrthodoxConnect is closed.</p>
        </div>
        <button
          type="button"
          onClick={() => void enablePush()}
          disabled={pushBusy}
          className="shrink-0 rounded-full bg-gold-400 px-3 py-2 text-xs font-bold text-ink-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
        >
          {pushBusy ? 'Enabling…' : 'Enable'}
        </button>
        <button type="button" onClick={dismissPushPrompt} className="shrink-0 text-ink-400 hover:text-ink-100" aria-label="Dismiss alert prompt">
          <X size={18} />
        </button>
      </div>
    )}

    {showIosBanner && (
      <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-gold-400/40 bg-ink-900/95 p-3 shadow-card backdrop-blur-md animate-slide-up sm:bottom-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-400/15 text-gold-200">
          <Share size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-100">Add OrthodoxConnect to your Home Screen</p>
          <p className="mt-1 text-xs leading-5 text-ink-300">
            On iPhone or iPad, tap <Share size={12} className="mx-0.5 inline" /> Share, then “Add to Home Screen” to enable lock-screen alerts.
          </p>
        </div>
        <button type="button" onClick={dismissIosBanner} className="shrink-0 text-ink-400 hover:text-ink-100" aria-label="Dismiss iOS install instructions">
          <X size={18} />
        </button>
      </div>
    )}
    </>
  );
}
