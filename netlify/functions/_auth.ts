import { eq } from 'drizzle-orm';
import { getUser, type User } from '@netlify/identity';
import { db } from '../../db/index.js';
import { adminNotifications, users } from '../../db/schema.js';

export type AppRole = 'user' | 'admin';
export type AppStatus = 'active' | 'blocked';
export const SUPER_ADMIN_EMAIL = 'lucasautocode@gmail.com';

// The shape Netlify Identity hands back, whether the account was read from the
// Identity API here or resolved by the runtime.
export type IdentityUser = User;

export interface AppActor {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  status: AppStatus;
  createdAt: Date;
  identity: IdentityUser;
}

interface IdentityApiUser {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  confirmed_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

function identityRole(user: IdentityUser): AppRole {
  return user.role === 'admin' || user.roles?.includes('admin') ? 'admin' : 'user';
}

function hasAdminAccess(role: AppRole, email: string): boolean {
  return role === 'admin' || email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Announce a brand-new account to the admin console. The id is derived from the
// account id so a retried sign-in can never queue the same alert twice, and a
// failure here is logged rather than thrown — an alert is never worth blocking
// somebody's sign-in over.
async function recordNewUserAlert(account: { id: string; email: string; name: string }) {
  try {
    await db
      .insert(adminNotifications)
      .values({
        id: `new-user-${account.id}`,
        type: 'new_user',
        subjectId: account.id,
        subjectEmail: account.email,
        subjectName: account.name,
        message: `New user registered: ${account.email || account.name}`,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('Could not record the new user admin alert', error);
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeIdentityApiUser(value: IdentityApiUser): IdentityUser | null {
  const id = optionalString(value.id);
  if (!id) return null;

  const appMetadata = value.app_metadata ?? {};
  const userMetadata = value.user_metadata ?? {};
  const roles = Array.isArray(appMetadata.roles)
    ? appMetadata.roles.filter((role): role is string => typeof role === 'string')
    : undefined;

  return {
    id,
    email: optionalString(value.email),
    role: optionalString(value.role),
    provider: optionalString(appMetadata.provider) as IdentityUser['provider'],
    roles,
    name: optionalString(userMetadata.full_name) ?? optionalString(userMetadata.name),
    pictureUrl: optionalString(userMetadata.avatar_url),
    confirmedAt: optionalString(value.confirmed_at),
    createdAt: optionalString(value.created_at),
    updatedAt: optionalString(value.updated_at),
    userMetadata,
    appMetadata,
  };
}

function identityEndpoint(path: string, req?: Request): URL | null {
  const siteUrl = process.env.URL?.trim();
  const base = siteUrl || req?.url;
  if (!base) return null;
  try {
    return new URL(`/.netlify/identity${path}`, base);
  } catch {
    return null;
  }
}

// Exchange an access token for the full Identity account. A token that is expired
// or revoked comes back as a 401 here, which is exactly the check we want.
async function identityFromAccessToken(token: string, req?: Request): Promise<IdentityUser | null> {
  const endpoint = identityEndpoint('/user', req);
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return normalizeIdentityApiUser((await response.json()) as IdentityApiUser);
  } catch (error) {
    console.error('Could not validate the Identity access token', error);
    return null;
  }
}

function bearerToken(req?: Request): string | null {
  const authorization = req?.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match ? match[1] : null;
}

function cookieToken(req: Request | undefined, name: string): string | null {
  const header = req?.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) continue;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

// The browser session is a short-lived access token plus a long-lived refresh
// token. When the access token has aged out mid-session, trade the refresh token
// for a fresh one rather than answering 401 and bouncing the member back to the
// sign-in screen.
async function identityFromRefreshToken(req?: Request): Promise<IdentityUser | null> {
  const refreshToken = cookieToken(req, 'nf_refresh');
  const endpoint = identityEndpoint('/token', req);
  if (!refreshToken || !endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: unknown };
    return typeof payload.access_token === 'string'
      ? await identityFromAccessToken(payload.access_token, req)
      : null;
  } catch (error) {
    console.error('Could not refresh the Identity session', error);
    return null;
  }
}

// Resolve the caller's Identity account from whichever proof of session the
// request carries: an `Authorization: Bearer` header (uploads and the native app),
// the `nf_jwt` cookie the browser session writes, the runtime's own Identity
// context, or the refresh cookie when the access token has expired.
async function resolveIdentity(req?: Request): Promise<IdentityUser | null> {
  const headerToken = bearerToken(req);
  if (headerToken) {
    const user = await identityFromAccessToken(headerToken, req);
    if (user) return user;
  }

  const sessionToken = cookieToken(req, 'nf_jwt');
  if (sessionToken && sessionToken !== headerToken) {
    const user = await identityFromAccessToken(sessionToken, req);
    if (user) return user;
  }

  const contextUser = await getUser().catch(() => null);
  if (contextUser) return contextUser;

  return identityFromRefreshToken(req);
}

export async function syncIdentityUser(identity: IdentityUser) {
  const email = identity.email?.trim().toLowerCase() ?? '';
  const name = identity.name?.trim() || email.split('@')[0] || 'Parish Member';

  // `onConflictDoNothing().returning()` hands back a row only when this identity
  // had no account yet, which is exactly the signal the admin signup alert
  // needs — no extra lookup on the hot path for members who already exist.
  const [created] = await db
    .insert(users)
    .values({
      id: identity.id,
      email,
      name,
      role: identityRole(identity),
      createdAt: identity.createdAt ? new Date(identity.createdAt) : new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    await recordNewUserAlert(created);
    return created;
  }

  const [appUser] = await db
    .update(users)
    .set({ email, name })
    .where(eq(users.id, identity.id))
    .returning();
  return appUser;
}

export async function requireAppUser(req?: Request): Promise<AppActor | Response> {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const appUser = await syncIdentityUser(identity);
  if (!appUser) {
    return Response.json({ error: 'Unable to load user account' }, { status: 500 });
  }

  if (appUser.status === 'blocked') {
    return Response.json({ error: 'This account has been blocked' }, { status: 403 });
  }

  return {
    ...appUser,
    role: hasAdminAccess(appUser.role, appUser.email) ? 'admin' : 'user',
    identity,
  };
}

export async function requireAdmin(req?: Request): Promise<AppActor | Response> {
  const actor = await requireAppUser(req);
  if (actor instanceof Response) return actor;
  if (actor.role !== 'admin') {
    return Response.json({ error: 'Administrator access required' }, { status: 403 });
  }
  return actor;
}

export function isResponse(value: AppActor | Response): value is Response {
  return value instanceof Response;
}