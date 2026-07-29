import { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  AlertCircle,
  Flag,
  Heart,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Avatar } from './ui';
import { LazyFeedVideo } from './LazyFeedVideo';
import { MeetingInviteCard } from './MeetingInviteCard';
import { useStore, getUser } from '@/store/context';
import { timeAgo } from '@/utils/format';
import type { Post } from '@/types';
import { useUI } from '@/store/ui';
import { hasAdminAccess } from '@/utils/users';
import { extractEmbeddedVideoUrl, extractExternalUrl, linkifyText } from '@/utils/video';
import {
  firstName,
  isLikedBy,
  postComments,
  postImageUrl,
  postLikes,
  postShareCount,
  postText,
  postVideoUrl,
  userName,
  userPhoto,
} from '@/utils/postSafety';
import { PostShareModal } from './PostShareModal';
import { LikesModal } from './LikesModal';
import { ProfileLink } from './ProfileLink';

// Helper function to strip raw URLs from post body text when media is embedded
function stripUrls(text: string) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|youtu\.be\/[^\s]+)/gi;
  return text.replace(urlRegex, '').trim();
}

export function PostCard({ post }: { post: Post }) {
  const store = useStore();
  const { users, currentUserId, toggleLike, addComment, openThreadWith, flagPost, unflagPost, deletePost } = store;
  const { setView, setOpenThreadId, openReel, focusedPostId, setFocusedPostId } = useUI();
  const me = users.find((u) => u?.id === currentUserId);
  const author = getUser(store, post?.authorId);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (focusedPostId !== post?.id) return;
    articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlight(true);
    const t = setTimeout(() => {
      setHighlight(false);
      setFocusedPostId(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [focusedPostId, post?.id, setFocusedPostId]);

  if (!post || !me || !author) return null;

  const engagementPost = post.originalPost ?? post;
  const originalAuthor = post.originalPost ? getUser(store, post.originalPost.authorId) : null;
  const likes = postLikes(engagementPost);
  const comments = postComments(engagementPost);
  const shareCount = postShareCount(engagementPost);
  const liked = isLikedBy(engagementPost, me.id);
  const isAdmin = hasAdminAccess(me);
  const isAuthor = post.authorId === me.id;
  const rawBodyText = postText(post);
  const authorName = userName(author);
  const imageUrl = postImageUrl(post);
  const videoUrl = postVideoUrl(post);

  const embeddedVideoUrl = post.meeting
    ? null
    : extractEmbeddedVideoUrl(rawBodyText) ?? extractExternalUrl(rawBodyText);

  // Filter out raw video URLs if an embedded player or video attachment exists
  const hasVideoMedia = Boolean(embeddedVideoUrl || videoUrl);
  const cleanedBodyText = hasVideoMedia ? stripUrls(rawBodyText) : rawBodyText;
  const linkedText = linkifyText(cleanedBodyText);

  const submitComment = () => {
    if (!comment.trim()) return;
    addComment(engagementPost.id, comment.trim(), engagementPost);
    setComment('');
    setShowComments(true);
  };

  const messageAuthor = () => {
    const tid = openThreadWith(author.id);
    setOpenThreadId(tid);
    setView('messenger');
  };

  return (
    <article
      ref={articleRef}
      className={`card animate-slide-up overflow-hidden scroll-mt-20 transition-shadow ${
        highlight ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-ink-950' : ''
      }`}
    >
      {post.originalPostId && (
        <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850/70 px-4 py-2 text-xs font-medium text-ink-300">
          <Repeat2 size={14} className="text-gold-300" />
          <ProfileLink userId={author.id} className="font-semibold hover:text-gold-200">{authorName}</ProfileLink>
          re-shared this
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <ProfileLink userId={author.id} label={`View ${authorName}'s profile`} className="shrink-0 !rounded-full">
          <Avatar src={userPhoto(author)} name={authorName} size={44} online={author.online} ring="gold" />
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProfileLink userId={author.id} className="truncate font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline">
              {authorName}
            </ProfileLink>
            {author.role === 'admin' && <span className="gold-chip">Admin</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <span className="truncate">{author.parish ?? ''}</span>
            <span>·</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 py-1 shadow-card animate-scale-in">
                {likes.length > 0 && (
                  <button
                    onClick={() => { setLikesOpen(true); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-750"
                  >
                    <Heart size={14} /> View likes
                  </button>
                )}
                <button
                  onClick={() => { messageAuthor(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-750"
                >
                  <Send size={14} /> Message {firstName(authorName)}
                </button>
                {!isAuthor && (
                  <button
                    onClick={() => { setFlagOpen(true); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-750"
                  >
                    <Flag size={14} /> Report post
                  </button>
                )}
                {(isAuthor || isAdmin) && (
                  <button
                    onClick={() => { deletePost(post.id); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-ink-750"
                  >
                    <Trash2 size={14} /> Delete post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {post.postType === 'promo' && post.promoTitle && (
        <div className="px-4 pb-2">
          <span className="mb-1 inline-flex rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300">Community Showcase</span>
          <h2 className="font-serif text-xl font-semibold text-ink-100">{post.promoTitle}</h2>
        </div>
      )}

      {/* Clean Text (Renders only if non-empty text remains after stripping the link) */}
      {cleanedBodyText.length > 0 && (
        <div className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-relaxed text-ink-100">
          {linkedText.map((part, index) => part.href ? (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noreferrer noopener"
              className="break-words text-gold-300 underline decoration-gold-400/40 underline-offset-2 transition-colors hover:text-gold-200 hover:decoration-gold-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
            >
              {part.text}
            </a>
          ) : part.text)}
        </div>
      )}

      {/* Live prayer meeting invite */}
      {post.meeting?.roomId && (
        <div className="px-4 pb-4">
          <MeetingInviteCard roomId={post.meeting.roomId} title={post.meeting.title} hostName={authorName} />
        </div>
      )}

      {post.originalPost && originalAuthor && (
        <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-inner">
          <div className="flex items-center gap-2.5 p-3">
            <ProfileLink userId={originalAuthor.id} label={`View ${userName(originalAuthor)}'s profile`} className="shrink-0 !rounded-full">
              <Avatar src={userPhoto(originalAuthor)} name={userName(originalAuthor)} size={34} />
            </ProfileLink>
            <div className="min-w-0">
              <ProfileLink
                userId={originalAuthor.id}
                className="block truncate text-sm font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline"
              >
                {userName(originalAuthor)}
              </ProfileLink>
              <div className="text-[11px] text-ink-400">{timeAgo(post.originalPost.createdAt)}</div>
            </div>
          </div>
          {postText(post.originalPost) && <p className="whitespace-pre-wrap px-3 pb-3 text-sm leading-relaxed text-ink-200">{postText(post.originalPost)}</p>}
          {postImageUrl(post.originalPost) && <img src={postImageUrl(post.originalPost)} alt="" className="max-h-96 w-full object-cover" referrerPolicy="no-referrer" />}
          {postVideoUrl(post.originalPost) && (
            <div className="w-full bg-black">
              <LazyFeedVideo url={postVideoUrl(post.originalPost)} />
            </div>
          )}
        </div>
      )}

      {/* External video player */}
      {embeddedVideoUrl && (
        <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-ink-600 bg-black shadow-lg">
          <LazyFeedVideo
            url={embeddedVideoUrl}
            title="External media shared in this post"
          />
        </div>
      )}

      {/* Image */}
      {imageUrl && (
        <div className="border-y border-ink-700 bg-ink-900">
          <img src={imageUrl} alt="" className="max-h-[520px] w-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}

      {/* Direct Video */}
      {videoUrl && (
        <div className="border-y border-ink-700 bg-black">
          <LazyFeedVideo
            url={videoUrl}
            loop
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-ink-950/90 px-4 py-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">Video post</div>
              <div className="truncate text-xs text-ink-400">Watch here or continue in the vertical viewer.</div>
            </div>
            <button onClick={() => openReel(post.id)} className="ghost-btn shrink-0 px-3 py-2 text-xs">
              <Clapperboard size={15} /> Watch in Reels
            </button>
          </div>
        </div>
      )}

      {post.videoStatus === 'uploading' && !videoUrl && (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 border-y border-ink-700 bg-ink-900 px-6 text-center">
          <Loader2 size={30} className="animate-spin text-gold-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-ink-100">Video is uploading</p>
            <p className="mt-1 text-xs text-ink-400">Your post is live now. The video appears automatically when processing finishes.</p>
          </div>
        </div>
      )}

      {post.videoStatus === 'failed' && !videoUrl && (
        <div className="flex items-center gap-3 border-y border-red-500/30 bg-red-500/10 px-4 py-4 text-red-200">
          <AlertCircle size={20} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold">Video unavailable</p>
            <p className="text-xs text-red-200/70">{post.videoError || 'The text portion of this post is still available.'}</p>
          </div>
        </div>
      )}

      {/* Flagged banner */}
      {post.flagged && (
        <div className="flex items-center gap-2 border-y border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <ShieldAlert size={14} /> Flagged: {post.flagReason}
          {isAdmin && (
            <button
              onClick={() => unflagPost(post.id)}
              className="ml-auto rounded px-2 py-0.5 text-red-200 underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Counts */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-ink-400">
        <span className="flex items-center gap-1">
          {likes.length > 0 && (
            <button
              onClick={() => setLikesOpen(true)}
              className="flex items-center gap-1 rounded-full px-1 py-0.5 transition-colors hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
              aria-label={`See who liked this post (${likes.length})`}
              title="See who liked this post"
            >
              <Heart size={12} className="fill-gold-400 text-gold-400" /> {likes.length}
            </button>
          )}
        </span>
        <div className="flex items-center gap-3">
          {comments.length > 0 && (
            <button onClick={() => setShowComments((v) => !v)} className="hover:text-gold-200">
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </button>
          )}
          {shareCount > 0 && <span>{shareCount} share{shareCount !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-ink-700 px-2 py-1">
        <button
          onClick={() => toggleLike(engagementPost.id, engagementPost)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
            liked ? 'text-gold-300 hover:bg-gold-400/10' : 'text-ink-300 hover:bg-ink-800'
          }`}
        >
          <Heart size={18} className={liked ? 'fill-gold-400' : ''} />
          {liked ? 'Liked' : 'Like'}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-800"
        >
          <MessageSquare size={18} /> Comment
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-800"
        >
          <Repeat2 size={18} /> Re-share
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-ink-700 p-4 animate-fade-in">
          <div className="space-y-3">
            {comments.map((c) => {
              const ca = users.find((u) => u?.id === c.authorId);
              if (!ca) return null;
              return (
                <div key={c.id} className="flex gap-2.5">
                  <ProfileLink userId={ca.id} label={`View ${userName(ca)}'s profile`} className="shrink-0 !rounded-full">
                    <Avatar src={userPhoto(ca)} name={userName(ca)} size={32} />
                  </ProfileLink>
                  <div className="flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ProfileLink userId={ca.id} className="text-xs font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline">
                          {userName(ca)}
                        </ProfileLink>
                        {ca.role === 'admin' && <span className="gold-chip py-0">Admin</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-200">{c.text}</p>
                    </div>
                    <div className="mt-1 pl-2 text-[10px] text-ink-400">{timeAgo(c.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compose comment */}
          <div className="mt-3 flex gap-2.5">
            <Avatar src={userPhoto(me)} name={userName(me)} size={32} />
            <div className="flex flex-1 items-center gap-2 rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-1.5">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment…"
                className="flex-1 bg-transparent text-sm text-ink-100 outline-none placeholder-ink-400"
              />
              <button
                onClick={submitComment}
                disabled={!comment.trim()}
                className="text-gold-300 transition-colors hover:text-gold-200 disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag modal */}
      {flagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setFlagOpen(false)}>
          <div className="card w-full max-w-md p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-ink-100">
              <Flag size={18} className="text-gold-300" /> Report this post
            </h3>
            <p className="mt-1 text-sm text-ink-400">Let admins know why this post shouldn’t be here.</p>
            <select
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="input mt-4"
            >
              <option value="">Select a reason…</option>
              <option value="Spam or scam">Spam or scam</option>
              <option value="Harassment or hate">Harassment or hate</option>
              <option value="Off-topic / not Orthodox-related">Off-topic</option>
              <option value="Inappropriate content">Inappropriate content</option>
              <option value="Other">Other</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFlagOpen(false)} className="ghost-btn py-2">Cancel</button>
              <button
                onClick={() => { if (flagReason) { flagPost(post.id, flagReason); setFlagOpen(false); } }}
                disabled={!flagReason}
                className="gold-btn py-2"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
      <PostShareModal post={post} open={shareOpen} onClose={() => setShareOpen(false)} />
      <LikesModal
        postId={engagementPost.id}
        likes={likes}
        open={likesOpen}
        onClose={() => setLikesOpen(false)}
      />
    </article>
  );
}
