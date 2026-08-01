import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Sizing every video frame shares: a full-width 16:9 black box that clips its
 * own corners. Without an explicit box a `<video>` with no metadata yet collapses
 * to the element's intrinsic 300×150 default (or to zero height inside a flex
 * parent), which reads as a broken black rectangle.
 *
 * The feed player, the reels player and the unavailable placeholder all share it
 * so a post keeps exactly one shape as it moves between those states.
 */
export const VIDEO_FRAME_CLASSES = 'w-full aspect-video overflow-hidden rounded-xl bg-black';

/**
 * What a member sees in place of a black screen when a video cannot play.
 *
 * A `<video>` element that errors, a stream that never produces a frame, and a
 * stored value that is not a usable video URL all end here: a framed card that
 * says so, with a retry when the caller can offer one. Every caller uses this
 * one card, so "unavailable" looks the same in the feed, in reels and in a live
 * broadcast.
 */
export function VideoUnavailable({
  className = '',
  description = 'This video could not be loaded. It may still be processing, or the file is no longer available.',
  onRetry,
}: {
  className?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`relative grid min-h-52 place-items-center ${VIDEO_FRAME_CLASSES} px-6 text-center ${className}`} role="alert">
      <div>
        <AlertCircle size={30} className="mx-auto text-red-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-white">Video unavailable</p>
        <p className="mt-1 text-xs leading-5 text-white/60">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-gold-300"
          >
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
