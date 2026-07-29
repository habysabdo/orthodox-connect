import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { posts, userProfiles, users } from '../../db/schema.js';
import type { Post, User } from '../../src/types.js';

function summarize(value: string, fallback: string) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? (text.length > 220 ? `${text.slice(0, 217)}…` : text) : fallback;
}

export default async (_req: Request, context: { params: { id?: string } }) => {
  const id = context.params.id;
  if (!id) return Response.json({ error: 'Post id is required' }, { status: 400 });
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  if (!row || row.groupId) return Response.json({ error: 'Post not found' }, { status: 404 });

  const shared = row.data as Post;
  const originalId = shared.originalPostId ?? shared.id;
  const [originalRow] = originalId === shared.id
    ? [row]
    : await db.select().from(posts).where(eq(posts.id, originalId));
  if (!originalRow || originalRow.groupId) return Response.json({ error: 'Post not found' }, { status: 404 });
  const original = originalRow.data as Post;
  const [author] = await db.select().from(users).where(eq(users.id, original.authorId));
  const [profileRow] = await db.select().from(userProfiles).where(eq(userProfiles.userId, original.authorId));
  const profile = profileRow?.data as Partial<User> | undefined;
  const authorName = author?.name || profile?.name || 'An OrthodoxConnect member';
  const description = summarize(
    [shared.repostKind === 'quote' ? shared.text : '', original.text].filter(Boolean).join(' — '),
    'View this post from the OrthodoxConnect community.',
  );

  return Response.json({
    title: `${authorName} on OrthodoxConnect`,
    description,
    image: original.image || profile?.photo || '/icon-512.png',
  }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
};

export const config: Config = { path: '/api/post-meta/:id' };
