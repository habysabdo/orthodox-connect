import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Download,
  File as FileIcon,
  Image,
  MessageCircle,
  Mic,
  Paperclip,
  Send,
  Square,
  ThumbsUp,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import { MeetingInviteCard } from './MeetingInviteCard';
import { useStore, friendsOf, threadIdFor, unreadCountFor } from '@/store/context';
import type { ChatAttachment, ChatMessage, User } from '@/types';
import { useUI } from '@/store/ui';
import { clockTime, timeAgo } from '@/utils/format';
import { firstName, userName, userPhoto } from '@/utils/postSafety';
import { uploadChatAttachment } from '@/utils/chatMedia';
import { createMeetingId, decodeChatInvite, encodeChatInvite } from '@/utils/meetings';

interface PendingFile {
  id: string;
  file: File;
  kind: 'image' | 'file';
  previewUrl?: string;
}

interface PendingVoice {
  blob: Blob;
  previewUrl: string;
  duration: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function messageSummary(message?: ChatMessage): string {
  if (!message) return 'Start the conversation';
  const invite = decodeChatInvite(message.text);
  if (invite) return `📹 ${invite.title}`;
  if (message.text) return message.text;
  const attachment = message.attachments?.[0];
  if (attachment?.kind === 'image') return 'Sent a photo';
  if (attachment?.kind === 'audio') return 'Sent a voice note';
  return attachment ? `Sent ${attachment.name}` : 'Sent a message';
}

async function handleDownloadPhoto(photoUrl: string, fileName?: string): Promise<void> {
  try {
    const response = await fetch(photoUrl);
    if (!response.ok) throw new Error(`Photo request failed with status ${response.status}`);

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = blobUrl;
    link.download = fileName || 'download.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Photo download failed:', error);
  }
}

