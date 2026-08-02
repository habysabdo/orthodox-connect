// Group video meetings ("prayer rooms") are hosted on Jitsi Meet, embedded with
// `@jitsi/react-sdk`. Nothing about a meeting needs to be stored server-side:
// the room id in the link *is* the room, so a member who has the link can join
// from the feed, a chat thread, or a pasted URL.

const env = import.meta.env as Record<string, string | undefined>;

/**
 * The Jitsi deployment the meeting iframe connects to.
<<<<<<< HEAD
 * Defaults to `8x8.vc` or unmoderated Jitsi parameters to bypass moderator lockouts.
=======
 * Defaults strictly to public `meet.jit.si` to avoid 8x8 moderator lockouts.
>>>>>>> e2a2e8d6ee7d1a518d0612113f7d179adff8691d
 */
export const JITSI_DOMAIN = (env.VITE_JITSI_DOMAIN ?? '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '') || '8x8.vc';

/**
 * Prefix applied to every room this app opens. Rooms on a shared Jitsi
 * deployment live in one flat namespace.
 */
const ROOM_NAMESPACE = 'OrthodoxConnect';

/** Label carried inside every room id, so a room name reads as what it is. */
const ROOM_LABEL = 'PrayerRoom';

/** Legacy prefixes that older invite links may still carry. */
const ROOM_ID_PREFIX = /^(?:PrayerRoom_|meet-)/;

<<<<<<< HEAD
/** Default config overwrites to pass to Jitsi SDK to bypass lobby & moderator screens */
=======
/** Default config overwrites passed to Jitsi SDK to bypass lobby & moderator screens */
>>>>>>> e2a2e8d6ee7d1a518d0612113f7d179adff8691d
export const JITSI_CONFIG_OVERWRITE = {
  prejoinPageEnabled: false,
  enableLobby: false,
  autoKnockLobby: false,
  requireDisplayName: false,
  startWithAudioMuted: false,
  startWithVideoMuted: false,
<<<<<<< HEAD
=======
  disableDeepLinking: true,
>>>>>>> e2a2e8d6ee7d1a518d0612113f7d179adff8691d
};

/** A short, unguessable token appended to a room id. */
function roomToken(): string {
  const crypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
}

export interface MeetingInvite {
  /** id carried in the `/meet/:roomId` link */
  roomId: string;
  title: string;
  /** member who opened the room */
  hostId?: string;
  /** when the room was created, so a stale invite can be labelled */
  startedAt?: number;
}

/**
 * A fresh room id for a meeting started right now.
 */
export function createMeetingId(): string {
  return `${ROOM_LABEL}_${Date.now()}_${roomToken()}`;
}

/** Room ids travel in URLs and in a Jitsi room name, so keep them plain. */
export function sanitizeMeetingId(raw: string | undefined | null): string {
  return (raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** The in-app route for a room. */
export function meetingPath(roomId: string): string {
  return `/meet/${encodeURIComponent(sanitizeMeetingId(roomId))}`;
}

/** An absolute link to a room, safe to paste into a post or a message. */
export function meetingUrl(roomId: string): string {
  const path = meetingPath(roomId);
  if (typeof window === 'undefined' || !window.location?.origin) return path;
  return `${window.location.origin}${path}`;
}

/**
<<<<<<< HEAD
 * The Jitsi room name for a room id. Appends hash parameters if using direct iframe
 * URLs to bypass the "waiting for moderator" lobby screen completely.
=======
 * Clean Jitsi room name for a room id.
>>>>>>> e2a2e8d6ee7d1a518d0612113f7d179adff8691d
 */
export function jitsiRoomName(roomId: string): string {
  const id = sanitizeMeetingId(roomId);
  const baseName = id.startsWith(ROOM_NAMESPACE) ? id : `${ROOM_NAMESPACE}_${id}`;
  
  // Appends configuration hashes to bypass moderator login if rendered in standard iframe
  return `${baseName}#config.prejoinPageEnabled=false&config.enableLobby=false&config.autoKnockLobby=false`;
}

/** A readable fallback title for a room that arrived without one. */
export function meetingTitleFor(invite: MeetingInvite | null, roomId: string): string {
  const title = invite?.title?.trim();
  if (title) return title;
  const id = sanitizeMeetingId(roomId).replace(ROOM_ID_PREFIX, '');
  const suffix = /^\d+[_-](.+)$/.exec(id)?.[1] ?? id;
  return `Prayer Room ${suffix}`.trim();
}

/** Marker that identifies a chat message as a meeting invite. */
const CHAT_INVITE_MARKER = '[prayer-meeting]';

/**
 * Chat messages are plain text rows, so an invite is encoded into the message
 * body behind a marker the thread recognises and renders as a call card.
 */
export function encodeChatInvite(invite: MeetingInvite): string {
  const title = invite.title.trim() || 'Video call';
  return `${CHAT_INVITE_MARKER} ${title}\n${meetingUrl(invite.roomId)}`;
}

/** Read a meeting invite back out of a chat message, or null when it is not one. */
export function decodeChatInvite(text: string | undefined | null): MeetingInvite | null {
  const value = (text ?? '').trim();
  if (!value.startsWith(CHAT_INVITE_MARKER)) return null;
  const [header, ...rest] = value.slice(CHAT_INVITE_MARKER.length).split('\n');
  const roomId = parseMeetingRoomId(rest.join('\n'));
  if (!roomId) return null;
  return { roomId, title: header.trim() || 'Video call' };
}

/**
 * Pull the room id out of anything that looks like a meeting link.
 */
export function parseMeetingRoomId(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  const match = value.match(/\/meet\/([A-Za-z0-9._%-]+)/);
  if (match) {
    try {
      return sanitizeMeetingId(decodeURIComponent(match[1])) || null;
    } catch {
      return sanitizeMeetingId(match[1]) || null;
    }
  }

  if (ROOM_ID_PREFIX.test(value) && /^[A-Za-z0-9._-]+$/.test(value)) return sanitizeMeetingId(value) || null;
  return null;
}