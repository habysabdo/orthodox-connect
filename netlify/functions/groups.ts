import type { Config } from '@netlify/functions';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { groupMembers, groups, posts, users } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';

export default async (req: Request) => {
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const requestedGroupId = url.searchParams.get('groupId');
    const wantsMembers = url.searchParams.get('members') === '1';
    const wantsDiscover = url.searchParams.get('discover') === '1';

    // Group discovery: list every group with the current member's own
    // relationship to it, so the client can render Join / Request Pending /
    // Joined for each one.
    if (wantsDiscover) {
      const myMemberships = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.userId, actor.id));
      const approvedGroupIds = new Set(
        myMemberships.filter((membership) => membership.status === 'approved').map((membership) => membership.groupId),
      );
      const allGroupRows = await db.select().from(groups).orderBy(desc(groups.createdAt));
      const groupRows = allGroupRows.filter((group) => group.isActive || approvedGroupIds.has(group.id));
      const ownerIds = [...new Set(groupRows.map((group) => group.createdBy))];
      const ownerRows = ownerIds.length
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))
        : [];
      const memberCounts = groupRows.length
        ? await db
            .select({ groupId: groupMembers.groupId, count: count() })
            .from(groupMembers)
            .where(and(
              inArray(groupMembers.groupId, groupRows.map((group) => group.id)),
              eq(groupMembers.status, 'approved'),
            ))
            .groupBy(groupMembers.groupId)
        : [];
      return Response.json(groupRows.map((group) => ({
        ...group,
        owner: ownerRows.find((owner) => owner.id === group.createdBy) ?? null,
        memberCount: memberCounts.find((item) => item.groupId === group.id)?.count ?? 0,
        membershipStatus: myMemberships.find((member) => member.groupId === group.id)?.status ?? null,
      })));
    }

    if (requestedGroupId && wantsMembers) {
      const [membership] = actor.role === 'admin' ? [null] : await db.select().from(groupMembers).where(and(
        eq(groupMembers.groupId, requestedGroupId),
        eq(groupMembers.userId, actor.id),
        eq(groupMembers.status, 'approved'),
      ));
      if (actor.role !== 'admin' && !membership) {
        return Response.json({ error: 'Group membership required' }, { status: 403 });
      }
      const memberships = await db.select().from(groupMembers).where(eq(groupMembers.groupId, requestedGroupId));
      const memberIds = memberships.map((member) => member.userId);
      const memberRows = memberIds.length ? await db.select().from(users).where(inArray(users.id, memberIds)) : [];
      return Response.json(memberships.map((membershipRow) => ({
        ...membershipRow,
        user: memberRows.find((user) => user.id === membershipRow.userId) ?? null,
      })));
    }
    const membershipRows = actor.role === 'admin'
      ? await db.select().from(groupMembers)
      : await db.select().from(groupMembers).where(and(
          eq(groupMembers.userId, actor.id),
          eq(groupMembers.status, 'approved'),
        ));
    const allowedIds = [...new Set(membershipRows.map((row) => row.groupId))];
    const groupRows = actor.role === 'admin'
      ? await db.select().from(groups).orderBy(desc(groups.createdAt))
      : allowedIds.length
        ? await db.select().from(groups).where(inArray(groups.id, allowedIds)).orderBy(desc(groups.createdAt))
        : [];
    const ownerIds = [...new Set(groupRows.map((group) => group.createdBy))];
    const ownerRows = ownerIds.length ? await db.select().from(users).where(inArray(users.id, ownerIds)) : [];
    const memberCounts = groupRows.length
      ? await db
          .select({ groupId: groupMembers.groupId, count: count() })
          .from(groupMembers)
          .where(and(
            inArray(groupMembers.groupId, groupRows.map((group) => group.id)),
            eq(groupMembers.status, 'approved'),
          ))
          .groupBy(groupMembers.groupId)
      : [];

    return Response.json(groupRows.map((group) => ({
      ...group,
      owner: ownerRows.find((owner) => owner.id === group.createdBy) ?? null,
      memberCount: memberCounts.find((item) => item.groupId === group.id)?.count ?? 0,
      membershipRole: actor.role === 'admin'
        ? 'global-admin'
        : membershipRows.find((member) => member.groupId === group.id)?.role ?? null,
    })));
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { name?: string; description?: string; groupId?: string };

    // Request to join an existing group (from group discovery). Records a
    // 'pending' membership the group owner can later approve. Idempotent: a
    // repeat request returns the current membership status unchanged.
    if (body.groupId) {
      const groupId = body.groupId;
      const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
      if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
      if (!group.isActive) return Response.json({ error: 'This group is not accepting join requests' }, { status: 409 });
      const [existing] = await db.select().from(groupMembers).where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, actor.id),
      ));
      if (existing) {
        return Response.json({ groupId, userId: actor.id, status: existing.status });
      }
      await db.insert(groupMembers).values({ groupId, userId: actor.id, status: 'pending' });
      return Response.json({ groupId, userId: actor.id, status: 'pending' }, { status: 201 });
    }

    const name = body.name?.trim();
    const description = body.description?.trim() ?? '';
    if (!name || name.length > 80) {
      return Response.json({ error: 'Group name must be between 1 and 80 characters' }, { status: 400 });
    }
    if (!description || description.length > 500) {
      return Response.json({ error: 'Description must be between 1 and 500 characters' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(groups).values({ id, name, description, createdBy: actor.id });
      await tx.insert(groupMembers).values({ groupId: id, userId: actor.id, role: 'creator', status: 'approved' });
    });
    return Response.json({
      id,
      name,
      description,
      isActive: true,
      createdBy: actor.id,
      memberCount: 1,
      membershipRole: 'creator',
    }, { status: 201 });
  }

  if (req.method === 'DELETE') {
    const groupId = new URL(req.url).searchParams.get('id');
    if (!groupId) return Response.json({ error: 'id is required' }, { status: 400 });
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });
    const [membership] = await db.select().from(groupMembers).where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, actor.id),
    ));
    if (actor.role !== 'admin' && group.createdBy !== actor.id && !['creator', 'admin'].includes(membership?.role ?? '')) {
      return Response.json({ error: 'Group administrator access required' }, { status: 403 });
    }
    await db.transaction(async (tx) => {
      await tx.delete(posts).where(eq(posts.groupId, groupId));
      await tx.delete(groups).where(eq(groups.id, groupId));
    });
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = { path: '/api/groups' };
