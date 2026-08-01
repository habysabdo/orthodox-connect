import { FacebookVideoEmbed } from './FacebookVideoEmbed';
import { LazyFeedVideo } from './LazyFeedVideo';
import { YouTubeEmbed } from './YouTubeEmbed';
import { LinkPreviewCard } from './LinkPreviewCard';
import { VideoUnavailable } from './VideoFrame';
import { parseVideoSource } from '@/utils/video';

interface MediaEmbedProps {
  /** a post's video field, or a video link found in its body text */
  url: string | null | undefined;
  title: string;
  /** applied to the 16:9 frame of a platform iframe (YouTube / Facebook) or a link card */
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
 * - any other external link → a link preview card with the page's own thumbnail
 *   and title, never a `<video>` tag and never a play button that reveals one
 * - a value that is not a usable URL → the "Video unavailable" card
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

  // An external link that is not a video on a platform we can frame. Facebook
  // profile links, news articles and shorteners all land here, and none of them
  // can be played: an iframe of them is blocked by `X-Frame-Options` and a
  // `<video>` pointed at them decodes nothing. Both leave a black rectangle — one
  // of them behind a play button, which is worse — so the link becomes a card
  // that shows what it actually is and opens the original site when tapped.
  if (source.kind === 'iframe') {
    return <LinkPreviewCard url={source.originalUrl} className={`aspect-video ${frameClassName}`} />;
  }

  // Not a usable URL at all — a half-saved post, or a stored value that was never
  // a link. There is nothing for a player to load, so say so rather than mount an
  // empty one.
  if (source.kind === 'invalid') {
    return <VideoUnavailable className={frameClassName} description="The address saved with this post is not a usable video link." />;
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
