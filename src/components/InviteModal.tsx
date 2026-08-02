import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, MessageCircle, Share2, UserPlus, Check, Loader2, Link2 } from 'lucide-react';
import { Modal, Avatar } from './ui';
import { useAuth } from '@/store/auth';
import { useToast } from './Toast';

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || 'https://orthodoxconnect.live';

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  const inviteLink = useMemo(() => {
    if (!profile?.id) return APP_DOMAIN;
    return `${APP_DOMAIN}/invite?ref=${profile.id}`;
  }, [profile?.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      notify('success', 'Invite link copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('error', 'Could not copy link. Please copy it manually.');
    }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `You're invited to join OrthodoxConnect — a private social network for the Orthodox faithful. ${inviteLink}`,
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    notify('success', 'Opening WhatsApp to share your invite link.');
  };

  const handleSMS = () => {
    const msg = encodeURIComponent(
      `Join me on OrthodoxConnect! ${inviteLink}`,
    );
    window.open(`sms:?body=${msg}`, '_blank');
    notify('success', 'Opening your messaging app.');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OrthodoxConnect',
          text: `Join me on OrthodoxConnect — a private social network for the Orthodox faithful.`,
          url: inviteLink,
        });
        notify('success', 'Invite link shared.');
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  if (!profile) return null;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
            <UserPlus size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold">Invite Friends</h2>
            <p className="text-xs text-ink-400">Share OrthodoxConnect with your parish community.</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="mt-5 flex flex-col items-center">
          <div className="rounded-2xl border border-ink-600 bg-white p-4 shadow-lg">
            <QRCodeSVG
              value={inviteLink}
              size={180}
              level="M"
              bgColor="#ffffff"
              fgColor="#0a0c12"
            />
          </div>
          <p className="mt-3 text-center text-xs text-ink-400">
            Scan to join OrthodoxConnect
          </p>
        </div>

        {/* Invite link display */}
        <div className="mt-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">
            Your invite link
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/60 p-2">
            <Link2 size={14} className="ml-1 shrink-0 text-ink-400" />
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent text-xs text-ink-200 outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-gold-400/15 text-gold-200 hover:bg-gold-400/25'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850/60 py-3 text-xs font-medium text-ink-200 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            <MessageCircle size={18} />
            WhatsApp
          </button>
          <button
            onClick={handleSMS}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850/60 py-3 text-xs font-medium text-ink-200 transition-all hover:border-gold-400/40 hover:bg-gold-400/10 hover:text-gold-200"
          >
            <Share2 size={18} />
            SMS
          </button>
          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-850/60 py-3 text-xs font-medium text-ink-200 transition-all hover:border-gold-400/40 hover:bg-gold-400/10 hover:text-gold-200"
          >
            <Share2 size={18} />
            More...
          </button>
        </div>

        {/* Inviter identity */}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-3">
          <Avatar src={profile.photo_url} name={profile.display_name} size={36} ring="gold" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink-100">{profile.display_name}</div>
            <div className="truncate text-xs text-ink-400">
              {profile.parish || 'No parish set'}
            </div>
          </div>
          <span className="chip text-[10px]">Referrer</span>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="ghost-btn py-2">Close</button>
        </div>
      </div>
    </Modal>
  );
}
