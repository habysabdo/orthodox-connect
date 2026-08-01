import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { ArrowLeft, Bookmark, Film, Heart, Loader2, MessageSquare, Music2, Send, Share2, Volume2, VolumeX } from 'lucide-react';
import { Avatar } from './ui';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { timeAgo } from '@/utils/format';
import { loadReels } from '@/utils/posts';
import { bunnyHlsUrl, bunnyPosterUrl, bunnyPreviewUrl } from '@/utils/bunny';
import { muxPlaybackId } from '@/utils/video';
import { postComments, postLikes, postShareCount, postText, postVideoUrl, userName } from '@/utils/postSafety';
import type { Post, User } from '@/types';
import { LikesModal } from './LikesModal';
import { ProfileLink } from './ProfileLink';
import { PostShareModal } from './PostShareModal';

/** Reels arrive in light batches of ten, fetched as the viewer nears the end. */
const REELS_BATCH_SIZE = 10;

function reelPreloadUrl(raw: string): string | null {
  const bunnyUrl = bunnyHlsUrl(raw);
  if (bunnyUrl) return bunnyUrl;
  const muxId = muxPlaybackId(raw);
  if (muxId) return `https://stream.mux.com/${muxId}.m3u8`;
  return null;
}

function ReelVideoFallback({ poster, processing = false }: { poster: string | null; processing?: boolean }) {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-ink-950" role="status">
      {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-contain opacity-55" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/70" />
      <div className="relative z-10 mx-6 flex max-w-xs flex-col items-center rounded-2xl border border-white/10 bg-black/65 px-6 py-5 text-center text-white shadow-2xl backdrop-blur-md">
        {processing ? <Loader2 size={30} className="animate-spin text-gold-300" /> : <Film size={30} className="text-gold-300" />}
        <p className="mt-3 text-sm font-semibold">{processing ? 'Video is still processing' : 'Video unavailable'}</p>
        <p className="mt-1 text-xs leading-5 text-white/60">{processing ? 'It appears here automatically when the stream is ready.' : 'Keep scrolling to watch the next reel.'}</p>
      </div>
    </div>
  );
}

class ReelVideoBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Reel video failed to render', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createReelSeed(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function ReelsView() {
  const { posts, users, currentUserId, activeGroupId, authChecked, usersLoading, toggleLike, addComment } = useStore();
  const { selectedReelId, setView } = useUI();
  const [reels, setReels] = useState<Post[]>(() => shuffled(posts.filter((post) => Boolean(postVideoUrl(post)))));
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [prefersMutedGlobal, setPrefersMutedGlobal] = useState(true);
  const reelRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadTriggerRef = useRef<HTMLElement | null>(null);
  const seedRef = useRef(createReelSeed());
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const generationRef = useRef(0);
  const postsRef = useRef(posts);
  const currentUserIdRef = useRef(currentUserId);
  postsRef.current = posts;
  currentUserIdRef.current = currentUserId;

  const fetchNextBatch = useCallback(async (generation = generationRef.current) => {
    const userId = currentUserIdRef.current;
    if (!userId || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const page = await loadReels({
        groupId: activeGroupId,
        seed: seedRef.current,
        offset: offsetRef.current,
        limit: REELS_BATCH_SIZE,
      });
      if (generation !== generationRef.current || currentUserIdRef.current !== userId) return;
      offsetRef.current += page.posts.length;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setReels((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !existingIds.has(post.id))];
      });
    } catch (error) {
      console.error('Failed to load more reels', error);
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [activeGroupId]);

  useEffect(() => {
    generationRef.current += 1;
    seedRef.current = createReelSeed();
    offsetRef.current = 0;
    loadingRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setReels(shuffled(postsRef.current.filter((post) => Boolean(postVideoUrl(post)))));
    if (currentUserId) void fetchNextBatch(generationRef.current);
  }, [activeGroupId, currentUserId, fetchNextBatch]);

  useEffect(() => {
    setReels((current) => current.map((reel) => posts.find((post) => post?.id === reel.id) ?? reel));
  }, [posts]);

  const visibleReels = useMemo(
    () => reels.filter((post) => post && users.some((user) => user?.id === post.authorId)),
    [reels, users],
  );

  useEffect(() => {
    const trigger = loadTriggerRef.current;
    const root = scrollRef.current;
    if (!trigger || !root || !hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextBatch();
      },
      { root, threshold: 0.2 },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [fetchNextBatch, hasMore, isLoading, visibleReels.length]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') {
      setActiveReelId(visibleReels[0]?.id ?? null);
      return;
    }

    // A reel takes over playback once it fills more than 80% of the viewport, and
    // gives it up the moment it drops below that — so exactly one video plays and
    // everything scrolled away is paused.
    const ACTIVE_VISIBILITY = 0.8;
    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = (entry.target as HTMLElement).dataset.reelId;
          if (reelId) visibility.set(reelId, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let focusedId: string | null = null;
        let focusedRatio = ACTIVE_VISIBILITY;
        visibleReels.forEach((reel) => {
          const ratio = visibility.get(reel.id) ?? 0;
          if (ratio >= focusedRatio) {
            focusedId = reel.id;
            focusedRatio = ratio;
          }
        });
        setActiveReelId(focusedId);
      },
      { root, threshold: [0, ACTIVE_VISIBILITY] },
    );

    visibleReels.forEach((reel) => {
      const node = reelRefs.current[reel.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [visibleReels]);

  useEffect(() => {
    if (!selectedReelId) return;
    const frame = window.requestAnimationFrame(() => {
      reelRefs.current[selectedReelId]?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedReelId, visibleReels.length]);

  const activeReelIndex = visibleReels.findIndex((reel) => reel.id === activeReelId);

  useEffect(() => {
    const nextIndex = activeReelIndex >= 0 ? activeReelIndex + 1 : 1;
    const nextUrl = postVideoUrl(visibleReels[nextIndex]);
    const preloadUrl = reelPreloadUrl(nextUrl);
    if (!preloadUrl) return;

    const controller = new AbortController();
    void fetch(preloadUrl, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      priority: 'low',
    } as RequestInit).catch(() => undefined);
    return () => controller.abort();
  }, [activeReelIndex, visibleReels]);

  // A reel only renders once its author is known, and the roster and the reel
  // batch load in parallel behind a session that is still being restored — so
  // "no reels yet" is only the truth once all three have settled. Announcing it
  // earlier is what made a freshly refreshed page look empty.
  const resolving = !authChecked || isLoading || usersLoading;

  if (visibleReels.length === 0) {
    return (
      <div className="card flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <Volume2 size={34} className="text-gold-300" />
        <h1 className="mt-4 font-serif text-2xl font-semibold text-ink-100">{resolving ? 'Loading reels' : 'No reels yet'}</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-400">
          {resolving ? 'Finding videos from the community.' : 'Upload a video from the home composer and it appears here automatically.'}
        </p>
        <button onClick={() => setView('feed')} className="gold-btn mt-5">
          <ArrowLeft size={16} /> Return to Home Feed
        </button>
      </div>
    );
  }

  return (
    <section className="relative">
      <button
        onClick={() => setView('feed')}
        className="fixed left-4 top-[4.5rem] z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-sm font-semibold text-white backdrop-blur-md hover:bg-black/80"
      >
        <ArrowLeft size={16} /> Feed
      </button>
      <div
        ref={scrollRef}
        className="no-scrollbar mx-auto h-[calc(100vh-64px)] w-full max-w-md snap-y snap-mandatory overflow-y-scroll overscroll-y-contain rounded-2xl bg-black scroll-smooth"
      >
        {visibleReels.map((post, index) => {
          const author = users.find((user) => user?.id === post.authorId);
          if (!author || !currentUserId) return null;
          const isLoadTrigger = index === Math.max(visibleReels.length - 2, 0);
          return (
            <ReelCard
              key={post.id}
              post={post}
              author={author}
              users={users}
              currentUserId={currentUserId}
              isActive={activeReelId === post.id}
              shouldLoad={activeReelIndex < 0 ? index < 2 : Math.abs(index - activeReelIndex) <= 1}
              prefersMutedGlobal={prefersMutedGlobal}
              setPrefersMutedGlobal={setPrefersMutedGlobal}
              toggleLike={(sourcePost, likeOnly) => {
                const sourceLikes = postLikes(sourcePost);
                const alreadyLiked = sourceLikes.includes(currentUserId);
                if (likeOnly && alreadyLiked) return;
                setReels((current) => current.map((reel) => reel.id === sourcePost.id
                  ? {
                      ...reel,
                      likes: alreadyLiked
                        ? postLikes(reel).filter((id) => id !== currentUserId)
                        : [...postLikes(reel), currentUserId],
                    }
                  : reel));
                toggleLike(sourcePost.id, sourcePost);
              }}
              addComment={(sourcePost, text) => addComment(sourcePost.id, text, sourcePost)}
              setRef={(node) => {
                reelRefs.current[post.id] = node;
                if (isLoadTrigger) loadTriggerRef.current = node;
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

function ReelCard({
  post,
  author,
  users,
  currentUserId,
  isActive,
  shouldLoad,
  prefersMutedGlobal,
  setPrefersMutedGlobal,
  toggleLike,
  addComment,
  setRef,
}: {
  post: Post;
  author: User;
  users: User[];
  currentUserId: string;
  isActive: boolean;
  shouldLoad: boolean;
  prefersMutedGlobal: boolean;
  setPrefersMutedGlobal: (muted: boolean) => void;
  toggleLike: (post: Post, likeOnly?: boolean) => void;
  addComment: (post: Post, text: string) => void;
  setRef: (node: HTMLElement | null) => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState('');
  const [autoPlayBlocked, setAutoPlayBlocked] = useState(false);
  const [isEffectivelyMuted, setIsEffectivelyMuted] = useState(prefersMutedGlobal);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<VideoPlayerHandle | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likes = postLikes(post);
  const comments = postComments(post);
  const shareCount = postShareCount(post);
  const liked = likes.includes(currentUserId);
  const reelVideoUrl = postVideoUrl(post);
  const reelPoster = bunnyPreviewUrl(reelVideoUrl) ?? bunnyPosterUrl(reelVideoUrl);
  // Posts do not carry a music track, so the audio line credits the creator's own
  // sound the way the vertical feeds people are used to do.
  const audioTrackTitle = `Original audio · ${userName(author)}`;

  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;
    // Scrolled out of view: pause, and rewind so the reel restarts from the top
    // the next time it becomes the active one.
    if (!isActive) {
      player.pause();
      player.reset();
      setIsPlaying(false);
      return;
    }

    setAutoPlayBlocked(false);
    setIsEffectivelyMuted(prefersMutedGlobal);
    player.setMuted(prefersMutedGlobal);
    void player.play().catch(() => {
      if (prefersMutedGlobal) return;
      player.setMuted(true);
      setIsEffectivelyMuted(true);
      setAutoPlayBlocked(true);
      void player.play().catch(() => undefined);
    });
  }, [isActive, prefersMutedGlobal, shouldLoad]);

  useEffect(() => () => {
    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
  }, []);

  useEffect(() => {
    setVideoFailed(false);
  }, [reelVideoUrl]);

  const assignRef = (node: HTMLElement | null) => {
    articleRef.current = node;
    setRef(node);
  };

  const handleAutoPlayBlocked = useCallback(() => {
    setIsEffectivelyMuted(true);
    setAutoPlayBlocked(true);
  }, []);

  const handleVideoTap = () => {
    const player = videoRef.current;
    if (!player || !isActive) return;

    if (isEffectivelyMuted) {
      setPrefersMutedGlobal(false);
      setIsEffectivelyMuted(false);
      setAutoPlayBlocked(false);
      player.setMuted(false);
      void player.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          player.setMuted(true);
          handleAutoPlayBlocked();
          void player.play().catch(() => undefined);
        });
      return;
    }

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }

    void player.play()
      .then(() => setIsPlaying(true))
      .catch(() => undefined);
  };

  /** The right-hand sound button, independent of tap-to-unmute on the video. */
  const toggleSound = () => {
    const player = videoRef.current;
    const nextMuted = !isEffectivelyMuted;
    setPrefersMutedGlobal(nextMuted);
    setIsEffectivelyMuted(nextMuted);
    setAutoPlayBlocked(false);
    player?.setMuted(nextMuted);
    if (nextMuted || !player) return;
    void player.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        player.setMuted(true);
        handleAutoPlayBlocked();
        void player.play().catch(() => undefined);
      });
  };

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    addComment(post, text);
    setComment('');
    setCommentsOpen(true);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, a, [role="button"]')) return;
    const now = Date.now();
    const previous = lastTapRef.current;
    const closeInTime = now - previous.time < 320;
    const closeInSpace = Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 36;
    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    if (closeInTime && closeInSpace) {
      event.preventDefault();
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      setHeartBurst((value) => value + 1);
      if (!liked) toggleLike(post, true);
      lastTapRef.current.time = 0;
      return;
    }

    if (isEffectivelyMuted) {
      handleVideoTap();
      return;
    }

    if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      handleVideoTap();
    }, 320);
  };

  return (
    <article
      ref={assignRef}
      data-reel-id={post.id}
      onPointerUp={handlePointerUp}
      className="relative flex h-full w-full touch-pan-y snap-start snap-always items-center justify-center overflow-hidden bg-black"
    >
      <ReelVideoBoundary fallback={<ReelVideoFallback poster={reelPoster} processing={post.videoStatus === 'uploading'} />}>
        {!reelVideoUrl || post.videoStatus === 'uploading' || post.videoStatus === 'failed' || videoFailed ? (
          <ReelVideoFallback poster={reelPoster} processing={post.videoStatus === 'uploading'} />
        ) : shouldLoad ? (
          <VideoPlayer
            ref={videoRef}
            url={reelVideoUrl}
            controls={false}
            autoPlay={isActive}
            loop
            fill
            muted={isEffectivelyMuted}
            onPlay={() => setIsPlaying(true)}
            onError={() => setVideoFailed(true)}
            onAutoPlayBlocked={handleAutoPlayBlocked}
            onMutedChange={setIsEffectivelyMuted}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full">
            {reelPoster ? (
              <img src={reelPoster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <ReelVideoFallback poster={null} />
            )}
          </div>
        )}
      </ReelVideoBoundary>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/65 to-transparent" />

      {heartBurst > 0 && (
        <div
          key={heartBurst}
          className="reel-heart-burst pointer-events-none absolute inset-0 z-30 grid place-items-center text-white"
          onAnimationEnd={() => setHeartBurst(0)}
          aria-hidden="true"
        >
          <Heart size={104} strokeWidth={1.5} className="fill-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]" />
        </div>
      )}

      {autoPlayBlocked && isEffectivelyMuted && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/65 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-md" aria-hidden="true">
          <Volume2 size={18} /> Tap video for sound
        </div>
      )}

      <div className="absolute bottom-5 left-4 right-20 z-10 sm:left-6 sm:right-28">
        <div className="flex items-center gap-3">
          <ProfileLink userId={author.id} label={`View ${userName(author)}'s profile`} className="shrink-0 !rounded-full">
            <Avatar src={author.photo} name={author.name} size={42} ring="gold" online={author.online} />
          </ProfileLink>
          <div className="min-w-0">
            <ProfileLink userId={author.id} className="block truncate font-semibold text-white transition-colors hover:text-gold-200 hover:underline">
              {userName(author)}
            </ProfileLink>
            <div className="truncate text-xs text-white/65">{author.parish ?? ''} · {timeAgo(post.createdAt)}</div>
          </div>
        </div>
        {postText(post) && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{postText(post)}</p>}

        <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <Music2 size={14} className="shrink-0 text-gold-200" aria-hidden="true" />
          <span className="truncate">{audioTrackTitle}</span>
        </div>

        {commentsOpen && (
          <div className="mt-3 max-h-44 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-md">
            <div className="space-y-2">
              {comments.length === 0 && <p className="text-xs text-white/55">Start the conversation.</p>}
              {comments.map((item) => {
                const commenter = users.find((user) => user?.id === item.authorId)?.name ?? 'Community member';
                return (
                  <p key={item.id} className="text-xs text-white/80">
                    <span className="font-semibold text-gold-200">{commenter}</span> {item.text}
                  </p>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submitComment()}
                placeholder="Add a comment"
                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/45"
              />
              <button onClick={submitComment} disabled={!comment.trim()} className="text-gold-300 disabled:opacity-40" aria-label="Send comment">
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-3 sm:right-6">
        <button onClick={() => toggleLike(post)} className="flex flex-col items-center gap-1 text-xs font-semibold text-white" aria-label={liked ? 'Unlike reel' : 'Like reel'}>
          <span className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition-transform duration-200 active:scale-90 ${liked ? 'scale-105 border-gold-300/60 bg-gold-400/25 text-gold-200' : 'border-white/15 bg-black/45'}`}>
            <Heart size={22} className={liked ? 'fill-current' : ''} />
          </span>
          {/* With likes, the count sits in its own button below so it can open
              the "Liked by" list without nesting one button inside another. */}
          {likes.length === 0 ? '0' : null}
        </button>
        {likes.length > 0 && (
          <button
            onClick={() => setLikesOpen(true)}
            className="-mt-2 text-xs font-semibold text-white transition-colors hover:text-gold-200"
            aria-label={`See who liked this reel (${likes.length})`}
          >
            {/* Re-keying on the count replays the pop animation on every like. */}
            <span key={likes.length} className="inline-block animate-scale-in">
              {likes.length}
            </span>
          </button>
        )}
        <button onClick={() => setCommentsOpen((open) => !open)} className="flex flex-col items-center gap-1 text-xs font-semibold text-white" aria-label="Show reel comments">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/45 backdrop-blur-md">
            <MessageSquare size={21} />
          </span>
          {comments.length}
        </button>
        <button onClick={() => setShareOpen(true)} className="flex flex-col items-center gap-1 text-xs font-semibold text-white" aria-label="Share reel">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/45 backdrop-blur-md transition hover:bg-black/65">
            <Share2 size={21} />
          </span>
          {shareCount || 'Share'}
        </button>
        <button
          onClick={toggleSound}
          className="flex flex-col items-center gap-1 text-xs font-semibold text-white"
          aria-label={isEffectivelyMuted ? 'Unmute reel' : 'Mute reel'}
          aria-pressed={!isEffectivelyMuted}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/45 backdrop-blur-md transition hover:bg-black/65">
            {isEffectivelyMuted ? <VolumeX size={21} /> : <Volume2 size={21} />}
          </span>
          {isEffectivelyMuted ? 'Sound off' : 'Sound on'}
        </button>
        <button onClick={() => setSaved((value) => !value)} className="flex flex-col items-center gap-1 text-xs font-semibold text-white" aria-label={saved ? 'Remove reel from saved' : 'Save reel'} aria-pressed={saved}>
          <span className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition hover:bg-black/65 ${saved ? 'border-gold-300/60 bg-gold-400/25 text-gold-200' : 'border-white/15 bg-black/45'}`}>
            <Bookmark size={21} className={saved ? 'fill-current' : ''} />
          </span>
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <LikesModal postId={post.id} likes={likes} open={likesOpen} onClose={() => setLikesOpen(false)} />
      <PostShareModal post={post} open={shareOpen} onClose={() => setShareOpen(false)} />
    </article>
  );
}
