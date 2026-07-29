import { useState, type ReactNode } from 'react';

interface AvatarProps {
  /** may be absent for a member whose profile has no photo */
  src?: string | null;
  /** may be absent for a member record that arrived without a name */
  name?: string | null;
  size?: number;
  online?: boolean;
  ring?: 'gold' | 'none';
  className?: string;
}

export function Avatar({ src, name, size = 40, online, ring = 'none', className = '' }: AvatarProps) {
  const [err, setErr] = useState(false);
  // Members reach this component from the API, from a localStorage cache and from
  // notification payloads, so neither the name nor the photo is guaranteed to be
  // a string. Both are coerced here rather than at every call site.
  const label = (name ?? '').trim();
  const photo = (src ?? '').trim();
  const initials =
    label
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className={`h-full w-full overflow-hidden rounded-full bg-ink-700 ${
          ring === 'gold' ? 'gold-ring' : ''
        }`}
      >
        {!err && photo ? (
          <img
            src={photo}
            alt={label}
            onError={() => setErr(true)}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold-500 to-gold-700 text-sm font-bold text-[#17130a]">
            {initials}
          </div>
        )}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 border-ink-850 ${
            online ? 'bg-emerald-400' : 'bg-ink-400'
          }`}
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
        />
      )}
    </div>
  );
}

export function Logo({ size = 36, withText = false }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-[#17130a] shadow-gold"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3/5 w-3/5">
          {/* Orthodox cross with three bars */}
          <path
            d="M11 2h2v4h4v2h-4v3h4v2h-4v9h-2v-9H7v-2h4V8H7V6h4V2z"
            fill="currentColor"
          />
        </svg>
      </div>
      {withText && (
        <div className="leading-tight">
          <div className="font-serif text-lg font-semibold tracking-wide gold-text">OrthodoxConnect</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Faith · Fellowship</div>
        </div>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  className = '',
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
  }[size];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`card w-full ${sizeClass} animate-scale-in max-h-[92vh] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 bg-ink-850/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-gold-300">
        {icon}
      </div>
      <p className="font-semibold text-ink-100">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-ink-400">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-ink-600 border-t-gold-400 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// Full-screen loading state shown while the persisted auth session is being
// restored, so logged-in users aren't briefly redirected to the landing page.
export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-950">
      <Logo size={48} withText />
      <div className="flex items-center gap-3 text-ink-400">
        <Spinner size={20} />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

// Neutral shimmering placeholder block. Building loading states out of these
// (instead of a spinner) keeps the layout stable so content swaps in without a
// jump when it arrives.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-800 ${className}`} />;
}

// Placeholder for a single feed post while the feed loads.
export function PostSkeleton() {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

// A short stack of post placeholders for the feed loading state.
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <PostSkeleton key={index} />
      ))}
    </div>
  );
}

// Placeholder for a person card used across the network view.
export function PersonCardSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );
}

// A grid of person placeholders for the network loading state.
export function PeopleSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <PersonCardSkeleton key={index} />
      ))}
    </div>
  );
}
