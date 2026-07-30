import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  Menu,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Shield,
  UserCircle,
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
import { NetworkView } from './NetworkView';
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
    setGoLiveOpen,
    setPrayerMeetingOpen,
    prayerMeetingOpen,
    openStreamId,
    shareOpen,
    likesModalPost,
  } = useUI();
  const { unreadCount } = useNotifications();
  const { t } = useI18n();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const me = users.find((u) => u?.id === currentUserId);

  // Close search when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchActive(false);
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
    setSearchActive(false);
    setSearchQuery('');
    setView('profile');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-ink-100">
      {/* --------------------------------------------------
         FACEBOOK-STYLE DUAL-ROW MOBILE HEADER
      -------------------------------------------------- */}
      <header className="sticky top-0 z-40 flex flex-col border-b border-ink-700/60 bg-ink-900/90 backdrop-blur-md">
        
        {/* ROW 1: Logo & Quick Action Buttons */}
        <div className="flex h-14 items-center justify-between px-3">
          {searchActive ? (
            /* Full-width Search Mode (Facebook Style) */
            <div ref={searchContainerRef} className="relative flex w-full items-center gap-2">
              <div className="relative flex flex-1 items-center">
                <Search size={18} className="absolute left-3 text-ink-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people, churches, groups..."
                  className="w-full rounded-full border border-ink-700 bg-ink-850 py-2 pl-9 pr-8 text-sm text-ink-100 placeholder-ink-400 outline-none focus:border-gold-400/70"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-ink-400 hover:text-ink-100"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchActive(false);
                  setSearchQuery('');
                }}
                className="px-2 text-xs font-semibold text-gold-400"
              >
                Cancel
              </button>

              {/* Full-width Floating Dropdown Results */}
              {trimmed.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-2 shadow-2xl z-50">
                  {matchingUsers.length > 0 ? (
                    <div className="space-y-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-400">
                        People & Parishes
                      </div>
                      {matchingUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleSelectUser(u.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-750"
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
                    <div className="py-4 text-center text-xs text-ink-400">
                      No matches found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Standard Header Row */
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-1.5 text-ink-300 hover:text-ink-100 lg:hidden"
                >
                  <Menu size={22} />
                </button>
                <Logo size={28} withText />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGoLiveOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-850 text-ink-300 hover:text-gold-300"
                  title="Go Live"
                >
                  <Plus size={20} />
                </button>
                <button
                  onClick={() => setSearchActive(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-850 text-ink-300 hover:text-gold-300"
                  title="Search"
                >
                  <Search size={20} />
                </button>
                <button
                  onClick={() => setView('messenger')}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ink-850 text-ink-300 hover:text-gold-300"
                  title="Messenger"
                >
                  <MessageCircle size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ROW 2: Facebook-Style Navigation Tabs */}
        {!searchActive && (
          <nav className="flex h-12 w-full items-center justify-around border-t border-ink-700/40 px-1">
            <button
              onClick={() => setView('feed')}
              className={`flex flex-1 items-center justify-center py-2.5 border-b-2 transition-colors ${
                view === 'feed' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'
              }`}
            >
              <Home size={22} />
            </button>
            <button
              onClick={() => setView('reels')}
              className={`flex flex-1 items-center justify-center py-2.5 border-b-2 transition-colors ${
                view === 'reels' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'
              }`}
            >
              <Clapperboard size={22} />
            </button>
            <button
              onClick={() => setView('network')}
              className={`flex flex-1 items-center justify-center py-2.5 border-b-2 transition-colors ${
                view === 'network' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'
              }`}
              aria-label={t('nav.network')}
              title={t('nav.network')}
            >
              <Users size={22} />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex flex-1 items-center justify-center py-2.5 border-b-2 transition-colors ${
                view === 'calendar' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'
              }`}
            >
              <CalendarDays size={22} />
            </button>
            {me && hasAdminAccess(me) && (
              <button
                onClick={() => setView('admin')}
                className={`flex flex-1 items-center justify-center py-2.5 border-b-2 transition-colors ${
                  view === 'admin' ? 'border-gold-400 text-gold-300' : 'border-transparent text-ink-400 hover:text-ink-100'
                }`}
              >
                <Shield size={22} />
              </button>
            )}
            <button
              onClick={() => setView('profile')}
              className={`flex flex-1 items-center justify-center py-1.5 border-b-2 transition-colors ${
                view === 'profile' ? 'border-gold-400' : 'border-transparent'
              }`}
            >
              {me ? <Avatar src={me.photo} name={me.name} size={26} ring={view === 'profile' ? 'gold' : 'none'} /> : <UserCircle size={22} />}
            </button>
          </nav>
        )}
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Desktop Left Sidebar */}
        <div className="hidden lg:block w-72 shrink-0 border-r border-ink-700/60 bg-ink-900/40">
          <LeftSidebar />
        </div>

        {/* Mobile Slideout Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex w-80 max-w-[85vw] flex-col bg-ink-900 shadow-2xl">
              <LeftSidebar onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* Center Main Content View */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {view === 'feed' && <FeedView />}
          {view === 'reels' && <ReelsView />}
          {view === 'network' && <NetworkView />}
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

      {/* Modals */}
      {goLiveOpen && <GoLiveModal />}
      {shareOpen && <ShareModal />}
      {likesModalPost && <LikesModal />}
      {prayerMeetingOpen && <MeetingView />}
      {openStreamId && <StreamViewer streamId={openStreamId} />}
      <InstallPrompt />
    </div>
  );
}
