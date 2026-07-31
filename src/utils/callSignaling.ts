import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { sanitizeMeetingId } from './meetings';

// A video call is delivered over Supabase Realtime, on a broadcast channel named
// after the *recipient* — so a caller can ring a member who is anywhere in the
// app (or on any other device) without either side polling the database. The
// chat invite that accompanies the call is the durable record; this event is
// only what makes the recipient's phone ring right now.

/** Broadcast event carried on a member's personal call channel. */
export const INCOMING_CALL_EVENT = 'incoming_call';

/** How long a call rings before it is treated as missed. */
export const CALL_RING_MS = 45_000;

export interface IncomingCall {
  /** meeting room the call happens in, i.e. `/meet/:roomId` */
  roomId: string;
  /** label shown above the meeting once the call is accepted */
  title: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  /** DM thread the call was started from */
  threadId?: string;
  /** when the caller dialled, so a late-delivered ring can be ignored */
  startedAt: number;
}

function callChannelName(userId: string): string {
  return `calls:${userId}`;
}

/**
 * Broadcast payloads arrive from another member's browser, so nothing in them is
 * trusted: the room id is sanitised the same way a pasted meeting link is, and a
 * call without a room or a caller is dropped.
 */
function readIncomingCall(payload: unknown): IncomingCall | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const roomId = sanitizeMeetingId(typeof value.roomId === 'string' ? value.roomId : '');
  const callerId = typeof value.callerId === 'string' ? value.callerId.trim() : '';
  if (!roomId || !callerId) return null;
  const startedAt = typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
    ? value.startedAt
    : Date.now();
  return {
    roomId,
    title: (typeof value.title === 'string' && value.title.trim()) || 'Video call',
    callerId,
    callerName: (typeof value.callerName === 'string' && value.callerName.trim()) || 'A member',
    callerPhoto: typeof value.callerPhoto === 'string' ? value.callerPhoto : undefined,
    threadId: typeof value.threadId === 'string' ? value.threadId : undefined,
    startedAt,
  };
}

/** Listen for calls dialled to `userId`. Returns an unsubscribe function. */
export function subscribeToIncomingCalls(userId: string, onCall: (call: IncomingCall) => void): () => void {
  if (!userId) return () => undefined;
  const channel = supabase
    .channel(callChannelName(userId))
    .on('broadcast', { event: INCOMING_CALL_EVENT }, (message) => {
      const call = readIncomingCall((message as { payload?: unknown }).payload);
      if (call) onCall(call);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Ring `recipientId` about a call that is starting now. */
export function publishIncomingCall(recipientId: string, call: IncomingCall): void {
  if (!recipientId || !call.roomId) return;
  const channel: RealtimeChannel = supabase.channel(callChannelName(recipientId)).subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void channel
      .send({ type: 'broadcast', event: INCOMING_CALL_EVENT, payload: call })
      .catch((error) => console.error('Failed to ring the recipient', error))
      .finally(() => supabase.removeChannel(channel));
  });
}
