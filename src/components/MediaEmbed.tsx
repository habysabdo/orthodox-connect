import { FacebookVideoEmbed } from './FacebookVideoEmbed';
import { LazyFeedVideo } from './LazyFeedVideo';
import { YouTubeEmbed } from './YouTubeEmbed';
import { parseVideoSource } from '@/utils/video';

interface MediaEmbedProps {
  /** a post's video field, or a video link found in its body text */
  url: string | null | undefined;
  title: string;
  /** applied to the 16:9 frame of a platform iframe (YouTube / Facebook) */
  frameClassName?: string;
  /** applied to the native player used for uploads and direct files */
  className?: string;
  posterClassName?: string;
  /** only meaningful for the native player; platform embeds keep their own controls */
  loop?: boolean;
}

/**
 * The one place a post decides how a piece of media is played.
 *
 * Feed cards used to branch on the URL themselves, so a link that the branch did
 * not recognise as YouTube fell through to the HTML5 player and rendered a black
 * three-second shell of a video, and Facebook links were handed to a player that
 * cannot frame them at all. Classification now happens once, in
 * `parseVideoSource`, and each kind reaches exactly one renderer:
 *
 * - YouTube (`youtube.com`, `youtu.be`, Shorts, Live) → a YouTube iframe
 * - Facebook (`facebook.com`, `fb.watch`) → the official Facebook video plugin
 * - uploads and direct files (`.mp4`, `.webm`, Bunny, Mux, storage URLs) → the
 *   native `<video>`/hosted player, lazily mounted with a poster
 * - anything else → the shared player's link preview, never a `<video>` tag
 */
export function MediaEmbed({
  url,
  title,
  frameClassName = '',
  className = 'w-full aspect-video overflow-hidden rounded-xl bg-black object-contain',
  posterClassName = 'w-full aspect-video overflow-hidden rounded-xl',
  loop = false,
}: MediaEmbedProps) {
  const value = (url ?? '').trim();
  if (!value) return null;

  const source = parseVideoSource(value);

  if (source.kind === 'embed' && source.provider === 'youtube') {
    return <YouTubeEmbed url={source.originalUrl} title={title} className={frameClassName} />;
  }

  if (source.kind === 'embed' && source.provider === 'facebook') {
    return <FacebookVideoEmbed url={source.originalUrl} title={title} className={frameClassName} />;
  }

  return (
    <LazyFeedVideo
      url={value}
      title={title}
      loop={loop}
      className={className}
      posterClassName={posterClassName}
    />
  );
}
