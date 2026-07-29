import { Users, Video } from 'lucide-react';
import { useUI } from '@/store/ui';
import { meetingTitleFor, meetingUrl } from '@/utils/meetings';

interface MeetingInviteCardProps {
  roomId?: string | null;
  title?: string;
  /** who opened the room, when it is known */
  hostName?: string;
  /** replaces the default "anyone with this invite" line */
  note?: string;
  /** compact layout for a chat bubble; the feed uses the full card */
  variant?: 'feed' | 'chat';
  className?: string;
}

/**
 * The "Join Live Prayer Meeting" invite. The same card is rendered on a feed
 * post and inside a message thread, so an invite looks and behaves the same
 * wherever a member finds it.
 */
export function MeetingInviteCard({
  roomId,
  title,
  hostName,
  note,
  variant = 'feed',
  className = '',
}: MeetingInviteCardProps) {
  const { openMeeting } = useUI();
  const room = (roomId ?? '').trim();
  const heading = meetingTitleFor(title && room ? { roomId: room, title } : null, room);
  const isChat = variant === 'chat';

  // Without a room id there is nothing to join, so the invite is not rendered.
  if (!room) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-br from-gold-400/12 via-ink-900/60 to-ink-900/40 ${
        isChat ? 'p-3' : 'p-4'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400/15 text-gold-200">
          <Video size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live prayer meeting
          </p>
          <p className={`mt-1 truncate font-serif font-semibold text-ink-100 ${isChat ? 'text-sm' : 'text-base'}`}>
            {heading}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-400">
            <Users size={12} aria-hidden="true" />
            {note ?? (hostName ? `${hostName} invited the community` : 'Anyone with this invite can join')}
          </p>
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-2 ${isChat ? 'mt-2.5' : 'mt-3'}`}>
        <button type="button" onClick={() => openMeeting(room, heading)} className="gold-btn py-2 text-sm">
          <Video size={15} /> Join Live Prayer Meeting
        </button>
        {/* A real link too, so the invite can be opened in a new tab or copied. */}
        <a
          href={meetingUrl(room)}
          onClick={(event) => {
            event.preventDefault();
            openMeeting(room, heading);
          }}
          className="text-[11px] text-ink-400 underline decoration-dotted hover:text-ink-200"
        >
          Open meeting link
        </a>
      </div>
    </div>
  );
}
