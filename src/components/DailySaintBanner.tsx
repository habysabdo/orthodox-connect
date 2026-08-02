import { BookOpen, Cross } from 'lucide-react';
import { dailySaints } from '@/data/content';

export function DailySaintBanner() {
  const saint = dailySaints[0];
  if (!saint) return null;

  return (
    <div className="card relative overflow-hidden p-0">
      {/* Maroon/burgundy gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-maroon-800/40 via-ink-850 to-ink-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(212,175,55,0.12),transparent_50%)]" />

      <div className="relative flex items-start gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
          <Cross size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="gold-chip text-[10px]">Today</span>
            <span className="text-xs text-ink-400">{saint.feast}</span>
          </div>
          <h3 className="mt-1.5 font-serif text-lg font-semibold text-ink-100">
            {saint.name}
          </h3>
          <p className="mt-1 text-sm italic leading-relaxed text-ink-300">
            &ldquo;{saint.quote}&rdquo;
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gold-300">
            <BookOpen size={12} />
            <span className="font-medium">{saint.scriptureRef}</span>
            <span className="text-ink-400">&mdash; {saint.scripture}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
