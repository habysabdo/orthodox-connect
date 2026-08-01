// Recovery for sessions that can no longer be refreshed.
//
// Both session stores this app relies on live in the browser: supabase-js keeps
// its session under `sb-<project-ref>-auth-token` and Netlify Identity keeps
// its own under `gotrue.user`. When a refresh token has been revoked, has
// already been used, or was issued by a different project, every refresh from
// then on answers 401 — and because the dead token is still on disk, the next
// page load repeats the same failure forever. The member is stuck: signed in as
// far as the stored session is concerned, rejected by every request, and unable
// to reach a working login.
//
// The way out is to treat a 401 on refresh as terminal: sign the Supabase
// session out, drop the stored auth keys, and hand the member back to the
// manual login form with nothing stale left behind.

import { supabase } from './supabase';

const IDENTITY_STORAGE_KEY = 'gotrue.user';
const LEGACY_SUPABASE_STORAGE_KEY = 'supabase.auth.token';

// Set while recovering and read once by the login form, so a member who was
// signed out mid-session is told why rather than silently finding themselves
// back at the login screen. sessionStorage survives the redirect below but not
// the tab, which is exactly the lifetime a one-off notice needs.
const EXPIRED_NOTICE_KEY = 'orthodox-connect.session-expired';

// supabase-js v2 namespaces its storage key per project, and keeps a sibling
// `-code-verifier` entry while a PKCE exchange is in flight.
const SUPABASE_AUTH_KEY_PATTERN = /^sb-.+-auth-token(-code-verifier)?$/;

// Netlify Identity mirrors its tokens into these cookies so the CDN and the
// `/api/*` functions see the signed-in member; a cleared session has to clear
// them too, or the next request is authenticated by a token that no longer has
// a session behind it.
const IDENTITY_COOKIES = ['nf_jwt', 'nf_refresh'];

// GoTrue error codes that all mean "this refresh token will never work again".
const UNAUTHORIZED_ERROR_CODES = new Set([
  'bad_jwt',
  'invalid_grant',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
  'user_not_found',
]);

// Older GoTrue builds answer with a plain message and an inconsistent status,
// so the message is matched as well as the status and code.
const UNAUTHORIZED_MESSAGE_PATTERN =
  /(invalid refresh token|refresh token not found|refresh_token|invalid grant|jwt expired|token (is )?expired|session (id )?not found|session from session id not found|already used|unauthorized|not authenticated)/i;

// A dropped connection or a 5xx is retryable: the token may well still be good,
// so it must never trigger a sign out. supabase-js labels these explicitly.
const RETRYABLE_ERROR_NAMES = new Set(['AuthRetryableFetchError']);

/** How close to expiry a token gets before the check refreshes it deliberately. */
const REFRESH_LEEWAY_MS = 60_000;
const AUTH_REQUEST_TIMEOUT_MS = 10_000;

export type SessionStatus =
  /** A usable session is present. */
  | 'valid'
  /** Nobody is signed in with Supabase; there is nothing to recover. */
  | 'none'
  /** The session exists but can no longer be refreshed — recover from this. */
  | 'expired'
  /** The check itself failed (offline, 5xx); the session is still assumed good. */
  | 'unknown';

export interface SessionCheck {
  status: SessionStatus;
  error?: unknown;
}

async function withAuthTimeout<T>(request: Promise<T>, operation: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error(`${operation} exceeded ${AUTH_REQUEST_TIMEOUT_MS}ms`)),
      AUTH_REQUEST_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

/**
 * Does this error mean the stored refresh token is permanently rejected?
 *
 * Deliberately narrow: only a 401, a known terminal GoTrue code, or a
 * token/session-shaped message counts. Everything else — above all network
 * failures — is left alone so a flaky connection can never sign a member out.
 */
export function isUnauthorizedSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    name?: unknown;
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error_description?: unknown;
  };

  if (typeof candidate.name === 'string' && RETRYABLE_ERROR_NAMES.has(candidate.name)) return false;

  if (candidate.status === 401) return true;
  if (typeof candidate.code === 'string' && UNAUTHORIZED_ERROR_CODES.has(candidate.code)) return true;

  const message = [candidate.message, candidate.error_description]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return message ? UNAUTHORIZED_MESSAGE_PATTERN.test(message) : false;
}

function sweepAuthKeys(store: Storage): void {
  const doomed: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) doomed.push(key);
  }
  for (const key of [...doomed, LEGACY_SUPABASE_STORAGE_KEY, IDENTITY_STORAGE_KEY]) {
    store.removeItem(key);
  }
}

