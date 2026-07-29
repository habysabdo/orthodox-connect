import { useEffect, useRef, useState } from 'react';
import { Eye, Maximize2, Minimize2, Send, Users, X } from 'lucide-react';
import { Avatar } from './ui';
import { SimulatedCanvas } from './SimulatedCanvas';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { liveDuration } from '@/utils/format';

export function StreamViewer() {
  const state = useStore();
  const { openStreamId, setOpenStreamId } = useUI();
  const [draft, setDraft] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const me = state.users.find((u) => u.id === state.currentUserId);

  const stream = openStreamId ? state.streams.find((s) => s.id === openStreamId) : null;

  useEffect(() => {
    if (stream && me && !stream.viewerIds.includes(me.id)) {
      state.joinStream(stream.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStreamId]);

  useEffect(() => {
    return () => {
      if (stream && me) state.leaveStream(stream.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStreamId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [stream?.chat.length]);

  if (!stream || !me) return null;
  const host = state.users.find((u) => u.id === stream.hostId);
  if (!host) return null;

  const send = () => {
    if (!draft.trim()) return;
    state.sendLiveChat(stream.id, draft.trim());
    setDraft('');
  };

  const close = () => {
    state.leaveStream(stream.id);
    setOpenStreamId(null);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur animate-fade-in ${
        fullscreen ? '' : 'md:items-center md:justify-center md:p-6'
      }`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar src={host.photo} name={host.name} size={40} ring="gold" />
          <div>
            <div className="font-semibold text-white">{host.name}</div>
            <div className="text-xs text-white/60">{host.parish}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-live-blink rounded-full bg-white" /> LIVE
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white">
            <Eye size={13} /> {stream.viewers}
          </span>
          <DurationBadge startedAt={stream.startedAt} />
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={close} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className={`flex flex-1 flex-col md:flex-row ${fullscreen ? '' : 'md:max-h-[80vh]'}`}>
        {/* Video */}
        <div className="relative flex-1 bg-black">
          {stream.kind === 'user' && stream.hostId === me.id ? (
            <div className="flex h-full items-center justify-center text-white/60">
              <p className="text-sm">Your broadcast is live in the Go Live window.</p>
            </div>
          ) : (
            <SimulatedCanvas className="h-full w-full" />
          )}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="max-w-md">
              <div className="text-lg font-semibold text-white drop-shadow">{stream.title}</div>
            </div>
          </div>
        </div>

        {/* Live chat */}
        <div className="flex h-64 flex-col border-t border-white/10 bg-ink-900 md:h-auto md:w-80 md:border-l md:border-t-0">
          <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
            <Users size={16} className="text-gold-300" />
            <span className="text-sm font-bold text-ink-100">Live chat</span>
            <span className="ml-auto text-xs text-ink-400">{stream.chat.length} messages</span>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {stream.chat.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-400">Be the first to say something!</p>
            ) : (
              stream.chat.map((m) => {
                const s = state.users.find((u) => u.id === m.senderId);
                const mine = m.senderId === me.id;
                return (
                  <div key={m.id} className="mb-2.5 flex items-start gap-2">
                    <Avatar src={s?.photo ?? ''} name={s?.name ?? ''} size={24} />
                    <div className="min-w-0">
                      <span className={`text-xs font-semibold ${mine ? 'text-gold-300' : 'text-gold-200'}`}>
                        {s?.name?.split(' ')[0] ?? 'Someone'}
                      </span>{' '}
                      <span className="text-sm text-ink-100">{m.text}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-ink-700 p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Say something…"
              className="input flex-1"
            />
            <button onClick={send} disabled={!draft.trim()} className="gold-btn px-3 py-2.5">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DurationBadge({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden rounded-full bg-white/10 px-2.5 py-1 font-mono text-xs text-white sm:flex">
      {liveDuration(startedAt)}
    </span>
  );
}