function MessageAttachment({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === 'image') {
    return (
      <div className="group relative overflow-hidden rounded-xl">
        <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={attachment.url}
            alt={attachment.name}
            loading="lazy"
            className="max-h-80 w-full min-w-48 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </a>
        <button
          type="button"
          onClick={() => void handleDownloadPhoto(attachment.url, attachment.name)}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/80 text-white opacity-100 shadow-lg backdrop-blur transition hover:bg-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          title={`Download ${attachment.name}`}
          aria-label={`Download ${attachment.name}`}
        >
          <Download size={17} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (attachment.kind === 'audio') {
    return <ChatAudioPlayer src={attachment.url} duration={attachment.duration} />;
  }

  return (
    <a
      href={`${attachment.url}&download=1`}
      className="flex min-w-52 items-center gap-3 rounded-xl bg-black/10 px-3 py-2.5 hover:bg-black/15"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-current/10">
        <FileIcon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{attachment.name}</span>
        <span className="block text-[10px] opacity-70">{formatBytes(attachment.size)}</span>
      </span>
      <Download size={16} className="shrink-0" />
    </a>
  );
}

function MessageStatus({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (!mine) {
    return <span>{message.isRead ? 'Read' : 'Unread'}</span>;
  }

  if (message.isRead) {
    return (
      <span className="inline-flex items-center gap-1 text-sky-300">
        <CheckCheck size={12} aria-hidden="true" />
        {message.readAt ? `Read at ${clockTime(message.readAt)}` : 'Read'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Check size={12} aria-hidden="true" /> Sent
    </span>
  );
}

export function MessengerView() {
  const state = useStore();
  const { openThreadId, setOpenThreadId, openMeeting } = useUI();
  const me = state.users.find((user) => user.id === state.currentUserId);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingVoice, setPendingVoice] = useState<PendingVoice | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const pendingFilesRef = useRef<PendingFile[]>([]);
  const pendingVoiceRef = useRef<PendingVoice | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingSecondsRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  pendingFilesRef.current = pendingFiles;
  pendingVoiceRef.current = pendingVoice;

  const friends = friendsOf(state, me?.id ?? '');
  const myThreads = state.threads.filter((thread) => me && thread?.participantIds?.includes(me.id));
  const partnerIds = new Set<string>();
  friends.forEach((friend) => partnerIds.add(friend.id));
  myThreads.forEach((thread) => {
    const other = thread?.participantIds?.find((id) => id !== me?.id);
    if (other) partnerIds.add(other);
  });

  const conversations = me
    ? Array.from(partnerIds)
      .map((partnerId) => state.users.find((user) => user?.id === partnerId))
      .filter((user): user is User => Boolean(user))
      .map((friend) => {
        const threadId = threadIdFor(me.id, friend.id);
        const thread = state.threads.find((candidate) => candidate?.id === threadId);
        const messages = Array.isArray(thread?.messages) ? thread.messages : [];
        const last = messages[messages.length - 1];
        const unread = messages.filter((message) => message.senderId !== me.id && !message.isRead).length;
        return { friend, thread, last, unread, threadId };
      })
      .sort((left, right) => (right.last?.createdAt ?? 0) - (left.last?.createdAt ?? 0))
    : [];

  const activeThread = openThreadId ? state.threads.find((thread) => thread?.id === openThreadId) : undefined;
  const activeThreadId = activeThread?.id;
  const activeThreadMessageCount = activeThread?.messages?.length;
  const markThreadRead = state.markThreadRead;
  const activeFriend = activeThread
    ? state.users.find((user) => user?.id === activeThread.participantIds?.find((id) => id !== me?.id))
    : undefined;
  const activeMessages = Array.isArray(activeThread?.messages) ? activeThread.messages : [];
  const activeFriendName = userName(activeFriend);

  useEffect(() => {
    if (!activeThreadId) return;
    const markWhenVisible = () => {
      if (document.visibilityState === 'visible') markThreadRead(activeThreadId);
    };
    markWhenVisible();
    window.addEventListener('focus', markWhenVisible);
    document.addEventListener('visibilitychange', markWhenVisible);
    return () => {
      window.removeEventListener('focus', markWhenVisible);
      document.removeEventListener('visibilitychange', markWhenVisible);
    };
  }, [activeThreadId, activeThreadMessageCount, markThreadRead]);

  // Handle textarea height dynamically
  useEffect(() => {
    const textarea = messageInputRef.current;
    if (!textarea) return;
    textarea.style.height = '42px';
    const maxHeight = 120;
    if (textarea.scrollHeight > 42) {
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [draft]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeThread?.messages?.length]);

  useEffect(() => () => {
    pendingFilesRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    if (pendingVoiceRef.current) URL.revokeObjectURL(pendingVoiceRef.current.previewUrl);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
  }, []);

  if (!me) {
    return (
      <div className="card flex min-h-48 items-center justify-center px-6 text-center text-sm text-ink-400">
        Your messaging profile is still loading. Please try again in a moment.
      </div>
    );
  }

  const addFiles = (files: FileList | null, kind: 'image' | 'file') => {
    if (!files?.length) return;
    setComposerError('');
    const additions = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      kind,
      ...(kind === 'image' ? { previewUrl: URL.createObjectURL(file) } : {}),
    }));
    setPendingFiles((current) => [...current, ...additions]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setComposerError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      setComposerError('');
      if (pendingVoice) URL.revokeObjectURL(pendingVoice.previewUrl);
      setPendingVoice(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopStream();
        setRecording(false);
        if (discardRecordingRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setComposerError('No audio was captured. Please try again.');
          return;
        }
        setPendingVoice({
          blob,
          previewUrl: URL.createObjectURL(blob),
          duration: Math.max(1, recordingSecondsRef.current),
        });
      };
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (error) {
      stopStream();
      setComposerError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone access was denied.'
        : 'Unable to start voice recording.');
    }
  };

  const finishRecording = (discard = false) => {
    discardRecordingRef.current = discard;
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  const removeVoice = () => {
    if (recording) {
      finishRecording(true);
      return;
    }
    if (pendingVoice) URL.revokeObjectURL(pendingVoice.previewUrl);
    setPendingVoice(null);
  };

  const clearPending = () => {
    pendingFiles.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    if (pendingVoice) URL.revokeObjectURL(pendingVoice.previewUrl);
    setPendingFiles([]);
    setPendingVoice(null);
  };

  const send = async () => {
    if (!activeThread || uploading || recording) return;
    if (!draft.trim() && pendingFiles.length === 0 && !pendingVoice) return;
    setUploading(true);
    setComposerError('');
    try {
      const uploaded = await Promise.all([
        ...pendingFiles.map((item) => uploadChatAttachment(item.file, {
          threadId: activeThread.id,
          kind: item.kind,
          name: item.file.name,
        })),
        ...(pendingVoice ? [uploadChatAttachment(pendingVoice.blob, {
          threadId: activeThread.id,
          kind: 'audio' as const,
          name: `voice-note-${Date.now()}.${pendingVoice.blob.type.includes('mp4') ? 'm4a' : 'webm'}`,
          duration: pendingVoice.duration,
        })] : []),
      ]);
      state.sendMessage(activeThread.id, draft.trim(), uploaded);
      setDraft('');
      clearPending();
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : 'Unable to send attachments.');
    } finally {
      setUploading(false);
    }
  };

  const sendLike = () => {
    if (!activeThread || uploading || recording) return;
    state.sendMessage(activeThread.id, '👍');
  };

  const startVideoCall = () => {
    if (!activeThread || uploading || recording) return;
    const roomId = createMeetingId();
    const title = me ? `Video call with ${me.name}` : 'Video call';
    state.sendMessage(activeThread.id, encodeChatInvite({ roomId, title, hostId: me?.id, startedAt: Date.now() }));
    openMeeting(roomId, title);
  };

  const openConversation = (threadId: string, friendId: string) => {
    if (!state.threads.some((thread) => thread.id === threadId)) setOpenThreadId(state.openThreadWith(friendId));
    else setOpenThreadId(threadId);
  };

  return (
    <div className="card flex h-[calc(100vh-7rem)] overflow-hidden">
      {/* Sidebar / Left panel */}
      <div className={`flex w-full flex-col border-r border-ink-700 md:w-80 ${activeThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="border-b border-ink-700 p-4">
          <h1 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <MessageCircle size={20} className="text-gold-300" /> Messages
          </h1>
          <p className="mt-1 text-xs text-ink-400">{unreadCountFor(state, me.id)} unread</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-400">No conversations yet. Add friends to start messaging.</div>
          ) : conversations.map(({ friend, last, unread, threadId }) => (
            <button
              key={friend.id}
              onClick={() => openConversation(threadId, friend.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800 ${
                openThreadId === threadId ? 'bg-ink-800 shadow-[inset_3px_0_0_0_#d4af37]' : ''
              }`}
            >
              <Avatar src={userPhoto(friend)} name={userName(friend)} size={44} online={friend.online} ring="gold" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-100">{userName(friend)}</span>
                  {last && <span className="shrink-0 text-[10px] text-ink-400">{timeAgo(last.createdAt ?? 0)}</span>}
                </div>
                <div className={`truncate text-xs ${unread ? 'font-semibold text-gold-200' : 'text-ink-400'}`}>
                  {last ? `${last.senderId === me.id ? 'You: ' : ''}${messageSummary(last)}` : messageSummary()}
                </div>
              </div>
              {unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-[#17130a]">{unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area / Right panel */}
      {activeThread && activeFriend ? (
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-ink-700 p-3">
            <button onClick={() => setOpenThreadId(null)} className="ghost-btn p-2 md:hidden" aria-label="Back to conversations">
              <MessageCircle size={16} />
            </button>
            <Avatar src={userPhoto(activeFriend)} name={activeFriendName} size={40} online={activeFriend.online} ring="gold" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink-100">{activeFriendName}</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${activeFriend.online ? 'bg-emerald-400' : 'bg-ink-400'}`} />
                <span className={activeFriend.online ? 'text-emerald-300' : 'text-ink-400'}>{activeFriend.online ? 'Active now' : 'Offline'}</span>
              </div>
            </div>
          </div>

          {/* Messages list */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
            {activeFriend.parish && (
              <div className="mx-auto w-fit rounded-full bg-ink-800 px-3 py-1 text-[10px] text-ink-400">{activeFriend.parish}</div>
            )}
            {activeMessages.map((message) => {
              const mine = message.senderId === me.id;
              const invite = decodeChatInvite(message.text);
              return (
                <div
                  key={message.id}
                  data-unread={!mine && !message.isRead ? 'true' : undefined}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[82%] gap-2 sm:max-w-[75%] ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && <Avatar src={userPhoto(activeFriend)} name={activeFriendName} size={28} />}
                    <div className="min-w-0">
                      {invite ? (
                        <MeetingInviteCard
                          roomId={invite.roomId}
                          title={invite.title}
                          variant="chat"
                          note={mine ? 'You started this call' : `${activeFriendName} started a call`}
                        />
                      ) : (
                        <div className={`space-y-2 rounded-2xl p-2.5 text-sm ${
                          mine
                            ? 'rounded-tr-sm bg-gradient-to-br from-gold-400 to-gold-500 text-[#17130a]'
                            : 'rounded-tl-sm bg-ink-800 text-ink-100'
                        }`}>
                          {message.attachments?.map((attachment) => <MessageAttachment key={attachment.id} attachment={attachment} />)}
                          {message.text && <div className="px-1 py-0.5 whitespace-pre-wrap break-words">{message.text}</div>}
                        </div>
                      )}
                      <div className={`mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-400 ${mine ? 'justify-end text-right' : ''}`}>
                        <span>{clockTime(message.createdAt)}</span>
                        <span aria-label={message.isRead ? 'Message read' : mine ? 'Message sent' : 'Message unread'}>
                          <MessageStatus message={message} mine={mine} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-ink-400">Say hello to {firstName(activeFriendName)}.</div>
            )}
          </div>

          {/* Footer / Input area */}
          <div className="border-t border-ink-700 bg-ink-850/95 p-3 flex flex-col gap-2">
            {(pendingFiles.length > 0 || pendingVoice || recording) && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {pendingFiles.map((item) => (
                  <div key={item.id} className="relative flex h-20 min-w-36 max-w-52 items-center gap-2 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 p-2">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.file.name} className="h-full w-16 rounded-lg object-cover" />
                    ) : <FileIcon size={24} className="ml-2 shrink-0 text-gold-300" />}
                    <div className="min-w-0 pr-5">
                      <div className="truncate text-xs font-semibold text-ink-100">{item.file.name}</div>
                      <div className="text-[10px] text-ink-400">{formatBytes(item.file.size)}</div>
                    </div>
                    <button type="button" onClick={() => removePendingFile(item.id)} className="absolute right-1 top-1 rounded-full bg-ink-950/80 p-1 text-ink-300 hover:text-red-300" aria-label={`Remove ${item.file.name}`}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {recording && (
                  <div className="flex min-w-60 items-center gap-3 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-red-200">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" />
                    <span className="flex-1 text-sm font-semibold">Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                    <button type="button" onClick={() => finishRecording(false)} className="rounded-lg bg-red-400/15 p-2 hover:bg-red-400/25" aria-label="Stop recording"><Square size={15} fill="currentColor" /></button>
                    <button type="button" onClick={() => finishRecording(true)} className="rounded-lg p-2 hover:bg-red-400/15" aria-label="Cancel recording"><Trash2 size={15} /></button>
                  </div>
                )}
                {pendingVoice && !recording && (
                  <div className="relative min-w-64 rounded-xl border border-ink-600 bg-ink-800 p-2 pr-9 text-ink-100">
                    <ChatAudioPlayer src={pendingVoice.previewUrl} duration={pendingVoice.duration} />
                    <button type="button" onClick={removeVoice} className="absolute right-1 top-1 rounded-full bg-ink-950/80 p-1 text-ink-300 hover:text-red-300" aria-label="Remove voice note"><X size={12} /></button>
                  </div>
                )}
              </div>
            )}
            {composerError && <div className="text-xs text-red-300">{composerError}</div>}
            
           {/* 1. TOP ROW: Full-Width Text Input Box */}
            <div style={{ width: '100%', display: 'block' }}>
              <textarea
                ref={messageInputRef}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={recording ? 'Recording voice note…' : 'Type a message…'}
                disabled={recording || uploading}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  maxHeight: '120px',
                  resize: 'none',
                  writingMode: 'horizontal-tb',
                  display: 'block',
                  boxSizing: 'border-box'
                }}
                className="rounded-xl border border-ink-600 bg-ink-800/80 px-4 py-2.5 text-sm text-ink-100 placeholder-ink-400 outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 disabled:opacity-50"
              />
            </div>

            {/* 2. BOTTOM ROW: Action Buttons & Send */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '8px' }}>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'image'); event.target.value = ''; }} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'file'); event.target.value = ''; }} />
              
              {/* Media Buttons */}
              <div className="flex items-center gap-1 rounded-xl border border-ink-600 bg-ink-800/60 p-1">
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading || recording} className="rounded-lg p-2 text-ink-300 hover:bg-ink-700 hover:text-gold-200 disabled:opacity-40" title="Add photos" aria-label="Add photos"><Image size={17} /></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || recording} className="rounded-lg p-2 text-ink-300 hover:bg-ink-700 hover:text-gold-200 disabled:opacity-40" title="Attach files" aria-label="Attach files"><Paperclip size={17} /></button>
                <button type="button" onClick={recording ? () => finishRecording(false) : startRecording} disabled={uploading} className={`rounded-lg p-2 hover:bg-ink-700 disabled:opacity-40 ${recording ? 'text-red-300' : 'text-ink-300 hover:text-gold-200'}`} title={recording ? 'Stop recording' : 'Record voice note'} aria-label={recording ? 'Stop recording' : 'Record voice note'}><Mic size={17} /></button>
                <button type="button" onClick={startVideoCall} disabled={uploading || recording} className="rounded-lg p-2 text-ink-300 hover:bg-ink-700 hover:text-gold-200 disabled:opacity-40" title="Start a video call" aria-label="Start a video call"><Video size={17} /></button>
                <button type="button" onClick={sendLike} disabled={uploading || recording} className="rounded-lg p-2 text-ink-300 hover:bg-ink-700 hover:text-gold-200 disabled:opacity-40" title="Send a like" aria-label="Send a like"><ThumbsUp size={17} /></button>
              </div>

              {/* Send Button */}
              <button 
                type="button"
                onClick={() => void send()} 
                disabled={uploading || recording || (!draft.trim() && pendingFiles.length === 0 && !pendingVoice)} 
                className="gold-btn px-4 py-2 shrink-0 flex items-center justify-center gap-1.5 rounded-xl" 
                aria-label="Send message"
              >
                <Send size={16} />
                <span>{uploading ? 'Uploading' : 'Send'}</span>
              </button>
            </div>
