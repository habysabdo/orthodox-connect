// Posts and members are stored as JSONB (`netlify/functions/posts.ts` hands the
// stored `data` column back to the client verbatim) and are also re-hydrated from
// a localStorage cache written by an older build. Both paths mean a record can
// arrive missing fields the `Post`/`User` types declare as required — a post from
// before comments existed has no `comments` array, a video post written by a
// half-finished upload has no `text`, a cached member has no `name`.
//
// TypeScript cannot catch that: the values are cast at the fetch boundary, so the
// compiler believes `post.likes.length` is safe while the browser throws
// "Cannot read properties of undefined". These helpers are the single place that
// turns a possibly-partial record into one the component tree can render, plus
// accessors for reading individual fields defensively at the point of use.

import type { Comment, Post, User } from '../types';

/** Anything shaped loosely enough that it might be a post. */
type MaybePost = Partial<Post> | null | undefined;

/** Anything shaped loosely enough that it might be a member. */
type MaybeUser = Partial<User> | null | undefined;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Only the ids that are actually usable strings survive a like list. */
function normalizeLikes(value: unknown): string[] {
  return asArray<unknown>(value).filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** A comment missing its author or body would break the thread, so fill it in. */
function normalizeComments(value: unknown): Comment[] {
  return asArray<Partial<Comment>>(value)
    .filter((comment): comment is Partial<Comment> => Boolean(comment) && typeof comment === 'object')
    .map((comment, index) => ({
      id: asString(comment.id) || `comment-${index}`,
      authorId: asString(comment.authorId),
      text: asString(comment.text),
      createdAt: asNumber(comment.createdAt),
    }));
}

/**
 * A post with every field the renderer relies on present. Fields the UI treats as
 * optional (`image`, `video`, `meeting`, …) are left untouched — absent is a
 * meaningful state for them — while the ones read without a guard (`text`,
 * `likes`, `comments`) are always filled. Re-shares carry a nested original,
 * which is normalized the same way.
 */
export function normalizePost(raw: MaybePost): Post {
  const post = (raw ?? {}) as Partial<Post>;
  const normalized: Post = {
    ...post,
    id: asString(post.id),
    authorId: asString(post.authorId),
    text: asString(post.text),
    createdAt: asNumber(post.createdAt),
    likes: normalizeLikes(post.likes),
    comments: normalizeComments(post.comments),
  };
  if (post.originalPost) normalized.originalPost = normalizePost(post.originalPost);
  return normalized;
}

/**
 * Normalize a list of posts, dropping entries that are not objects at all and
 * any that arrive without an id — without one they cannot be keyed, liked, or
 * updated, so rendering them only invites a crash further down.
 */
export function normalizePosts(raw: unknown): Post[] {
  return asArray<MaybePost>(raw)
    .filter((post) => Boolean(post) && typeof post === 'object')
    .map((post) => normalizePost(post))
    .filter((post) => post.id.length > 0);
}

/** Normalize a `{ posts, hasMore }` reels page, whatever shape it arrives in. */
export function normalizeReelsPage(raw: unknown): { posts: Post[]; hasMore: boolean } {
  const page = (raw ?? {}) as { posts?: unknown; hasMore?: unknown };
  return { posts: normalizePosts(page.posts), hasMore: page.hasMore === true };
}

/** The like list of a post, always an array. */
export function postLikes(post: MaybePost): string[] {
  return normalizeLikes(post?.likes);
}

/** The comments of a post, always an array of well-formed comments. */
export function postComments(post: MaybePost): Comment[] {
  return normalizeComments(post?.comments);
}

/** The body text of a post, always a string. */
export function postText(post: MaybePost): string {
  return asString(post?.text);
}

/** The video URL of a post, or an empty string when it has none. */
export function postVideoUrl(post: MaybePost): string {
  return asString(post?.video).trim();
}

/** The image URL of a post, or an empty string when it has none. */
export function postImageUrl(post: MaybePost): string {
  return asString(post?.image).trim();
}

/** How many times a post was re-shared, never negative and never NaN. */
export function postShareCount(post: MaybePost): number {
  return Math.max(0, asNumber(post?.shareCount));
}

/** Whether a member has liked a post. */
export function isLikedBy(post: MaybePost, userId: string | undefined | null): boolean {
  if (!userId) return false;
  return postLikes(post).includes(userId);
}

/** A member's display name, with a neutral stand-in when it is missing. */
export function userName(user: MaybeUser, fallback = 'Member'): string {
  return asString(user?.name).trim() || fallback;
}

/** The first word of a member's name — used for "Posts by …" style labels. */
export function firstName(name: string | undefined | null, fallback = 'Member'): string {
  const value = asString(name).trim();
  if (!value) return fallback;
  return value.split(' ')[0] || fallback;
}

/** A member's avatar URL, or an empty string so `Avatar` shows initials. */
export function userPhoto(user: MaybeUser): string {
  return asString(user?.photo).trim();
}

/**
 * A member record with the fields the roster is indexed and rendered by. `name`
 * and `photo` are read directly all over the tree, and `id` is what every
 * `users.find(…)` compares against, so those are always strings here.
 */
export function normalizeUser(raw: MaybeUser): User {
  const user = (raw ?? {}) as Partial<User>;
  return {
    ...user,
    id: asString(user.id),
    name: asString(user.name),
    photo: asString(user.photo),
    age: asNumber(user.age),
    joinedAt: asNumber(user.joinedAt),
  } as User;
}

/**
 * Normalize the member roster. Entries that are not objects, or that arrive
 * without an id, are dropped — the store keys members by id, so an id-less one
 * could never be matched to a post, a thread, or a friendship anyway.
 */
export function normalizeUsers(raw: unknown): User[] {
  return asArray<MaybeUser>(raw)
    .filter((user) => Boolean(user) && typeof user === 'object')
    .map((user) => normalizeUser(user))
    .filter((user) => user.id.length > 0);
}
