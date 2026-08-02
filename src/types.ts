// Core domain types for OrthodoxConnect

export type Role = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  photo: string;
  parish: string;
  role: Role;
  bio?: string;
  joinedAt: number;
  /** profile setup completed */
  onboarded: boolean;
  /** simulated presence — true when user appears online */
  online: boolean;
  /** users this person follows (ids) */
  following: string[];
  /** users following this person (ids) */
  followers: string[];
  /** verified badge */
  verified?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName?: string;
  text: string;
  image?: string;
  /** optional video URL for reels-style content */
  videoUrl?: string;
  /** multiple images for slideshow posts */
  images?: string[];
  /** hashtags extracted from text */
  hashtags?: string[];
  createdAt: number;
  likes: string[]; // user ids
  comments: Comment[];
  /** users who bookmarked this post */
  bookmarks?: string[];
  flagged?: boolean;
  flagReason?: string;
}

/** @deprecated kept for backward compat with seed data */
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
  createdAt: number;
  read: boolean;
  /** optional media attachment URL */
  mediaUrl?: string;
  /** voice message blob URL */
  voiceUrl?: string;
}

export interface Thread {
  id: string;
  participantIds: [string, string];
  messages: ChatMessage[];
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

export interface Story {
  id: string;
  authorId: string;
  /** image or short clip URL */
  mediaUrl: string;
  /** 'image' or 'video' */
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: number;
  /** users who viewed this story */
  viewedBy: string[];
  /** text overlays */
  overlays?: StoryOverlay[];
}

export interface StoryOverlay {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  color?: string;
}

export interface VideoReel {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  /** video or image URL */
  mediaUrl: string;
  mediaType: 'video' | 'image';
  caption: string;
  hashtags: string[];
  /** audio track info */
  audioTitle?: string;
  audioArtist?: string;
  createdAt: number;
  likes: string[];
  comments: Comment[];
  bookmarks: string[];
}

export interface DailySaint {
  name: string;
  feast: string;
  quote: string;
  scripture: string;
  scriptureRef: string;
  date: string;
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

export const ADMIN_EMAIL = 'lucasautocode@gmail.com';
