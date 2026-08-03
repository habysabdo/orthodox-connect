import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types';

export interface SupabaseMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

function mapRow(row: SupabaseMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    text: row.text,
    read: row.read,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function threadIdFor(a: string, b: string): string {
  return [a, b].sort().join('__');
}

export async function loadMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data) return [];
  return (data as SupabaseMessageRow[]).map(mapRow);
}

export async function sendMessage(
  threadId: string,
  senderId: string,
  recipientId: string,
  text: string,
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      recipient_id: recipientId,
      text,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as SupabaseMessageRow);
}

export async function markThreadRead(threadId: string, recipientId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('thread_id', threadId)
    .eq('recipient_id', recipientId)
    .eq('read', false);
}

export function subscribeToThread(threadId: string, onNew: (msg: ChatMessage) => void) {
  const channel = supabase
    .channel(`messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const row = payload.new as SupabaseMessageRow;
        onNew(mapRow(row));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
