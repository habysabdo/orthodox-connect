// Core domain types for OrthodoxConnect

export type Role = 'admin' | 'user';
export type UserStatus = 'active' | 'blocked';
export type Theme = 'light' | 'dark' | 'ancient';

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  photo: string;
  parish: string;
  role: Role;
  status?: UserStatus;
  bio?: string;
  joinedAt: number;
  /** profile setup completed */
  onboarded: boolean;
  /** simulated presence — true when user appears online */
  online: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

/** A group video meeting (prayer room) advertised on a feed post. */
export interface PostMeeting {
  /** room id carried in the `/meet/:roomId` link */
  roomId: string;
  title: string;
  startedAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  text: string;
  image?: string;
  video?: string;
  videoStatus?: 'uploading' | 'ready' | 'failed';
  videoError?: string;
  videoUploadStartedAt?: number;
  createdAt: number;
  likes: string[]; // user ids
  comments: Comment[];
  groupId?: string | null;
  postType?: 'regular' | 'promo';
  status?: 'pending' | 'approved' | 'rejected';
  promoTitle?: string;
  flagged?: boolean;
  flagReason?: string;
  originalPostId?: string;
  repostKind?: 'repost' | 'quote';
  originalPost?: Post;
  shareCount?: number;
  /** set when the post is an invitation to a live prayer meeting */
  meeting?: PostMeeting;
}

/** One member in a post's "Liked by" list, as returned by `/api/post-likes`. */
export interface LikedByUser {
  id: string;
  name: string;
  photo: string;
  parish: string;
  role: Role;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdAt?: string;
  memberCount: number;
  membershipRole: 'creator' | 'admin' | 'member' | 'global-admin' | null;
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
}

export type GroupMembershipStatus = 'pending' | 'approved';

/** A group as shown in the discovery modal, with the current member's own
 * relationship to it. `membershipStatus` is null when they have no membership. */
export interface DiscoverableGroup {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string;
  createdAt?: string;
  memberCount: number;
  membershipStatus: GroupMembershipStatus | null;
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
}

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'accepted';

export interface Friendship {
  /** stable id combining the two user ids */
  id: string;
  a: string;
  b: string;
  status: FriendStatus;
  since?: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: number;
  isRead: boolean;
  readAt: number | null;
}

export type ChatAttachmentKind = 'image' | 'file' | 'audio';

export interface ChatAttachment {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  contentType: string;
  size: number;
  url: string;
  duration?: number;
}

export interface Thread {
  id: string;
  participantIds: [string, string];
  messages: ChatMessage[];
}

/** Kinds of in-app notification a member can receive. */
export type NotificationType = 'like' | 'message';

export interface Notification {
  id: string;
  /** recipient — the member this notification is delivered to */
  userId: string;
  /** the member who triggered it */
  actorId: string;
  actorName: string;
  type: NotificationType;
  /** human-readable tail, rendered as `${actorName} ${content}` */
  content: string;
  /** click-through target for 'like' notifications */
  postId?: string | null;
  /** click-through target for 'message' notifications */
  threadId?: string | null;
  isRead: boolean;
  createdAt: number;
}

/** Console-wide alert shown to administrators. Unlike `Notification` these are
 * not addressed to one recipient — every admin reads the same feed. */
export interface AdminNotification {
  id: string;
  /** currently only 'new_user'; kept open for future admin alert kinds */
  type: string;
  /** the account the alert is about */
  subjectId: string | null;
  subjectEmail: string;
  subjectName: string;
  /** ready-to-render line, e.g. 'New user registered: member@example.com' */
  message: string;
  read: boolean;
  createdAt: number;
}

export interface LiveChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface LiveStream {
  id: string;
  hostId: string;
  title: string;
  startedAt: number;
  viewers: number;
  viewerIds: string[];
  chat: LiveChatMessage[];
  active: boolean;
  /** seed streams render an animated canvas; user streams use webcam */
  kind: 'seed' | 'user';
}

export interface CalendarEvent {
  id: string;
  title: string;
  parish: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  description: string;
  createdBy: string;
}

export interface CommunityAlert {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'urgent';
  createdAt: number;
  createdBy: string;
}

export const PARISHES = [
  'St. Nicholas Antiochian Orthodox Cathedral',
  'Holy Trinity Greek Orthodox Church',
  'St. George Coptic Orthodox Church',
  'Annunciation Orthodox Cathedral',
  'St. Mary Coptic Orthodox Church',
  'St. Vladimir Orthodox Seminary Chapel',
  'Holy Cross Orthodox Monastery',
  'St. Anthony the Great Mission',
  'Theotokos of Axion Estin Chapel',
  'St. Herman of Alaska Orthodox Church',
  'St. John the Baptist Greek Orthodox Church',
  'St. Sophia Ukrainian Orthodox Cathedral',
] as const;
