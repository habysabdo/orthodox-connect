import {
  seedAlerts,
  seedEvents,
  seedFriendships,
  seedLiveStream,
  seedPosts,
  seedThreads,
  seedUsers,
} from '../data/seed';
import { ADMIN_EMAIL } from '../types';
import {
  friendsOf,
  threadIdFor,
  uid,
  type AppState,
} from './context';
import type {
  CalendarEvent,
  ChatMessage,
  CommunityAlert,
  Friendship,
  Friendship as _F,
  LiveChatMessage,
  LiveStream,
  Post,
  Thread,
  User,
} from '../types';

export type Action =
  | { type: 'SIGN_IN'; user: User }
  | { type: 'COMPLETE_ONBOARDING'; data: { name: string; age: number; photo: string; parish: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'CREATE_POST'; post: Post }
  | { type: 'TOGGLE_LIKE'; postId: string; userId: string }
  | { type: 'ADD_COMMENT'; postId: string; comment: { id: string; authorId: string; text: string; createdAt: number } }
  | { type: 'FLAG_POST'; postId: string; reason: string }
  | { type: 'UNFLAG_POST'; postId: string }
  | { type: 'DELETE_POST'; postId: string }
  | { type: 'ADD_FRIEND'; from: string; to: string }
  | { type: 'ACCEPT_FRIEND'; from: string; to: string }
  | { type: 'REMOVE_FRIEND'; a: string; b: string }
  | { type: 'SEND_MESSAGE'; message: ChatMessage }
  | { type: 'MARK_THREAD_READ'; threadId: string; userId: string }
  | { type: 'ENSURE_THREAD'; thread: Thread }
  | { type: 'GO_LIVE'; stream: LiveStream }
  | { type: 'END_LIVE'; streamId: string; hostId: string }
  | { type: 'JOIN_STREAM'; streamId: string; userId: string }
  | { type: 'LEAVE_STREAM'; streamId: string; userId: string }
  | { type: 'LIVE_CHAT'; message: LiveChatMessage }
  | { type: 'SET_VIEWERS'; streamId: string; viewers: number }
  | { type: 'ADD_EVENT'; event: CalendarEvent }
  | { type: 'ADD_ALERT'; alert: CommunityAlert }
  | { type: 'DISMISS_ALERT'; id: string }
  | { type: 'TOGGLE_USER_ONLINE'; userId: string; online: boolean };

export function initialState(): AppState {
  return {
    users: seedUsers,
    currentUserId: null,
    posts: seedPosts,
    friendships: seedFriendships,
    threads: seedThreads,
    streams: [seedLiveStream],
    events: seedEvents,
    alerts: seedAlerts,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, users: upsertUser(state.users, action.user), currentUserId: action.user.id };

    case 'COMPLETE_ONBOARDING': {
      if (!state.currentUserId) return state;
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === state.currentUserId
            ? { ...u, ...action.data, onboarded: true }
            : u,
        ),
      };
    }

    case 'SIGN_OUT':
      return { ...state, currentUserId: null };

    case 'CREATE_POST':
      return { ...state, posts: [action.post, ...state.posts] };

    case 'TOGGLE_LIKE':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? {
                ...p,
                likes: p.likes.includes(action.userId)
                  ? p.likes.filter((id) => id !== action.userId)
                  : [...p.likes, action.userId],
              }
            : p,
        ),
      };

    case 'ADD_COMMENT':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, comments: [...p.comments, action.comment] }
            : p,
        ),
      };

    case 'FLAG_POST':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId ? { ...p, flagged: true, flagReason: action.reason } : p,
        ),
      };

    case 'UNFLAG_POST':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId ? { ...p, flagged: false, flagReason: undefined } : p,
        ),
      };

    case 'DELETE_POST':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.postId) };

    case 'ADD_FRIEND':
      return { ...state, friendships: upsertFriendship(state.friendships, action.from, action.to, 'outgoing') };

    case 'ACCEPT_FRIEND':
      return { ...state, friendships: upsertFriendship(state.friendships, action.to, action.from, 'accepted', true) };

    case 'REMOVE_FRIEND':
      return {
        ...state,
        friendships: state.friendships.filter(
          (f) => !((f.a === action.a && f.b === action.b) || (f.a === action.b && f.b === action.a)),
        ),
      };

    case 'SEND_MESSAGE':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.message.threadId
            ? { ...t, messages: [...t.messages, action.message] }
            : t,
        ),
      };

    case 'MARK_THREAD_READ':
      return {
        ...state,
        threads: state.threads.map((t) =>
          t.id === action.threadId
            ? { ...t, messages: t.messages.map((m) => (m.senderId !== action.userId ? { ...m, read: true } : m)) }
            : t,
        ),
      };

    case 'ENSURE_THREAD':
      return state.threads.some((t) => t.id === action.thread.id)
        ? state
        : { ...state, threads: [...state.threads, action.thread] };

    case 'GO_LIVE':
      return { ...state, streams: [action.stream, ...state.streams] };

    case 'END_LIVE':
      return {
        ...state,
        streams: state.streams.map((s) =>
          s.id === action.streamId ? { ...s, active: false, viewers: 0, viewerIds: [] } : s,
        ),
      };

    case 'JOIN_STREAM':
      return {
        ...state,
        streams: state.streams.map((s) =>
          s.id === action.streamId
            ? {
                ...s,
                viewerIds: s.viewerIds.includes(action.userId) ? s.viewerIds : [...s.viewerIds, action.userId],
                viewers: s.viewerIds.includes(action.userId) ? s.viewers : s.viewers + 1,
              }
            : s,
        ),
      };

    case 'LEAVE_STREAM':
      return {
        ...state,
        streams: state.streams.map((s) =>
          s.id === action.streamId
            ? {
                ...s,
                viewerIds: s.viewerIds.filter((id) => id !== action.userId),
                viewers: Math.max(0, s.viewers - 1),
              }
            : s,
        ),
      };

    case 'LIVE_CHAT':
      return {
        ...state,
        streams: state.streams.map((s) =>
          s.id === action.message.streamId ? { ...s, chat: [...s.chat, action.message] } : s,
        ),
      };

    case 'SET_VIEWERS':
      return {
        ...state,
        streams: state.streams.map((s) => (s.id === action.streamId ? { ...s, viewers: action.viewers } : s)),
      };

    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.event] };

    case 'ADD_ALERT':
      return { ...state, alerts: [action.alert, ...state.alerts] };

    case 'DISMISS_ALERT':
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.id) };

    case 'TOGGLE_USER_ONLINE':
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, online: action.online } : u)),
      };

    default:
      return state;
  }
}

function upsertUser(users: User[], user: User): User[] {
  const exists = users.some((u) => u.id === user.id);
  if (exists) return users.map((u) => (u.id === user.id ? { ...u, ...user } : u));
  return [...users, user];
}

function upsertFriendship(
  list: Friendship[],
  a: string,
  b: string,
  status: Friendship['status'],
  setSince = false,
): Friendship[] {
  const existing = list.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
  if (existing) {
    return list.map((f) =>
      f.id === existing.id
        ? { ...f, status, since: setSince ? Date.now() : f.since }
        : f,
    );
  }
  return [
    ...list,
    {
      id: uid('f'),
      a,
      b,
      status,
      since: setSince ? Date.now() : undefined,
    } satisfies _F,
  ];
}

// keep lint happy about unused import path while still re-exporting helpers
export const selectors = { friendsOf, threadIdFor };
