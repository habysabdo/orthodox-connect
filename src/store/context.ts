import { createContext, useContext } from 'react';
import type {
  CalendarEvent,
  ChatMessage,
  CommunityAlert,
  Friendship,
  LiveStream,
  Post,
  Thread,
  User,
} from '../types';

export interface AppState {
  users: User[];
  currentUserId: string | null;
  posts: Post[];
  friendships: Friendship[];
  threads: Thread[];
  streams: LiveStream[];
  events: CalendarEvent[];
  alerts: CommunityAlert[];
}

export interface AppActions {
  // auth
  signInWithGoogle: (info: { email: string; name: string; photo: string }) => User;
  completeOnboarding: (data: { name: string; age: number; photo: string; parish: string }) => void;
  signOut: () => void;

  // posts
  createPost: (data: { text: string; image?: string }) => void;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, text: string) => void;
  flagPost: (postId: string, reason: string) => void;
  unflagPost: (postId: string) => void;
  deletePost: (postId: string) => void;

  // friendships
  addFriend: (otherId: string) => void;
  acceptFriend: (otherId: string) => void;
  removeFriend: (otherId: string) => void;

  // chat
  sendMessage: (threadId: string, text: string) => void;
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

// ----- selectors / helpers (pure) -----

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const threadIdFor = (a: string, b: string) =>
  [a, b].sort().join('__');

export function getUser(state: AppState, id: string | null): User | undefined {
  if (!id) return undefined;
  return state.users.find((u) => u.id === id);
}

export function friendsOf(state: AppState, userId: string): User[] {
  return state.friendships
    .filter((f) => f.status === 'accepted' && (f.a === userId || f.b === userId))
    .map((f) => (f.a === userId ? f.b : f.a))
    .map((id) => state.users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));
}

export function friendshipBetween(state: AppState, a: string, b: string): Friendship | undefined {
  return state.friendships.find(
    (f) => (f.a === a && f.b === b) || (f.a === b && f.b === a),
  );
}

export function threadForUsers(state: AppState, a: string, b: string): Thread | undefined {
  const id = threadIdFor(a, b);
  return state.threads.find((t) => t.id === id);
}

export function unreadCountFor(state: AppState, userId: string): number {
  return state.threads.reduce((sum, t) => {
    if (!t.participantIds.includes(userId)) return sum;
    return sum + t.messages.filter((m: ChatMessage) => m.senderId !== userId && !m.read).length;
  }, 0);
}
