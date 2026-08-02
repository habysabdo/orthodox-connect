import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { loadReels } from '@/utils/posts';
import { timeAgo } from '@/utils/format';
import type { Post } from '@/types';

export function ReelsView() {
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadReels();
        if (!cancelled) setReels(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<ImageIcon size={28} />}
        title="Couldn't load reels"
        subtitle={error}
      />
    );
  }

  if (reels.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon size={28} />}
        title="No reels yet"
        subtitle="Posts with images will show up here as reels."
      />
    );
  }

  const reel = reels[index];
  const prev = () => setIndex((i) => (i - 1 + reels.length) % reels.length);
  const next = () => setIndex((i) => (i + 1) % reels.length);

  return (
    <div className="mx-auto max-w-md">
      <div className="card overflow-hidden">
        <div className="relative aspect-[9/16] bg-ink-900">
          {reel.image && (
            <img
              src={reel.image}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-ink-950/30" />

          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="chip bg-ink-950/60">
              {index + 1} / {reels.length}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar src="" name={reel.authorName ?? 'Unknown'} size={36} ring="gold" />
              <span className="font-semibold text-ink-100">{reel.authorName}</span>
              <span className="text-xs text-ink-400">{timeAgo(reel.createdAt)}</span>
            </div>
            {reel.text && (
              <p className="text-sm leading-relaxed text-ink-100">{reel.text}</p>
            )}
          </div>

          {reels.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ink-950/60 p-2 text-ink-100 transition-colors hover:bg-ink-950/80"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink-950/60 p-2 text-ink-100 transition-colors hover:bg-ink-950/80"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
