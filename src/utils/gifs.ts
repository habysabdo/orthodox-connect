import { apiUrl } from '../lib/config';

export interface FaithGif {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface GifSearchResponse {
  gifs?: FaithGif[];
  error?: string;
}

export async function searchFaithGifs(query: string, signal?: AbortSignal): Promise<FaithGif[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const suffix = params.size ? `?${params.toString()}` : '';
  const response = await fetch(apiUrl(`/api/gifs${suffix}`), { signal });
  const payload = (await response.json().catch(() => ({}))) as GifSearchResponse;
  if (!response.ok) throw new Error(payload.error || 'Unable to load faith GIFs.');
  return payload.gifs ?? [];
}
