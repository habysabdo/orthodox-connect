import { useState, type ReactNode } from 'react';

interface AvatarProps {
  src: string;
  name: string;
  size?: number;
  online?: boolean;
  ring?: 'gold' | 'none';
  className?: string;
}

export function Avatar({ src, name, size = 40, online, ring = 'none', className = '' }: AvatarProps) {
  const [err, setErr] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
        {!err ? (
          <img
            src={src}
            alt={name}
            onError={() => setErr(true)}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold-500 to-gold-700 text-sm font-bold text-ink-950">
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
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-ink-950 shadow-gold"
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
