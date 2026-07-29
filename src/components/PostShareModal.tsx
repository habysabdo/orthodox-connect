import { useEffect, useState } from 'react';
import { Check, Copy, MessageSquareQuote, Repeat2, Share2, X } from 'lucide-react';
import type { Post } from '@/types';
import { useStore } from '@/store/context';
import { postText } from '@/utils/postSafety';

function permalink(postId: string) {
  const origin = typeof window === 'undefined' ? 'https://orthodoxconnect.live' : window.location.origin;
  return `${origin}/post/${encodeURIComponent(postId)}`;
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function PostShareModal({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const { resharePost } = useStore();
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const original = post?.originalPost ?? post;
  const originalText = postText(original);
  const url = permalink(post?.id ?? '');

  useEffect(() => {
    if (!open) {
      setQuoting(false);
      setQuote('');
      setNotice('');
    }
  }, [open]);

  if (!open || !original?.id) return null;

  const publish = async (kind: 'repost' | 'quote') => {
    setBusy(true);
    const created = await resharePost(original.id, kind, quote);
    setBusy(false);
    if (created) onClose();
    else setNotice('Unable to re-share this post. Please try again.');
  };

  const shareVia = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'OrthodoxConnect post', text: originalText.slice(0, 180), url });
        return;
      }
      await copyToClipboard(url);
      setNotice('Link copied to clipboard!');
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        await copyToClipboard(url);
        setNotice('Link copied to clipboard!');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-ink-700 bg-ink-900 shadow-card animate-scale-in sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div>
            <h3 className="font-semibold text-ink-100">Share this post</h3>
            <p className="text-xs text-ink-400">Pass it along in the community or beyond.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Close share menu"><X size={18} /></button>
        </div>

        {quoting ? (
          <div className="p-5">
            <label className="text-sm font-semibold text-ink-100" htmlFor={`quote-${post.id}`}>Add your thoughts</label>
            <textarea id={`quote-${post.id}`} value={quote} onChange={(event) => setQuote(event.target.value)} className="input mt-3 min-h-28 resize-none" maxLength={5000} autoFocus placeholder="What would you like to say?" />
            <div className="mt-3 rounded-2xl border border-ink-700 bg-ink-850 p-3">
              <p className="line-clamp-3 text-sm text-ink-300">{originalText || 'Media post'}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="ghost-btn" onClick={() => setQuoting(false)}>Back</button>
              <button className="gold-btn" disabled={busy || !quote.trim()} onClick={() => publish('quote')}><MessageSquareQuote size={16} /> Quote Post</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 p-4">
            <button className="flex items-center gap-3 rounded-2xl p-3 text-left text-ink-100 transition-colors hover:bg-ink-800" disabled={busy} onClick={() => publish('repost')}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-400/15 text-gold-300"><Repeat2 size={20} /></span>
              <span><strong className="block text-sm">Repost</strong><span className="text-xs text-ink-400">Instantly share the original with your feed.</span></span>
            </button>
            <button className="flex items-center gap-3 rounded-2xl p-3 text-left text-ink-100 transition-colors hover:bg-ink-800" onClick={() => setQuoting(true)}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-400/15 text-sky-300"><MessageSquareQuote size={20} /></span>
              <span><strong className="block text-sm">Quote Post</strong><span className="text-xs text-ink-400">Add your own caption above the original.</span></span>
            </button>
            <button className="flex items-center gap-3 rounded-2xl p-3 text-left text-ink-100 transition-colors hover:bg-ink-800" onClick={shareVia}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Share2 size={20} /></span>
              <span><strong className="block text-sm">Share via…</strong><span className="text-xs text-ink-400">Open your device share sheet or copy the link.</span></span>
            </button>
          </div>
        )}

        {notice && <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{notice.includes('copied') ? <Check size={15} /> : <Copy size={15} />}{notice}</div>}
      </div>
    </div>
  );
}
