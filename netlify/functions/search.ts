import type { Config } from '@netlify/functions';
import { and, desc, eq, exists, ilike, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { churches, groupMembers, hymns, posts, userProfiles } from '../../db/schema.js';
import type { Post, User } from '../../src/types.js';
import { isResponse, requireAppUser } from './_auth.js';

const RESULT_LIMIT = 8;

// Global multi-category search. A single query string is matched, in real time,
// against real records in several database tables and returned grouped into the
// categories the UI renders: People, Churches, Songs, Videos.
export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (q.length === 0) {
    return Response.json({ people: [], churches: [], songs: [], videos: [] });
  }

  const like = `%${q}%`;

  const [peopleRows, churchRows, hymnRows, videoRows] = await Promise.all([
    // Members — the `user_profiles` document stores the full User record.
    db
      .select()
      .from(userProfiles)
      .where(
        or(
          sql`${userProfiles.data} ->> 'name' ILIKE ${like}`,
          sql`${userProfiles.data} ->> 'parish' ILIKE ${like}`,
          sql`${userProfiles.data} ->> 'email' ILIKE ${like}`,
          sql`${userProfiles.data} ->> 'bio' ILIKE ${like}`,
        ),
      )
      .limit(RESULT_LIMIT),

    db
      .select()
      .from(churches)
      .where(
        or(
          ilike(churches.name, like),
          ilike(churches.jurisdiction, like),
          ilike(churches.city, like),
          ilike(churches.region, like),
        ),
      )
      .limit(RESULT_LIMIT),

    db
      .select()
      .from(hymns)
      .where(
        or(
          ilike(hymns.title, like),
          ilike(hymns.composer, like),
          ilike(hymns.tone, like),
          ilike(hymns.lyrics, like),
        ),
      )
      .limit(RESULT_LIMIT),

    // Videos / reels — feed posts that carry a video, matched on their caption.
    db
      .select()
      .from(posts)
      .where(
        and(
          sql`${posts.data} ->> 'video' IS NOT NULL`,
          sql`${posts.data} ->> 'text' ILIKE ${like}`,
          actor.role === 'admin'
            ? sql`true`
            : or(
                isNull(posts.groupId),
                exists(
                  db
                    .select({ userId: groupMembers.userId })
                    .from(groupMembers)
                    .where(and(
                      eq(groupMembers.groupId, posts.groupId),
                      eq(groupMembers.userId, actor.id),
                    )),
                ),
              ),
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(RESULT_LIMIT),
  ]);

  const people = peopleRows
    .map((r) => r.data as User)
    .map((u) => ({ id: u.id, name: u.name, parish: u.parish, photo: u.photo, email: u.email }));

  const videos = videoRows
    .map((r) => r.data as Post)
    .map((p) => ({ id: p.id, text: p.text, authorId: p.authorId, createdAt: p.createdAt }));

  return Response.json({
    people,
    churches: churchRows,
    songs: hymnRows,
    videos,
  });
};

export const config: Config = {
  path: '/api/search',
};
