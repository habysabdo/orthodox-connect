import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, MessageCircle, Mic, Phone, Send, Trash2, Video } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { useStore, friendsOf, threadIdFor, unreadCountFor } from '@/store/context';
import type { ChatMessage } from '@/types';
import { useUI } from '@/store/ui';
import { clockTime, timeAgo } from '@/utils/format';
import { loadMessages, sendMessage as dbSend, markThreadRead, subscribeToThread } from '@/utils/messages';
import { useAuth } from '@/store/auth';
import { useToast } from './Toast';

export function MessengerView() {
  const state = useStore();
  const { openThreadId, setOpenThreadId, setCallPeerId, setCallGroupLabel } = useUI();
  const { profile } = useAuth();
  const { notify } = useToast();
  const me = state.users.find((u) => u.id === state.currentUserId);
  const [draft, setDraft] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dbMessages, setDbMessages] = useState<Record<string, ChatMessage[]>>({});
  const [sending, setSending] = useState(false);

  const friends = friendsOf(state, me?.id ?? '');
  const activeThread = openThreadId ? state.threads.find((thread) => thread.id === openThreadId) : undefined;
  const activeFriend = activeThread
    ? state.users.find((user) => user.id === activeThread.participantIds.find((id) => id !== me?.id))
    : undefined;

  const conversations = friends.map((f) => {
    const tid = threadIdFor(me?.id ?? '', f.id);
    const thread = state.threads.find((t) => t.id === tid);
    const last = thread?.messages[thread.messages.length - 1];
    const unread = thread ? thread.messages.filter((m: ChatMessage) => m.senderId !== me?.id && !m.read).length : 0;
    return { friend: f, thread, last, unread, tid };
  }).sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

  // Merge in-memory and Supabase messages, dedup by id
  const allMessages: ChatMessage[] = (() => {
    if (!activeThread) return [];
    const inMem = activeThread.messages;
    const db = dbMessages[activeThread.id] ?? [];
    const seen = new Set<string>();
    const merged: ChatMessage[] = [];
    for (const m of [...inMem, ...db]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    return merged.sort((a, b) => a.createdAt - b.createdAt);
  })();

  // Load messages from Supabase when a thread is opened
  useEffect(() => {
    if (!activeThread || !me) return;
    const tid = activeThread.id;
    if (dbMessages[tid]) return; // already loaded
    loadMessages(tid)
      .then((msgs) => {
        setDbMessages((prev) => ({ ...prev, [tid]: msgs }));
      })
      .catch(() => {
        // silently fall back to in-memory messages
      });
  }, [activeThread?.id, me?.id]);

  // Subscribe to new messages via realtime
  useEffect(() => {
    if (!activeThread || !me) return;
    const unsub = subscribeToThread(activeThread.id, (msg) => {
      setDbMessages((prev) => {
        const existing = prev[activeThread.id] ?? [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [activeThread.id]: [...existing, msg] };
      });
    });
    return unsub;
  }, [activeThread?.id, me?.id]);

  // Mark thread read when messages change
  useEffect(() => {
    if (activeThread && me && profile) {
      state.markThreadRead(activeThread.id);
      markThreadRead(activeThread.id, profile.id).catch(() => {});
    }
  }, [activeThread?.id, activeThread?.messages.length, profile?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeThread?.messages.length, dbMessages]);

  const send = useCallback(async () => {
    if (!draft.trim() || !activeThread || !me || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      state.sendMessage(activeThread.id, text);
      if (profile?.id && activeFriend) {
        await dbSend(activeThread.id, profile.id, activeFriend.id, text);
      }
    } catch {
      if (profile?.id && activeFriend) {
        notify('error', 'Message saved locally but not delivered.');
      }
    } finally {
      setSending(false);
    }
  }, [draft, activeThread, me, sending, profile?.id, activeFriend, state, notify]);

  if (!me) return null;

  const sendMedia = (mediaUrl: string) => {
    if (!activeThread) return;
    state.sendMessage(activeThread.id, `[photo] ${mediaUrl}`);
    if (profile?.id && activeFriend) {
      dbSend(activeThread.id, profile.id, activeFriend.id, `[photo] ${mediaUrl}`).catch(() => {});
    }
    setMediaPreview(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (activeThread) {
        sendMedia(url);
      } else {
        setMediaPreview(url);
      }
    };
    reader.readAsDataURL(f);
  };

  const openConv = (tid: string, friendId: string) => {
    if (!state.threads.some((t) => t.id === tid)) {
      const newId = state.openThreadWith(friendId);
      setOpenThreadId(newId);
    } else {
      setOpenThreadId(tid);
    }
  };

  const isMediaMessage = (text: string) => text.startsWith('[photo] ');
  const getMediaUrl = (text: string) => text.replace('[photo] ', '');

  return (
    <div className="card flex h-[calc(100vh-7rem)] overflow-hidden">
      {/* Thread list */}
      <div className={`flex w-full flex-col border-r border-ink-700 md:w-80 ${activeThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="border-b border-ink-700 p-4">
          <h1 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <MessageCircle size={20} className="text-gold-300" /> Messages
          </h1>
          <p className="mt-1 text-xs text-ink-400">{unreadCountFor(state, me.id)} unread</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-400">
              No conversations yet. Add friends to start messaging.
            </div>
          ) : (
            conversations.map(({ friend, last, unread, tid }) => (
              <button
                key={friend.id}
                onClick={() => openConv(tid, friend.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800 ${
                  openThreadId === tid ? 'bg-ink-800 shadow-[inset_3px_0_0_0_#d4af37]' : ''
                }`}
              >
                <Avatar src={friend.photo} name={friend.name} size={44} online={friend.online} ring="gold" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink-100">{friend.name}</span>
                    {last && <span className="shrink-0 text-[10px] text-ink-400">{timeAgo(last.createdAt)}</span>}
                  </div>
                  <div className={`truncate text-xs ${unread ? 'font-semibold text-gold-200' : 'text-ink-400'}`}>
                    {last
                      ? isMediaMessage(last.text)
                        ? (last.senderId === me.id ? 'You: ' : '') + 'Sent a photo'
                        : (last.senderId === me.id ? 'You: ' : '') + last.text
                      : 'Start the conversation'}
                  </div>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-ink-950">
                    {unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      {activeThread && activeFriend ? (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-ink-700 p-3">
            <button onClick={() => setOpenThreadId(null)} className="ghost-btn p-2 md:hidden">
              <MessageCircle size={16} />
            </button>
            <Avatar src={activeFriend.photo} name={activeFriend.name} size={40} online={activeFriend.online} ring="gold" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink-100">{activeFriend.name}</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${activeFriend.online ? 'bg-emerald-400' : 'bg-ink-400'}`} />
                <span className={activeFriend.online ? 'text-emerald-300' : 'text-ink-400'}>
                  {activeFriend.online ? 'Active now' : 'Offline'}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setCallPeerId(activeFriend.id); setCallGroupLabel(`Call with ${activeFriend.name}`); }}
              className="rounded-full p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200"
              title="Audio call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => { setCallPeerId(activeFriend.id); setCallGroupLabel(`Video call with ${activeFriend.name}`); }}
              className="rounded-full p-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200"
              title="Video call"
            >
              <Video size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
            <div className="mx-auto w-fit rounded-full bg-ink-800 px-3 py-1 text-[10px] text-ink-400">
              {activeFriend.parish}
            </div>
            <AnimatePresence initial={false}>
              {allMessages.map((m: ChatMessage) => {
                const mine = m.senderId === me.id;
                const media = isMediaMessage(m.text);
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[75%] gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                      {!mine && <Avatar src={activeFriend.photo} name={activeFriend.name} size={28} />}
                      <div>
                        {media ? (
                          <div className="overflow-hidden rounded-2xl">
                            <img
                              src={getMediaUrl(m.text)}
                              alt="Shared media"
                              className="max-h-60 w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm ${
                              mine
                                ? 'rounded-tr-sm bg-gradient-to-br from-gold-400 to-gold-500 text-ink-950'
                                : 'rounded-tl-sm bg-ink-800 text-ink-100'
                            }`}
                          >
                            {m.text}
                          </div>
                        )}
                        <div className={`mt-0.5 text-[10px] text-ink-400 ${mine ? 'text-right' : ''}`}>
                          {clockTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {allMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-ink-400">
                Say hello to {activeFriend.name.split(' ')[0]}
              </div>
            )}
          </div>

          {/* Media preview */}
          {mediaPreview && (
            <div className="border-t border-ink-700 p-2">
              <div className="relative inline-block">
                <img src={mediaPreview} alt="" className="h-20 rounded-lg object-cover" />
                <button
                  onClick={() => setMediaPreview(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-maroon-600 text-white"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 border-t border-ink-700 p-3">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-full p-2.5 text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200"
              title="Send photo"
            >
              <ImagePlus size={18} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              className="input flex-1"
            />
            <VoiceRecorder onSend={(voiceUrl) => state.sendMessage(activeThread.id, `[voice] ${voiceUrl}`)} />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={send}
              disabled={!draft.trim()}
              className="gold-btn px-3 py-2.5"
            >
              <Send size={16} />
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center p-8 md:flex">
          <EmptyState
            icon={<MessageCircle size={26} />}
            title="Select a conversation"
            subtitle="Pick a friend on the left to view your message history."
          />
        </div>
      )}
    </div>
  );
}

function VoiceRecorder({ onSend }: { onSend: (voiceUrl: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () => {
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (seconds > 0) {
      onSend(`Voice message (${seconds}s)`);
    }
    setSeconds(0);
  };

  if (recording) {
    return (
      <motion.button
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={stop}
        className="flex items-center gap-2 rounded-full bg-maroon-600/20 px-3 py-2.5 text-maroon-300"
      >
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-maroon-500" />
        <span className="font-mono text-xs">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
        <span className="text-xs">Stop</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={start}
      className="rounded-full p-2.5 text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200"
      title="Record voice message"
    >
      <Mic size={18} />
    </motion.button>
  );
}
