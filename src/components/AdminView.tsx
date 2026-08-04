import { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle, Eye, Flag, Megaphone, Shield, ShieldCheck, Trash2, Users,
  ArrowUp, ArrowDown, Ban, RotateCcw, Loader2, Search,
} from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useStore } from '@/store/context';
import { useAuth, type Profile } from '@/store/auth';
import { useToast } from './Toast';
import { timeAgo } from '@/utils/format';
import { supabase } from '@/lib/supabase';

type AdminTab = 'overview' | 'users' | 'moderation' | 'alerts';

export function AdminView() {
  const state = useStore();
  const { profile } = useAuth();
  const { notify } = useToast();
  const me = state.users.find((u) => u.id === state.currentUserId);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertBody, setAlertBody] = useState('');
  const [alertLevel, setAlertLevel] = useState<'info' | 'warning' | 'urgent'>('info');

  // Real Supabase data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [metrics, setMetrics] = useState({ total_users: 0, banned_users: 0, admin_count: 0 });
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      notify('error', `Failed to load users: ${error.message}`);
    } else if (data) {
      setProfiles(data as Profile[]);
    }
    setLoadingProfiles(false);
  };

  const fetchMetrics = async () => {
    const { data, error } = await supabase.rpc('get_platform_metrics');
    if (!error && data) {
      setMetrics(data as { total_users: number; banned_users: number; admin_count: number });
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
    fetchMetrics();
  }, [isAdmin]);

  const handlePromote = async (uid: string) => {
    setActionLoading(uid);
    const { error } = await supabase.rpc('promote_user', { target_uid: uid });
    if (error) {
      notify('error', `Failed to promote: ${error.message}`);
    } else {
      notify('success', 'User promoted to admin.');
      await fetchProfiles();
      await fetchMetrics();
    }
    setActionLoading(null);
  };

  const handleDemote = async (uid: string) => {
    setActionLoading(uid);
    const { error } = await supabase.rpc('demote_user', { target_uid: uid });
    if (error) {
      notify('error', `Failed to demote: ${error.message}`);
    } else {
      notify('success', 'Admin demoted to member.');
      await fetchProfiles();
      await fetchMetrics();
    }
    setActionLoading(null);
  };

  const handleBan = async (uid: string) => {
    setActionLoading(uid);
    const { error } = await supabase.rpc('ban_user', { target_uid: uid });
    if (error) {
      notify('error', `Failed to ban user: ${error.message}`);
    } else {
      notify('success', 'User has been banned.');
      await fetchProfiles();
      await fetchMetrics();
    }
    setActionLoading(null);
  };

  const handleUnban = async (uid: string) => {
    setActionLoading(uid);
    const { error } = await supabase.rpc('unban_user', { target_uid: uid });
    if (error) {
      notify('error', `Failed to unban: ${error.message}`);
    } else {
      notify('success', 'User has been unbanned.');
      await fetchProfiles();
      await fetchMetrics();
    }
    setActionLoading(null);
  };

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const query = search.toLowerCase();
    return profiles.filter((profileItem) =>
      profileItem.display_name?.toLowerCase().includes(query) ||
      profileItem.email?.toLowerCase().includes(query) ||
      profileItem.parish?.toLowerCase().includes(query)
    );
  }, [profiles, search]);

  if (!me || !isAdmin) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Shield size={32} className="mb-3 text-red-400" />
        <p className="font-semibold text-ink-100">Admin access required</p>
        <p className="mt-1 text-sm text-ink-400">Only community admins can view this panel.</p>
      </div>
    );
  }

  const flaggedPosts = state.posts.filter((p) => p.flagged);
  const memberCount = metrics.total_users || profiles.length;
  const bannedCount = metrics.banned_users;
  const adminCount = metrics.admin_count;
  const onlineCount = state.users.filter((u) => u.online).length;
  const activeStreams = state.streams.filter((s) => s.active).length;

  const stats = [
    { label: 'Registered Users', value: memberCount, icon: <Users size={18} /> },
    { label: 'Online Now', value: onlineCount, icon: <Eye size={18} /> },
    { label: 'Admins', value: adminCount, icon: <ShieldCheck size={18} /> },
    { label: 'Banned Users', value: bannedCount, icon: <Ban size={18} /> },
    { label: 'Active Streams', value: activeStreams, icon: <Megaphone size={18} /> },
    { label: 'Flagged Posts', value: flaggedPosts.length, icon: <Flag size={18} /> },
  ];

  const submitAlert = () => {
    if (!alertTitle.trim()) return;
    state.addAlert({ title: alertTitle.trim(), body: alertBody, level: alertLevel });
    setAlertTitle(''); setAlertBody(''); setAlertLevel('info'); setAlertOpen(false);
    notify('success', 'Alert published.');
  };

  return (
    <div className="space-y-4">
      <header className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
            <ShieldCheck size={22} className="text-gold-300" /> Admin <span className="gold-text">Panel</span>
          </h1>
          <p className="mt-1 text-sm text-ink-400">Community oversight for {profile?.display_name || me.name}</p>
        </div>
        <button onClick={() => setAlertOpen(true)} className="gold-btn">
          <Megaphone size={16} /> New alert
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-850/60 p-1">
        {([
          ['overview', 'Overview'],
          ['users', `Users (${profiles.length})`],
          ['moderation', `Moderation${flaggedPosts.length ? ` (${flaggedPosts.length})` : ''}`],
          ['alerts', `Alerts (${state.alerts.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-gold-400/15 text-gold-200' : 'text-ink-300 hover:bg-ink-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="card flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold text-ink-100">{s.value}</div>
                  <div className="text-xs text-ink-400">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User management tab */}
      {tab === 'users' && (
        <div className="card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
              <Users size={14} /> User Management
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="input py-1.5 pl-9 text-sm"
              />
            </div>
          </div>

          {loadingProfiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gold-300" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No users found.</p>
          ) : (
            <div className="space-y-2">
              {filteredProfiles.map((p) => {
                const isMe = p.id === profile?.id;
                const isBanned = p.banned;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      isBanned ? 'border-red-500/30 bg-red-500/5' : 'border-ink-700 bg-ink-850/60'
                    }`}
                  >
                    <Avatar src={p.photo_url} name={p.display_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-100">
                          {p.display_name || 'Unnamed'}
                        </span>
                        {p.role === 'admin' && <span className="gold-chip py-0">Admin</span>}
                        {p.verified && <span className="chip py-0 text-emerald-300">Verified</span>}
                        {isBanned && <span className="chip py-0 text-red-300">Banned</span>}
                        {isMe && <span className="chip py-0 text-ink-300">You</span>}
                      </div>
                      <div className="truncate text-xs text-ink-400">{p.email}</div>
                      {p.parish && <div className="truncate text-[10px] text-ink-500">{p.parish}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {actionLoading === p.id ? (
                        <Loader2 size={14} className="animate-spin text-gold-300" />
                      ) : (
                        <>
                          {p.role === 'admin' && !isMe && (
                            <button
                              onClick={() => handleDemote(p.id)}
                              className="ghost-btn px-2 py-1.5 text-xs"
                              title="Demote to member"
                            >
                              <ArrowDown size={13} />
                            </button>
                          )}
                          {p.role !== 'admin' && !isBanned && (
                            <button
                              onClick={() => handlePromote(p.id)}
                              className="ghost-btn px-2 py-1.5 text-xs"
                              title="Promote to admin"
                            >
                              <ArrowUp size={13} />
                            </button>
                          )}
                          {!isMe && !isBanned && (
                            <button
                              onClick={() => handleBan(p.id)}
                              className="ghost-btn px-2 py-1.5 text-xs text-red-300"
                              title="Ban user"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                          {!isMe && isBanned && (
                            <button
                              onClick={() => handleUnban(p.id)}
                              className="ghost-btn px-2 py-1.5 text-xs text-emerald-300"
                              title="Unban user"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Moderation tab */}
      {tab === 'moderation' && (
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
            <Flag size={14} /> Flagged content
          </h2>
          {flaggedPosts.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No flagged posts. The community is at peace.</p>
          ) : (
            <div className="space-y-3">
              {flaggedPosts.map((p) => {
                const author = state.users.find((u) => u.id === p.authorId);
                return (
                  <div key={p.id} className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-start gap-3">
                      <Avatar src={author?.photo ?? ''} name={author?.name ?? ''} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-100">{author?.name}</span>
                          <span className="flex items-center gap-1 text-xs text-red-300">
                            <AlertTriangle size={11} /> {p.flagReason}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-200">{p.text}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => state.unflagPost(p.id)} className="ghost-btn py-1.5 text-xs">
                          Clear
                        </button>
                        <button onClick={() => state.deletePost(p.id)} className="ghost-btn py-1.5 text-xs text-red-300">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alerts tab */}
      {tab === 'alerts' && (
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
            <Megaphone size={14} /> Community alerts
          </h2>
          <div className="space-y-2">
            {state.alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-3">
                <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  a.level === 'urgent' ? 'bg-red-500/20 text-red-300'
                    : a.level === 'warning' ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-gold-400/20 text-gold-200'
                }`}>{a.level}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-100">{a.title}</div>
                  <div className="text-xs text-ink-400">{a.body}</div>
                  <div className="mt-1 text-[10px] text-ink-500">{timeAgo(a.createdAt)} ago</div>
                </div>
                <button onClick={() => state.dismissAlert(a.id)} className="text-xs text-ink-400 hover:text-red-300">
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New alert modal */}
      <Modal open={alertOpen} onClose={() => setAlertOpen(false)} size="md">
        <div className="p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Megaphone size={18} className="text-gold-300" /> New community alert
          </h2>
          <div className="mt-4 space-y-3">
            <input value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} placeholder="Alert title" className="input" />
            <textarea value={alertBody} onChange={(e) => setAlertBody(e.target.value)} rows={3} placeholder="Message to the community…" className="input resize-none" />
            <div className="flex gap-2">
              {(['info', 'warning', 'urgent'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setAlertLevel(lvl)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    alertLevel === lvl
                      ? 'border-gold-400/60 bg-gold-400/10 text-gold-200'
                      : 'border-ink-600 text-ink-300 hover:bg-ink-800'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setAlertOpen(false)} className="ghost-btn py-2">Cancel</button>
            <button onClick={submitAlert} disabled={!alertTitle.trim()} className="gold-btn py-2">Publish alert</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
