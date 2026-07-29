// Client for the global multi-category search endpoint.

import { apiUrl } from '../lib/config';

export interface SearchPerson {
  id: string;
  name: string;
  parish: string;
  photo: string;
  email: string;
}

export interface SearchChurch {
  id: string;
  name: string;
  jurisdiction: string;
  city: string;
  region: string;
  description: string;
}

export interface SearchSong {
  id: string;
  title: string;
  composer: string;
  tone: string;
  lyrics: string;
}

export interface SearchVideo {
  id: string;
  text: string;
  authorId: string;
  createdAt: number;
}

export interface SearchResults {
  people: SearchPerson[];
  churches: SearchChurch[];
  songs: SearchSong[];
  videos: SearchVideo[];
}

export const EMPTY_RESULTS: SearchResults = { people: [], churches: [], songs: [], videos: [] };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The endpoint may omit a category it found nothing for, and an older deploy may
 * not know about a category at all. Every consumer reads all four arrays, so fill
 * in whatever is missing here rather than guarding at each render site.
 */
function normalizeResults(raw: unknown): SearchResults {
  const payload = (raw ?? {}) as Partial<Record<keyof SearchResults, unknown>>;
  return {
    people: asArray<SearchPerson>(payload.people).filter(Boolean),
    churches: asArray<SearchChurch>(payload.churches).filter(Boolean),
    songs: asArray<SearchSong>(payload.songs).filter(Boolean),
    videos: asArray<SearchVideo>(payload.videos).filter(Boolean),
  };
}

// Query the search endpoint. Accepts an AbortSignal so an in-flight request can
// be cancelled when the user keeps typing.
export async function search(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return EMPTY_RESULTS;
  const res = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(q)}`), { signal });
  if (!res.ok) throw new Error('Search failed');
  return normalizeResults(await res.json());
}

export function totalCount(results: SearchResults | null | undefined): number {
  const safe = normalizeResults(results);
  return safe.people.length + safe.churches.length + safe.songs.length + safe.videos.length;
}
