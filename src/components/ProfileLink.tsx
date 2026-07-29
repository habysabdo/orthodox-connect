import type { MouseEvent, ReactNode } from 'react';
import { useUI } from '@/store/ui';

/**
 * Link to a member's public profile (`/profile/:userId`).
 *
 * A real anchor rather than a button, so the URL is visible on hover and
 * cmd/ctrl-click still opens the profile in a new tab. A plain click is handled
 * in-app by the router in `store/ui`, which keeps navigation instant.
 */
export function ProfileLink({
  userId,
  children,
  className = '',
  label,
}: {
  userId: string;
  children: ReactNode;
  className?: string;
  /** accessible name, when the visible content is only an avatar */
  label?: string;
}) {
  const { openProfile, profileHref } = useUI();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks and middle-clicks to the browser so "open in new
    // tab" behaves the way it does on any other link.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Posts and reels wrap these links in their own click handlers.
    event.stopPropagation();
    openProfile(userId);
  };

  return (
    <a
      href={profileHref(userId)}
      onClick={navigate}
      aria-label={label}
      className={`rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 ${className}`}
    >
      {children}
    </a>
  );
}
