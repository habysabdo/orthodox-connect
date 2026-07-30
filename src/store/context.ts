import { createContext, useContext } from 'react';
import type {
  CalendarEvent,
  ChatAttachment,
  ChatMessage,
  CommunityAlert,
  Friendship,
  Group,
  LiveStream,
  Post,
  Thread,
  User,
} from '../types';

export interface AppState {
  users: User[];
  currentUserId: string | null;
  // Whether the initial Identity session restore has completed.
  authChecked: boolean;
  groups: Group[];
  activeGroupId: string | null;
  friendships: Friendship[];
  posts: Post[];
  postsCache: Record<string, Post[]>;
  postsHasMoreCache: Record<string, boolean>;
  postsLoading: boolean;
  postsLoadingMore: boolean;
  postsHasMore: boolean;
  usersLoading: boolean;
  groupsLoading: boolean;
  threads: Thread[];
  streams: LiveStream[];
  events: CalendarEvent[];
  alerts: CommunityAlert[];
}

export interface AppActions {
  // auth & onboarding
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

  // Instagram-style Follow System
  followUser: (targetUserId: string) => Promise<void>;
  unfollowUser: (targetUserId: string) => Promise<void>;
  addFriend: (otherId: string) => Promise<void>;
  acceptFriend: (otherId: string) => Promise<void>;
  removeFriend: (otherId: string) => Promise<void>;

  // chat
  sendMessage: (threadId: string, text: string, attachments?: ChatAttachment[]) => void;
  markThreadRead: (threadId: string) => void;
  openThreadWith: (otherId: string) => string;

  // live
  goLive: (title: string) => string;
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

// ----- Selectors & Helpers -----

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const threadIdFor = (a: string, b: string) =>
  [a, b].sort().join('__');

export const groupCacheKey = (groupId: string | null | undefined) => groupId ?? 'public';

export function getUser(state: AppState, id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return state.users.find((u) => u?.id === id);
}

// Helper: Check if User A follows User B
export function isFollowing(state: AppState, currentUserId: string, targetUserId: string): boolean {
  const target = getUser(state, targetUserId);
  return Boolean(target?.followers?.includes(currentUserId));
}

// Helper: Get array of Users who follow this user
export function followersOf(state: AppState, userId: string): User[] {
  const user = getUser(state, userId);
  if (!user?.followers) return [];
  const followerSet = new Set(user.followers);
  return state.users.filter((u) => u && followerSet.has(u.id));
}

// Helper: Get array of Users this user is following
export function followingOf(state: AppState, userId: string): User[] {
  const user = getUser(state, userId);
  if (!user?.following) return [];
  const followingSet = new Set(user.following);
  return state.users.filter((u) => u && followingSet.has(u.id));
}

export function friendshipBetween(state: AppState, a: string, b: string): Friendship | undefined {
  return state.friendships.find(
    (friendship) =>
      (friendship.a === a && friendship.b === b) ||
      (friendship.a === b && friendship.b === a),
  );
}

export function friendsOf(state: AppState, userId: string): User[] {
  const friendIds = new Set(
    state.friendships
      .filter((friendship) => friendship.status === 'accepted' && (friendship.a === userId || friendship.b === userId))
      .map((friendship) => (friendship.a === userId ? friendship.b : friendship.a)),
  );
  return state.users.filter((user) => friendIds.has(user.id));
}

export function threadForUsers(state: AppState, a: string, b: string): Thread | undefined {
  const id = threadIdFor(a, b);
  return state.threads.find((t) => t?.id === id);
}

export function unreadCountFor(state: AppState, userId: string): number {
  return state.threads.reduce((sum, t) => {
    if (!t?.participantIds?.includes(userId)) return sum;
    if (!Array.isArray(t.messages)) return sum;
    return sum + t.messages.filter((m: ChatMessage) => m.senderId !== userId && !m.isRead).length;
  }, 0);
}
