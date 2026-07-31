import type { ChatMessage, Thread } from '../types';
import { apiUrl } from '../lib/config';

// Load every persisted chat message (chronological) from the database.
export async function loadMessages(): Promise<ChatMessage[]> {
  const res = await fetch(apiUrl('/api/messages'));
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

// Persist a single newly sent message.
export async function saveMessage(message: ChatMessage): Promise<void> {
  const res = await fetch(apiUrl('/api/messages'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error('Failed to save message');
}

export async function markMessagesRead(threadId: string, messageIds: string[]): Promise<{ messageIds: string[]; readAt: number }> {
  const res = await fetch(apiUrl('/api/messages'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, messageIds }),
  });
  if (!res.ok) throw new Error('Failed to mark messages as read');
  return res.json();
}

// Rebuild the threads list from persisted messages. Thread ids created at
// runtime are keyed `a__b`, so each thread's participants are recovered from
// its id. `known` may supply any threads whose ids don't encode participants.
export function buildThreads(messages: ChatMessage[], known: Thread[] = []): Thread[] {
  const byThread = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    const list = byThread.get(m.threadId);
    if (list) list.push(m);
    else byThread.set(m.threadId, [m]);
  }

  const threads: Thread[] = [];
  const seen = new Set<string>();

  for (const t of known) {
    if (!t?.id) continue;
    seen.add(t.id);
    threads.push({
      ...t,
      participantIds: Array.isArray(t.participantIds) ? t.participantIds.filter(Boolean) : [],
      messages: byThread.get(t.id) ?? (Array.isArray(t.messages) ? t.messages : []),
    });
  }

  for (const [threadId, msgs] of byThread) {
    if (seen.has(threadId)) continue;
    const parts = threadId.split('__');
    if (parts.length === 2) {
      threads.push({ id: threadId, participantIds: [parts[0], parts[1]], messages: msgs });
    }
  }

  return threads;
}
