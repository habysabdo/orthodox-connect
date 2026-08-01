import { Eye, MessageCircle, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore, connectedUsers, unreadCountFor, threadForUsers } from '@/store/context';
import { useUI } from '@/store/ui';
import { clockTime, liveDuration } from '@/utils/format';
import { userName } from '@/utils/postSafety';
import { useEffect, useState } from 'react';
import type { ChatMessage } from '@/types';

export function RightSidebar({ onClose }: { onClose?: () => void }) {
  const state = useStore();
  const { setView, setOpenStreamId, setOpenThreadId, setRightOpen } = useUI();
  const me = state.users.find((u) => u?.id === state.currentUserId);
  if (!me) return null;

  const activeStreams = state.streams.filter((s) => s?.active);
  // Anybody the member follows or is followed by can be messaged.
  const friends = connectedUsers(state);
  const unread = unreadCountFor(state, me.id);

  return (
    <aside className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Community</h3>
        {onClose && (
          <button onClick={onClose} className="ghost-btn p-1.5 lg:hidden">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Live Now */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <span className="flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-red-500/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-sm font-bold text-ink-100">Live Now</span>
          <span className="ml-auto text-xs text-ink-400">{activeStreams.length} active</span>
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {activeStreams.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-ink-400">
              No one is live right now. Be the first!
            </div>
          )}
          {activeStreams.map((s) => {
            const host = state.users.find((u) => u?.id === s.hostId);
            if (!host) return null;
            return (
              <button
                key={s.id}
                onClick={() => setOpenStreamId(s.id)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800"
              >
                <div className="relative">
                  <Avatar src={host.photo} name={host.name} size={40} ring="gold" />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-red-600 px-1 text-[8px] font-bold text-white">
                    LIVE
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink-100 group-hover:text-gold-200">
                    {s.title}
                  </div>
                  <div className="truncate text-xs text-ink-400">{userName(host)}</div>
                </div>
                <div className="flex flex-col items-end text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {s.viewers}
                  </span>
                  <Duration startedAt={s.startedAt} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Chats */}
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <MessageCircle size={16} className="text-gold-300" />
          <span className="text-sm font-bold text-ink-100">Active Chats</span>
          {unread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-[#17130a]">
              {unread}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {friends.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-ink-400">
              Follow people to start chatting.
            </div>
          )}
          {friends.map((f) => {
            const thread = threadForUsers(state, me.id, f.id);
            // A thread rebuilt from a cached payload may have no `messages` array.
            const messages = Array.isArray(thread?.messages) ? thread.messages : [];
            const last = messages[messages.length - 1];
            const lastUnread = messages.filter(
              (m: ChatMessage) => m.senderId !== me.id && !m.isRead,
            ).length;
            return (
              <button
                key={f.id}
                onClick={() => {
                  if (thread) {
                    setOpenThreadId(thread.id);
                    setView('messenger');
                  } else {
                    const id = state.openThreadWith(f.id);
                    setOpenThreadId(id);
                    setView('messenger');
                  }
                  setRightOpen(false);
                }}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800"
              >
                <Avatar src={f.photo} name={f.name} size={40} online={f.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-ink-100 group-hover:text-gold-200">
                      {userName(f)}
                    </div>
                    {last && <span className="shrink-0 text-[10px] text-ink-400">{clockTime(last.createdAt)}</span>}
                  </div>
                  <div className={`truncate text-xs ${lastUnread ? 'font-semibold text-gold-200' : 'text-ink-400'}`}>
                    {last ? (last.senderId === me.id ? 'You: ' : '') + (last.text ?? '') : 'Say hello 👋'}
                  </div>
                </div>
                {lastUnread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-[#17130a]">
                    {lastUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="border-t border-ink-700 p-2">
          <button
            onClick={() => {
              setView('messenger');
              setRightOpen(false);
            }}
            className="ghost-btn w-full py-2 text-xs"
          >
            See all in Messenger
          </button>
        </div>
      </div>

    </aside>
  );
}

function Duration({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-[10px] text-ink-400">{liveDuration(startedAt)}</span>;
}
