import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Composer } from './Composer';
import { PostCard } from './PostCard';
import { DailySaintBanner } from './DailySaintBanner';
import { StoriesBar } from './StoriesBar';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { CommunityAlerts } from './CommunityAlerts';
import { loadPosts } from '@/utils/posts';
import type { Post } from '@/types';

export function FeedView() {
  const { posts, alerts } = useStore();
  const { setGoLiveOpen } = useUI();
  const [dbPosts, setDbPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadPosts();
        if (!cancelled) setDbPosts(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const allPosts = [...dbPosts, ...posts];

  return (
    <div className="space-y-4">
      <DailySaintBanner />
      <StoriesBar />
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

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <Sparkles size={32} className="mb-3 text-gold-300" />
          <p className="font-semibold text-ink-100">Couldn't load the feed</p>
          <p className="mt-1 text-sm text-ink-400">{error}</p>
        </div>
      )}

      {!loading && !error && allPosts.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={32} className="mb-3 text-gold-300" />
          <p className="font-semibold text-ink-100">The feed is quiet</p>
          <p className="mt-1 text-sm text-ink-400">Be the first to share something today.</p>
        </div>
      )}

      {!loading && !error && allPosts.length > 0 && (
        allPosts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </div>
  );
}
