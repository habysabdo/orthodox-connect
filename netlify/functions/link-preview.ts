import type { Config } from '@netlify/functions';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isResponse, requireAppUser } from './_auth.js';

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 7_000;

type LinkPreview = {
  url: string;
  resolvedUrl: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  provider: 'youtube' | 'facebook' | 'external';
  embeddable: boolean;
};

function providerFor(url: URL): LinkPreview['provider'] {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    return 'youtube';
  }
  if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.com' || host === 'fb.watch') {
    return 'facebook';
  }
  return 'external';
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }

  const normalized = address.toLowerCase().split('%')[0];
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPrivateAddress(mappedIpv4);
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff') || normalized.startsWith('2001:db8:');
}

async function assertSafeUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new Error('Unsupported URL');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private URLs are not supported');
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private URLs are not supported');
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private URLs are not supported');
  }
}

async function fetchWithSafeRedirects(initialUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertSafeUrl(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; OrthodoxConnectLinkPreview/1.0)',
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: currentUrl };
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: currentUrl };
    currentUrl = new URL(location, currentUrl);
  }

  throw new Error('Too many redirects');
}

async function readLimitedHtml(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }
    html += decoder.decode(value, { stream: true });
  }

  return html + decoder.decode();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value);
  }
  return '';
}

function pageTitle(html: string): string {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function canonicalUrl(html: string, base: URL): URL | null {
  const raw = metaContent(html, 'og:url') || html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';
  if (!raw) return null;
  try {
    return new URL(decodeHtml(raw), base);
  } catch {
    return null;
  }
}

function absoluteUrl(raw: string, base: URL): string {
  if (!raw) return '';
  try {
    const url = new URL(raw, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function youtubePreview(url: URL): Promise<LinkPreview | null> {
  const endpoint = new URL('https://www.youtube.com/oembed');
  endpoint.searchParams.set('url', url.toString());
  endpoint.searchParams.set('format', 'json');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) return null;
  const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    url: url.toString(),
    resolvedUrl: url.toString(),
    title: data.title?.trim() || 'YouTube video',
    description: data.author_name ? `Shared by ${data.author_name}` : '',
    image: data.thumbnail_url || '',
    siteName: 'YouTube',
    provider: 'youtube',
    embeddable: true,
  };
}

export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const rawUrl = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  let requestedUrl: URL;
  try {
    requestedUrl = new URL(rawUrl);
    await assertSafeUrl(requestedUrl);
  } catch {
    return Response.json({ error: 'A valid public URL is required' }, { status: 400 });
  }

  try {
    if (providerFor(requestedUrl) === 'youtube') {
      const preview = await youtubePreview(requestedUrl);
      if (!preview) return Response.json({ error: 'This YouTube video is unavailable' }, { status: 422 });
      return Response.json(preview, { headers: { 'Cache-Control': 'private, max-age=3600' } });
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(requestedUrl);
    if (!response.ok) return Response.json({ error: 'This link is unavailable' }, { status: 422 });
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return Response.json({ error: 'This link does not provide a preview' }, { status: 422 });
    }

    const html = await readLimitedHtml(response);
    const canonical = canonicalUrl(html, finalUrl);
    const resolvedUrl = canonical && providerFor(canonical) === providerFor(finalUrl) ? canonical : finalUrl;
    const provider = providerFor(resolvedUrl);
    const title = metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || pageTitle(html);
    const description = metaContent(html, 'og:description') || metaContent(html, 'description') || metaContent(html, 'twitter:description');
    const image = absoluteUrl(metaContent(html, 'og:image') || metaContent(html, 'twitter:image'), resolvedUrl);
    const siteName = metaContent(html, 'og:site_name') || (provider === 'facebook' ? 'Facebook' : resolvedUrl.hostname.replace(/^www\./, ''));
    const preview: LinkPreview = {
      url: requestedUrl.toString(),
      resolvedUrl: resolvedUrl.toString(),
      title: title || (provider === 'facebook' ? 'Facebook video' : siteName),
      description,
      image,
      siteName,
      provider,
      embeddable: false,
    };
    return Response.json(preview, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) {
    console.error('Link preview failed', { error, requestId: req.headers.get('x-nf-request-id') });
    return Response.json({ error: 'The link preview could not be loaded' }, { status: 422 });
  }
};

export const config: Config = { path: '/api/link-preview' };
