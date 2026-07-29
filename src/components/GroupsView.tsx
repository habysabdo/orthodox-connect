import {
  ArrowUpRight,
  Check,
  Clock,
  Compass,
  Crown,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { DiscoverableGroup } from '@/types';
import { discoverGroups, joinGroupRemote } from '@/utils/groups';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { EmptyState, FeedSkeleton, Modal, Spinner } from './ui';

function memberLabel(count: number) {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

export function GroupsView() {
  const { createGroup, currentUserId, refreshGroups } = useStore();
  const { openGroup } = useUI();
  const [groups, setGroups] = useState<DiscoverableGroup[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    discoverGroups()
      .then((rows) => {
        if (!cancelled) setGroups(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load groups. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups.filter((group) => (
      group.name.toLowerCase().includes(normalized)
      || group.description.toLowerCase().includes(normalized)
    ));
  }, [groups, query]);

  const myGroups = filteredGroups.filter((group) => group.membershipStatus === 'approved');
  const exploreGroups = filteredGroups.filter((group) => group.membershipStatus !== 'approved');

  const join = async (groupId: string) => {
    setJoining((current) => new Set(current).add(groupId));
    setError('');
    try {
      const status = await joinGroupRemote(groupId);
      setGroups((current) => current.map((group) => (
        group.id === groupId ? { ...group, membershipStatus: status } : group
      )));
      if (status === 'approved') await refreshGroups();
    } catch {
      setError('Could not send your request. Please try again.');
    } finally {
      setJoining((current) => {
        const next = new Set(current);
        next.delete(groupId);
        return next;
      });
    }
  };

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError('');
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = groupName.trim();
    const summary = description.trim();
    if (!name || !summary) {
      setCreateError('Add both a group name and description.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const group = await createGroup(name, summary);
      setCreateOpen(false);
      setGroupName('');
      setDescription('');
      openGroup(group.id);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : 'Could not create the group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-ink-700 bg-ink-850/90 px-5 py-6 shadow-card sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-gold-400/20 bg-gold-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <span className="gold-chip mb-4"><Compass size={14} /> Community circles</span>
            <h1 className="font-serif text-4xl font-semibold leading-none text-ink-50 sm:text-5xl">Groups Hub</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-ink-300 sm:text-base">
              Gather around shared ministries, seasons of life, and local fellowship. Your approved groups stay close; new communities are ready to discover.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="gold-btn min-h-12 self-start px-5 md:self-end">
            <Plus size={18} /> Create Group
          </button>
        </div>
        <label className="relative mt-7 block max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by group name or purpose"
            className="input min-h-12 pl-11"
          />
        </label>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="card p-5"><FeedSkeleton /></div>
      ) : (
        <>
          <section aria-labelledby="my-groups-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">Your communities</p>
                <h2 id="my-groups-heading" className="mt-1 font-serif text-3xl font-semibold text-ink-100">My Groups</h2>
              </div>
              <span className="chip">{myGroups.length} approved</span>
            </div>

            {myGroups.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title={query ? 'No joined groups match your search' : 'Your groups are waiting'}
                subtitle={query ? 'Try a broader search.' : 'Create a group or request to join one below. Approved communities appear here.'}
                action={!query ? <button onClick={() => setCreateOpen(true)} className="gold-btn"><Plus size={16} /> Create your first group</button> : undefined}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myGroups.map((group, index) => (
                  <button
                    key={group.id}
                    onClick={() => openGroup(group.id)}
                    className={`group relative min-h-56 overflow-hidden rounded-[1.75rem] border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-gold ${index % 3 === 0 ? 'border-gold-400/25 bg-gradient-to-br from-gold-500/15 via-ink-850 to-ink-900' : 'border-ink-700 bg-ink-850/85'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-400/25 bg-gold-400/10 text-gold-300">
                        {group.createdBy === currentUserId ? <Crown size={22} /> : <Users size={22} />}
                      </span>
                      <ArrowUpRight className="text-ink-500 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-gold-300" size={20} />
                    </div>
                    <h3 className="mt-8 font-serif text-2xl font-semibold text-ink-100">{group.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-400">{group.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink-700/70 pt-4 text-xs text-ink-400">
                      <span>{memberLabel(group.memberCount)}</span>
                      <span className="font-semibold text-gold-300">Open feed</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="explore-groups-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">Find your people</p>
                <h2 id="explore-groups-heading" className="mt-1 font-serif text-3xl font-semibold text-ink-100">Explore Groups</h2>
              </div>
              <span className="chip">{exploreGroups.length} to explore</span>
            </div>

            {exploreGroups.length === 0 ? (
              <EmptyState
                icon={<Compass size={26} />}
                title={query ? 'No other groups match your search' : 'You have explored every active group'}
                subtitle={query ? 'Try another name or keyword.' : 'New active groups appear here when the community creates them.'}
              />
            ) : (
              <div className="space-y-3">
                {exploreGroups.map((group) => (
                  <article key={group.id} className="grid gap-4 rounded-2xl border border-ink-700 bg-ink-850/70 p-4 transition-colors hover:border-ink-600 hover:bg-ink-850 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-800 text-gold-300">
                      <Users size={21} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink-100">{group.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-ink-400">{group.description}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        {memberLabel(group.memberCount)}{group.owner?.name ? ` · Created by ${group.owner.name}` : ''}
                      </p>
                    </div>
                    {group.membershipStatus === 'pending' ? (
                      <button disabled className="ghost-btn min-w-40 shrink-0 py-2 text-xs opacity-60">
                        <Clock size={14} /> Request Pending
                      </button>
                    ) : (
                      <button onClick={() => join(group.id)} disabled={joining.has(group.id)} className="ghost-btn min-w-40 shrink-0 py-2 text-xs disabled:opacity-60">
                        {joining.has(group.id) ? <><Spinner size={14} /> Requesting</> : <><Check size={14} /> Request to Join</>}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Modal open={createOpen} onClose={closeCreate} size="md" className="overflow-hidden p-0">
        <form onSubmit={submitCreate}>
          <div className="relative border-b border-ink-700 bg-gradient-to-br from-gold-500/15 via-ink-850 to-ink-900 p-6">
            <button type="button" onClick={closeCreate} disabled={creating} className="absolute right-4 top-4 rounded-full p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100" aria-label="Close create group dialog">
              <X size={18} />
            </button>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-400/30 bg-gold-400/10 text-gold-300"><Plus size={22} /></span>
            <h2 className="mt-5 font-serif text-3xl font-semibold text-ink-100">Create a group</h2>
            <p className="mt-2 text-sm leading-6 text-ink-400">Name the community and describe the conversations or fellowship it supports.</p>
          </div>
          <div className="space-y-5 p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-200">Group Name</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} className="input" placeholder="Young Adults Fellowship" autoFocus />
              <span className="mt-1.5 block text-right text-xs text-ink-500">{groupName.length}/80</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-200">Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={5} className="input resize-none" placeholder="Share the group’s purpose, who it is for, and what members can expect." />
              <span className="mt-1.5 block text-right text-xs text-ink-500">{description.length}/500</span>
            </label>
            {createError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{createError}</p>}
            <div className="flex flex-col-reverse gap-3 border-t border-ink-700 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeCreate} disabled={creating} className="ghost-btn">Cancel</button>
              <button type="submit" disabled={creating || !groupName.trim() || !description.trim()} className="gold-btn min-w-36">
                {creating ? <><Spinner size={16} /> Creating</> : <><Plus size={16} /> Create Group</>}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
