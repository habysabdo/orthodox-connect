import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneOff, Video } from 'lucide-react';
import { Avatar } from './ui';
import { useStore, getUser } from '@/store/context';
import { useUI } from '@/store/ui';
import { CALL_RING_MS, subscribeToIncomingCalls, type IncomingCall } from '@/utils/callSignaling';
import { startRingtone } from '@/utils/ringtone';

/**
 * The global incoming-call listener. It is mounted once for the signed-in member
 * — outside every view, because a call can arrive while they are reading the
 * feed, writing a message or already in another prayer room. While a call is
 * ringing it takes over the screen with Accept and Decline, and a ringtone
 * plays until the call is answered, declined or missed.
 */
export function IncomingCallOverlay() {
  const store = useStore();
  const { currentUserId } = store;
  const { openMeeting } = useUI();
  const [call, setCall] = useState<IncomingCall | null>(null);
  // Rooms this member has already been rung about, so a duplicate broadcast
  // cannot restart the ringtone for a call they just declined.
  const answeredRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;
    return subscribeToIncomingCalls(currentUserId, (incoming) => {
      // Never ring a member about their own call, and ignore a ring that was
      // delivered so late that the caller has long since given up.
      if (incoming.callerId === currentUserId) return;
      if (Date.now() - incoming.startedAt > CALL_RING_MS) return;
      if (answeredRooms.current.has(incoming.roomId)) return;
      setCall((current) => (current ? current : incoming));
    });
  }, [currentUserId]);

  // The ringtone is tied to the call being on screen: it starts with the
  // overlay and stops however the overlay goes away.
  useEffect(() => {
    if (!call) return;
    const stopRinging = startRingtone();
    const missedTimer = window.setTimeout(() => setCall(null), CALL_RING_MS);
    return () => {
      stopRinging();
      window.clearTimeout(missedTimer);
    };
  }, [call]);

  const dismiss = useCallback(() => {
    setCall((current) => {
      if (current) answeredRooms.current.add(current.roomId);
      return null;
    });
  }, []);

  const accept = useCallback(() => {
    if (!call) return;
    answeredRooms.current.add(call.roomId);
    setCall(null);
    openMeeting(call.roomId, call.title);
  }, [call, openMeeting]);

  // Escape declines, which is what a member reaches for to silence a call.
  useEffect(() => {
    if (!call) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [call, dismiss]);

  if (!call || !currentUserId) return null;

  // Prefer the roster's copy of the caller, so a member who changed their photo
  // since the call was dialled still shows up correctly.
  const caller = getUser(store, call.callerId);
  const callerName = caller?.name?.trim() || call.callerName;
  const callerPhoto = caller?.photo || call.callerPhoto || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming video call from ${callerName}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/92 p-4 backdrop-blur-md"
    >
      <div className="card w-full max-w-sm p-6 text-center animate-slide-up">
        <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Incoming video call
        </p>

        <div className="relative mx-auto mt-5 w-fit">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold-400/25" aria-hidden="true" />
          <Avatar src={callerPhoto} name={callerName} size={96} ring="gold" className="relative" />
        </div>

        <h2 className="mt-4 font-serif text-2xl font-semibold text-ink-100">{callerName}</h2>
        <p className="mt-1 text-sm text-ink-400">is calling you · ringing…</p>

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 active:scale-[0.98]"
          >
            <PhoneOff size={18} aria-hidden="true" /> Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Video size={18} aria-hidden="true" /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
