import { Menu, MessageCircle, Radio, Users, Languages } from 'lucide-react';
import { Avatar, Logo } from './ui';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { FeedView } from './FeedView';
import { ReelsView } from './ReelsView';
import { NetworkView } from './NetworkView';
import { MessengerView } from './MessengerView';
import { CalendarView } from './CalendarView';
import { AdminView } from './AdminView';
import { ProfileView } from './ProfileView';
import { GoLiveModal } from './GoLiveModal';
import { StreamViewer } from './StreamViewer';
import { VideoUploadModal } from './VideoUploadModal';
import { VideoCallModal } from './VideoCallModal';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/store/i18n';
import { useState } from 'react';

export function AppShell() {
  const { users, currentUserId } = useStore();
  const { view, setView, setGoLiveOpen, rightOpen, setRightOpen, uploadOpen, setUploadOpen, callPeerId, setCallPeerId, callGroupLabel } = useUI();
  const { lang, setLang } = useI18n();
  const me = users.find((u) => u.id === currentUserId);
  const [leftOpen, setLeftOpen] = useState(false);

  if (!me) return null;

  return (
    <div className="min-h-screen text-ink-100" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ borderBottom: '1px solid var(--border-base)', backgroundColor: 'color-mix(in srgb, var(--bg-base) 85%, transparent)' }}>
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-3 sm:px-4">
          <button
            onClick={() => setLeftOpen(true)}
            className="rounded-lg p-2 text-ink-300 hover:bg-ink-800 lg:hidden"
          >
            <Menu size={20} />
          </button>

          <button onClick={() => setView('feed')} className="hidden sm:block">
            <Logo size={32} withText />
          </button>
          <button onClick={() => setView('feed')} className="sm:hidden">
            <Logo size={32} />
          </button>

          <div className="flex-1" />

          {/* Mobile quick nav */}
          <div className="flex items-center gap-1 lg:hidden">
            <NavBtn active={view === 'feed'} onClick={() => setView('feed')} icon={<Radio size={18} />} />
            <NavBtn active={view === 'reels'} onClick={() => setView('reels')} icon={<MessageCircle size={18} />} />
            <NavBtn active={view === 'network'} onClick={() => setView('network')} icon={<Users size={18} />} />
          </div>

          {/* Language switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200"
            title={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'}
          >
            <Languages size={16} />
            {lang === 'en' ? 'EN' : 'ع'}
          </button>

          {/* Go Live in header */}
          <button
            onClick={() => setGoLiveOpen(true)}
            className="gold-btn hidden py-2 text-sm sm:flex"
          >
            <span className="flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 animate-ping rounded-full bg-red-500/70" />
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Go Live
          </button>
          <button
            onClick={() => setGoLiveOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white sm:hidden"
          >
            <Radio size={16} />
          </button>

          {/* Right panel toggle (mobile) */}
          <button
            onClick={() => setRightOpen(true)}
            className="hidden rounded-lg p-2 text-ink-300 hover:bg-ink-800 xl:hidden"
            title="Open chats & live"
          >
            <MessageCircle size={20} />
          </button>

          <button onClick={() => setView('profile')} className="ml-1">
            <Avatar src={me.photo} name={me.name} size={34} ring="gold" online />
          </button>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mx-auto flex max-w-[1500px] gap-0 px-0 lg:px-4 lg:py-4">
        {/* Left sidebar */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-[4.5rem] card !rounded-2xl">
            <LeftSidebar />
          </div>
        </div>

        {/* Middle content */}
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 lg:px-4">
          <div className="mx-auto max-w-2xl">
            {view === 'feed' && <FeedView />}
            {view === 'reels' && <ReelsView />}
            {view === 'network' && <NetworkView />}
            {view === 'messenger' && <MessengerView />}
            {view === 'calendar' && <CalendarView />}
            {view === 'admin' && <AdminView />}
            {view === 'profile' && <ProfileView />}
          </div>
        </main>

        {/* Right sidebar */}
        <div className="hidden w-80 shrink-0 xl:block">
          <div className="sticky top-[4.5rem]">
            <div className="card !rounded-2xl h-[calc(100vh-6rem)]">
              <RightSidebar />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile left drawer */}
      {leftOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setLeftOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] animate-slide-right border-r border-ink-700 bg-ink-900">
            <LeftSidebar onClose={() => setLeftOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile right drawer */}
      {rightOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setRightOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[90%] animate-slide-right border-l border-ink-700 bg-ink-900">
            <RightSidebar onClose={() => setRightOpen(false)} />
          </div>
        </div>
      )}

      {/* Global overlays */}
      <GoLiveModal />
      <StreamViewer />
      <VideoUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <VideoCallModal
        open={callPeerId !== null}
        onClose={() => setCallPeerId(null)}
        peerId={callPeerId ?? ''}
        groupLabel={callGroupLabel ?? undefined}
        isGroup={callGroupLabel !== null && !callGroupLabel.includes('call with')}
      />
    </div>
  );
}

function NavBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-2.5 transition-colors ${
        active ? 'bg-gold-400/15 text-gold-200' : 'text-ink-300 hover:bg-ink-800'
      }`}
    >
      {icon}
    </button>
  );
}
