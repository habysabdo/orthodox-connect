import { normalizeIdentityUser, type IdentityUser } from './_auth.js';

/**
 * Minimal client for the Netlify Identity admin API.
 *
 * The `@netlify/identity` package these functions used to import does not exist
 * on npm, so the admin endpoints are called directly with the operator token
 * Netlify hands to functions. Every call is best-effort: when the operator
 * credentials are unavailable the caller keeps working against this app's own
 * database, which is what actually gates access (a blocked account is rejected
 * by `requireAppUser`).
 */

export interface IdentityAdminAccess {
  url: string;
  token: string;
}

interface ClientContextCarrier {
  clientContext?: { identity?: { url?: unknown; token?: unknown } };
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolve the Identity admin endpoint and operator token. Netlify passes them to
 * a function through its client context; environment variables are accepted as a
 * fallback so the feature can also be configured explicitly.
 */
export function identityAdminAccess(context?: unknown): IdentityAdminAccess | null {
  const provided = (context as ClientContextCarrier | undefined)?.clientContext?.identity;
  const siteUrl = trimmed(process.env.URL);
  const url = (
    trimmed(provided?.url)
    || trimmed(process.env.IDENTITY_ENDPOINT)
    || (siteUrl ? `${siteUrl}/.netlify/identity` : '')
  ).replace(/\/+$/, '');
  const token = trimmed(provided?.token) || trimmed(process.env.NETLIFY_IDENTITY_TOKEN);
  if (!url || !token) return null;
  return { url, token };
}

async function identityRequest(
  access: IdentityAdminAccess,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${access.url}/admin${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${access.token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Identity admin request failed with status ${response.status}`);
  }
  return response.status === 204 ? null : await response.json();
}

/** Every Identity account, or an empty list when admin access is unavailable. */
export async function listIdentityUsers(context?: unknown): Promise<IdentityUser[]> {
  const access = identityAdminAccess(context);
  if (!access) return [];

  const payload = await identityRequest(access, '/users?per_page=1000');
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { users?: unknown })?.users)
      ? ((payload as { users: unknown[] }).users)
      : [];
  return rows
    .map((row) => normalizeIdentityUser(row as Record<string, unknown>))
    .filter((user): user is IdentityUser => user !== null);
}

/** A single Identity account, or null when it cannot be read. */
export async function getIdentityUser(
  userId: string,
  context?: unknown,
): Promise<IdentityUser | null> {
  const access = identityAdminAccess(context);
  if (!access) return null;

  const payload = await identityRequest(access, `/users/${encodeURIComponent(userId)}`);
  return normalizeIdentityUser((payload ?? {}) as Record<string, unknown>);
}

export interface IdentityUserPatch {
  role?: string;
  app_metadata?: Record<string, unknown>;
  /** Netlify Identity ban duration, e.g. `876000h` to block or `none` to unblock. */
  ban_duration?: string;
}

/**
 * Mirror a role or block change into Identity. Returns false when the change
 * could not be applied so the caller can carry on with the database update.
 */
export async function updateIdentityUser(
  userId: string,
  patch: IdentityUserPatch,
  context?: unknown,
): Promise<boolean> {
  const access = identityAdminAccess(context);
  if (!access) {
    console.warn('Identity operator access is unavailable; the account was updated in the app only.');
    return false;
  }

  try {
    await identityRequest(access, `/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return true;
  } catch (error) {
    console.error('Identity could not update the account', error);
    return false;
  }
}
