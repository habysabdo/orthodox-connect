import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  Flag,
  Megaphone,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useStore } from '@/store/context';
import { timeAgo } from '@/utils/format';

export function AdminView() {
  const state = useStore();
  const me = state.users.find((u) => u.id === state.currentUserId);
  const [tab, setTab] = useState<'overview' | 'moderation' | 'alerts'>('overview');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertBody, setAlertBody] = useState('');
  const [alertLevel, setAlertLevel] = useState<'info' | 'warning' | 'urgent'>('info');

  if (!me || me.role !== 'admin') {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Shield size={32} className="mb-3 text-red-400" />
        <p className="font-semibold text-ink-100">Admin access required</p>
        <p className="mt-1 text-sm text-ink-400">Only the community owner can view this panel.</p>
      </div>
    );
  }

  const flaggedPosts = state.posts.filter((p) => p.flagged);
  const memberCount = state.users.length;
  const onlineCount = state.users.filter((u) => u.online).length;
  const activeStreams = state.streams.filter((s) => s.active).length;

  const stats = [
    { label: 'Members', value: memberCount, icon: <Users size={18} /> },
    { label: 'Online now', value: onlineCount, icon: <Eye size={18} /> },
    { label: 'Active streams', value: activeStreams, icon: <Megaphone size={18} /> },
    { label: 'Flagged posts', value: flaggedPosts.length, icon: <Flag size={18} /> },
  ];

  const submitAlert = () => {
    if (!alertTitle.trim()) return;
    state.addAlert({ title: alertTitle.trim(), body: alertBody, level: alertLevel });
    setAlertTitle(''); setAlertBody(''); setAlertLevel('info'); setAlertOpen(false);
  };

  const recentMembers = useMemo(
    () => [...state.users].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 6),
    [state.users],
  );

  return (
    <div className="space-y-4">
      <header className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
            <ShieldCheck size={22} className="text-gold-300" /> Admin <span className="gold-text">Panel</span>
          </h1>
          <p className="mt-1 text-sm text-ink-400">Community oversight for {me.name}</p>
        </div>
        <button onClick={() => setAlertOpen(true)} className="gold-btn">
          <Megaphone size={16} /> New alert
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-ink-700 bg-ink-850/60 p-1">
        {([
          ['overview', 'Overview'],
          ['moderation', `Moderation${flaggedPosts.length ? ` (${flaggedPosts.length})` : ''}`],
          ['alerts', `Alerts (${state.alerts.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === k ? 'bg-gold-400/15 text-gold-200' : 'text-ink-300 hover:bg-ink-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

          <div className="card p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Recent members</h2>
            <div className="space-y-2">
              {recentMembers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-2.5">
                  <Avatar src={u.photo} name={u.name} size={36} online={u.online} ring="gold" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink-100">{u.name}</span>
                      {u.role === 'admin' && <span className="gold-chip py-0">Admin</span>}
                    </div>
                    <div className="truncate text-xs text-ink-400">{u.email}</div>
                  </div>
                  <div className="text-right text-[10px] text-ink-400">
                    joined {timeAgo(u.joinedAt)} ago
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
