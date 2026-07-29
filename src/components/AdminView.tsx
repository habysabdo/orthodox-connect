import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Clock3, MailPlus, Plus, RefreshCw, Search, Shield, ShieldOff, Store, Trash2, Users, X, XCircle } from 'lucide-react';
import type { Group, Post, User, UserStatus } from '@/types';
import { Avatar } from './ui';
import { timeAgo } from '@/utils/format';
import { apiUrl } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { LazyFeedVideo } from './LazyFeedVideo';

interface ManagedUser extends User {
  status: UserStatus;
}

interface ManagedGroup extends Group {
  members: Array<{ groupId: string; userId: string; role: 'admin' | 'member' }>;
}

interface PendingPromo {
  post: Post;
  author: { id: string; name: string; email: string };
}

interface ProfileUser {
  id: string;
  email: string;
  createdAt: string;
  confirmed: boolean;
  pending: boolean;
  fullName: string;
  parish: string;
  avatarUrl: string;
  role: string;
}

interface ProfileTotals {
  total: number;
  confirmed: number;
  pending: number;
}

type ProfileRow = Record<string, unknown>;

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeProfile(profile: ProfileRow): ProfileUser | null {
  const id = textValue(profile.id) || textValue(profile.user_id);
  if (!id) return null;

  const status = textValue(profile.status).toLowerCase();
  const pending = profile.pending === true || status === 'pending';
  const emailConfirmed = booleanValue(profile.email_confirmed);

  return {
    id,
    email: textValue(profile.email).toLowerCase(),
    createdAt: textValue(profile.created_at),
    confirmed: emailConfirmed ?? true,
    pending,
    fullName: textValue(profile.full_name) || textValue(profile.name),
    parish: textValue(profile.parish),
    avatarUrl: textValue(profile.avatar_url),
    role: textValue(profile.role),
  };
}

function calculateProfileTotals(profiles: ProfileUser[]): ProfileTotals {
  let confirmed = 0;
  let pending = 0;

  for (const profile of profiles) {
    if (profile.confirmed) confirmed += 1;
    if (profile.pending) pending += 1;
  }

  return { total: profiles.length, confirmed, pending };
}

const SUPER_ADMIN_EMAIL = 'lucasautocode@gmail.com';

function dedupeUsers(users: ManagedUser[]): ManagedUser[] {
  return Array.from(new Map(users.map((user) => [user.id, user])).values());
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { credentials: 'include', ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not complete this admin action');
  }
  return response.json();
}

