import { useMemo } from "react";

/**
 * VideoPlayer
 *
 * Renders Bunny Stream videos using the official embed iframe.
 *
 * Embed URL format (strict):
 *   https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${VIDEO_ID}
 *
 * The Bunny library ID is read from the Vite env var
 * `import.meta.env.VITE_BUNNY_LIBRARY_ID`. If it is missing the component
 * falls back to a safe default (empty string) and renders a friendly
 * "Video unavailable" message instead of a broken iframe.
 */

const BUNNY_LIBRARY_ID: string =
  (import.meta.env.VITE_BUNNY_LIBRARY_ID as string | undefined) ?? "";

export interface VideoPlayerProps {
  /** The Bunny Stream video ID for this post. */
  videoId: string;
  /** Optional poster/thumbnail URL. */
  poster?: string;
  /** Optional extra className for the wrapper. */
  className?: string;
}

export function VideoPlayer({
  videoId,
  poster,
  className,
}: VideoPlayerProps) {
  // Build the official embed URL. useMemo avoids rebuilding on every render.
  const embedUrl = useMemo(() => {
    if (!BUNNY_LIBRARY_ID || !videoId) return "";
    return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
  }, [videoId]);

  // Graceful fallback when configuration or video id is missing.
  if (!embedUrl) {
    return (
      <div
        className={
          "flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-900 text-neutral-400 " +
          (className ?? "")
        }
        role="img"
        aria-label="Video unavailable"
      >
        <p className="px-4 text-center text-sm">
          {BUNNY_LIBRARY_ID
            ? "Video unavailable."
            : "Video unavailable — Bunny library ID is not configured."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={"aspect-video w-full overflow-hidden rounded-lg " + (className ?? "")}
      style={{ backgroundImage: poster ? `url(${poster})` : undefined }}
    >
      <iframe
        src={embedUrl}
        title="Bunny Stream video"
        loading="lazy"
        className="h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    </div>
  );
}

export default VideoPlayer;
