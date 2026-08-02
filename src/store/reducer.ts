import {
  friendsOf,
  groupCacheKey,
  threadIdFor,
  uid,
  type AppState,
} from './context';
import type {
  CalendarEvent,
  ChatMessage,
  CommunityAlert,
  Friendship,
  Group,
  Friendship as _F,
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
  | { type: 'HYDRATE_FRIENDSHIPS'; friendships: Friendship[] }
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
  | { type: 'ADD_FRIEND'; from: string; to: string }
  | { type: 'ACCEPT_FRIEND'; from: string; to: string }
  | { type: 'REMOVE_FRIEND'; a: string; b: string }
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
  
  // Normalize user ID in case cached user references subject_id
  const cachedUser = cached?.user
    ? { ...cached.user, id: (cached.user as any).subject_id || cached.user.id }
    : null;

  return {
    users: cachedUser ? [cachedUser] : [],
    currentUserId: cachedUser?.id ?? null,
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
    friendships: [],
    threads: [],
    streams: [],
    events: [],
    alerts: [],
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SIGN_IN': {
      const normalizedUser = {
        ...action.user,
        id: (action.user as any).subject_id || action.user.id,
      };
      return { 
        ...state, 
        users: upsertUser(state.users, normalizedUser), 
        currentUserId: normalizedUser.id, 
        authChecked: true 
      };
    }

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
        users: state.users.map((u) => {
          const targetId = (u as any)?.subject_id || u?.id;
          return targetId === action.userId ? { ...u, ...action.data, id: u.id } : u;
        }),
      };

    case 'HYDRATE_USERS': {
      // Normalize users payload so subject_id maps cleanly to id
      const normalizedUsers = action.users.map((u) => ({
        ...u,
        id: (u as any)?.subject_id || u?.id,
      }));

      const me = state.users.find((u) => u?.id === state.currentUserId);
      const usersById = new Map(
        normalizedUsers.filter((user) => user?.id).map((user) => [user.id, user])
      );
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

    case 'HYDRATE_FRIENDSHIPS':
      return { ...state, friendships: action.friendships };

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
  const userId = (user as any).subject_id || user.id;
  const exists = users.some((u) => ((u as any)?.subject_id || u?.id) === userId);
  
  if (exists) {
    return users.map((u) => (((u as any)?.subject_id || u?.id) === userId ? { ...u, ...user } : u));
  }
  return [...users, { ...user, id: userId }];
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

export const selectors = { friendsOf, threadIdFor };
