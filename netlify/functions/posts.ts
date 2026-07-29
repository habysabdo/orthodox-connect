import type { Config } from '@netlify/functions';
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { groupMembers, postReshares, posts } from '../../db/schema.js';
import type { Post } from '../../src/types.js';
import { isResponse, requireAppUser, type AppActor } from './_auth.js';

const VIDEO_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const VIDEO_PROCESSING_ERROR = 'The video was not ready before the processing timeout. Please try posting it again.';

function failStaleVideo(post: Post): Post {
  if (post.video || post.videoStatus !== 'uploading') return post;
  const startedAt = post.videoUploadStartedAt ?? post.createdAt;
  if (Date.now() - startedAt < VIDEO_PROCESSING_TIMEOUT_MS) return post;
  return {
    ...post,
    videoStatus: 'failed',
    videoError: VIDEO_PROCESSING_ERROR,
    videoUploadStartedAt: undefined,
  };
}

interface PostRow {
  id: string;
  data: unknown;
  groupId: string | null;
  postType?: string;
  status?: string;
}

async function normalizeLoadedPosts(rows: PostRow[]): Promise<Post[]> {
  const normalized = rows.map((row) => ({
    row,
    post: failStaleVideo({
      ...(row.data as Post),
      groupId: row.groupId,
      postType: row.postType === 'promo' ? 'promo' : (row.data as Post).postType ?? 'regular',
      status: ['pending', 'approved', 'rejected'].includes(row.status ?? '')
        ? row.status as Post['status']
        : (row.data as Post).status ?? 'approved',
    }),
  }));
  const changed = normalized.filter(({ row, post }) => post.videoStatus !== (row.data as Post).videoStatus);
  await Promise.all(changed.map(({ row, post }) => db.update(posts).set({ data: post }).where(eq(posts.id, row.id))));
  const loaded = normalized.map(({ post }) => post);
  const canonicalIds = [...new Set(loaded.map((post) => post.originalPostId ?? post.id))];
  if (!canonicalIds.length) return loaded;

  const [originalRows, countRows] = await Promise.all([
    db.select({
      id: posts.id,
      data: posts.data,
      groupId: posts.groupId,
      postType: posts.postType,
      status: posts.status,
    }).from(posts).where(inArray(posts.id, canonicalIds)),
    db.select({ originalPostId: postReshares.originalPostId, total: count() })
      .from(postReshares)
      .where(inArray(postReshares.originalPostId, canonicalIds))
      .groupBy(postReshares.originalPostId),
  ]);
  const originals = new Map(originalRows.map((row) => {
    const data = failStaleVideo({ ...(row.data as Post), groupId: row.groupId });
    const clean = { ...data };
    delete clean.originalPost;
    return [row.id, clean as Post];
  }));
  const counts = new Map(countRows.map((row) => [row.originalPostId, Number(row.total)]));

  return loaded.map((post) => {
    const canonicalId = post.originalPostId ?? post.id;
    const shareCount = counts.get(canonicalId) ?? 0;
    return post.originalPostId
      ? { ...post, shareCount, originalPost: originals.get(canonicalId) ? { ...originals.get(canonicalId)!, shareCount } : undefined }
      : { ...post, shareCount };
  });
}

async function canAccessGroup(actor: AppActor, groupId: string): Promise<boolean> {
  if (actor.role === 'admin') return true;
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, actor.id),
      eq(groupMembers.status, 'approved'),
    ));
  return Boolean(membership);
}

