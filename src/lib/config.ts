// Central resolution of backend endpoints
export function cleanEnv(value: string | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '') // surrounding quotes/backticks
    .replace(/[[\](){}<>]/g, '')     // stray brackets/parentheses/braces/angles
    .replace(/\s+/g, '')             // internal whitespace
    .trim();
}

export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function firstValidUrl(...candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    const cleaned = cleanEnv(candidate);
    if (isValidHttpUrl(cleaned)) return cleaned.replace(/\/+$/, '');
  }
  return null;
}

// 🎯 Explicitly reference import.meta.env properties so Vite inlines them at build time
export const SUPABASE_URL = firstValidUrl(
  import.meta.env.VITE_SUPABASE_PROXY_URL,
  import.meta.env.VITE_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const hasSupabaseConfig = Boolean(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;

const CONFIGURED_API_BASE = firstValidUrl(
  import.meta.env.VITE_API_PROXY_URL,
  import.meta.env.VITE_MEDIA_CDN_URL
);

export function apiBase(): string {
  if (CONFIGURED_API_BASE) return CONFIGURED_API_BASE;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function apiUrl(path: string): string {
  const relative = path.startsWith('/') ? path : `/${path}`;

  // 🛑 Intercept legacy Netlify or missing local API routes to prevent Cloudflare 404 HTML returns
  if (relative.startsWith('/api/') || relative.startsWith('/.netlify/')) {
    console.warn(`[Config] Prevented legacy Netlify request to: ${relative}`);
    // Returning an unresolvable data URI forces fetch() to fail safely rather than parsing an HTML string as JSON
    return 'data:application/json,[]';
  }

  const base = apiBase();
  return base ? `${base}${relative}` : relative;
}