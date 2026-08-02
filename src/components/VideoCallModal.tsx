import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hand,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  ScreenShare,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { Avatar } from './ui';
import { useStore } from '@/store/context';

interface VideoCallModalProps {
  open: boolean;
  onClose: () => void;
  /** user id of the person being called (1-on-1) */
  peerId: string;
  /** group call label */
  groupLabel?: string;
  /** if true, render a group room with multiple simulated participants */
  isGroup?: boolean;
}

interface Participant {
  id: string;
  name: string;
  photo: string;
  online: boolean;
  muted: boolean;
  camOn: boolean;
  handRaised: boolean;
  isMe?: boolean;
}

export function VideoCallModal({ open, onClose, peerId, groupLabel, isGroup }: VideoCallModalProps) {
  const { users } = useStore();
  const peer = users.find((u) => u.id === peerId);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Build participant list
  const participants: Participant[] = isGroup
    ? (() => {
        const groupMembers = users.filter((u) => u.online && u.id !== peerId).slice(0, 5);
        return [
          { ...users[0], online: true, muted: false, camOn: true, handRaised: false, isMe: true } as Participant,
          ...groupMembers.map((u, i) => ({
            id: u.id,
            name: u.name,
            photo: u.photo,
            online: true,
            muted: i % 2 === 0,
            camOn: i % 3 === 0,
            handRaised: i === 2,
          })),
        ];
      })()
    : peer
      ? [
          { id: peer.id, name: peer.name, photo: peer.photo, online: peer.online, muted: false, camOn: false, handRaised: false },
          { id: 'me', name: 'You', photo: '', online: true, muted: !micOn, camOn, handRaised, isMe: true },
        ]
      : [];

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [open]);

  // Simulate active speaker rotation for group calls
  useEffect(() => {
    if (!open || !isGroup) return;
    const speakerTimer = setInterval(() => {
      const speakers = participants.filter((p) => !p.muted);
      if (speakers.length > 0) {
        setActiveSpeaker(speakers[Math.floor(Math.random() * speakers.length)].id);
      }
    }, 3000);
    return () => clearInterval(speakerTimer);
  }, [open, isGroup, participants.length]);

  // Try to access webcam when cam is turned on
  useEffect(() => {
    if (!open) return;
    if (camOn) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {});
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [camOn, open]);

  if (!open || (!peer && !isGroup)) return null;

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const gridCols = participants.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-ink-950"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-sm font-semibold text-ink-100">
            {groupLabel ?? `Call with ${peer?.name ?? 'User'}`}
          </span>
          <span className="font-mono text-xs text-ink-400">{fmtTime(seconds)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Users size={14} /> {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Video grid */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className={`grid h-full w-full max-w-4xl gap-3 ${gridCols}`}>
          {participants.map((p) => {
            const isActiveSpeaker = isGroup && activeSpeaker === p.id;
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`relative overflow-hidden rounded-2xl border bg-ink-900 transition-all ${
                  isActiveSpeaker
                    ? 'border-gold-400 shadow-glow ring-2 ring-gold-400/30'
                    : 'border-ink-700'
                }`}
              >
                {/* Participant video/avatar */}
                {p.isMe && camOn && videoRef.current ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : p.camOn && !p.isMe ? (
                  <img
                    src={p.photo}
                    alt=""
                    className="h-full w-full object-cover opacity-50"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Avatar src={p.photo} name={p.name} size={isGroup ? 56 : 80} ring="gold" />
                  </div>
                )}

                {/* Name + indicators */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                  <span className="rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                    {p.isMe ? 'You' : p.name}
                  </span>
                  {p.muted && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-maroon-600/80">
                      <MicOff size={11} className="text-white" />
                    </span>
                  )}
                  {p.handRaised && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-400/80">
                      <Hand size={11} className="text-ink-950" />
                    </span>
                  )}
                </div>

                {/* Active speaker badge */}
                {isActiveSpeaker && (
                  <div className="absolute right-2 top-2">
                    <span className="rounded-full bg-gold-400/90 px-2 py-0.5 text-[10px] font-bold text-ink-950">
                      Speaking
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4">
        <ControlButton
          active={micOn}
          onClick={() => setMicOn((v) => !v)}
          icon={micOn ? <Mic size={22} /> : <MicOff size={22} />}
          label={micOn ? 'Mute' : 'Unmute'}
        />
        <ControlButton
          active={camOn}
          onClick={() => setCamOn((v) => !v)}
          icon={camOn ? <Video size={22} /> : <VideoOff size={22} />}
          label={camOn ? 'Stop video' : 'Start video'}
        />
        <ControlButton
          active={screenShare}
          onClick={() => setScreenShare((v) => !v)}
          icon={screenShare ? <MonitorUp size={22} /> : <ScreenShare size={22} />}
          label="Share"
        />
        <ControlButton
          active={handRaised}
          onClick={() => setHandRaised((v) => !v)}
          icon={<Hand size={22} />}
          label="Raise hand"
          accent="gold"
        />
        <button
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-maroon-600 text-white shadow-lg transition-all hover:bg-maroon-500 active:scale-95"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </motion.div>
  );
}

function ControlButton({
  active,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent?: 'gold';
}) {
  const baseActive = accent === 'gold'
    ? 'bg-gold-400/20 text-gold-300 border-gold-400/40'
    : 'bg-ink-700 text-ink-100 border-ink-600';
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 transition-all active:scale-95 ${
        active ? baseActive : 'border-ink-700 bg-ink-800 text-ink-400'
      }`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
