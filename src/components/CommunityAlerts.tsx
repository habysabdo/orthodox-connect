import { AlertTriangle, Info, Megaphone, X } from 'lucide-react';
import { useStore } from '@/store/context';
import type { CommunityAlert } from '@/types';

const ALERT_STYLES = {
  info: { icon: <Info size={16} />, cls: 'border-gold-400/40 bg-gold-400/5 text-gold-200' },
  warning: { icon: <AlertTriangle size={16} />, cls: 'border-amber-500/40 bg-amber-500/5 text-amber-200' },
  urgent: { icon: <Megaphone size={16} />, cls: 'border-red-500/40 bg-red-500/5 text-red-200' },
} as const;

export function CommunityAlerts({ alerts }: { alerts?: CommunityAlert[] | null }) {
  const { currentUserId, dismissAlert } = useStore();
  const visible = (Array.isArray(alerts) ? alerts : []).filter(Boolean).slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const mine = a.createdBy === currentUserId;
        // An alert stored with an unrecognised level still has to render, so an
        // unknown value falls back to the neutral 'info' styling.
        const styles = ALERT_STYLES[a.level] ?? ALERT_STYLES.info;
        return (
          <div key={a.id} className={`card flex items-start gap-3 border p-3 ${styles.cls}`}>
            <span className="mt-0.5">{styles.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="mt-0.5 text-xs opacity-80">{a.body}</p>
            </div>
            {mine && (
              <button onClick={() => dismissAlert(a.id)} className="rounded p-1 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
