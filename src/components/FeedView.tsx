import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck, Sparkles, Video } from 'lucide-react';
import { Composer } from './Composer';
import { PostCard } from './PostCard';
import { ErrorBoundary } from './ErrorBoundary';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { CommunityAlerts } from './CommunityAlerts';
import { FeedSkeleton } from './ui';
import { StoriesCarousel } from './StoriesCarousel';
import { hasAdminAccess } from '@/utils/users';
import type { Post } from '@/types';

function IsolatedFeedPost({ post }: { post: Post }) {
  return (
    <div id={`feed-post-${post.id}`} className="scroll-mt-24">
      <ErrorBoundary
        name={`Feed post ${post.id}`}
        resetKeys={[post.id, post.video, post.videoStatus]}
        fallback={(reset) => (
          <article className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center shadow-sm" role="alert">
            <AlertCircle size={28} className="text-red-700" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-amber-950">This post could not be displayed</p>
            <p className="mt-1 text-xs text-amber-800/70">Other posts remain available.</p>
            <button type="button" onClick={reset} className="mt-4 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200">
              Try this post again
            </button>
          </article>
        )}
      >
        <PostCard post={post} />
      </ErrorBoundary>
    </div>
  );
}

export function FeedView() {
  const {
    posts,
    alerts,
    groups,
    activeGroupId,
    users,
    currentUserId,
    postsLoading,
    postsLoadingMore,
    postsHasMore,
    loadMorePosts,
    loadPostById,
  } = useStore();
  const { setGoLiveOpen, setPrayerMeetingOpen } = useUI();
  const me = users.find((user) => user?.id === currentUserId);
  const activeGroup = groups.find((group) => group?.id === activeGroupId);
  const [permalinkPostId, setPermalinkPostId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/post\/([^/]+)$/);
    if (!match) return;
    const postId = decodeURIComponent(match[1]);
    setPermalinkPostId(postId);
    void loadPostById(postId);
  }, [loadPostById]);

  // Infinite scroll: the next batch of ten is fetched as the end of the feed
  // approaches, so a member never waits on a button. The button below stays as
  // the fallback for browsers without IntersectionObserver and for keyboard use.
  useEffect(() => {
    if (!postsHasMore || postsLoading || postsLoadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMorePosts();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts, postsHasMore, postsLoading, postsLoadingMore]);
  const permalinkPost = posts.find((post) => post?.id === permalinkPostId) ?? null;

  return (
    <div className="feed-parchment space-y-4 rounded-[1.75rem] bg-gradient-to-b from-amber-50/45 via-orange-50/25 to-transparent p-1 sm:p-2">
      <CommunityAlerts alerts={alerts} />

      <section className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm dark:border-gold-400/25 dark:from-gold-900/35 dark:to-red-950/20">
        {hasAdminAccess(me) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-100/70 px-3 py-1.5 text-xs text-amber-900 dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-100">
            <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
            <span className="font-medium">
              Global Admin view active. {activeGroup ? 'Group is private.' : 'Private groups are visible.'}
            </span>
          </div>
        )}

        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold leading-snug text-gray-900 dark:text-ink-100">
            Share a word, go live, or lift a brother up.
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-ink-300">
            {activeGroup ? `Sharing privately in ${activeGroup.name ?? 'this group'}.` : 'Your parish is listening.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setGoLiveOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:bg-gold-500 dark:text-ink-950 dark:hover:bg-gold-400 dark:focus-visible:ring-gold-400 dark:focus-visible:ring-offset-ink-900"
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Go Live
          </button>
          <button
            type="button"
            onClick={() => setPrayerMeetingOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-ink-600 dark:bg-ink-850 dark:text-ink-100 dark:hover:border-gold-400/50 dark:hover:bg-ink-800 dark:focus-visible:ring-gold-400 dark:focus-visible:ring-offset-ink-900"
          >
            <Video size={17} aria-hidden="true" />
            Join Prayer Meeting
          </button>
        </div>
      </section>

      <Composer />

      <StoriesCarousel posts={posts} users={users} currentUser={me} />

      {postsLoading ? (
        <FeedSkeleton />
      ) : posts.length === 0 && !permalinkPost ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 py-16 text-center shadow-sm">
          <Sparkles size={32} className="mb-3 text-amber-700" />
          <p className="font-serif font-semibold text-amber-950">The feed is quiet</p>
          <p className="mt-1 text-sm text-amber-800/70">Be the first to share something today.</p>
        </div>
      ) : (
        <>
          {permalinkPost && <IsolatedFeedPost key={`permalink-${permalinkPost.id}`} post={permalinkPost} />}
          {posts
            .filter((post): post is Post => Boolean(post && post.id !== permalinkPost?.id))
            .map((post) => <IsolatedFeedPost key={post.id} post={post} />)}
          {postsHasMore && (
            <>
              <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
              <button
                type="button"
                onClick={() => void loadMorePosts()}
                disabled={postsLoadingMore}
                className="mx-auto flex min-w-36 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 font-semibold text-amber-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {postsLoadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                {postsLoadingMore ? 'Loading…' : 'Load more posts'}
              </button>
            </>
          )}
        </>
      )}

    </div>
  );
}
