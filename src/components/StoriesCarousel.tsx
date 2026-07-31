import { Plus } from 'lucide-react';
import type { Post, User } from '@/types';
import { Avatar } from './ui';

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_VISIBLE_STORIES = 12;

interface StoryPreview {
  id: string;
  author: User;
  background: string;
}

function activeStoryPreviews(posts: Post[], users: User[]): StoryPreview[] {
  const cutoff = Date.now() - STORY_LIFETIME_MS;
  const usersById = new Map(users.filter(Boolean).map((user) => [user.id, user]));
  const seenAuthors = new Set<string>();

  return posts
    .filter((post) => Boolean(post?.image && post.createdAt >= cutoff))
    .sort((left, right) => right.createdAt - left.createdAt)
    .flatMap((post) => {
      const author = usersById.get(post.authorId);
      if (!author || !post.image || seenAuthors.has(author.id)) return [];
      seenAuthors.add(author.id);
      return [{ id: post.id, author, background: post.image }];
    })
    .slice(0, MAX_VISIBLE_STORIES);
}

function focusComposer() {
  document.querySelector<HTMLTextAreaElement>('[data-feed-composer]')?.focus();
}

function openStory(postId: string) {
  document.getElementById(`feed-post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function StoriesCarousel({ posts, users, currentUser }: { posts: Post[]; users: User[]; currentUser?: User }) {
  const stories = activeStoryPreviews(posts, users);

  return (
    <section
      aria-label="Community stories"
      className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/90 py-4 shadow-[0_12px_35px_-24px_rgba(120,53,15,0.55)]"
    >
      <div className="mb-3 flex items-end justify-between gap-3 px-4">
        <div>
          <p className="font-serif text-lg font-bold text-amber-950">Stories</p>
          <p className="text-xs text-amber-800/75">Small glimpses from parish life</p>
        </div>
        {stories.length > 0 && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Today</span>}
      </div>

      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={focusComposer}
          className="group relative h-48 w-28 shrink-0 snap-start overflow-hidden rounded-2xl border border-amber-300 bg-amber-100 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
          aria-label="Create a story"
        >
          <div className="absolute inset-x-0 top-0 h-[68%] overflow-hidden bg-gradient-to-br from-amber-200 via-orange-100 to-amber-50">
            {currentUser?.photo ? (
              <img
                src={currentUser.photo}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Avatar src={currentUser?.photo} name={currentUser?.name ?? 'You'} size={64} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-amber-950/30 via-transparent to-amber-900/5" />
          </div>
          <span className="absolute left-1/2 top-[58%] grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border-4 border-amber-50 bg-amber-700 text-amber-50 shadow-md transition group-hover:bg-amber-800">
            <Plus size={21} strokeWidth={3} aria-hidden="true" />
          </span>
          <span className="absolute inset-x-2 bottom-3 text-center text-sm font-bold leading-tight text-amber-950">Create Story</span>
        </button>

        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => openStory(story.id)}
            className="group relative h-48 w-28 shrink-0 snap-start overflow-hidden rounded-2xl border border-amber-300 bg-amber-200 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
            aria-label={`View ${story.author.name}'s story`}
          >
            <img
              src={story.background}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-amber-950/25 via-transparent to-amber-950/85" />
            <Avatar
              src={story.author.photo}
              name={story.author.name}
              size={38}
              className="absolute left-2.5 top-2.5 rounded-full ring-2 ring-amber-100 shadow-md"
            />
            <span className="absolute inset-x-2.5 bottom-3 line-clamp-2 text-sm font-bold leading-tight text-amber-50 drop-shadow-md">
              {story.author.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
