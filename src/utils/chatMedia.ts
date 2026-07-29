import type { ChatAttachment, ChatAttachmentKind } from '../types';
import { apiUrl } from '../lib/config';

export async function uploadChatAttachment(
  file: Blob,
  options: {
    threadId: string;
    kind: ChatAttachmentKind;
    name: string;
    duration?: number;
  },
): Promise<ChatAttachment> {
  const uploadId = crypto.randomUUID();
  const chunkSize = 4 * 1024 * 1024;
  const partCount = Math.ceil(file.size / chunkSize);

  for (let part = 0; part < partCount; part += 1) {
    const chunk = file.slice(part * chunkSize, Math.min(file.size, (part + 1) * chunkSize));
    const response = await fetch(apiUrl(`/api/chat-media?uploadId=${uploadId}&part=${part}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to upload attachment');
    }
  }

  const response = await fetch(apiUrl('/api/chat-media'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      partCount,
      threadId: options.threadId,
      kind: options.kind,
      fileName: options.name,
      contentType: file.type || 'application/octet-stream',
      duration: options.duration,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to upload attachment');
  return data;
}
