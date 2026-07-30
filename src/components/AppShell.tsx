import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Menu,
  Search,
  Shield,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Avatar, Logo } from './ui';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { GoLiveModal } from './GoLiveModal';
import { ShareModal } from './ShareModal';
import { LikesModal } from './LikesModal';
import { InstallPrompt } from './InstallPrompt';
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
import { useNotifications } from '@/store/notifications';
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
    setPrayerMeetingOpen,
    prayerMeetingOpen,
    openStreamId,
    shareOpen,
    likesModalPost,
  } = useUI();
  const { unreadCount } = useNotifications();
  const { t } = useI18n();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const me = users.find((u) => u?.id === currentUserId);

  // Close search on click/tap outside
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

  const trimmed = searchQuery.trim().toLowerCase();
  const safeUsers = Array.isArray(users) ? users : [];
  const matchingUsers = trimmed
    ? safeUsers.filter(
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
      {/* Restored Full Top Navigation Bar */}
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-ink-700/60 bg-ink-900/80 px-3 backdrop-blur-md">
        {/* Left: Hamburger Menu & Cross Logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ghost-btn p-2 rounded-xl text-ink-300 hover:text-ink-100"
            aria-label="Toggle Menu"
          >
            <Menu size={20} />
          </button>
          <button onClick={() => setView('feed')} className="flex items-center gap-2 focus:outline-none">
            <Logo size={32} />
          </button>
        </div>

        {/* Center: Expandable Facebook-Style Search */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xs mx-2">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="SEARCH..."
              className="w-full rounded-full border border-ink-700 bg-ink-850 py-1.5 pl-8 pr-8 text-xs text-ink-100 placeholder-ink-400 outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/30"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                className="absolute right-2.5 rounded-full p-0.5 text-ink-400 hover:text-ink-100"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Search Dropdown Overlay */}
          {searchOpen && trimmed.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-2 shadow-2xl z-50">
              {matchingUsers.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase text-gold-400">
                    People & Parishes
                  </div>
                  {matchingUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-750"
                    >
                      <Avatar src={u.photo} name={u.name} size={32} ring="gold" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-ink-100">{u.name}</div>
                        <div className="truncate text-[11px] text-ink-400">{u.parish || 'Orthodox Member'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-ink-400">
                  No results for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions: Video, Friends, Notifications, Admin Shield, Avatar */}
        <div className="flex items-center gap-1.5">
          {/* Video Call Icon */}
          <button
            onClick={() => setPrayerMeetingOpen(true)}
            className="rounded-full p-2 text-ink-300 hover:bg-ink-800 hover:text-gold-200 transition-colors"
            title="Start Video Meeting"
          >
            <Video size={19} />
          </button>

          {/* Friends / Groups Icon */}
          <button
            onClick={() => setView('groups')}
            className="rounded-full p-2 text-ink-300 hover:bg-ink-800 hover:text-gold-200 transition-colors"
            title="Groups & Friends"
          >
            <Users size={19} />
          </button>

          {/* Bell Notification Badge */}
          <button
            onClick={() => setView('messenger')}
            className="relative rounded-full p-2 text-ink-300 hover:bg-ink-800 hover:text-gold-200 transition-colors"
            title="Notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Admin Shield (if user is admin) */}
          {me && hasAdminAccess(me) && (
            <button
              onClick={() => setView('admin')}
              className="relative rounded-full p-2 text-ink-300 hover:bg-ink-800 hover:text-gold-200 transition-colors"
              title="Admin Dashboard"
            >
              <Shield size={19} />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-gold-400" />
            </button>
          )}

          {/* Profile Avatar Button */}
          {me && (
            <button
              onClick={() => setView('profile')}
              className="ml-1 transition-transform active:scale-95"
            >
              <Avatar src={me.photo} name={me.name} size={34} ring="gold" />
            </button>
          )}
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left Sidebar */}
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

        {/* Center Main Views */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {view === 'feed' && <FeedView />}
          {view === 'reels' && <ReelsView />}
          {view === 'messenger' && <MessengerView />}
          {view === 'calendar' && <CalendarView />}
          {view === 'groups' && (groupRouteId ? <GroupFeedView groupId={groupRouteId} /> : <GroupsView />)}
          {view === 'profile' && <ProfileView />}
          {view === 'admin' && me && hasAdminAccess(me) && <AdminView />}
        </main>

        {/* Right Sidebar */}
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
