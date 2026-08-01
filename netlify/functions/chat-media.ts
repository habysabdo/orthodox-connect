import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatAttachments } from '../../db/schema.js';
import type { ChatAttachment, ChatAttachmentKind } from '../../src/types.js';
import { isResponse, requireAppUser } from './_auth.js';

const attachments = getStore({ name: 'chat-attachments', consistency: 'strong' });
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_FILE_BYTES / MAX_CHUNK_BYTES);
const validKinds = new Set<ChatAttachmentKind>(['image', 'file', 'audio']);
const validUploadId = /^[a-f0-9-]{36}$/i;

function attachmentUrl(id: string): string {
  return `/api/chat-media?id=${encodeURIComponent(id)}`;
}

function safeFileName(value: string): string {
  const cleaned = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 && character !== '/' && character !== '\\';
    })
    .join('')
    .trim()
    .slice(0, 180);
  return cleaned || 'attachment';
}

function canAccess(threadId: string, actorId: string, role: string): boolean {
  return role === 'admin' || threadId.split('__').includes(actorId);
}

function asAttachment(row: typeof chatAttachments.$inferSelect): ChatAttachment {
  return {
    id: row.id,
    kind: row.kind as ChatAttachmentKind,
    name: row.fileName,
    contentType: row.contentType,
    size: row.size,
    url: attachmentUrl(row.id),
    ...(row.duration === null ? {} : { duration: row.duration }),
  };
}

function uploadPartKey(actorId: string, uploadId: string, part: number): string {
  return `${actorId}/pending-${uploadId}-${part}`;
}

export default async (req: Request) => {
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;

  const url = new URL(req.url);

  if (req.method === 'PUT') {
    const uploadId = url.searchParams.get('uploadId') ?? '';
    const part = Number(url.searchParams.get('part'));
    if (!validUploadId.test(uploadId) || !Number.isInteger(part) || part < 0 || part >= MAX_PARTS) {
      return Response.json({ error: 'Invalid attachment upload part' }, { status: 400 });
    }
    const chunk = await req.arrayBuffer();
    if (chunk.byteLength === 0 || chunk.byteLength > MAX_CHUNK_BYTES) {
      return Response.json({ error: 'Attachment upload part is too large' }, { status: 413 });
    }
    await attachments.set(uploadPartKey(actor.id, uploadId, part), chunk);
    return Response.json({ ok: true });
  }

  if (req.method === 'POST') {
    const input = await req.json() as {
      uploadId?: string;
      partCount?: number;
      threadId?: string;
      kind?: ChatAttachmentKind;
      fileName?: string;
      contentType?: string;
      duration?: number;
    };
    const uploadId = input.uploadId ?? '';
    const partCount = input.partCount ?? 0;
    const threadId = input.threadId ?? '';
    const kind = input.kind as ChatAttachmentKind;
    const fileName = safeFileName(input.fileName ?? 'attachment');
    const contentType = input.contentType?.split(';')[0].trim() || 'application/octet-stream';
    const duration = typeof input.duration === 'number' && Number.isFinite(input.duration) && input.duration >= 0
      ? Math.round(input.duration)
      : null;

    if (!validUploadId.test(uploadId) || !Number.isInteger(partCount) || partCount < 1 || partCount > MAX_PARTS) {
      return Response.json({ error: 'Invalid attachment upload' }, { status: 400 });
    }
    if (!canAccess(threadId, actor.id, actor.role)) return Response.json({ error: 'Invalid conversation' }, { status: 403 });
    if (!validKinds.has(kind)) return Response.json({ error: 'Invalid attachment type' }, { status: 400 });
    if (kind === 'image' && !contentType.startsWith('image/')) return Response.json({ error: 'Selected photo is not a supported image' }, { status: 415 });
    if (kind === 'audio' && !contentType.startsWith('audio/')) return Response.json({ error: 'Voice note is not a supported audio file' }, { status: 415 });

    const partKeys = Array.from({ length: partCount }, (_, part) => uploadPartKey(actor.id, uploadId, part));
    const chunks = await Promise.all(partKeys.map((key) => attachments.get(key, { type: 'arrayBuffer' })));
    if (chunks.some((chunk) => !chunk)) return Response.json({ error: 'Attachment upload is incomplete' }, { status: 400 });
    const body = new Blob(chunks as ArrayBuffer[], { type: contentType });
    const maximum = kind === 'audio' ? MAX_AUDIO_BYTES : MAX_FILE_BYTES;
    if (body.size === 0 || body.size > maximum) {
      return Response.json({ error: `Attachment must be smaller than ${Math.round(maximum / 1024 / 1024)}MB` }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const blobKey = `${actor.id}/${id}`;
    try {
      await attachments.set(blobKey, body);
      const [row] = await db
        .insert(chatAttachments)
        .values({
          id,
          blobKey,
          threadId,
          uploaderId: actor.id,
          kind,
          fileName,
          contentType,
          size: body.size,
          duration,
          createdAt: Date.now(),
        })
        .returning();
      await Promise.all(partKeys.map((key) => attachments.delete(key)));
      return Response.json(asAttachment(row));
    } catch (error) {
      await attachments.delete(blobKey).catch(() => undefined);
      await Promise.all(partKeys.map((key) => attachments.delete(key).catch(() => undefined)));
      console.error('Chat attachment upload failed', error);
      return Response.json({ error: 'Failed to upload attachment' }, { status: 500 });
    }
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const id = url.searchParams.get('id') ?? '';
    const [row] = await db.select().from(chatAttachments).where(eq(chatAttachments.id, id));
    if (!row || !canAccess(row.threadId, actor.id, actor.role)) return new Response('Not found', { status: 404 });

    const headers = new Headers({
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `${url.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${safeFileName(row.fileName).replace(/"/g, '')}"`,
      'Content-Length': String(row.size),
      'Content-Type': row.contentType,
    });
    if (req.method === 'HEAD') return new Response(null, { headers });

    const data = await attachments.get(row.blobKey, { type: 'stream' });
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(data as ReadableStream, { headers });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = { path: '/api/chat-media' };
