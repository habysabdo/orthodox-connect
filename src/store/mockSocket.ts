import { useEffect, useRef } from 'react';
import { useStore } from './context';
import type { AppState } from './context';
import { uid } from './context';
import type { Action } from './reducer';

/**
 * Mock real-time socket. Drives bot activity so the app feels alive:
 *  - random friends send DMs to the current user
 *  - random users go live periodically
 *  - active streams get live-chat messages from viewers
 *  - viewer counts drift
 *  - presence flickers
 *
 * Dispatches are throttled and only run while a user is signed in.
 */
const BOT_LIVE_TITLES = [
  'Morning Prayers — Join me',
  'Quick reflection from the office',
  'Reading the Psalms together',
  'Coffee & catechism',
  'Ask a priest (live)',
  'Bible study — Gospel of John',
  'Chanting the Tone 8 Paraklesis',
];

const BOT_CHAT_LINES = [
  'Glory to God!',
  'Amen 🙏',
  'So true.',
  'Thank you for this.',
  'Lord have mercy.',
  'Can you say that again?',
  'This is a blessing.',
  'Greetings from Texas!',
  'Greetings from Sydney 🇦🇺',
  'Lord, have mercy.',
  ' axios esti 🕊️',
  'Christ is risen!',
];

const BOT_DM_LINES = [
  'Are you coming to liturgy this Sunday?',
  'Did you see the new post in the feed?',
  'Praying for you today.',
  'Can I ask you something after Vespers?',
  'Thank you for the kind words earlier.',
  'I shared your stream with my parish.',
];

export function useMockSocket(dispatch: React.Dispatch<Action>, state: AppState) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const tick = useRef(0);

  useEffect(() => {
    if (!state.currentUserId) return;
    const me = state.currentUserId;

    const interval = setInterval(() => {
      tick.current += 1;
      const t = tick.current;
      const s = stateRef.current;
      if (!s.currentUserId) return;

      // Every ~45s: a friend sends a DM
      if (t % 3 === 0) {
        const myFriends = s.users.filter(
          (u) => u.id !== me && s.friendships.some(
            (f) => f.status === 'accepted' && ((f.a === me && f.b === u.id) || (f.b === me && f.a === u.id)),
          ),
        );
        if (myFriends.length) {
          const friend = myFriends[Math.floor(Math.random() * myFriends.length)];
          const tid = [me, friend.id].sort().join('__');
          if (!s.threads.some((th) => th.id === tid)) {
            dispatch({
              type: 'ENSURE_THREAD',
              thread: { id: tid, participantIds: [me, friend.id], messages: [] },
            });
          }
          dispatch({
            type: 'SEND_MESSAGE',
            message: {
              id: uid('m'),
              threadId: tid,
              senderId: friend.id,
              text: BOT_DM_LINES[Math.floor(Math.random() * BOT_DM_LINES.length)],
              createdAt: Date.now(),
              read: false,
            },
          });
        }
      }

      // Every ~90s: a random offline user goes live
      if (t % 6 === 1) {
        const activeHosts = new Set(s.streams.filter((x) => x.active).map((x) => x.hostId));
        const candidates = s.users.filter((u) => u.id !== me && !activeHosts.has(u.id));
        if (candidates.length && s.streams.filter((x) => x.active).length < 3) {
          const host = candidates[Math.floor(Math.random() * candidates.length)];
          const newStreamId = uid('live');
          dispatch({
            type: 'GO_LIVE',
            stream: {
              id: newStreamId,
              hostId: host.id,
              title: BOT_LIVE_TITLES[Math.floor(Math.random() * BOT_LIVE_TITLES.length)],
              startedAt: Date.now(),
              viewers: 1 + Math.floor(Math.random() * 6),
              viewerIds: [],
              active: true,
              kind: 'seed',
              chat: [
                {
                  id: uid('lc'),
                  streamId: newStreamId,
                  senderId: host.id,
                  text: 'Welcome — just went live. Say hi!',
                  createdAt: Date.now(),
                },
              ],
            },
          });
        }
      }

      // Every tick: live chat on active streams
      s.streams
        .filter((st) => st.active && st.hostId !== me)
        .forEach((st) => {
          if (Math.random() < 0.55) {
            const chatters = s.users.filter((u) => u.id !== me && u.id !== st.hostId);
            if (chatters.length) {
              const sender = chatters[Math.floor(Math.random() * chatters.length)];
              dispatch({
                type: 'LIVE_CHAT',
                message: {
                  id: uid('lc'),
                  streamId: st.id,
                  senderId: sender.id,
                  text: BOT_CHAT_LINES[Math.floor(Math.random() * BOT_CHAT_LINES.length)],
                  createdAt: Date.now(),
                },
              });
            }
          }
          // viewer drift
          if (Math.random() < 0.4) {
            const delta = Math.random() < 0.6 ? 1 : -1;
            dispatch({ type: 'SET_VIEWERS', streamId: st.id, viewers: Math.max(0, st.viewers + delta) });
          }
        });

      // Occasionally flip a user's presence
      if (t % 5 === 0) {
        const others = s.users.filter((u) => u.id !== me);
        if (others.length) {
          const u = others[Math.floor(Math.random() * others.length)];
          dispatch({ type: 'TOGGLE_USER_ONLINE', userId: u.id, online: !u.online });
        }
      }
    }, 15000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUserId]);
}
