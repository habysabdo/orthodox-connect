import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  Heart,
  MessageSquare,
  Music,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { Avatar } from './ui';
import { useStore } from '@/store/context';
import { seedReels } from '@/data/content';
import { loadReels } from '@/utils/posts';
import { timeAgo } from '@/utils/format';
import type { Comment, VideoReel } from '@/types';

export function ReelsView() {
  const { users, currentUserId } = useStore();
  const me = users.find((u) => u.id === currentUserId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reels, setReels] = useState<VideoReel[]>(seedReels);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);

  // Load video/image reels from Supabase and merge with seed content
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dbReels = await loadReels();
        if (cancelled || dbReels.length === 0) return;
        const mapped: VideoReel[] = dbReels.map((p) => ({
          id: p.id,
          authorId: p.authorId,
          authorName: p.authorName ?? 'Unknown',
          authorPhoto: p.authorAvatar ?? '',
          mediaUrl: p.image ?? '',
          mediaType: 'image',
          caption: p.text,
          hashtags: [],
          createdAt: p.createdAt,
          likes: p.likes,
          comments: p.comments,
          bookmarks: [],
        }));
        setReels((prev) => [...mapped, ...prev]);
      } catch {
        // silently fall back to seed reels
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Track which reel is in view via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 },
    );
    container.querySelectorAll('[data-reel]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  const toggleLike = (reelId: string) => {
    if (!me) return;
    setReels((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        const liked = r.likes.includes(me.id);
        return { ...r, likes: liked ? r.likes.filter((id) => id !== me.id) : [...r.likes, me.id] };
      }),
    );
  };

  const toggleBookmark = (reelId: string) => {
    if (!me) return;
    setReels((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        const saved = r.bookmarks.includes(me.id);
        return {
          ...r,
          bookmarks: saved ? r.bookmarks.filter((id) => id !== me.id) : [...r.bookmarks, me.id],
        };
      }),
    );
  };

  const toggleFollow = (authorId: string) => {
    setFollowing((prev) =>
      prev.includes(authorId)
        ? prev.filter((id) => id !== authorId)
        : [...prev, authorId],
    );
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="no-scrollbar h-[calc(100vh-3.5rem)] snap-y-mandatory overflow-y-auto overflow-x-hidden lg:h-[calc(100vh-6rem)]"
      >
        {reels.map((reel, i) => (
          <div
            key={reel.id}
            data-reel
            data-index={i}
            className="snap-center h-full w-full"
          >
            <ReelCard
              reel={reel}
              active={i === activeIndex}
              liked={me ? reel.likes.includes(me.id) : false}
              bookmarked={me ? reel.bookmarks.includes(me.id) : false}
              isFollowing={following.includes(reel.authorId)}
              onLike={() => toggleLike(reel.id)}
              onBookmark={() => toggleBookmark(reel.id)}
              onComment={() => setCommentOpen(reel.id)}
              onFollow={() => toggleFollow(reel.authorId)}
            />
          </div>
        ))}
      </div>

      {/* Comment drawer */}
      <AnimatePresence>
        {commentOpen && (
          <CommentDrawer
            reel={reels.find((r) => r.id === commentOpen)!}
            onClose={() => setCommentOpen(null)}
            onAddComment={(text) => {
              if (!me) return;
              setReels((prev) =>
                prev.map((r) =>
                  r.id === commentOpen
                    ? {
                        ...r,
                        comments: [
                          ...r.comments,
                          { id: `rc_${Date.now()}`, authorId: me.id, text, createdAt: Date.now() } as Comment,
                        ],
                      }
                    : r,
                ),
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReelCard({
  reel,
  active,
  liked,
  bookmarked,
  isFollowing,
  onLike,
  onBookmark,
  onComment,
  onFollow,
}: {
  reel: VideoReel;
  active: boolean;
  liked: boolean;
  bookmarked: boolean;
  isFollowing: boolean;
  onLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
  onFollow: () => void;
}) {
  const { users } = useStore();
  const author = users.find((u) => u.id === reel.authorId);

  return (
    <div className="relative flex h-full items-center justify-center bg-ink-950">
      {/* Media */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: active ? 1 : 0.85 }}
        transition={{ duration: 0.4 }}
        className="relative h-full w-full max-w-md overflow-hidden"
      >
        <img
          src={reel.mediaUrl}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Dark gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />

        {/* Right action rail */}
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onLike}
            className="flex flex-col items-center gap-1"
          >
            <motion.div
              animate={liked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart
                size={30}
                className={`transition-colors ${liked ? 'fill-maroon-500 text-maroon-500' : 'text-white'}`}
              />
            </motion.div>
            <span className="text-[11px] font-medium text-white drop-shadow-lg">{reel.likes.length}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onComment}
            className="flex flex-col items-center gap-1"
          >
            <MessageSquare size={28} className="text-white" />
            <span className="text-[11px] font-medium text-white drop-shadow-lg">{reel.comments.length}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onBookmark}
            className="flex flex-col items-center gap-1"
          >
            <Bookmark
              size={28}
              className={`transition-colors ${bookmarked ? 'fill-gold-400 text-gold-400' : 'text-white'}`}
            />
            <span className="text-[11px] font-medium text-white drop-shadow-lg">Save</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {}}
            className="flex flex-col items-center gap-1"
          >
            <Share2 size={26} className="text-white" />
            <span className="text-[11px] font-medium text-white drop-shadow-lg">Share</span>
          </motion.button>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-16 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar src={reel.authorPhoto} name={reel.authorName} size={40} ring="gold" />
            <div className="flex-1">
              <span className="font-semibold text-white drop-shadow-lg">{reel.authorName}</span>
              {author?.parish && (
                <p className="text-xs text-white/60">{author.parish}</p>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onFollow}
              className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-colors ${
                isFollowing
                  ? 'border border-white/30 bg-white/10 text-white'
                  : 'bg-gold-400 text-ink-950 hover:bg-gold-300'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </motion.button>
          </div>
          <p className="text-sm leading-relaxed text-white drop-shadow-lg">{reel.caption}</p>
          {reel.hashtags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {reel.hashtags.map((tag) => (
                <span key={tag} className="text-xs font-medium text-gold-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {/* Audio track */}
          {reel.audioTitle && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-white/70">
              <Music size={14} className="animate-pulse" />
              <span className="truncate">
                {reel.audioTitle} {reel.audioArtist && `— ${reel.audioArtist}`}
              </span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70 backdrop-blur-sm">
            {timeAgo(reel.createdAt)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function CommentDrawer({
  reel,
  onClose,
  onAddComment,
}: {
  reel: VideoReel;
  onClose: () => void;
  onAddComment: (text: string) => void;
}) {
  const { users, currentUserId } = useStore();
  const me = users.find((u) => u.id === currentUserId);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    onAddComment(draft.trim());
    setDraft('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="card w-full max-w-md rounded-b-none rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <h3 className="text-sm font-bold text-ink-100">
            {reel.comments.length} Comment{reel.comments.length !== 1 ? 's' : ''}
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-ink-800">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin p-4">
          {reel.comments.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-400">Be the first to comment.</p>
          )}
          {reel.comments.map((c) => {
            const author = users.find((u) => u.id === c.authorId);
            return (
              <div key={c.id} className="mb-4 flex gap-2.5">
                <Avatar src={author?.photo ?? ''} name={author?.name ?? 'User'} size={32} />
                <div>
                  <div className="rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2">
                    <span className="text-xs font-semibold text-ink-100">{author?.name ?? 'Unknown'}</span>
                    <p className="text-sm text-ink-200">{c.text}</p>
                  </div>
                  <span className="ml-2 mt-0.5 text-[10px] text-ink-400">{timeAgo(c.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-ink-700 p-3">
          <Avatar src={me?.photo ?? ''} name={me?.name ?? 'Me'} size={32} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a comment..."
            className="input flex-1"
            autoFocus
          />
          <button onClick={submit} disabled={!draft.trim()} className="gold-btn px-3 py-2.5">
            <Send size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
