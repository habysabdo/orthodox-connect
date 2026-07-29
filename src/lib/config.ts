// Central resolution of the backend endpoints so every request — Supabase auth,
// Supabase Storage bucket fetches, and this site's own `/api/*` functions
// (including media) — can be routed through a custom regional domain/proxy when
// one is configured, and transparently fall back to the default endpoints when
// it isn't.
//
// Env vars (all optional except the base Supabase pair):
//   VITE_SUPABASE_PROXY_URL  custom domain/proxy fronting the Supabase project
//                            (auth + storage). Falls back to VITE_SUPABASE_URL.
//   VITE_SUPABASE_URL        the Supabase project URL.
//   VITE_SUPABASE_ANON_KEY   the Supabase anon key.
//   VITE_API_PROXY_URL       custom domain/proxy fronting this site's own API +
//                            media CDN. Also accepts VITE_MEDIA_CDN_URL. Falls
//                            back to the current browser origin.

// Environment values often arrive with stray characters — copied-in brackets,
// parentheses, quotes, or surrounding whitespace — that make an otherwise valid
// URL fail strict validation. Strip those before using the value.
export function cleanEnv(value: string | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '') // surrounding quotes/backticks
    .replace(/[[\](){}<>]/g, '') // stray brackets/parentheses/braces/angles
    .replace(/\s+/g, '') // internal whitespace (a URL has none)
    .trim();
}

// Only accept a value that parses as a real HTTP(S) URL. Anything else is
// treated as missing so callers can fall back instead of using a broken value.
export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Return the first candidate that cleans up into a valid HTTP(S) URL, with any
// trailing slashes removed so it can be safely concatenated with a path.
function firstValidUrl(...candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    const cleaned = cleanEnv(candidate);
    if (isValidHttpUrl(cleaned)) return cleaned.replace(/\/+$/, '');
  }
  return null;
}

const env = import.meta.env as Record<string, string | undefined>;

// Supabase project endpoint — prefer the regional proxy/custom domain so auth
// and storage traffic follow the configured DNS route, else the project URL.
export const SUPABASE_URL = firstValidUrl(env.VITE_SUPABASE_PROXY_URL, env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = cleanEnv(env.VITE_SUPABASE_ANON_KEY);
export const hasSupabaseConfig = Boolean(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;

// A configured custom domain/proxy for this site's own API + media, if any.
const CONFIGURED_API_BASE = firstValidUrl(env.VITE_API_PROXY_URL, env.VITE_MEDIA_CDN_URL);

// The base origin that `/api/*` requests and media URLs should resolve against.
// Prefer the configured proxy/CDN domain; otherwise the current browser origin
// (same-origin, i.e. the default fallback). Returns '' only in non-browser
// contexts with nothing configured, which keeps paths relative.
export function apiBase(): string {
  if (CONFIGURED_API_BASE) return CONFIGURED_API_BASE;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

// Resolve an app-relative path (e.g. `/api/posts`) to a full URL rooted at the
// configured proxy/CDN domain, or a relative path when nothing is configured so
// behaviour is identical to the previous same-origin fetches.
export function apiUrl(path: string): string {
  const relative = path.startsWith('/') ? path : `/${path}`;
  const base = apiBase();
  return base ? `${base}${relative}` : relative;
}