export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const postId = url.searchParams.get('id');
    if (postId) {
      const [row] = await db.select({
        id: posts.id,
        data: posts.data,
        groupId: posts.groupId,
        authorId: posts.authorId,
        postType: posts.postType,
        status: posts.status,
      }).from(posts).where(eq(posts.id, postId));
      if (!row) return Response.json({ error: 'Post not found' }, { status: 404 });
      if (row.status !== 'approved' && actor.role !== 'admin' && row.authorId !== actor.id) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      if (row.groupId && !(await canAccessGroup(actor, row.groupId))) {
        return Response.json({ error: 'Group membership required' }, { status: 403 });
      }
      const [post] = await normalizeLoadedPosts([row]);
      return Response.json(post, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const groupId = url.searchParams.get('group_id') ?? url.searchParams.get('groupId');
    if (groupId && !(await canAccessGroup(actor, groupId))) {
      return Response.json({ error: 'Group membership required' }, { status: 403 });
    }

    const visibility = groupId ? eq(posts.groupId, groupId) : isNull(posts.groupId);
    const publiclyVisible = eq(posts.status, 'approved');

    if (url.searchParams.get('reels') === 'true') {
      const limitParam = Number(url.searchParams.get('limit'));
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;
      const offsetParam = Number(url.searchParams.get('offset'));
      const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;
      const seed = (url.searchParams.get('seed') || crypto.randomUUID()).slice(0, 64);
      const videoOnly = sql<boolean>`coalesce(${posts.data}->>'video', '') <> ''`;
      const rows = await db
        .select({ id: posts.id, data: posts.data, groupId: posts.groupId, postType: posts.postType, status: posts.status })
        .from(posts)
        .where(and(visibility, publiclyVisible, videoOnly))
        .orderBy(sql`md5(${posts.id} || ${seed})`)
        .limit(limit + 1)
        .offset(offset);
      const page = rows.slice(0, limit);
      const normalizedPosts = await normalizeLoadedPosts(page);

      return Response.json(
        {
          posts: normalizedPosts,
          hasMore: rows.length > limit,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // Cap the payload to a page of the most recent posts and support a
    // `before` cursor (the createdAt of the oldest post already loaded) so the
    // feed can page backwards without ever fetching the whole table.
    const limitParam = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;
    const beforeParam = Number(url.searchParams.get('before'));
    const before = Number.isFinite(beforeParam) && beforeParam > 0 ? beforeParam : null;
    // A member's public profile lists only what they authored.
    const authorId = url.searchParams.get('author_id') ?? url.searchParams.get('authorId');

    const conditions = [
      visibility,
      publiclyVisible,
      before ? lt(posts.createdAt, before) : undefined,
      authorId ? eq(posts.authorId, authorId) : undefined,
    ].filter(Boolean);
    const where = conditions.length ? and(...conditions) : undefined;

    // Only the JSON document and its group are needed by the client; skipping
    // the duplicated `content`/`author_id` columns keeps the response lean.
    const rows = await db
      .select({ id: posts.id, data: posts.data, groupId: posts.groupId, postType: posts.postType, status: posts.status })
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(limit);
    const normalizedPosts = await normalizeLoadedPosts(rows);
    return Response.json(normalizedPosts, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  if (req.method === 'POST') {
    const body = await req.json() as { originalPostId?: string; kind?: string; quote?: string };
    if (!body.originalPostId || !['repost', 'quote'].includes(body.kind ?? '')) {
      return Response.json({ error: 'A post and re-share type are required' }, { status: 400 });
    }
    const [requested] = await db.select().from(posts).where(eq(posts.id, body.originalPostId));
    if (!requested) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (requested.status !== 'approved') return Response.json({ error: 'Post not found' }, { status: 404 });
    const requestedData = requested.data as Post;
    const originalId = requestedData.originalPostId ?? requested.id;
    const [original] = originalId === requested.id ? [requested] : await db.select().from(posts).where(eq(posts.id, originalId));
    if (!original) return Response.json({ error: 'Original post not found' }, { status: 404 });
    if (original.status !== 'approved') return Response.json({ error: 'Original post not found' }, { status: 404 });
    if (original.groupId && !(await canAccessGroup(actor, original.groupId))) {
      return Response.json({ error: 'Group membership required' }, { status: 403 });
    }
    const kind = body.kind as 'repost' | 'quote';
    const quote = kind === 'quote' ? (body.quote ?? '').trim().slice(0, 5000) : '';
    if (kind === 'quote' && !quote) return Response.json({ error: 'Quote text is required' }, { status: 400 });
    const createdAt = Date.now();
    const resharedPost: Post = {
      id: `p_${crypto.randomUUID()}`,
      authorId: actor.id,
      text: quote,
      createdAt,
      likes: [],
      comments: [],
      groupId: original.groupId,
      originalPostId: original.id,
      repostKind: kind,
    };
    await db.transaction(async (tx) => {
      await tx.insert(posts).values({
        id: resharedPost.id,
        data: resharedPost,
        content: resharedPost.text,
        authorId: actor.id,
        groupId: original.groupId,
        postType: 'regular',
        status: 'approved',
        createdAt,
      });
      await tx.insert(postReshares).values({
        id: `pr_${crypto.randomUUID()}`,
        originalPostId: original.id,
        resharedPostId: resharedPost.id,
        userId: actor.id,
        kind,
        createdAt,
      });
    });
    const [hydrated] = await normalizeLoadedPosts([{
      id: resharedPost.id,
      data: resharedPost,
      groupId: original.groupId,
      postType: 'regular',
      status: 'approved',
    }]);
    return Response.json(hydrated, { status: 201 });
  }

  if (req.method === 'PUT') {
    const incoming = (await req.json()) as Post;
    if (!incoming.id) return Response.json({ error: 'Post id is required' }, { status: 400 });
    const [existing] = await db.select().from(posts).where(eq(posts.id, incoming.id));
    const groupId = incoming.groupId ?? existing?.groupId ?? null;
    if (groupId && !(await canAccessGroup(actor, groupId))) {
      return Response.json({ error: 'Group membership required' }, { status: 403 });
    }
    if (existing?.groupId !== groupId && existing) {
      return Response.json({ error: 'A post cannot be moved between feeds' }, { status: 400 });
    }

    const existingData = existing?.data as Post | undefined;
    const canEditContent = !existing || actor.role === 'admin' || existing.authorId === actor.id;
    const postType: Post['postType'] = existing?.postType === 'promo' || (!existing && incoming.postType === 'promo')
      ? 'promo'
      : 'regular';
    if (!existing && postType === 'promo' && groupId) {
      return Response.json({ error: 'Promo posts must be submitted to the public community feed' }, { status: 400 });
    }
    if (postType === 'promo' && !(incoming.promoTitle ?? existingData?.promoTitle)?.trim()) {
      return Response.json({ error: 'A promo title is required' }, { status: 400 });
    }
    const status: Post['status'] = existing
      ? existing.status as Post['status']
      : postType === 'promo'
        ? 'pending'
        : 'approved';
    const incomingVideoStatus = incoming.videoStatus === 'uploading' && !incoming.video
      ? 'uploading'
      : incoming.video
        ? 'ready'
        : incoming.videoStatus;
    const post: Post = {
      ...incoming,
      authorId: existing?.authorId || actor.id,
      groupId,
      createdAt: existing?.createdAt ?? incoming.createdAt ?? Date.now(),
      postType,
      status,
      promoTitle: postType === 'promo'
        ? (canEditContent ? incoming.promoTitle?.trim().slice(0, 160) : existingData?.promoTitle)
        : undefined,
      text: canEditContent ? incoming.text : existingData?.text ?? '',
      image: canEditContent ? incoming.image : existingData?.image,
      video: canEditContent ? incoming.video : existingData?.video,
      videoStatus: canEditContent ? incomingVideoStatus : existingData?.videoStatus,
      videoError: canEditContent ? incoming.videoError : existingData?.videoError,
      videoUploadStartedAt: canEditContent
        ? incomingVideoStatus === 'uploading'
          ? incoming.videoUploadStartedAt ?? Date.now()
          : undefined
        : existingData?.videoUploadStartedAt,
    };
    await db
      .insert(posts)
      .values({
        id: post.id,
        data: post,
        content: post.text,
        authorId: post.authorId,
        groupId,
        postType,
        status,
        createdAt: post.createdAt,
      })
      .onConflictDoUpdate({
        target: posts.id,
        set: { data: post, content: post.text, groupId, postType, status },
      });
    return Response.json(post);
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (post.groupId && !(await canAccessGroup(actor, post.groupId))) {
      return Response.json({ error: 'Group membership required' }, { status: 403 });
    }
    if (actor.role !== 'admin' && post.authorId !== actor.id) {
      const [membership] = post.groupId
        ? await db.select().from(groupMembers).where(and(
            eq(groupMembers.groupId, post.groupId),
            eq(groupMembers.userId, actor.id),
            inArray(groupMembers.role, ['creator', 'admin']),
          ))
        : [];
      if (!membership) return Response.json({ error: 'Not allowed to delete this post' }, { status: 403 });
    }
    const reshares = await db.select({ resharedPostId: postReshares.resharedPostId }).from(postReshares).where(eq(postReshares.originalPostId, id));
    if (reshares.length) await db.delete(posts).where(inArray(posts.id, reshares.map((row) => row.resharedPostId)));
    await db.delete(posts).where(eq(posts.id, id));
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = { path: '/api/posts' };
