import type { Config } from '@netlify/functions';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { isResponse, requireAdmin, SUPER_ADMIN_EMAIL } from './_auth.js';

interface AdminUserSummary {
  id: string;
  email: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  confirmed: boolean;
  // False when auth.users holds this account but public.profiles has no row for
  // it yet, so the console can label the row "Profile Pending" instead of
  // hiding the account.
  hasProfile: boolean;
  profile: AdminUserProfile | null;
}

interface AdminUsersPayload {
  total: number;
  confirmed: number;
  pending: number;
  profilePending: number;
  users: AdminUserSummary[];
}

interface AdminUserProfile {
  fullName: string;
  parish: string;
  avatarUrl: string;
  role: string;
  createdAt: string | null;
}

type PublicProfileRow = Record<string, unknown>;

// Largest page Supabase Admin will return. MAX_PAGES is only a runaway-loop
// backstop for auth.users.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getSupabaseAdmin(): SupabaseClient | null {
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function summarizeProfile(profile: PublicProfileRow | undefined): AdminUserProfile | null {
  if (!profile) return null;

  return {
    fullName: textValue(profile.full_name),
    parish: textValue(profile.parish),
    avatarUrl: textValue(profile.avatar_url),
    role: textValue(profile.role),
    createdAt: textValue(profile.created_at) || null,
  };
}

function summarizeUser(user: User, profile?: PublicProfileRow): AdminUserSummary {
  return {
    id: user.id,
    email: user.email?.trim().toLowerCase() ?? '',
    createdAt: user.created_at,
    emailConfirmedAt: user.email_confirmed_at ?? null,
    confirmed: Boolean(user.email_confirmed_at),
    hasProfile: Boolean(profile),
    profile: summarizeProfile(profile),
  };
}

// Supabase caps a single listUsers call at one page, so walk every page until a
// short page arrives. perPage is the maximum the Admin API accepts, which keeps
// the walk to one request for any realistic parish roster while still being
// correct past 1,000 accounts.
async function listAllUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) break;
  }

  return users;
}

async function loadProfiles(
  supabase: SupabaseClient,
): Promise<Map<string, PublicProfileRow>> {
  const profilesByUserId = new Map<string, PublicProfileRow>();
  const { data, error } = await supabase
    .schema('public')
    .from('profiles')
    .select('*');

  if (error) throw error;

  const rows = (data ?? []) as PublicProfileRow[];
  for (const row of rows) {
    const userId = textValue(row.id) || textValue(row.user_id);
    if (userId) profilesByUserId.set(userId, row);
  }

  return profilesByUserId;
}

function calculateBreakdown(users: AdminUserSummary[]): Omit<AdminUsersPayload, 'users'> {
  let confirmed = 0;
  let pending = 0;
  let profilePending = 0;

  for (const user of users) {
    if (!user.hasProfile) {
      profilePending += 1;
    } else if (user.confirmed) {
      confirmed += 1;
    } else {
      pending += 1;
    }
  }

  return { total: users.length, confirmed, pending, profilePending };
}

function errorResponse(error: unknown, fallback: string): Response {
  console.error(fallback, error);
  const message = error instanceof Error && error.message ? error.message : fallback;
  const candidateStatus = typeof error === 'object' && error && 'status' in error
    ? Number(error.status)
    : 500;
  const status = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  return Response.json({ error: message }, { status });
}

export default async (req: Request) => {
  const actor = await requireAdmin(req);
  if (isResponse(actor)) return actor;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { error: 'Supabase Admin API is not configured' },
      { status: 503 },
    );
  }

  if (req.method === 'GET') {
    try {
      const authUsers = await listAllUsers(supabase);
      const profilesByUserId = await loadProfiles(supabase);
      const users = authUsers
        .map((user) => summarizeUser(user, profilesByUserId.get(user.id)))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

      const payload: AdminUsersPayload = {
        ...calculateBreakdown(users),
        users,
      };

      return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error, 'Could not load registered users');
    }
  }

  if (req.method === 'POST') {
    let body: { action?: string; email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'A valid JSON body is required' }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase() ?? '';
    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });

    if (body.action === 'create') {
      const password = body.password ?? '';
      if (password.length < 6) {
        return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }

      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
        });
        if (error) throw error;
        if (!data.user) throw new Error('Supabase did not return the created user');
        return Response.json(summarizeUser(data.user), { status: 201 });
      } catch (error) {
        return errorResponse(error, 'Could not create the user');
      }
    }

    if (body.action === 'resend') {
      try {
        const users = await listAllUsers(supabase);
        const target = users.find((user) => user.email?.trim().toLowerCase() === email);
        if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
        if (target.email_confirmed_at) {
          return Response.json({ error: 'This user has already confirmed their email' }, { status: 400 });
        }

        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw error;
        return Response.json({ ok: true });
      } catch (error) {
        return errorResponse(error, 'Could not resend the confirmation email');
      }
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  }

  if (req.method === 'DELETE') {
    let bodyUserId = '';
    try {
      const body = await req.clone().json() as { userId?: string };
      bodyUserId = body.userId?.trim() ?? '';
    } catch {
      bodyUserId = '';
    }
    const userId = new URL(req.url).searchParams.get('userId')?.trim() || bodyUserId;
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

    try {
      const { data: targetData, error: targetError } = await supabase.auth.admin.getUserById(userId);
      if (targetError) throw targetError;
      const target = targetData.user;
      const targetEmail = target?.email?.trim().toLowerCase() ?? '';
      if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
      if (targetEmail === actor.email.trim().toLowerCase() || targetEmail === SUPER_ADMIN_EMAIL) {
        return Response.json({ error: 'This protected administrator cannot be deleted' }, { status: 400 });
      }

      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return Response.json({ ok: true });
    } catch (error) {
      return errorResponse(error, 'Could not delete the user');
    }
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, POST, DELETE' },
  });
};

export const config: Config = { path: '/api/admin-users' };
