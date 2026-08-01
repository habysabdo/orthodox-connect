import { createContext, useContext } from 'react';
import type {
  CalendarEvent,
  ChatAttachment,
  ChatMessage,
  CommunityAlert,
  Group,
  LiveStream,
  Post,
  Thread,
  User,
} from '../types';

export interface AppState {
  users: User[];
  currentUserId: string | null;
  // Whether the initial Identity session restore has completed. Starts false so
  // the app can show a loading state instead of flashing the logged-out landing
  // page while getUser() resolves (noticeably slower on mobile), and so no
  // database query is fired against a session that has not been established yet.
  authChecked: boolean;
  groups: Group[];
  activeGroupId: string | null;
  posts: Post[];
  // Feed posts fetched per space, keyed by `groupCacheKey`. Revisiting a space
  // renders its cached posts instantly while a background refresh runs, so
  // switching spaces never blanks the feed or refetches from scratch.
  postsCache: Record<string, Post[]>;
  postsHasMoreCache: Record<string, boolean>;
  // True while the active space's feed is being fetched with no cached copy to
  // show in the meantime — drives the feed loading skeleton.
  postsLoading: boolean;
  postsLoadingMore: boolean;
  postsHasMore: boolean;
  // True until the community roster and groups have been loaded once, so the
  // network and spaces UIs can show skeletons instead of a misleading "empty".
  usersLoading: boolean;
  groupsLoading: boolean;
  /** Ids of the members the signed-in member follows. */
  following: string[];
  /** Ids of the members who follow the signed-in member. */
  followers: string[];
  /** True until the follow graph has been read once for this session. */
  followsLoading: boolean;
  threads: Thread[];
  streams: LiveStream[];
  events: CalendarEvent[];
  alerts: CommunityAlert[];
}

export interface AppActions {
  // auth
  completeOnboarding: (data: { name: string; age: number; photo: string; parish: string; bio?: string }) => Promise<void>;
  signOut: () => void;
  createGroup: (name: string, description: string) => Promise<Group>;
  setActiveGroup: (groupId: string | null) => Promise<void>;
  refreshGroups: () => Promise<void>;

  // posts
  createPost: (data: { text: string; image?: string; video?: string; videoStatus?: Post['videoStatus']; meeting?: Post['meeting'] }) => Post | undefined;
  createPromoPost: (data: { title: string; text: string; image?: string; video?: string; videoStatus?: Post['videoStatus'] }) => Promise<Post | undefined>;
  resharePost: (postId: string, kind: 'repost' | 'quote', quote?: string) => Promise<Post | undefined>;
  updatePostVideo: (postId: string, video?: string, status?: Post['videoStatus'], error?: string) => Promise<void>;
  loadMorePosts: () => Promise<void>;
  loadPostById: (postId: string) => Promise<void>;
  toggleLike: (postId: string, sourcePost?: Post) => void;
  addComment: (postId: string, text: string, sourcePost?: Post) => void;
  flagPost: (postId: string, reason: string) => void;
  unflagPost: (postId: string) => void;
  deletePost: (postId: string) => void;

  // follows
  followUser: (otherId: string) => Promise<void>;
  unfollowUser: (otherId: string) => Promise<void>;

  // chat
  sendMessage: (threadId: string, text: string, attachments?: ChatAttachment[]) => void;
  markThreadRead: (threadId: string) => void;
  openThreadWith: (otherId: string) => string;

  // live
  goLive: (title: string, sourceUrl?: string) => string;
  endLive: (streamId: string) => void;
  joinStream: (streamId: string) => void;
  leaveStream: (streamId: string) => void;
  sendLiveChat: (streamId: string, text: string) => void;

  // calendar
  addEvent: (data: Omit<CalendarEvent, 'id' | 'createdBy'>) => void;

  // admin
  addAlert: (data: Omit<CommunityAlert, 'id' | 'createdAt' | 'createdBy'>) => void;
  dismissAlert: (id: string) => void;
}

export type Store = AppState & AppActions;

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ----- selectors / helpers (pure) -----

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const threadIdFor = (a: string, b: string) =>
  [a, b].sort().join('__');

// Stable cache key for a space's feed. The public feed has no group id, so it
// is keyed under a reserved 'public' bucket alongside each group's own id.
export const groupCacheKey = (groupId: string | null | undefined) => groupId ?? 'public';

export function getUser(state: AppState, id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return state.users.find((u) => u?.id === id);
}

export function isFollowing(state: AppState, userId: string): boolean {
  return state.following.includes(userId);
}

/** The members the signed-in member follows, in roster order. */
export function followingUsers(state: AppState): User[] {
  const ids = new Set(state.following);
  return state.users.filter((user) => user && ids.has(user.id));
}

/** The members who follow the signed-in member. */
export function followerUsers(state: AppState): User[] {
  const ids = new Set(state.followers);
  return state.users.filter((user) => user && ids.has(user.id));
}

// People a member can start a conversation with: everybody they follow, plus
// everybody who follows them, so a DM is never blocked by a one-way follow.
export function connectedUsers(state: AppState): User[] {
  const ids = new Set([...state.following, ...state.followers]);
  return state.users.filter((user) => user && ids.has(user.id));
}

export function threadForUsers(state: AppState, a: string, b: string): Thread | undefined {
  const id = threadIdFor(a, b);
  return state.threads.find((t) => t?.id === id);
}

// A thread can arrive from a cached payload without its `messages` or
// `participantIds` array, so both are treated as possibly absent here.
export function unreadCountFor(state: AppState, userId: string): number {
  return state.threads.reduce((sum, t) => {
    if (!t?.participantIds?.includes(userId)) return sum;
    if (!Array.isArray(t.messages)) return sum;
    return sum + t.messages.filter((m: ChatMessage) => m.senderId !== userId && !m.isRead).length;
  }, 0);
}
