import {
  AUTH_EVENTS,
  AuthError,
  MissingIdentityError,
  getUser,
  handleAuthCallback,
  login,
  logout,
  onAuthChange,
  refreshSession,
  signup,
  type AuthEvent,
  type User,
} from '@netlify/identity';

// Netlify Identity is used headlessly: every screen in this app authenticates
// through the functions below, straight from our own forms. The old
// `netlify-identity-widget` modal (`#netlify-modal-assembly`) is never loaded,
// so it can never appear over our UI.

const IDENTITY_STORAGE_KEY = 'gotrue.user';
const PERSISTENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export type IdentityUser = User;
export { AUTH_EVENTS, onAuthChange, type AuthEvent };

type StoredIdentitySession = {
  token?: {
    access_token?: unknown;
    refresh_token?: unknown;
  };
};

function setPersistentCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; secure; samesite=lax; max-age=${PERSISTENT_COOKIE_MAX_AGE}`;
}

function readStoredSession(): StoredIdentitySession | null {
  try {
    const storedSession = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    return storedSession ? (JSON.parse(storedSession) as StoredIdentitySession) : null;
  } catch {
    return null;
  }
}

// Identity writes `nf_jwt`/`nf_refresh` as *session* cookies, while the session
// itself lives in localStorage. Two things depend on re-writing them with an
// expiry: our Netlify functions read `nf_jwt` off the request to authorize it,
// and `getUser()` deliberately discards the stored session when the cookie is
// missing. Without this, closing the browser logged everybody out.
export function persistIdentityCookiesFromLocalStorage(): boolean {
  const session = readStoredSession();
  const accessToken = session?.token?.access_token;
  const refreshToken = session?.token?.refresh_token;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return false;

  try {
    setPersistentCookie('nf_jwt', accessToken);
    setPersistentCookie('nf_refresh', refreshToken);
    return true;
  } catch {
    return false;
  }
}

export function identityAccessToken(): string | null {
  const accessToken = readStoredSession()?.token?.access_token;
  return typeof accessToken === 'string' && accessToken ? accessToken : null;
}

export function identityAuthorizationHeaders(): Record<string, string> {
  const accessToken = identityAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// Restore whatever session the browser already has and make sure the cookies our
// API reads are present and unexpired *before* the first `/api/*` call goes out.
// A stale access token here is what produced the sign-in loop: the API answered
// 401, the app decided nobody was signed in, and the user was sent back to the
// login screen even though a perfectly good refresh token was sitting in storage.
export async function restoreIdentitySession(): Promise<IdentityUser | null> {
  persistIdentityCookiesFromLocalStorage();

  try {
    // Consumes `#confirmation_token`, `#recovery_token`, `#invite_token` and the
    // OAuth hash when the user arrives from an Identity email link.
    await handleAuthCallback();
  } catch (error) {
    console.warn('Could not process the Identity callback in the URL', error);
  }

  try {
    // No-op unless the access token is expired or within a minute of expiring.
    await refreshSession();
  } catch (error) {
    console.warn('Could not refresh the Identity session', error);
  }

  const user = await getUser();
  persistIdentityCookiesFromLocalStorage();
  return user;
}

export interface AuthResult {
  user: IdentityUser | null;
  /** True when Identity established a session, i.e. the app can sign the user in now. */
  signedIn: boolean;
  /** Set when the account still needs to be confirmed by email before signing in. */
  notice?: string;
}

function afterSessionEstablished(): void {
  // Mirror the freshly issued tokens into long-lived cookies so the very next
  // `/api/session` request is authorized and survives a browser restart.
  persistIdentityCookiesFromLocalStorage();
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const user = await login(email.trim(), password);
  afterSessionEstablished();
  return { user, signedIn: true };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  const user = await signup(email.trim(), password, { full_name: fullName.trim() });

  // With autoconfirm on, Identity signs the new account in immediately. With it
  // off, there is no session yet — the confirmation email has to be opened first.
  if (user?.confirmedAt) {
    afterSessionEstablished();
    return { user, signedIn: true };
  }

  return {
    user,
    signedIn: false,
    notice: 'Account created. Check your email for the confirmation link, then sign in.',
  };
}

export function clearIdentityCookies(): void {
  try {
    document.cookie = 'nf_jwt=; path=/; max-age=0';
    document.cookie = 'nf_refresh=; path=/; max-age=0';
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export async function signOutIdentity(): Promise<void> {
  try {
    await logout();
  } finally {
    clearIdentityCookies();
  }
}

// Turn an Identity failure into something a member can act on.
export function describeAuthError(error: unknown, isRegister: boolean): string {
  if (error instanceof MissingIdentityError) {
    return 'Sign-in is not available right now. Please try again in a few minutes.';
  }

  if (error instanceof AuthError) {
    switch (error.status) {
      case 400:
      case 401:
        return isRegister
          ? 'That account could not be created. Please check your details and try again.'
          : 'Incorrect email or password.';
      case 403:
        return 'New registrations are currently closed for this community.';
      case 404:
        return 'No account exists for that email address.';
      case 422:
        return 'Please enter a valid email address and a password of at least 6 characters.';
      case 429:
        return 'Too many attempts. Please wait a moment and try again.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong. Please try again.';
}
