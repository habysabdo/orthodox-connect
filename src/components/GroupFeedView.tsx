import { ArrowLeft, LockKeyhole, Users } from 'lucide-react';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { FeedSkeleton } from './ui';
import { FeedView } from './FeedView';

export function GroupFeedView() {
  const { groups, activeGroupId, groupsLoading } = useStore();
  const { setView } = useUI();
  const group = groups.find((item) => item?.id === activeGroupId);

  if (!group || groupsLoading) return <FeedSkeleton />;

  const memberCount = typeof group.memberCount === 'number' ? group.memberCount : 0;

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden p-0">
        <div className="bg-gradient-to-br from-gold-500/15 via-transparent to-ink-900 p-5 sm:p-6">
          <button onClick={() => setView('groups')} className="ghost-btn mb-4 py-1.5 text-xs">
            <ArrowLeft size={14} /> All Groups
          </button>
          <div className="flex items-start gap-4">
            <span className="rounded-2xl border border-gold-400/30 bg-gold-400/10 p-3 text-gold-300">
              <Users size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl font-semibold text-ink-100">{group.name || 'Group'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">{group.description ?? ''}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-400">
                <LockKeyhole size={14} /> Private group feed · {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>
      </section>
      <FeedView />
    </div>
  );
}
