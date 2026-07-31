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
  Plus,
  Camera,
  Smile,
  PhoneCall,
} from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { ChatAudioPlayer } from './ChatAudioPlayer';
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
      <div className="group relative overflow-hidden rounded-2xl">
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
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-100 shadow backdrop-blur transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
          title={`Download ${attachment.name}`}
          aria-label={`Download ${attachment.name}`}
        >
          <Download size={15} aria-hidden="true" />
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
      className="flex min-w-52 items-center gap-3 rounded-2xl bg-black/5 dark:bg-white/10 px-3 py-2.5 hover:bg-black/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-current/10">
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
  if (!mine) return null;
  if (message.isRead) {
    return <CheckCheck size={14} className="text-blue-500" aria-hidden="true" />;
  }
  return <Check size={14} className="text-gray-400" aria-hidden="true" />;
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

  // Dynamic textarea height tracking
  useEffect(() => {
    const textarea = messageInputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 100;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
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
      <div className="card flex min-h-48 items-center justify-center px-6 text-center text-sm text-gray-400">
        Your messaging profile is loading...
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
      setComposerError('Voice recording is not supported.');
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
          setComposerError('No audio captured.');
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
      setComposerError('Microphone access denied.');
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
      setComposerError(error instanceof Error ? error.message : 'Unable to send message.');
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
    <div className="flex h-[calc(100vh-6rem)] bg-white dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* Conversations Left Sidebar */}
      <div className={`flex w-full flex-col border-r border-gray-200 dark:border-gray-800 md:w-80 ${activeThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="border-b border-gray-100 dark:border-gray-800 p-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            Chats
          </h1>
          <p className="mt-1 text-xs text-gray-500">{unreadCountFor(state, me.id)} unread</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No conversations yet.</div>
          ) : conversations.map(({ friend, last, unread, threadId }) => (
            <button
              key={friend.id}
              onClick={() => openConversation(threadId, friend.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
                openThreadId === threadId ? 'bg-gray-100 dark:bg-gray-800' : ''
              }`}
            >
              <Avatar src={userPhoto(friend)} name={userName(friend)} size={48} online={friend.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{userName(friend)}</span>
                  {last && <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(last.createdAt ?? 0)}</span>}
                </div>
                <div className={`truncate text-xs ${unread ? 'font-bold text-black dark:text-white' : 'text-gray-500'}`}>
                  {last ? `${last.senderId === me.id ? 'You: ' : ''}${messageSummary(last)}` : messageSummary()}
                </div>
              </div>
              {unread > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active Conversation Area */}
      {activeThread && activeFriend ? (
        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
          
          {/* Messenger Top Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpenThreadId(null)} className="p-1.5 md:hidden text-gray-600 dark:text-gray-300" aria-label="Back">
                <MessageCircle size={20} />
              </button>
              <Avatar src={userPhoto(activeFriend)} name={activeFriendName} size={40} online={activeFriend.online} />
              <div>
                <div className="font-semibold text-gray-900 dark:text-white text-base leading-tight">{activeFriendName}</div>
                <div className="text-xs text-gray-500">{activeFriend.online ? 'Active now' : 'Offline'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-black dark:text-white">
              <button onClick={startVideoCall} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                <Video size={22} />
              </button>
            </div>
          </div>

          {/* Messages Scroll View */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {activeMessages.map((message) => {
              const mine = message.senderId === me.id;
              const invite = decodeChatInvite(message.text);
              return (
                <div
                  key={message.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] sm:max-w-[70%] items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && <Avatar src={userPhoto(activeFriend)} name={activeFriendName} size={28} />}
                    
                    <div className="min-w-0">
                      {invite ? (
                        /* Messenger Call Card Design */
                        <div className="w-64 rounded-2xl bg-gray-100 dark:bg-gray-800 p-4 text-gray-900 dark:text-white shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-500 text-white">
                              <PhoneCall size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-sm">Video call</div>
                              <div className="text-xs text-gray-500">Live call invite</div>
                            </div>
                          </div>
                          <button
                            onClick={startVideoCall}
                            className="w-full rounded-xl bg-white dark:bg-gray-700 py-2 text-center text-sm font-semibold text-black dark:text-white shadow-sm transition hover:bg-gray-50"
                          >
                            Join call
                          </button>
                        </div>
                      ) : (
                        /* Message Bubble */
                        <div className={`rounded-2xl px-4 py-2 text-[15px] leading-relaxed ${
                          mine
                            ? 'bg-[#0084ff] text-white rounded-br-xs'
                            : 'bg-[#f0f0f0] dark:bg-gray-800 text-black dark:text-white rounded-bl-xs'
                        }`}>
                          {message.attachments?.map((attachment) => <MessageAttachment key={attachment.id} attachment={attachment} />)}
                          {message.text && <div className="whitespace-pre-wrap break-words">{message.text}</div>}
                        </div>
                      )}
                      
                      <div className={`mt-1 flex items-center gap-1 text-[10px] text-gray-400 ${mine ? 'justify-end' : 'justify-start'}`}>
                        <span>{clockTime(message.createdAt)}</span>
                        <MessageStatus message={message} mine={mine} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-gray-400">
                Say hello to {firstName(activeFriendName)}.
              </div>
            )}
          </div>

          {/* Messenger Authentic Input Toolbar */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 bg-white dark:bg-slate-950">
            {/* Attachment Previews */}
            {(pendingFiles.length > 0 || pendingVoice || recording) && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {pendingFiles.map((item) => (
                  <div key={item.id} className="relative flex h-16 min-w-32 max-w-48 items-center gap-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.file.name} className="h-full w-12 rounded-lg object-cover" />
                    ) : <FileIcon size={20} className="ml-1 shrink-0 text-blue-500" />}
                    <div className="min-w-0 pr-4">
                      <div className="truncate text-xs font-semibold">{item.file.name}</div>
                      <div className="text-[10px] text-gray-400">{formatBytes(item.file.size)}</div>
                    </div>
                    <button type="button" onClick={() => removePendingFile(item.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {recording && (
                  <div className="flex min-w-48 items-center gap-3 rounded-full bg-red-50 dark:bg-red-950 px-4 py-2 text-red-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                    <span className="flex-1 text-xs font-bold">Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                    <button type="button" onClick={() => finishRecording(false)} className="p-1 hover:bg-red-100 rounded-full"><Square size={14} fill="currentColor" /></button>
                    <button type="button" onClick={() => finishRecording(true)} className="p-1 hover:bg-red-100 rounded-full"><Trash2 size={14} /></button>
                  </div>
                )}
                {pendingVoice && !recording && (
                  <div className="relative min-w-56 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 pr-8">
                    <ChatAudioPlayer src={pendingVoice.previewUrl} duration={pendingVoice.duration} />
                    <button type="button" onClick={removeVoice} className="absolute right-2 top-2 rounded-full bg-black/60 p-0.5 text-white">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {composerError && <div className="mb-2 text-xs text-red-500">{composerError}</div>}

            <div className="flex items-center gap-2 w-full">
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'image'); event.target.value = ''; }} />
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, 'file'); event.target.value = ''; }} />

              {/* Left Side Icons (Bare Messenger Style) */}
              <div className="flex items-center gap-1 shrink-0 text-black dark:text-white">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition" title="More">
                  <Plus size={22} />
                </button>
                <button type="button" onClick={() => photoInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition" title="Camera">
                  <Camera size={22} />
                </button>
                <button type="button" onClick={() => photoInputRef.current?.click()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition" title="Gallery">
                  <Image size={22} />
                </button>
                <button type="button" onClick={recording ? () => finishRecording(false) : startRecording} className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition ${recording ? 'text-red-500' : ''}`} title="Voice">
                  <Mic size={22} />
                </button>
              </div>

              {/* Middle Grey Rounded Text Pill */}
              <div className="flex-1 min-w-0 flex items-center bg-[#f0f2f5] dark:bg-gray-800 rounded-full px-4 py-1.5">
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
                  placeholder="Message"
                  disabled={recording || uploading}
                  className="w-full resize-none bg-transparent text-[15px] text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                  style={{ maxHeight: '100px' }}
                />
                <button type="button" className="p-1 text-black dark:text-white shrink-0 hover:opacity-70 transition">
                  <Smile size={20} />
                </button>
              </div>

              {/* Right Side Action (Send / Thumbs Up) */}
              <div className="shrink-0">
                {draft.trim() || pendingFiles.length > 0 || pendingVoice ? (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={uploading || recording}
                    className="p-1.5 text-[#0084ff] hover:opacity-80 transition disabled:opacity-50"
                  >
                    <Send size={22} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={sendLike}
                    disabled={uploading || recording}
                    className="p-1.5 text-black dark:text-white hover:opacity-80 transition"
                  >
                    <ThumbsUp size={24} fill="currentColor" />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center p-8 md:flex">
          <EmptyState icon={<MessageCircle size={28} />} title="Select a conversation" subtitle="Pick a chat from the left list to begin messaging." />
        </div>
      )}
    </div>
  );
}
