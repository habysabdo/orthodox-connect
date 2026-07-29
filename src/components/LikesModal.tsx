import { useEffect, useState } from 'react';
import { Heart, Loader2, X } from 'lucide-react';
import { Avatar } from './ui';
import { ProfileLink } from './ProfileLink';
import { useStore } from '@/store/context';
import { loadPostLikes } from '@/utils/postLikes';
import { userName } from '@/utils/postSafety';
import type { LikedByUser } from '@/types';

/**
 * "Liked by" — the members who liked one post.
 *
 * The cached community roster fills the list immediately so the modal never
 * opens empty, then `/api/post-likes` replaces it with the server's answer,
 * which also covers members the roster has not cached.
 */
export function LikesModal({
  postId,
  likes,
  open,
  onClose,
}: {
  postId: string;
  /** The post's like list (user ids), used for the instant local rendering. */
  likes?: string[] | null;
  open: boolean;
  onClose: () => void;
}) {
  const { users } = useStore();
  const [likedBy, setLikedBy] = useState<LikedByUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Seed from the roster and then refresh from the server each time it opens, so
  // a like added since the last open shows up.
  useEffect(() => {
    if (!open) return;

    const seeded = (Array.isArray(likes) ? [...likes] : [])
      .reverse()
      .map((userId) => users.find((user) => user?.id === userId))
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({ id: user.id, name: userName(user), photo: user.photo, parish: user.parish, role: user.role }));
    setLikedBy(seeded);
    setError('');
    setLoading(true);

    let cancelled = false;
    loadPostLikes(postId)
      .then((loaded) => {
        if (cancelled) return;
        setLikedBy(loaded);
      })
      .catch((loadError) => {
        console.error('Failed to load who liked this post', loadError);
        // The roster already produced a list, so keep showing it rather than
        // replacing a usable list with an error.
        if (cancelled || seeded.length > 0) return;
        setError('Could not load who liked this post.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `likes` is only the seed for this opening; refetching on every like change
    // while the modal is open is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  // Escape closes, matching the backdrop click.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      // Reels treat a double tap on the card as a like, and this modal renders
      // inside that card — taps in here must not reach it.
      onPointerUp={(event) => event.stopPropagation()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-ink-700 bg-ink-900 shadow-card animate-scale-in sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Liked by"
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <Heart size={17} className="fill-gold-400 text-gold-400" />
            <div>
              <h3 className="font-semibold text-ink-100">Liked by</h3>
              <p className="text-xs text-ink-400">
                {likedBy.length > 0
                  ? `${likedBy.length} ${likedBy.length === 1 ? 'member' : 'members'} liked this post`
                  : 'Everyone who liked this post'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
            aria-label="Close likes list"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="max-h-[60vh] overflow-y-auto p-2 sm:max-h-96"
          // Opening a profile from here should leave the modal behind, including
          // when the post is already being viewed on somebody's profile page.
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('a')) onClose();
          }}
        >
          {likedBy.filter(Boolean).map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-ink-850">
              <ProfileLink userId={user.id} label={`View ${userName(user)}'s profile`} className="shrink-0 !rounded-full" >
                <Avatar src={user.photo} name={user.name} size={44} ring="gold" />
              </ProfileLink>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ProfileLink
                    userId={user.id}
                    className="truncate font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline"
                  >
                    {userName(user)}
                  </ProfileLink>
                  {user.role === 'admin' && <span className="gold-chip">Admin</span>}
                </div>
                {user.parish && (
                  <span className="mt-1 inline-flex max-w-full items-center truncate rounded-full border border-ink-700 bg-ink-850 px-2 py-0.5 text-[11px] text-ink-300">
                    {user.parish}
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && likedBy.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-ink-400">
              <Loader2 size={16} className="animate-spin text-gold-300" /> Loading likes…
            </div>
          )}

          {!loading && likedBy.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-400">
              {error || 'No one has liked this post yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
