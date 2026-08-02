import { useState } from "react";
import { VideoPlayer } from "./VideoPlayer";

/**
 * PostCard
 *
 * Renders a single post in the Orthodox Connect feed.
 *
 * Media handling:
 *  - Bunny Stream videos → rendered via the <VideoPlayer> component using the
 *    official Bunny embed iframe.
 *  - YouTube videos       → rendered via YouTube's lightweight embed iframe.
 *  - Facebook videos      → rendered via Facebook's plugin embed iframe.
 *  - Image posts          → rendered as a standard <img>.
 *
 * The post object is expected to follow a shape similar to:
 *   {
 *     id: string,
 *     author: { name: string, avatar_url?: string },
 *     content: string,
 *     created_at: string,
 *     media_type?: "bunny" | "youtube" | "facebook" | "image" | null,
 *     video_id?: string,        // used for Bunny & YouTube
 *     video_url?: string,       // used for Facebook embed
 *     image_url?: string,       // used for image posts
 *     thumbnail_url?: string,   // optional poster for Bunny videos
 *   }
 */

export interface PostAuthor {
  name: string;
  avatar_url?: string;
}

export interface Post {
  id: string;
  author: PostAuthor;
  content: string;
  created_at: string;
  media_type?: "bunny" | "youtube" | "facebook" | "image" | null;
  video_id?: string;
  video_url?: string;
  image_url?: string;
  thumbnail_url?: string;
}

export interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/** YouTube lightweight embed — no extra JS, respects privacy-enhanced mode. */
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        loading="lazy"
        className="h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    </div>
  );
}

/** Facebook video embed via the official plugin iframe. */
function FacebookEmbed({ videoUrl }: { videoUrl: string }) {
  const src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    videoUrl,
  )}&show_text=false`;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={src}
        title="Facebook video"
        loading="lazy"
        className="h-full w-full border-0"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

export function PostCard({ post, onLike, onComment }: PostCardProps) {
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    setLiked((v) => !v);
    onLike?.(post.id);
  };

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-600">
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt={post.author.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-neutral-500">
              {post.author.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {post.author.name}
          </span>
          <span className="text-xs text-neutral-500">{timeAgo(post.created_at)}</span>
        </div>
      </div>

      {/* Text content */}
      {post.content && (
        <p className="mb-3 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
          {post.content}
        </p>
      )}

      {/* Media */}
      {post.media_type === "bunny" && post.video_id && (
        <VideoPlayer
          videoId={post.video_id}
          poster={post.thumbnail_url}
          className="mb-3"
        />
      )}

      {post.media_type === "youtube" && post.video_id && (
        <div className="mb-3">
          <YouTubeEmbed videoId={post.video_id} />
        </div>
      )}

      {post.media_type === "facebook" && post.video_url && (
        <div className="mb-3">
          <FacebookEmbed videoUrl={post.video_url} />
        </div>
      )}

      {post.media_type === "image" && post.image_url && (
        <div className="mb-3 overflow-hidden rounded-lg">
          <img
            src={post.image_url}
            alt="Post media"
            loading="lazy"
            className="max-h-[500px] w-full object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 border-t border-neutral-100 pt-3 dark:border-neutral-700">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm transition ${
            liked
              ? "text-red-500"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          <span aria-hidden="true">{liked ? "❤️" : "🤍"}</span>
          <span>Like</span>
        </button>
        <button
          type="button"
          onClick={() => onComment?.(post.id)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          <span aria-hidden="true">💬</span>
          <span>Comment</span>
        </button>
      </div>
    </article>
  );
}

export default PostCard;
