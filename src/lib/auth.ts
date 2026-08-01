import netlifyIdentity from 'netlify-identity-widget';

const IDENTITY_STORAGE_KEY = 'gotrue.user';
const PERSISTENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * Fired on this window whenever a sign-in has stored a usable session token, so
 * the store can load the account without depending solely on the Identity
 * widget's own `login` event.
 */
export const IDENTITY_SESSION_EVENT = 'orthodoxconnect:identity-session';

export type IdentityUser = ReturnType<typeof netlifyIdentity.currentUser>;

type StoredIdentitySession = {
  token?: {
    access_token?: unknown;
    refresh_token?: unknown;
  };
};

function setPersistentCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; secure; samesite=lax; max-age=${PERSISTENT_COOKIE_MAX_AGE}`;
}

function expireCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * Drop the session cookies. The API accepts them as credentials, so leaving them
 * behind after a sign-out would keep authenticating requests until the token
 * happened to expire.
 */
export function clearIdentityCookies(): void {
  try {
    expireCookie('nf_jwt');
    expireCookie('nf_refresh');
  } catch {
    // Safe fallback in non-browser contexts
  }
}

export function persistIdentityCookiesFromLocalStorage(): boolean {
  try {
    const storedSession = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!storedSession) {
      clearIdentityCookies();
      return false;
    }

    const session = JSON.parse(storedSession) as StoredIdentitySession;
    const accessToken = session.token?.access_token;
    const refreshToken = session.token?.refresh_token;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      clearIdentityCookies();
      return false;
    }

    setPersistentCookie('nf_jwt', accessToken);
    setPersistentCookie('nf_refresh', refreshToken);
    return true;
  } catch {
    return false;
  }
}

export function identityAuthorizationHeaders(): Record<string, string> {
  const accessToken = storedAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/** The Identity access token saved in this browser, if there is one at all. */
export function storedAccessToken(): string | null {
  try {
    const storedSession = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!storedSession) return null;

    const session = JSON.parse(storedSession) as StoredIdentitySession;
    const accessToken = session.token?.access_token;
    return typeof accessToken === 'string' && accessToken ? accessToken : null;
  } catch {
    return null;
  }
}

/** True when this browser holds a stored session that is worth revalidating. */
export function hasStoredSession(): boolean {
  return storedAccessToken() !== null;
}

/**
 * Return a usable access token for the signed-in member, letting the widget
 * exchange the refresh token first when the current one is close to expiring.
 * Returns null when nobody is signed in or the stored session can no longer be
 * refreshed — the signal that authenticated requests must not be attempted.
 */
export async function currentAccessToken(): Promise<string | null> {
  ensureIdentityInit();
  const user = netlifyIdentity.currentUser();
  if (!user) return null;

  try {
    const token = await user.jwt();
    if (typeof token === 'string' && token) {
      // The refreshed token replaces the stored one; mirror it into the cookies
      // so plain browser requests keep carrying a valid credential too.
      persistIdentityCookiesFromLocalStorage();
      return token;
    }
  } catch (error) {
    console.warn('The saved session could not be refreshed.', error);
    return null;
  }

  return storedAccessToken();
}

/** Let the app know a fresh session token is available to use. */
export function announceIdentitySession(): void {
  try {
    window.dispatchEvent(new Event(IDENTITY_SESSION_EVENT));
  } catch {
    // Safe fallback in non-browser contexts
  }
}

/**
 * The Identity widget ships its own login UI inside a full-screen iframe.
 * AuthModal replaces it entirely, so the widget modal is never wanted — close it
 * defensively wherever an auth event could have opened it. Paired with the
 * iframe suppression rules in index.css.
 */
export function closeIdentityModal(): void {
  try {
    netlifyIdentity.close();
  } catch {
    // Safe fallback if the widget is not initialized or already closed
  }
}

function ensureIdentityInit(): void {
  try {
    netlifyIdentity.init();
  } catch {
    // Safe fallback if initialized already
  }
}

type IdentityGoTrue = {
  settings: () => Promise<{ autoconfirm?: boolean; disable_signup?: boolean }>;
  signup: (email: string, password: string, data?: Record<string, unknown>) => Promise<unknown>;
};

type IdentityStore = {
  gotrue: IdentityGoTrue | null;
  error: unknown;
  login: (email: string, password: string) => Promise<void>;
};

/**
 * The widget's internal store. It exposes `login`/`logout` actions that drive
 * the same state the widget UI would, which means the `login` and `logout`
 * events StoreProvider listens for still fire — the modal is simply never
 * opened. Read `store.gotrue` rather than the public `netlifyIdentity.gotrue`
 * getter: that getter opens the modal as a side effect when the GoTrue client
 * is not ready yet.
 */
function identityStore(): IdentityStore | null {
  ensureIdentityInit();
  const store = (netlifyIdentity as { store?: IdentityStore }).store;
  return store?.gotrue ? store : null;
}

export type IdentityAuthResult =
  | { status: 'signed-in' }
  | { status: 'confirmation-required' }
  | { status: 'error'; message: string };

const UNAVAILABLE_MESSAGE =
  'Sign-in is unavailable right now. Please reload the page and try again.';

function identityFailure(error: unknown, fallback: string): IdentityAuthResult {
  const detail = error as
    | { status?: number; json?: Record<string, string>; message?: string }
    | null
    | undefined;

  const described =
    detail?.json?.error_description || detail?.json?.msg || detail?.json?.error;
  if (described) return { status: 'error', message: described };

  switch (detail?.status) {
    case 400:
    case 401:
      return { status: 'error', message: 'That email and password do not match an account.' };
    case 403:
      return { status: 'error', message: 'Registration is currently closed for this community.' };
    case 404:
      return { status: 'error', message: 'No account exists for that email address.' };
    case 422:
      return {
        status: 'error',
        message: 'Please check the email address and choose a longer password.',
      };
    default:
      return { status: 'error', message: detail?.message || fallback };
  }
}

/** Authenticate against Netlify Identity without ever opening the widget modal. */
export async function signInWithIdentity(
  email: string,
  password: string,
): Promise<IdentityAuthResult> {
  const store = identityStore();
  if (!store) return { status: 'error', message: UNAVAILABLE_MESSAGE };

  try {
    // `store.login` funnels failures into `store.error` instead of rejecting,
    // and clears it at the start of every attempt.
    await store.login(email, password);
  } catch (err) {
    closeIdentityModal();
    return identityFailure(err, 'Could not sign you in. Please try again.');
  }

  closeIdentityModal();
  if (store.error) return identityFailure(store.error, 'Could not sign you in. Please try again.');

  // The login succeeded (200): mirror the stored token into the cookies the API
  // reads, then announce it so the app loads the account straight away.
  persistIdentityCookiesFromLocalStorage();
  announceIdentitySession();
  return { status: 'signed-in' };
}

/**
 * Register a new account. When the project autoconfirms signups the new user is
 * signed in immediately; otherwise they must confirm by email first.
 */
export async function signUpWithIdentity(
  fullName: string,
  email: string,
  password: string,
): Promise<IdentityAuthResult> {
  const store = identityStore();
  const gotrue = store?.gotrue;
  if (!store || !gotrue) return { status: 'error', message: UNAVAILABLE_MESSAGE };

  // The widget normally loads settings when its modal opens. It never opens
  // here, so read them directly — `autoconfirm` decides whether the account is
  // usable right away or is waiting on a confirmation email.
  let autoconfirm = false;
  try {
    const settings = await gotrue.settings();
    autoconfirm = Boolean(settings?.autoconfirm);
  } catch {
    // Assume confirmation is required if the settings cannot be read
  }

  try {
    await gotrue.signup(email, password, { full_name: fullName });
  } catch (err) {
    closeIdentityModal();
    return identityFailure(err, 'Could not create your account. Please try again.');
  }

  closeIdentityModal();
  if (!autoconfirm) return { status: 'confirmation-required' };

  return signInWithIdentity(email, password);
}

export async function restoreIdentitySession(): Promise<IdentityUser | null> {
  ensureIdentityInit();

  // Netlify Identity persists its browser session in localStorage, but its
  // companion cookies are session cookies. Recreate those cookies first so
  // currentUser() does not discard a valid saved session after a browser restart.
  persistIdentityCookiesFromLocalStorage();

  const user = netlifyIdentity.currentUser();
  if (!user) return null;

  persistIdentityCookiesFromLocalStorage();
  return user;
}