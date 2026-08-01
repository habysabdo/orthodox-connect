import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const DEFAULT_FAITH_QUERY = 'worship prayer scripture saints church joy';
const REQUIRED_QUERY_PREFIX = 'Orthodox Christian faith';

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyResult {
  id?: string;
  title?: string;
  images?: {
    fixed_width?: GiphyImage;
    fixed_width_small_still?: GiphyImage;
    original?: GiphyImage;
  };
}

interface GiphyResponse {
  data?: GiphyResult[];
}

export default async (req: Request) => {
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const apiKey = Netlify.env.get('GIPHY_API_KEY');
  if (!apiKey) {
    return Response.json(
      { error: 'GIF search is not configured yet. Add the GIPHY_API_KEY environment variable in Netlify.' },
      { status: 503 },
    );
  }

  const requestedQuery = new URL(req.url).searchParams.get('q')?.trim().slice(0, 80) || DEFAULT_FAITH_QUERY;
  const faithQuery = `${REQUIRED_QUERY_PREFIX} ${requestedQuery}`;
  const endpoint = new URL(GIPHY_SEARCH_URL);
  endpoint.searchParams.set('api_key', apiKey);
  endpoint.searchParams.set('q', faithQuery);
  endpoint.searchParams.set('limit', '24');
  endpoint.searchParams.set('rating', 'g');
  endpoint.searchParams.set('lang', 'en');

  try {
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return Response.json({ error: 'The faith GIF service is temporarily unavailable.' }, { status: 502 });
    }

    const payload = (await response.json()) as GiphyResponse;
    const gifs = (payload.data ?? []).flatMap((result) => {
      const animated = result.images?.fixed_width ?? result.images?.original;
      if (!result.id || !animated?.url) return [];
      const still = result.images?.fixed_width_small_still?.url;
      return [{
        id: result.id,
        title: result.title?.trim() || 'Christian faith GIF',
        url: animated.url,
        previewUrl: still || animated.url,
        width: Number(animated.width) || 200,
        height: Number(animated.height) || 200,
      }];
    });

    return Response.json({ gifs, query: faithQuery });
  } catch {
    return Response.json({ error: 'The faith GIF service could not be reached.' }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/gifs',
};