/**
 * Remove every local trace of the two browser sessions plus the Identity
 * cookies. Both stores go together on purpose: the app treats the Supabase and
 * Identity sessions as belonging to the same member, and a half-cleared state is
 * exactly what produces the "cannot log in, cannot log out" loop.
 */
export function clearLocalAuthStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    sweepAuthKeys(window.localStorage);
  } catch {
    // Storage is unavailable in private browsing — nothing was persisted either.
  }
  try {
    sweepAuthKeys(window.sessionStorage);
  } catch {
    // Same as above; a missing sessionStorage means nothing to clean up.
  }
  try {
    for (const name of IDENTITY_COOKIES) {
      document.cookie = `${name}=; path=/; max-age=0; secure; samesite=lax`;
    }
  } catch {
    // Cookies can be blocked entirely; the storage sweep above still applies.
  }
}

let activeRecovery: Promise<void> | null = null;

/**
 * Sign out of a session that can no longer be refreshed and wipe what it left
 * behind, so the member lands on the login form with a clean slate.
 *
 * Concurrent callers share one run: the boot check, the tab-focus check and a
 * background refresh failure can all land at once, and signing out three times
 * would only produce three more 401s.
 */
export function recoverFromUnauthorizedSession(reason: string): Promise<void> {
  if (!activeRecovery) {
    console.warn(`Session refresh was rejected (${reason}); signing out for a clean login.`);
    // Marked up front: signing out fires a SIGNED_OUT listener that can navigate
    // to the login form before this promise settles, and the notice has to be on
    // disk by then to be shown there.
    markSessionExpiredNotice();
    activeRecovery = signOutAndClear().finally(() => {
      activeRecovery = null;
    });
  }
  return activeRecovery;
}

async function signOutAndClear(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    // A global sign out asks the server to revoke the session, which needs a
    // token the server has already rejected — so it commonly 401s here. Fall
    // back to a local sign out, whose only job is to drop the client session.
    console.warn('Could not revoke the expired Supabase session on the server; clearing it locally', error);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (localError) {
      console.warn('Local Supabase sign out failed; removing the stored keys directly', localError);
    }
  }
  clearLocalAuthStorage();
}

/** Remember that this sign out was involuntary, for the login form to explain. */
function markSessionExpiredNotice(): void {
  try {
    window.sessionStorage.setItem(EXPIRED_NOTICE_KEY, '1');
  } catch {
    // Without sessionStorage the login form simply shows no notice.
  }
}

/**
 * Was the member signed out involuntarily? Read only — the login form clears the
 * flag when they submit, so a double-render (or React's development remount)
 * cannot swallow the message before it has been shown.
 */
export function hasSessionExpiredNotice(): boolean {
  try {
    return window.sessionStorage.getItem(EXPIRED_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Discard the notice once the member has acted on it. */
export function clearSessionExpiredNotice(): void {
  try {
    window.sessionStorage.removeItem(EXPIRED_NOTICE_KEY);
  } catch {
    // Nothing was stored if sessionStorage is unavailable.
  }
}

/**
 * Check whether the Supabase session is still usable.
 *
 * `getSession()` only refreshes when the access token has already expired, so a
 * token that is seconds from expiring is refreshed explicitly here. That turns a
 * failure that would otherwise surface later, from a background auto-refresh
 * with nobody listening, into a result this caller can act on.
 */
export async function verifySupabaseSession(): Promise<SessionCheck> {
  try {
    const { data, error } = await withAuthTimeout(
      supabase.auth.getSession(),
      'Supabase session restore',
    );
    if (error) {
      return { status: isUnauthorizedSessionError(error) ? 'expired' : 'unknown', error };
    }

    const session = data.session;
    if (!session) return { status: 'none' };

    const expiresAtMs = typeof session.expires_at === 'number' ? session.expires_at * 1000 : null;
    const expiringSoon = expiresAtMs === null || expiresAtMs - Date.now() <= REFRESH_LEEWAY_MS;
    if (!expiringSoon) return { status: 'valid' };

    const { error: refreshError } = await withAuthTimeout(
      supabase.auth.refreshSession(),
      'Supabase session refresh',
    );
    if (refreshError) {
      return { status: isUnauthorizedSessionError(refreshError) ? 'expired' : 'unknown', error: refreshError };
    }
    return { status: 'valid' };
  } catch (error) {
    // supabase-js throws rather than returning an error for some transport
    // failures; the same 401-only rule decides whether that is terminal.
    return { status: isUnauthorizedSessionError(error) ? 'expired' : 'unknown', error };
  }
}
