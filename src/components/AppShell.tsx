import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  Menu,
  MessageCircle,
  Search,
  Shield,
  UserCircle,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Avatar, FeedSkeleton, Logo } from './ui';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { GoLiveModal } from './GoLiveModal';
import { ShareModal } from './ShareModal';
import { LikesModal } from './LikesModal';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { FeedView } from './FeedView';
import { ReelsView } from './ReelsView';
import { MessengerView } from './MessengerView';
import { CalendarView } from './CalendarView';
import { GroupsView } from './GroupsView';
import { GroupFeedView } from './GroupFeedView';
import { ProfileView } from './ProfileView';
import { AdminView } from './AdminView';
import { MeetingView } from './MeetingView';
import { StreamViewer } from './StreamViewer';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/i18n';
import { hasAdminAccess } from '@/utils/users';

export function AppShell() {
  const state = useStore();
  const { users, currentUserId } = state;
  const {
    view,
    setView,
    groupRouteId,
    goLiveOpen,
    setGoLiveOpen,
    setPrayerMeetingOpen,
    prayerMeetingOpen,
    openStreamId,
    shareOpen,
    likesModalPost,
  } = useUI();
  const { t } = useI18n();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const me = users.find((u) => u?.id === currentUserId);

  // Close search dropdown on tap outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Real-time Facebook-style search filter
  const trimmed = searchQuery.trim().toLowerCase();
  const matchingUsers = trimmed
    ? users.filter(
        (u) =>
          u?.name?.toLowerCase().includes(trimmed) ||
          (u?.parish && u.parish.toLowerCase().includes(trimmed))
      )
    : [];

  const handleSelectUser = (userId: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setView('profile');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-ink-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-ink-700/60 bg-ink-900/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ghost-btn p-2 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>
          <Logo size={32} withText />
        </div>

        {/* Facebook-Style Search Input & Floating Dropdown */}
        <div ref={searchContainerRef} className="relative w-full max-w-md px-2">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="SEARCH PEOPLE, CHURCHES, GROUPS..."
              className="w-full rounded-full border border-ink-700 bg-ink-850 py-2 pl-10 pr-9 text-xs tracking-wider uppercase text-ink-100 placeholder-ink-400 outline-none transition-all focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                className="absolute right-3 rounded-full p-1 text-ink-400 hover:bg-ink-750 hover:text-ink-100"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Floating Dropdown Results (Non-Blocking) */}
          {searchOpen && trimmed.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 z-50">
              {matchingUsers.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-400">
                    People & Parishes
                  </div>
                  {matchingUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-ink-750"
                    >
                      <Avatar src={u.photo} name={u.name} size={36} ring="gold" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink-100">{u.name}</div>
                        <div className="truncate text-xs text-ink-400">{u.parish || 'Orthodox Member'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-ink-400">
                  No matches found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrayerMeetingOpen(true)}
            className="ghost-btn hidden sm:flex !py-2 !px-3 text-xs"
          >
            <Video size={16} />
            <span>Prayer Meeting</span>
          </button>
        </div>
      </header>

      {/* Main App Workspace */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Desktop Left Sidebar */}
        <div className="hidden lg:block w-72 shrink-0 border-r border-ink-700/60 bg-ink-900/40">
          <LeftSidebar />
        </div>

        {/* Mobile Slideout Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex w-80 max-w-[85vw] flex-col bg-ink-900 shadow-2xl">
              <LeftSidebar onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Center Main Route Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {view === 'feed' && <FeedView />}
          {view === 'reels' && <ReelsView />}
          {view === 'messenger' && <MessengerView />}
          {view === 'calendar' && <CalendarView />}
          {view === 'groups' && (groupRouteId ? <GroupFeedView groupId={groupRouteId} /> : <GroupsView />)}
          {view === 'profile' && <ProfileView />}
          {view === 'admin' && me && hasAdminAccess(me) && <AdminView />}
        </main>

        {/* Desktop Right Sidebar */}
        <div className="hidden xl:block w-80 shrink-0 border-l border-ink-700/60 bg-ink-900/40">
          <RightSidebar />
        </div>
      </div>

      {/* Modals & Overlays */}
      {goLiveOpen && <GoLiveModal />}
      {shareOpen && <ShareModal />}
      {likesModalPost && <LikesModal />}
      {prayerMeetingOpen && <MeetingView />}
      {openStreamId && <StreamViewer streamId={openStreamId} />}
      <InstallPrompt />
    </div>
  );
}
