import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2, Send, Video } from 'lucide-react';
import { Modal } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { createMeetingId, meetingTitleFor, meetingUrl } from '@/utils/meetings';

const TITLE_PLACEHOLDER = 'Evening Praise & Prayer';

/**
 * The "Start Prayer Meeting" creator.
 *
 * Minting a unique room id (`PrayerRoom_<timestamp>_<token>`) as soon as opened,
 * offering hosts two ways to use it: join right away, or announce it to the community feed.
 */
export function PrayerMeetingModal() {
  const { createPost } = useStore();
  const { prayerMeetingOpen, setPrayerMeetingOpen, openMeeting, setView } = useUI();
  const [title, setTitle] = useState('');
  const [roomId, setRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  // A fresh id per opening so meetings started in one session never collide.
  useEffect(() => {
    if (!prayerMeetingOpen) return;
    setRoomId(createMeetingId());
    setTitle('');
    setCopied(false);
    setPosting(false);
    setError('');
  }, [prayerMeetingOpen]);

  const heading = useMemo(
    () => meetingTitleFor(title.trim() ? { roomId, title } : null, roomId),
    [roomId, title],
  );
  const inviteLink = roomId ? meetingUrl(roomId) : '';

  const close = () => setPrayerMeetingOpen(false);

  const joinNow = () => {
    if (!roomId) return;
    // 1. Close creator modal
    setPrayerMeetingOpen(false);
    // 2. Open group Jitsi prayer room
    openMeeting(roomId, heading);
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copying failed — select the link above and copy it manually.');
    }
  };

  const postToFeed = () => {
    if (!roomId || posting) return;
    setPosting(true);
    setError('');
    const post = createPost({
      text: `${heading} — a live prayer meeting has just opened. Everyone is welcome to join.`,
      meeting: { roomId, title: heading, startedAt: Date.now() },
    });
    if (!post) {
      setPosting(false);
      setError('The invite could not be posted. Please sign in again and retry.');
      return;
    }
    setPrayerMeetingOpen(false);
    setView('feed');
  };

  return (
    <Modal open={prayerMeetingOpen} onClose={close} size="md" className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-700 px-5 py-3">
        <Video size={19} className="text-gold-300" aria-hidden="true" />
        <span className="font-semibold text-ink-100">Start a prayer meeting</span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="prayer-meeting-title" className="mb-1.5 block text-sm font-medium text-ink-200">
            Meeting title
          </label>
          <input
            id="prayer-meeting-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={TITLE_PLACEHOLDER}
            maxLength={120}
            autoFocus
            className="input"
          />
          <p className="mt-1.5 text-xs text-ink-400">
            Leave it empty and the room is simply called “{heading}”.
          </p>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-850/70 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            <Link2 size={12} aria-hidden="true" /> Invite link
          </p>
          <p className="mt-1 break-all text-xs text-ink-200">{inviteLink}</p>
          <button onClick={() => void copyLink()} className="ghost-btn mt-2 py-1.5 text-xs">
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={joinNow} disabled={!roomId} className="gold-btn flex-1 disabled:opacity-60">
            <Video size={16} /> Join now
          </button>
          <button onClick={postToFeed} disabled={!roomId || posting} className="ghost-btn flex-1 disabled:opacity-60">
            <Send size={16} /> {posting ? 'Posting…' : 'Post to feed'}
          </button>
        </div>
        <p className="text-xs text-ink-400">
          Posting to the feed publishes a “Join Live Prayer Meeting” card so anyone in the community can enter the room.
        </p>
      </div>
    </Modal>
  );
}