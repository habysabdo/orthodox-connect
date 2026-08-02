import { useMemo, useReducer, useRef, type ReactNode } from 'react';
import { ADMIN_EMAIL, type CalendarEvent, type CommunityAlert, type Post, type User } from '../types';
import {
  StoreContext,
  threadIdFor,
  uid,
  useStore,
  type AppActions,
  type AppState,
  type Store,
} from './context';
import { initialState, reducer } from './reducer';
import { useMockSocket } from './mockSocket';

const GOOGLE_PHOTOS = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
  'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg',
];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Keep a live ref so action callbacks always read the freshest state,
  // regardless of how the actions memo is memoized. This prevents stale
  // closures that caused the post-login blank screen.
  const stateRef = useRef(state);
  stateRef.current = state;

  useMockSocket(dispatch, state);

  const actions = useMemo<AppActions>(() => {
    const getCurrent = (): User | undefined =>
      stateRef.current.users.find((u) => u.id === stateRef.current.currentUserId);

    return {
      signInWithGoogle({ email, name, photo }) {
        const current = stateRef.current;
        const existing = current.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'member';
        if (existing) {
          const merged: User = {
            ...existing,
            role: role === 'admin' ? 'admin' : existing.role,
            photo: existing.onboarded ? existing.photo : photo,
            name: existing.onboarded ? existing.name : name,
            online: true,
          };
          dispatch({ type: 'SIGN_IN', user: merged });
          return merged;
        }
        const newUser: User = {
          id: uid('u'),
          email,
          name,
          age: 0,
          photo,
          parish: '',
          role,
          joinedAt: Date.now(),
          onboarded: false,
          online: true,
        };
        dispatch({ type: 'SIGN_IN', user: newUser });
        return newUser;
      },

      completeOnboarding(data) {
        dispatch({ type: 'COMPLETE_ONBOARDING', data });
      },

      signOut() {
        dispatch({ type: 'SIGN_OUT' });
      },

      createPost({ text, image }) {
        const me = getCurrent();
        if (!me) return;
        const post: Post = {
          id: uid('p'),
          authorId: me.id,
          text,
          image,
          createdAt: Date.now(),
          likes: [],
          comments: [],
        };
        dispatch({ type: 'CREATE_POST', post });
      },

      toggleLike(postId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'TOGGLE_LIKE', postId, userId: me.id });
      },

      addComment(postId, text) {
        const me = getCurrent();
        if (!me) return;
        dispatch({
          type: 'ADD_COMMENT',
          postId,
          comment: { id: uid('c'), authorId: me.id, text, createdAt: Date.now() },
        });
      },

      flagPost(postId, reason) {
        dispatch({ type: 'FLAG_POST', postId, reason });
      },
      unflagPost(postId) {
        dispatch({ type: 'UNFLAG_POST', postId });
      },
      deletePost(postId) {
        dispatch({ type: 'DELETE_POST', postId });
      },

      addFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'ADD_FRIEND', from: me.id, to: otherId });
      },
      acceptFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'ACCEPT_FRIEND', from: otherId, to: me.id });
      },
      removeFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'REMOVE_FRIEND', a: me.id, b: otherId });
      },

      sendMessage(threadId, text) {
        const me = getCurrent();
        if (!me) return;
        dispatch({
          type: 'SEND_MESSAGE',
          message: { id: uid('m'), threadId, senderId: me.id, text, createdAt: Date.now(), read: true },
        });
      },

      markThreadRead(threadId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'MARK_THREAD_READ', threadId, userId: me.id });
      },

      openThreadWith(otherId) {
        const me = getCurrent();
        if (!me) return '';
        const tid = threadIdFor(me.id, otherId);
        dispatch({
          type: 'ENSURE_THREAD',
          thread: { id: tid, participantIds: [me.id, otherId], messages: [] },
        });
        return tid;
      },

      goLive(title) {
        const me = getCurrent();
        if (!me) return '';
        const id = uid('live');
        dispatch({
          type: 'GO_LIVE',
          stream: {
            id,
            hostId: me.id,
            title: title || `${me.name} is live`,
            startedAt: Date.now(),
            viewers: 0,
            viewerIds: [],
            active: true,
            kind: 'user',
            chat: [],
          },
        });
        return id;
      },

      endLive(streamId) {
        const me = getCurrent();
        dispatch({ type: 'END_LIVE', streamId, hostId: me?.id ?? '' });
      },

      joinStream(streamId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'JOIN_STREAM', streamId, userId: me.id });
      },
      leaveStream(streamId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'LEAVE_STREAM', streamId, userId: me.id });
      },

      sendLiveChat(streamId, text) {
        const me = getCurrent();
        if (!me) return;
        dispatch({
          type: 'LIVE_CHAT',
          message: { id: uid('lc'), streamId, senderId: me.id, text, createdAt: Date.now() },
        });
      },

      addEvent(data) {
        const me = getCurrent();
        if (!me) return;
        const event: CalendarEvent = { ...data, id: uid('e'), createdBy: me.id };
        dispatch({ type: 'ADD_EVENT', event });
      },

      addAlert(data) {
        const me = getCurrent();
        if (!me) return;
        const alert: CommunityAlert = {
          ...data,
          id: uid('a'),
          createdAt: Date.now(),
          createdBy: me.id,
        };
        dispatch({ type: 'ADD_ALERT', alert });
      },
      dismissAlert(id) {
        dispatch({ type: 'DISMISS_ALERT', id });
      },
    };
    // Actions read fresh state via stateRef, so this memo is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Store>(() => ({ ...state, ...actions }), [state, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export { useStore };

// helper for the Landing page demo
export function pickGooglePhoto(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GOOGLE_PHOTOS[h % GOOGLE_PHOTOS.length];
}
