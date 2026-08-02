import { useState } from 'react';
import {
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Avatar } from './ui';
import { useStore, getUser } from '@/store/context';
import { timeAgo } from '@/utils/format';
import type { Post } from '@/types';
import { useUI } from '@/store/ui';

export function PostCard({ post }: { post: Post }) {
  const store = useStore();
  const { users, currentUserId, toggleLike, addComment, openThreadWith, flagPost, unflagPost, deletePost } = store;
  const { setView, setOpenThreadId } = useUI();
  const me = users.find((u) => u.id === currentUserId);
  const author = getUser(store, post.authorId);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  if (!me || !author) return null;

  const liked = post.likes.includes(me.id);
  const isAdmin = me.role === 'admin';
  const isAuthor = post.authorId === me.id;

  const submitComment = () => {
    if (!comment.trim()) return;
    addComment(post.id, comment.trim());
    setComment('');
    setShowComments(true);
  };

  const messageAuthor = () => {
    const tid = openThreadWith(author.id);
    setOpenThreadId(tid);
    setView('messenger');
  };

  return (
    <article className="card animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar src={author.photo} name={author.name} size={44} online={author.online} ring="gold" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink-100">{author.name}</span>
            {author.role === 'admin' && <span className="gold-chip">Admin</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <span className="truncate">{author.parish}</span>
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
                <button
                  onClick={() => { messageAuthor(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-750"
                >
                  <Send size={14} /> Message {author.name.split(' ')[0]}
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

      {/* Text */}
      {post.text && (
        <div className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-relaxed text-ink-100">
          {post.text}
        </div>
      )}

      {/* Image */}
      {post.image && (
        <div className="border-y border-ink-700 bg-ink-900">
          <img src={post.image} alt="" className="max-h-[520px] w-full object-cover" referrerPolicy="no-referrer" />
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
          {post.likes.length > 0 && (
            <>
              <Heart size={12} className="fill-gold-400 text-gold-400" /> {post.likes.length}
            </>
          )}
        </span>
        {post.comments.length > 0 && (
          <button onClick={() => setShowComments((v) => !v)} className="hover:text-gold-200">
            {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-ink-700 px-2 py-1">
        <button
          onClick={() => toggleLike(post.id)}
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
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-ink-700 p-4 animate-fade-in">
          <div className="space-y-3">
            {post.comments.map((c) => {
              const ca = users.find((u) => u.id === c.authorId);
              if (!ca) return null;
              return (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar src={ca.photo} name={ca.name} size={32} />
                  <div className="flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-100">{ca.name}</span>
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
            <Avatar src={me.photo} name={me.name} size={32} />
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
    </article>
  );
}