export function AdminView() {
  const { currentUserId, users: directoryUsers } = useStore();
  // The selected tab lives in UI state so an admin alert can deep-link straight
  // to "Manage Users" from the header bell.
  const { adminTab: tab, setAdminTab: setTab } = useUI();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [profileUsers, setProfileUsers] = useState<ProfileUser[]>([]);
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPromos, setPendingPromos] = useState<PendingPromo[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ManagedGroup | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [profileUsersLoading, setProfileUsersLoading] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const currentAdmin = directoryUsers.find((user) => user.id === currentUserId);

  const isProtectedAdmin = (user: ManagedUser) =>
    user.id === currentUserId
    || user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  const loadUsers = async () => {
    try {
      const loadedUsers = await requestJson<ManagedUser[]>('/api/admin?resource=users');
      setUsers(dedupeUsers(loadedUsers));
    } catch (loadError) {
      console.error('Could not load admin users', loadError);
      setUsers([]);
    }
  };

  const loadGroups = async () => {
    try {
      setGroups(await requestJson<ManagedGroup[]>('/api/admin?resource=groups'));
    } catch (loadError) {
      console.error('Could not load admin groups', loadError);
      setGroups([]);
    }
  };

  const loadPendingPromos = async () => {
    setPromosLoading(true);
    setError('');
    try {
      setPendingPromos(await requestJson<PendingPromo[]>('/api/admin?resource=promo-posts'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load pending promo posts');
      setPendingPromos([]);
    } finally {
      setPromosLoading(false);
    }
  };

  const loadProfileUsers = async (announceRefresh = false) => {
    setProfileUsersLoading(true);
    setError('');
    if (announceRefresh) setNotice('');
    try {
      const { data, error: profileError } = await supabase.from('profiles').select('*');
      if (profileError) throw profileError;
      setProfileUsers((data ?? []).map((profile) => normalizeProfile(profile as ProfileRow)).filter((profile): profile is ProfileUser => profile !== null));
      if (announceRefresh) setNotice('User list refreshed.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load registered users');
      setProfileUsers([]);
    } finally {
      setProfileUsersLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadUsers(), loadGroups()]);
  }, []);

  useEffect(() => {
    if (tab === 'auth-users') void loadProfileUsers();
    if (tab === 'promo-moderation') void loadPendingPromos();
  }, [tab]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dedupeUsers(users).filter((user) => {
      const matchesSearch = !query || `${user.name} ${user.email} ${user.parish}`.toLowerCase().includes(query);
      return matchesSearch
        && (roleFilter === 'all' || user.role === roleFilter)
        && (statusFilter === 'all' || user.status === statusFilter);
    });
  }, [roleFilter, search, statusFilter, users]);

  const accountTotals = useMemo(() => calculateProfileTotals(profileUsers), [profileUsers]);
  const countsReady = !profileUsersLoading || profileUsers.length > 0;

  const updateUser = async (user: ManagedUser, patch: Partial<Pick<ManagedUser, 'role' | 'status'>>) => {
    if (isProtectedAdmin(user) && (patch.role === 'user' || patch.status === 'blocked')) return;
    setBusyId(user.id);
    setError('');
    try {
      await requestJson('/api/admin?resource=users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...patch }),
      });
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the user');
    } finally {
      setBusyId('');
    }
  };

  const openGroup = async (group: ManagedGroup) => {
    setSelectedGroup(group);
    setError('');
    try {
      setPosts(await requestJson<Post[]>(`/api/posts?groupId=${encodeURIComponent(group.id)}`));
    } catch (loadError) {
      console.error('Could not load group posts', loadError);
      setPosts([]);
    }
  };

  const deletePost = async (postId: string) => {
    setBusyId(postId);
    try {
      await requestJson(`/api/admin?resource=posts&id=${encodeURIComponent(postId)}`, { method: 'DELETE' });
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the post');
    } finally {
      setBusyId('');
    }
  };

  const deleteGroup = async (group: ManagedGroup) => {
    if (!window.confirm(`Delete “${group.name}” and every post inside it?`)) return;
    setBusyId(group.id);
    try {
      await requestJson(`/api/admin?resource=groups&id=${encodeURIComponent(group.id)}`, { method: 'DELETE' });
      setSelectedGroup(null);
      setPosts([]);
      await loadGroups();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the group');
    } finally {
      setBusyId('');
    }
  };

  const moderatePromo = async (postId: string, action: 'approve' | 'reject') => {
    setBusyId(postId);
    setError('');
    setNotice('');
    try {
      await requestJson('/api/admin?resource=promo-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action }),
      });
      setPendingPromos((current) => current.filter((item) => item.post.id !== postId));
      setNotice(action === 'approve' ? 'Promo approved and released to the public feed.' : 'Promo rejected.');
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Could not moderate the promo post');
    } finally {
      setBusyId('');
    }
  };

  const createAuthUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId('create-auth-user');
    setError('');
    setNotice('');
    try {
      await requestJson<{ id: string }>('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', email: newUserEmail, password: newUserPassword }),
      });
      setAddUserOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNotice('User created. Their email remains pending until confirmation.');
      await loadProfileUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the user');
    } finally {
      setBusyId('');
    }
  };

  const resendAuthEmail = async (user: ProfileUser) => {
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      await requestJson('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', email: user.email }),
      });
      setNotice(`Confirmation email resent to ${user.email}.`);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the confirmation email');
    } finally {
      setBusyId('');
    }
  };

  const deleteAuthUser = async (user: ProfileUser) => {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      await requestJson(`/api/admin-users?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      setProfileUsers((current) => current.filter((candidate) => candidate.id !== user.id));
      setNotice(`${user.email} was permanently deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the user');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold-400/40 bg-gradient-to-r from-gold-400/15 to-transparent p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-gold-400/20 p-2 text-gold-200"><Shield size={22} /></span>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink-100">Global Admin Console</h1>
            <p className="text-sm text-ink-400">Server-verified access to every account, private group, member list, and post.</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

      <div className="flex gap-2 border-b border-ink-700">
        <button onClick={() => setTab('users')} className={`px-4 py-3 text-sm font-semibold ${tab === 'users' ? 'border-b-2 border-gold-400 text-gold-200' : 'text-ink-400'}`}>Users</button>
        <button onClick={() => setTab('auth-users')} className={`px-4 py-3 text-sm font-semibold ${tab === 'auth-users' ? 'border-b-2 border-gold-400 text-gold-200' : 'text-ink-400'}`}>Manage Users</button>
        <button onClick={() => setTab('promo-moderation')} className={`px-4 py-3 text-sm font-semibold ${tab === 'promo-moderation' ? 'border-b-2 border-gold-400 text-gold-200' : 'text-ink-400'}`}>Promo Approval</button>
        <button onClick={() => setTab('groups')} className={`px-4 py-3 text-sm font-semibold ${tab === 'groups' ? 'border-b-2 border-gold-400 text-gold-200' : 'text-ink-400'}`}>Groups & Content</button>
      </div>

      {tab === 'users' && (
        <div className="space-y-3">
          <div className="card grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 text-ink-400" size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or parish" className="input pl-10" />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="input md:w-40">
              <option value="all">All roles</option><option value="user">Users</option><option value="admin">Admins</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="input md:w-40">
              <option value="all">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
            </select>
          </div>
          <div className="card divide-y divide-ink-700 overflow-hidden">
            {filteredUsers.map((user) => {
              const protectedAdmin = isProtectedAdmin(user);
              const isSuperAdmin = user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
              const isCurrentAdmin = user.id === (currentAdmin?.id ?? currentUserId);
              return (
                <div key={user.id} className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center ${protectedAdmin ? 'bg-gold-400/[0.04]' : ''}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar src={user.photo} name={user.name} size={42} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold text-ink-100">{user.name}</span>{user.role === 'admin' && <span className="gold-chip">Admin</span>}{isCurrentAdmin && <span className="rounded-full border border-gold-400/40 bg-gold-400/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-200">You</span>}{user.status === 'blocked' && <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">Blocked</span>}</div>
                      <div className="truncate text-xs text-ink-400">{user.email} · joined {timeAgo(user.joinedAt)} ago</div>
                    </div>
                  </div>
                  {!isCurrentAdmin && !isSuperAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busyId === user.id || (protectedAdmin && user.role === 'admin')} onClick={() => updateUser(user, { role: user.role === 'admin' ? 'user' : 'admin' })} className="ghost-btn py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}{protectedAdmin && user.role === 'admin' ? 'Admin Protected' : user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</button>
                      <button disabled={busyId === user.id || (protectedAdmin && user.status !== 'blocked')} onClick={() => updateUser(user, { status: user.status === 'blocked' ? 'active' : 'blocked' })} className={`ghost-btn py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${user.status === 'blocked' ? 'text-emerald-300' : 'text-red-300'}`}>{user.status === 'blocked' ? <CheckCircle2 size={14} /> : <Ban size={14} />}{protectedAdmin && user.status !== 'blocked' ? 'Block Protected' : user.status === 'blocked' ? 'Unblock User' : 'Block User'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'auth-users' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-400/15 via-ink-850 to-ink-850 p-5">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <span className="rounded-2xl bg-gold-400/20 p-3 text-gold-200"><Users size={26} /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Total Registered Users</p>
                  <p className="font-serif text-4xl font-semibold leading-tight text-ink-100" aria-live="polite">
                    {countsReady ? accountTotals.total.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
              <div className="flex gap-6 border-t border-ink-700 pt-4 sm:border-0 sm:pt-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Confirmed</p>
                  <p className="mt-0.5 text-2xl font-semibold text-emerald-300">
                    {countsReady ? accountTotals.confirmed.toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Pending</p>
                  <p className="mt-0.5 text-2xl font-semibold text-amber-300">
                    {countsReady ? accountTotals.pending.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-ink-100">Registered Accounts</h2>
              <p className="mt-1 text-sm text-ink-400">Live profiles from the same source as the Users directory.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" disabled={profileUsersLoading} onClick={() => void loadProfileUsers(true)} className="ghost-btn disabled:cursor-wait disabled:opacity-50">
                <RefreshCw size={17} className={profileUsersLoading ? 'animate-spin' : ''} /> Refresh User List
              </button>
              <button onClick={() => { setError(''); setNotice(''); setAddUserOpen(true); }} className="primary-btn">
                <Plus size={17} /> Add New User
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="border-b border-ink-700 bg-ink-850/70 text-xs uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {profileUsersLoading && (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-ink-400">Loading registered users…</td></tr>
                  )}
                  {!profileUsersLoading && profileUsers.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-ink-400">No profiles found.</td></tr>
                  )}
                  {!profileUsersLoading && profileUsers.map((user) => {
                    const protectedUser = user.email.toLowerCase() === currentAdmin?.email.toLowerCase()
                      || user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
                    const createdAt = Date.parse(user.createdAt);
                    return (
                      <tr key={user.id} className="transition-colors hover:bg-ink-800/40">
                        <td className="px-4 py-4">
                          <div className="font-medium text-ink-100">{user.email || user.fullName || 'Profile'}</div>
                          {user.fullName && user.fullName.toLowerCase() !== user.email.toLowerCase() && (
                            <div className="mt-1 text-sm text-ink-300">{user.fullName}</div>
                          )}
                          {user.parish && <div className="mt-1 text-xs text-ink-400">{user.parish}</div>}
                          <div className="mt-1 text-xs text-ink-500">
                            Created {Number.isFinite(createdAt) ? new Date(createdAt).toLocaleDateString() : 'date unavailable'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${user.pending || !user.confirmed ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                              {user.pending || !user.confirmed ? <MailPlus size={13} /> : <CheckCircle2 size={13} />}
                              {user.pending ? 'Pending' : user.confirmed ? 'Confirmed' : 'Unconfirmed'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {!user.confirmed && user.email && (
                              <button disabled={busyId === user.id} onClick={() => resendAuthEmail(user)} className="ghost-btn py-2 text-xs disabled:cursor-wait disabled:opacity-50">
                                <RefreshCw size={14} className={busyId === user.id ? 'animate-spin' : ''} /> Resend Email
                              </button>
                            )}
                            <button disabled={busyId === user.id || protectedUser} onClick={() => deleteAuthUser(user)} className="ghost-btn py-2 text-xs text-red-300 disabled:cursor-not-allowed disabled:opacity-40">
                              <Trash2 size={14} /> {protectedUser ? 'Protected' : 'Delete User'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'promo-moderation' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-400/30 bg-gradient-to-r from-gold-400/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-gold-400/15 p-2.5 text-gold-200"><Store size={21} /></span>
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-100">Community Showcase / Business Promo</h2>
                <p className="text-sm text-ink-400">Review pending submissions before they reach the public home feed.</p>
              </div>
            </div>
            <button type="button" onClick={() => void loadPendingPromos()} disabled={promosLoading} className="ghost-btn py-2 text-xs disabled:opacity-50">
              <RefreshCw size={14} className={promosLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {promosLoading && pendingPromos.length === 0 ? (
            <div className="card grid min-h-48 place-items-center text-sm text-ink-400"><RefreshCw size={20} className="mb-2 animate-spin text-gold-300" />Loading pending promos…</div>
          ) : pendingPromos.length === 0 ? (
            <div className="card grid min-h-48 place-items-center px-6 text-center">
              <div><CheckCircle2 size={34} className="mx-auto text-emerald-300" /><p className="mt-3 font-semibold text-ink-100">All caught up</p><p className="mt-1 text-sm text-ink-400">There are no promo posts awaiting approval.</p></div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {pendingPromos.map(({ post, author: submittedBy }) => {
                const directoryAuthor = users.find((user) => user.id === submittedBy.id);
                const authorName = directoryAuthor?.name ?? submittedBy.name;
                return (
                  <article key={post.id} className="card overflow-hidden p-0">
                    <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={directoryAuthor?.photo ?? ''} name={authorName} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-100">{authorName}</p>
                          <p className="truncate text-xs text-ink-400">{submittedBy.email || 'No email available'} · {timeAgo(post.createdAt)} ago</p>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200"><Clock3 size={12} /> Pending</span>
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">Promo title</p>
                        <h3 className="mt-1 font-serif text-xl font-semibold text-ink-100">{post.promoTitle || 'Untitled promotion'}</h3>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">Description</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-200">{post.text || 'No description provided.'}</p>
                      </div>
                      {post.image && <img src={post.image} alt={`Preview for ${post.promoTitle || 'promo post'}`} className="max-h-72 w-full rounded-xl border border-ink-700 bg-ink-950 object-contain" referrerPolicy="no-referrer" />}
                      {post.video && <LazyFeedVideo url={post.video} title={post.promoTitle || 'Promo video'} className="aspect-video w-full rounded-xl bg-black object-contain" posterClassName="aspect-video w-full rounded-xl" />}
                    </div>

                    <div className="flex gap-2 border-t border-ink-700 bg-ink-900/40 p-4">
                      <button type="button" disabled={busyId === post.id} onClick={() => void moderatePromo(post.id, 'reject')} className="ghost-btn flex-1 justify-center py-2.5 text-red-300 disabled:cursor-wait disabled:opacity-50"><XCircle size={16} /> Reject</button>
                      <button type="button" disabled={busyId === post.id} onClick={() => void moderatePromo(post.id, 'approve')} className="primary-btn flex-1 justify-center py-2.5 disabled:cursor-wait disabled:opacity-50"><CheckCircle2 size={16} /> Approve</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="card divide-y divide-ink-700 overflow-hidden">
            {groups.map((group) => (
              <button key={group.id} onClick={() => openGroup(group)} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-ink-800/60 ${selectedGroup?.id === group.id ? 'bg-gold-400/10' : ''}`}>
                <span className="rounded-lg bg-ink-800 p-2 text-gold-300"><Users size={18} /></span>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold text-ink-100">{group.name}</div><div className="truncate text-xs text-ink-400">Owner: {group.owner?.name ?? group.createdBy} · {group.memberCount} members</div></div>
              </button>
            ))}
          </div>

          <div className="card p-4">
            {!selectedGroup ? <p className="py-16 text-center text-sm text-ink-400">Select a group to inspect its private feed.</p> : (
              <div>
                <div className="flex items-center justify-between gap-3 border-b border-ink-700 pb-3"><div><h2 className="font-serif text-xl font-semibold text-ink-100">{selectedGroup.name}</h2><p className="text-xs text-ink-400">{selectedGroup.memberCount} members · Global Admin inspection</p></div><button disabled={busyId === selectedGroup.id} onClick={() => deleteGroup(selectedGroup)} className="ghost-btn py-2 text-xs text-red-300"><Trash2 size={14} /> Delete Group</button></div>
                <div className="mt-3 space-y-3">
                  {posts.length === 0 ? <p className="py-10 text-center text-sm text-ink-400">No posts in this group.</p> : posts.map((post) => {
                    const author = users.find((user) => user.id === post.authorId);
                    return <div key={post.id} className="rounded-xl border border-ink-700 bg-ink-850/60 p-3"><div className="flex items-start gap-3"><Avatar src={author?.photo ?? ''} name={author?.name ?? 'Member'} size={34} /><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink-100">{author?.name ?? 'Member'}</div><p className="mt-1 whitespace-pre-wrap text-sm text-ink-200">{post.text}</p><div className="mt-2 text-[10px] text-ink-500">{timeAgo(post.createdAt)} ago</div></div><button disabled={busyId === post.id} onClick={() => deletePost(post.id)} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={16} /></button></div></div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {addUserOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-user-title" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId !== 'create-auth-user') setAddUserOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-gold-400/30 bg-ink-850 p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="add-user-title" className="font-serif text-2xl font-semibold text-ink-100">Add New User</h2>
                <p className="mt-1 text-sm text-ink-400">Create a pending Supabase account with a temporary password.</p>
              </div>
              <button type="button" disabled={busyId === 'create-auth-user'} onClick={() => setAddUserOpen(false)} className="rounded-lg p-2 text-ink-400 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-40" aria-label="Close add user dialog"><X size={19} /></button>
            </div>

            <form onSubmit={createAuthUser} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gold-300">Email</span>
                <input type="email" required autoFocus autoComplete="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} className="input" placeholder="member@example.com" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gold-300">Password</span>
                <input type="password" required minLength={6} autoComplete="new-password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} className="input" placeholder="At least 6 characters" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" disabled={busyId === 'create-auth-user'} onClick={() => setAddUserOpen(false)} className="ghost-btn">Cancel</button>
                <button type="submit" disabled={busyId === 'create-auth-user'} className="primary-btn disabled:cursor-wait disabled:opacity-60">
                  {busyId === 'create-auth-user' ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                  {busyId === 'create-auth-user' ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
