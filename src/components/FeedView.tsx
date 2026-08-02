import { Sparkles } from 'lucide-react';
import { Composer } from './Composer';
import { PostCard } from './PostCard';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { CommunityAlerts } from './CommunityAlerts';

export function FeedView() {
  const { posts, alerts } = useStore();
  const { setGoLiveOpen } = useUI();

  return (
    <div className="space-y-4">
      <CommunityAlerts alerts={alerts} />

      {/* Hero Go Live banner */}
      <div className="card relative overflow-hidden p-0">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/15 via-transparent to-red-500/10" />
        <div className="relative flex items-center justify-between gap-4 p-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink-100">
              Share a word, go <span className="gold-text">live</span>, or lift a brother up.
            </h2>
            <p className="mt-1 text-sm text-ink-400">Your parish is listening.</p>
          </div>
          <button
            onClick={() => setGoLiveOpen(true)}
            className="gold-btn shrink-0"
          >
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Go Live
          </button>
        </div>
      </div>

      <Composer />

      {posts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={32} className="mb-3 text-gold-300" />
          <p className="font-semibold text-ink-100">The feed is quiet</p>
          <p className="mt-1 text-sm text-ink-400">Be the first to share something today.</p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
