import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const CHAT_EVENT = 'messages-changed';

export function subscribeToMessageChanges(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`chat:${userId}`)
    .on('broadcast', { event: CHAT_EVENT }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function publishMessageChange(userId: string): void {
  const channel: RealtimeChannel = supabase.channel(`chat:${userId}`).subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void channel
      .send({ type: 'broadcast', event: CHAT_EVENT, payload: {} })
      .finally(() => supabase.removeChannel(channel));
  });
}
