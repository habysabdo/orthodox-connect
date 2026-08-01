import { useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { isFollowing, useStore } from '@/store/context';

/**
 * Instagram-style follow toggle. Following happens immediately — there is no
 * request for the other member to approve — so the button only ever has two
 * resting states: gold "Follow" when the member is not followed, and a muted
 * outline "Following" once they are. Clicking while following unfollows.
 */
export function FollowButton({ userId, className = '' }: { userId: string; className?: string }) {
  const state = useStore();
  const [busy, setBusy] = useState(false);
  const following = isFollowing(state, userId);

  if (userId === state.currentUserId) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (following) await state.unfollowUser(userId);
      else await state.followUser(userId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={following}
      className={`${following ? 'ghost-btn' : 'gold-btn'} py-2 text-xs disabled:opacity-60 ${className}`}
      title={following ? 'Unfollow' : 'Follow'}
    >
      {following ? (
        <>
          <Check size={14} /> Following
        </>
      ) : (
        <>
          <UserPlus size={14} /> Follow
        </>
      )}
    </button>
  );
}
