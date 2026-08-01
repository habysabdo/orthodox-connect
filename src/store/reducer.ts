import {
  connectedUsers,
  groupCacheKey,
  threadIdFor,
  type AppState,
} from './context';
import type {
  CalendarEvent,
  ChatMessage,
  CommunityAlert,
  Group,
  LiveChatMessage,
  LiveStream,
  Post,
  Thread,
  User,
} from '../types';
import { loadCachedAppState } from './persistence';
import { postComments, postLikes } from '../utils/postSafety';

/** Add or remove an id from a like list without assuming the list exists. */
function toggled(ids: string[], userId: string): string[] {
  return ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId];
}

export type Action =
  | { type: 'SIGN_IN'; user: User }
  | { type: 'AUTH_CHECKED' }
  | { type: 'COMPLETE_ONBOARDING'; data: { name: string; age: number; photo: string; parish: string; bio?: string } }
  | { type: 'HYDRATE_PROFILE'; userId: string; data: Partial<User> }
  | { type: 'HYDRATE_USERS'; users: User[] }
  | { type: 'HYDRATE_GROUPS'; groups: Group[] }
  | { type: 'SET_ACTIVE_GROUP'; groupId: string | null }
  | { type: 'HYDRATE_FOLLOWS'; following: string[]; followers: string[] }
  | { type: 'HYDRATE_POSTS'; posts: Post[]; cacheKey?: string; hasMore?: boolean }
  | { type: 'APPEND_POSTS'; posts: Post[]; cacheKey: string; hasMore: boolean }
  | { type: 'SET_POSTS_LOADING'; loading: boolean }
  | { type: 'SET_POSTS_LOADING_MORE'; loading: boolean }
  | { type: 'HYDRATE_THREADS'; threads: Thread[] }
  | { type: 'SIGN_OUT' }
  | { type: 'CREATE_POST'; post: Post; cacheKey: string }
  | { type: 'RESHARE_POST'; post: Post; cacheKey: string; originalPostId: string }
  | { type: 'UPDATE_POST'; post: Post }
  | { type: 'UPSERT_POST'; post: Post; cacheKey: string }
  | { type: 'TOGGLE_LIKE'; postId: string; userId: string }
  | { type: 'ADD_COMMENT'; postId: string; comment: { id: string; authorId: string; text: string; createdAt: number } }
  | { type: 'FLAG_POST'; postId: string; reason: string }
  | { type: 'UNFLAG_POST'; postId: string }
  | { type: 'DELETE_POST'; postId: string }
  | { type: 'FOLLOW_USER'; userId: string }
  | { type: 'UNFOLLOW_USER'; userId: string }
  | { type: 'SEND_MESSAGE'; message: ChatMessage }
  | { type: 'MARK_THREAD_READ'; threadId: string; userId: string; readAt: number }
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
  const cached = loadCachedAppState();
  const postsCache = cached?.postsCache ?? {};
  const publicPosts = postsCache[groupCacheKey(null)] ?? [];
  return {
    users: cached ? [cached.user] : [],
    currentUserId: cached?.user.id ?? null,
    authChecked: false,
    groups: [],
    activeGroupId: null,
    posts: publicPosts,
    postsCache,
    postsHasMoreCache: cached?.postsHasMoreCache ?? {},
    postsLoading: !cached,
    postsLoadingMore: false,
    postsHasMore: cached?.postsHasMoreCache[groupCacheKey(null)] ?? false,
    usersLoading: true,
    groupsLoading: true,
    following: [],
    followers: [],
    followsLoading: true,
    threads: [],
    streams: [],
    events: [],
    alerts: [],
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SIGN_IN':
      return { ...state, users: upsertUser(state.users, action.user), currentUserId: action.user.id, authChecked: true };

    case 'AUTH_CHECKED':
      return state.authChecked ? state : { ...state, authChecked: true };

    case 'COMPLETE_ONBOARDING': {
      if (!state.currentUserId) return state;
      return {
        ...state,
        users: state.users.map((u) =>
          u?.id === state.currentUserId
            ? { ...u, ...action.data, onboarded: true }
            : u,
        ),
      };
    }

    case 'HYDRATE_PROFILE':
      return {
        ...state,
        users: state.users.map((u) =>
          u?.id === action.userId ? { ...u, ...action.data, id: u.id } : u,
        ),
      };

    case 'HYDRATE_USERS': {
      // Replace the roster with the live set of registered members from the
      // database. The signed-in member is kept from local state (not the DB
      // copy) so an in-flight profile edit or a just-completed onboarding is
      // never clobbered by a background refresh.
      const me = state.users.find((u) => u?.id === state.currentUserId);
      const usersById = new Map(action.users.filter((user) => user?.id).map((user) => [user.id, user]));
      if (me) usersById.set(me.id, { ...usersById.get(me.id), ...me });
      return { ...state, users: [...usersById.values()], usersLoading: false };
    }

    case 'HYDRATE_GROUPS':
      return { ...state, groups: action.groups, groupsLoading: false };

    case 'SET_ACTIVE_GROUP':
      return {
        ...state,
        activeGroupId: action.groupId,
        postsHasMore: state.postsHasMoreCache[groupCacheKey(action.groupId)] ?? false,
      };

    case 'HYDRATE_FOLLOWS':
      return { ...state, following: action.following, followers: action.followers, followsLoading: false };

    case 'HYDRATE_POSTS':
      return {
        ...state,
        posts:
          !action.cacheKey || action.cacheKey === groupCacheKey(state.activeGroupId)
            ? action.posts
            : state.posts,
        postsLoading: false,
        postsLoadingMore: false,
        postsHasMore: action.hasMore ?? state.postsHasMore,
        // Remember this space's feed so returning to it is instant. Only cache
        // when a key is supplied (a real fetch), not when replaying the cache.
        postsCache: action.cacheKey
          ? { ...state.postsCache, [action.cacheKey]: action.posts }
          : state.postsCache,
        postsHasMoreCache: action.cacheKey && action.hasMore !== undefined
          ? { ...state.postsHasMoreCache, [action.cacheKey]: action.hasMore }
          : state.postsHasMoreCache,
      };

    case 'APPEND_POSTS': {
      const existing = state.postsCache[action.cacheKey] ?? [];
      const ids = new Set(existing.map((post) => post.id));
      const combined = [...existing, ...action.posts.filter((post) => !ids.has(post.id))];
      return {
        ...state,
        posts: action.cacheKey === groupCacheKey(state.activeGroupId) ? combined : state.posts,
        postsCache: { ...state.postsCache, [action.cacheKey]: combined },
        postsHasMoreCache: { ...state.postsHasMoreCache, [action.cacheKey]: action.hasMore },
        postsHasMore: action.cacheKey === groupCacheKey(state.activeGroupId) ? action.hasMore : state.postsHasMore,
        postsLoadingMore: false,
      };
    }

    case 'SET_POSTS_LOADING':
      return { ...state, postsLoading: action.loading };

    case 'SET_POSTS_LOADING_MORE':
      return { ...state, postsLoadingMore: action.loading };

    case 'HYDRATE_THREADS':
      return { ...state, threads: action.threads };

    case 'SIGN_OUT':
      return {
        ...state,
        currentUserId: null,
        groups: [],
        activeGroupId: null,
        posts: [],
        postsCache: {},
        postsHasMoreCache: {},
        postsLoading: false,
        postsLoadingMore: false,
        postsHasMore: false,
        usersLoading: true,
        groupsLoading: true,
        following: [],
        followers: [],
        followsLoading: true,
      };

    case 'UPDATE_POST':
      return {
        ...state,
        posts: state.posts.map((post) => post.id === action.post.id ? action.post : post),
        postsCache: Object.fromEntries(
          Object.entries(state.postsCache).map(([key, posts]) => [
            key,
            posts.map((post) => post.id === action.post.id ? action.post : post),
          ]),
        ),
      };

    case 'UPSERT_POST':
      return {
        ...state,
        posts: [action.post, ...state.posts.filter((post) => post.id !== action.post.id)],
        postsCache: {
          ...state.postsCache,
          [action.cacheKey]: [
            action.post,
            ...(state.postsCache[action.cacheKey] ?? []).filter((post) => post.id !== action.post.id),
          ],
        },
      };

    case 'CREATE_POST':
      return {
        ...state,
        posts: [action.post, ...state.posts.filter((post) => post.id !== action.post.id)],
        postsCache: {
          ...state.postsCache,
          [action.cacheKey]: [
            action.post,
            ...(state.postsCache[action.cacheKey] ?? []).filter((post) => post.id !== action.post.id),
          ],
        },
      };

    case 'RESHARE_POST': {
      const updateShareCount = (post: Post): Post => {
        if (post.id === action.originalPostId) return { ...post, shareCount: (post.shareCount ?? 0) + 1 };
        if (post.originalPost?.id === action.originalPostId) {
          return {
            ...post,
            shareCount: (post.shareCount ?? 0) + 1,
            originalPost: { ...post.originalPost, shareCount: (post.originalPost.shareCount ?? 0) + 1 },
          };
        }
        return post;
      };
      const posts = [action.post, ...state.posts.map(updateShareCount).filter((post) => post.id !== action.post.id)];
      return {
        ...state,
        posts,
        postsCache: Object.fromEntries(Object.entries(state.postsCache).map(([key, cachedPosts]) => [
          key,
          key === action.cacheKey
            ? [action.post, ...cachedPosts.map(updateShareCount).filter((post) => post.id !== action.post.id)]
            : cachedPosts.map(updateShareCount),
        ])),
      };
    }

    case 'TOGGLE_LIKE':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, likes: toggled(postLikes(p), action.userId) }
            : p.originalPost?.id === action.postId
              ? {
                  ...p,
                  originalPost: {
                    ...p.originalPost,
                    likes: toggled(postLikes(p.originalPost), action.userId),
                  },
                }
              : p,
        ),
      };

    case 'ADD_COMMENT':
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, comments: [...postComments(p), action.comment] }
            : p.originalPost?.id === action.postId
              ? { ...p, originalPost: { ...p.originalPost, comments: [...postComments(p.originalPost), action.comment] } }
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
      return {
        ...state,
        posts: state.posts.filter((post) => post.id !== action.postId),
        postsCache: Object.fromEntries(
          Object.entries(state.postsCache).map(([key, posts]) => [
            key,
            posts.filter((post) => post.id !== action.postId),
          ]),
        ),
      };

    case 'FOLLOW_USER':
      return state.following.includes(action.userId)
        ? state
        : { ...state, following: [...state.following, action.userId] };

    case 'UNFOLLOW_USER':
      return { ...state, following: state.following.filter((id) => id !== action.userId) };

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
            ? {
                ...t,
                messages: t.messages.map((m) => (
                  m.senderId !== action.userId && !m.isRead
                    ? { ...m, isRead: true, readAt: action.readAt }
                    : m
                )),
              }
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
        users: state.users.map((u) => (u?.id === action.userId ? { ...u, online: action.online } : u)),
      };

    default:
      return state;
  }
}

function upsertUser(users: User[], user: User): User[] {
  const exists = users.some((u) => u?.id === user.id);
  if (exists) return users.map((u) => (u?.id === user.id ? { ...u, ...user } : u));
  return [...users, user];
}

// keep lint happy about unused import path while still re-exporting helpers
export const selectors = { connectedUsers, threadIdFor };
