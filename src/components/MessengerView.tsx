import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { useStore, friendsOf, threadIdFor, unreadCountFor } from '@/store/context';
import type { ChatMessage } from '@/types';
import { useUI } from '@/store/ui';
import { clockTime, timeAgo } from '@/utils/format';

export function MessengerView() {
  const state = useStore();
  const { openThreadId, setOpenThreadId } = useUI();
  const me = state.users.find((u) => u.id === state.currentUserId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const friends = friendsOf(state, me?.id ?? '');
  const myThreads = state.threads.filter((t) => me && t.participantIds.includes(me.id));

  // Build a list of conversations: friends with a thread + friends without
  const conversations = friends.map((f) => {
    const tid = threadIdFor(me!.id, f.id);
    const thread = state.threads.find((t) => t.id === tid);
    const last = thread?.messages[thread.messages.length - 1];
    const unread = thread ? thread.messages.filter((m: ChatMessage) => m.senderId !== me!.id && !m.read).length : 0;
    return { friend: f, thread, last, unread, tid };
  }).sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

  const activeThread = openThreadId ? state.threads.find((t) => t.id === openThreadId) : undefined;
  const activeFriend = activeThread
    ? state.users.find((u) => u.id === activeThread.participantIds.find((id) => id !== me?.id))
    : undefined;

  useEffect(() => {
    if (activeThread) {
      state.markThreadRead(activeThread.id);
    }
  }, [activeThread?.id, activeThread?.messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeThread?.messages.length]);

  if (!me) return null;

  const send = () => {
    if (!draft.trim() || !activeThread) return;
    state.sendMessage(activeThread.id, draft.trim());
    setDraft('');
  };

  const openConv = (tid: string, friendId: string) => {
    if (!state.threads.some((t) => t.id === tid)) {
      const newId = state.openThreadWith(friendId);
      setOpenThreadId(newId);
    } else {
      setOpenThreadId(tid);
    }
  };

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
            conversations.map(({ friend, thread, last, unread, tid }) => (
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
                    {last ? (last.senderId === me.id ? 'You: ' : '') + last.text : 'Start the conversation'}
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
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
            <div className="mx-auto w-fit rounded-full bg-ink-800 px-3 py-1 text-[10px] text-ink-400">
              {activeFriend.parish}
            </div>
            {activeThread.messages.map((m: ChatMessage) => {
              const mine = m.senderId === me.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[75%] gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && <Avatar src={activeFriend.photo} name={activeFriend.name} size={28} />}
                    <div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? 'rounded-tr-sm bg-gradient-to-br from-gold-400 to-gold-500 text-ink-950'
                            : 'rounded-tl-sm bg-ink-800 text-ink-100'
                        }`}
                      >
                        {m.text}
                      </div>
                      <div className={`mt-0.5 text-[10px] text-ink-400 ${mine ? 'text-right' : ''}`}>
                        {clockTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeThread.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-ink-400">
                Say hello to {activeFriend.name.split(' ')[0]} 👋
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-ink-700 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message…"
              className="input flex-1"
            />
            <button onClick={send} disabled={!draft.trim()} className="gold-btn px-3 py-2.5">
              <Send size={16} />
            </button>
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
