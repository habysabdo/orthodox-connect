import { useEffect } from 'react';
import { Heart, MessageCircle, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore, getUser } from '@/store/context';
import { useNotifications, useNotificationNavigate } from '@/store/notifications';
import type { Notification } from '@/types';

// How long a toast lingers before auto-dismissing.
const TOAST_MS = 5000;

// Floating alerts that appear at the top of the screen when a new notification
// arrives. Each renders `${actorName} ${content}` and follows the same
// click-through as the dropdown.
export function NotificationToasts() {
  const { toasts } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}

function ToastItem({ notification: n }: { notification: Notification }) {
  const store = useStore();
  const { dismissToast } = useNotifications();
  const navigate = useNotificationNavigate();
  const actor = getUser(store, n.actorId);

  useEffect(() => {
    const t = setTimeout(() => dismissToast(n.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [n.id, dismissToast]);

  return (
    <div
      role="alert"
      onClick={() => {
        navigate(n);
        dismissToast(n.id);
      }}
      className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/95 p-3 shadow-card backdrop-blur-md animate-slide-up"
    >
      <div className="relative shrink-0">
        <Avatar src={actor?.photo ?? ''} name={n.actorName || 'Member'} size={40} ring="gold" />
        <span
          className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-white ${
            n.type === 'like' ? 'bg-red-500' : 'bg-gold-500'
          }`}
        >
          {n.type === 'like' ? <Heart size={10} className="fill-white" /> : <MessageCircle size={10} />}
        </span>
      </div>
      <p className="min-w-0 flex-1 text-sm leading-snug text-ink-100">
        <span className="font-semibold">{n.actorName || 'A member'}</span>{' '}
        <span className="text-ink-300">{n.content ?? ''}</span>
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismissToast(n.id);
        }}
        className="shrink-0 rounded-full p-1 text-ink-400 hover:bg-ink-700 hover:text-ink-100"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
