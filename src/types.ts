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
  createdAt: number;
  likes: string[]; // user ids
  comments: Comment[];
  flagged?: boolean;
  flagReason?: string;
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
  createdAt: number;
  read: boolean;
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
