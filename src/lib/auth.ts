import netlifyIdentity from 'netlify-identity-widget';

const IDENTITY_STORAGE_KEY = 'gotrue.user';
const PERSISTENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

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

export function persistIdentityCookiesFromLocalStorage(): boolean {
  try {
    const storedSession = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!storedSession) return false;

    const session = JSON.parse(storedSession) as StoredIdentitySession;
    const accessToken = session.token?.access_token;
    const refreshToken = session.token?.refresh_token;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return false;

    setPersistentCookie('nf_jwt', accessToken);
    setPersistentCookie('nf_refresh', refreshToken);
    return true;
  } catch {
    return false;
  }
}

export function identityAuthorizationHeaders(): Record<string, string> {
  try {
    const storedSession = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!storedSession) return {};

    const session = JSON.parse(storedSession) as StoredIdentitySession;
    const accessToken = session.token?.access_token;
    return typeof accessToken === 'string' && accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
  } catch {
    return {};
  }
}

export async function restoreIdentitySession(): Promise<IdentityUser | null> {
  try {
    netlifyIdentity.init();
  } catch {
    // Safe fallback if initialized already
  }

  // Netlify Identity persists its browser session in localStorage, but its
  // companion cookies are session cookies. Recreate those cookies first so
  // currentUser() does not discard a valid saved session after a browser restart.
  persistIdentityCookiesFromLocalStorage();

  const user = netlifyIdentity.currentUser();
  if (!user) return null;

  persistIdentityCookiesFromLocalStorage();
  return user;
}