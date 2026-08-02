import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { adminNotifications, users } from '../../db/schema.js';

export type AppRole = 'user' | 'admin';
export type AppStatus = 'active' | 'blocked';
export const SUPER_ADMIN_EMAIL = 'lucasautocode@gmail.com';

export interface IdentityUser {
  id: string;
  email?: string;
  role?: string;
  provider?: string;
  roles?: string[];
  name?: string;
  pictureUrl?: string;
  confirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
}

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
    provider: optionalString(appMetadata.provider),
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

async function identityFromBearer(req?: Request): Promise<IdentityUser | null> {
  if (!req) return null;
  const authorization = req.headers.get('authorization')?.trim() ?? '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return null;

  try {
    const siteUrl = process.env.URL?.trim();
    const identityUrl = new URL('/.netlify/identity/user', siteUrl || req.url);
    const response = await fetch(identityUrl, {
      headers: { Authorization: authorization },
    });
    if (!response.ok) return null;
    return normalizeIdentityApiUser((await response.json()) as IdentityApiUser);
  } catch (error) {
    console.error('Could not validate the request bearer token', error);
    return null;
  }
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
  const identity = await identityFromBearer(req);
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