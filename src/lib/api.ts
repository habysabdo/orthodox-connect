// A single entry point for every request to this site's own `/api/*` functions.
//
// Two things were quietly breaking signed-in members before this existed:
//
//   1. Most callers used a bare `fetch`, so the request carried only cookies.
//      Netlify Identity writes its session to localStorage, and the `nf_jwt`
//      cookie our functions read can be missing (private browsing, a
//      cross-origin API proxy, or a browser that dropped it). The function then
//      answered 401 and the screen rendered as if there were no data at all —
//      an empty feed, empty reels, an empty roster.
//   2. A single expired access token was fatal. The token lives for minutes, so
//      the first request after a page refresh can legitimately be too old.
//
// `apiFetch` fixes both: it always sends the Identity bearer token alongside the
// cookies, and a 401 triggers exactly one session refresh followed by a retry.
import { identityAuthorizationHeaders, restoreIdentitySession } from './auth';
import { apiUrl } from './config';

// One refresh at a time, shared by every caller that got a 401 in the same
// moment, so a page full of parallel requests refreshes the session once.
let refreshInFlight: Promise<unknown> | null = null;

function refreshSessionOnce(): Promise<unknown> {
  refreshInFlight ??= restoreIdentitySession()
    .catch((error) => {
      console.warn('Could not refresh the session before retrying the request', error);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Fetch an app-relative API path with the current session attached.
 *
 * Bodies must be replayable (a string, FormData, or nothing) because an
 * unauthorized response is retried once after refreshing the session.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () =>
    fetch(apiUrl(path), {
      ...init,
      // Cookies still matter (the functions read `nf_jwt`/`nf_refresh`); the
      // bearer token is what keeps the request authorized when they are absent.
      credentials: init.credentials ?? 'include',
      headers: { ...(init.headers as Record<string, string> | undefined), ...identityAuthorizationHeaders() },
    });

  const response = await send();
  if (response.status !== 401) return response;

  await refreshSessionOnce();
  return send();
}

/** Fetch a path that should never be answered from the browser cache. */
export function apiFetchFresh(path: string, init: RequestInit = {}): Promise<Response> {
  return apiFetch(path, { cache: 'no-store', ...init });
}

/** Read the `error` message a function returned, falling back to `fallback`. */
export async function apiError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error?.trim() || fallback;
}
