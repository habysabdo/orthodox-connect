import { useCallback, useEffect, useRef, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { ArrowLeft, Check, Copy, Loader2, Users, Video } from 'lucide-react';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { JITSI_DOMAIN, jitsiRoomName, meetingUrl, sanitizeMeetingId } from '@/utils/meetings';

/** Buttons the prayer room exposes — everything else Jitsi ships is hidden. */
const TOOLBAR_BUTTONS = [
  'microphone',
  'camera',
  'desktop',
  'chat',
  'raisehand',
  'tileview',
  'hangup',
  'sharetimesheet',
];

function MeetingSpinner() {
  return (
    <div className="grid h-full w-full place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-3 text-ink-300">
        <Loader2 size={30} className="animate-spin text-gold-300" aria-hidden="true" />
        <p className="text-sm font-medium">Connecting you to the prayer room…</p>
      </div>
    </div>
  );
}

/**
 * The full-screen group meeting. The room is identified entirely by the
 * `/meet/:roomId` link, so anyone who has the link — from the feed, a chat
 * invite, or a message elsewhere — joins the same conference.
 */
export function MeetingView() {
  const { users, currentUserId } = useStore();
  const { meetingRoomId, meetingTitle, setView } = useUI();
  const me = users.find((user) => user.id === currentUserId);
  const [copied, setCopied] = useState(false);
  const [closed, setClosed] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const roomId = sanitizeMeetingId(meetingRoomId ?? '');
  const heading = meetingTitle?.trim() || 'Prayer Room';

  const leave = useCallback(() => setView('feed'), [setView]);

  useEffect(() => {
    if (closed) leave();
  }, [closed, leave]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingUrl(roomId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!roomId) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center">
        <div className="card max-w-md p-8">
          <Video size={30} className="mx-auto text-gold-300" aria-hidden="true" />
          <h1 className="mt-4 font-serif text-2xl font-semibold text-ink-100">This meeting link is incomplete</h1>
          <p className="mt-2 text-sm text-ink-400">Ask the host to share the invite again, or start a new prayer meeting from the feed.</p>
          <button onClick={leave} className="gold-btn mx-auto mt-6">
            <ArrowLeft size={16} /> Back to the feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-ink-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-950/95 px-3 py-2.5 sm:px-4">
        <button onClick={leave} className="ghost-btn shrink-0 py-2" aria-label="Leave the meeting">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Leave</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate font-serif text-base font-semibold text-ink-100 sm:text-lg">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="truncate">{heading}</span>
          </h1>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-ink-400">
            <Users size={12} aria-hidden="true" /> Anyone with the link can join · {roomId}
          </p>
        </div>
        <button onClick={() => void copyLink()} className="ghost-btn shrink-0 py-2" aria-label="Copy the invite link">
          {copied ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
          <span className="hidden sm:inline">{copied ? 'Link copied' : 'Copy invite'}</span>
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <JitsiMeeting
          domain={JITSI_DOMAIN}
          roomName={jitsiRoomName(roomId)}
          userInfo={{
            displayName: me?.name || 'Community Member',
            email: me?.email || '',
          }}
          configOverwrite={{
            // Members are already signed in to OrthodoxConnect, so the prejoin
            // screen and the lobby only add a "Waiting for moderator" wall
            // between them and the prayer room. `prejoinConfig` is the current
            // key; `prejoinPageEnabled` is kept for older Jitsi deployments.
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableLobbyChat: false,
            // When a deployment does put a room behind a lobby, knock straight
            // away instead of parking the member on a button.
            lobby: { autoKnock: true, enableChat: false },
            disableModeratorIndicator: false,
            toolbarButtons: TOOLBAR_BUTTONS,
          }}
          interfaceConfigOverwrite={{
            TOOLBAR_BUTTONS,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#090d12',
            MOBILE_APP_PROMO: false,
          }}
          spinner={MeetingSpinner}
          onApiReady={(api) => {
            // Display name and email travel in `userInfo`; the profile photo has
            // to be pushed over the external API, which is what puts a member's
            // real avatar on their tile instead of a generated initial.
            if (me?.photo) api.executeCommand('avatarUrl', me.photo);
            if (heading) api.executeCommand('subject', heading);
          }}
          onReadyToClose={() => setClosed(true)}
          getIFrameRef={(node) => {
            frameRef.current = node;
            node.style.height = '100%';
            node.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
}
