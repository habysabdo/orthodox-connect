import { Menu, Radio, Users, Video } from 'lucide-react';
import { Avatar, FeedSkeleton, Logo } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/i18n';
import { NotificationBell } from './NotificationBell';
import { AdminNotificationBell } from './AdminNotificationBell';
import { lazy, Suspense, useEffect, useState } from 'react';
import { hasAdminAccess } from '@/utils/users';
import { ErrorBoundary } from './ErrorBoundary';

const FeedView = lazy(() => import('./FeedView').then((m) => ({ default: m.FeedView })));
const GroupFeedView = lazy(() => import('./GroupFeedView').then((m) => ({ default: m.GroupFeedView })));
const GroupsView = lazy(() => import('./GroupsView').then((m) => ({ default: m.GroupsView })));
const NetworkView = lazy(() => import('./NetworkView').then((m) => ({ default: m.NetworkView })));
const MessengerView = lazy(() => import('./MessengerView').then((m) => ({ default: m.MessengerView })));
const CalendarView = lazy(() => import('./CalendarView').then((m) => ({ default: m.CalendarView })));
const AdminView = lazy(() => import('./AdminView').then((m) => ({ default: m.AdminView })));
const ProfileView = lazy(() => import('./ProfileView').then((m) => ({ default: m.ProfileView })));
const ReelsView = lazy(() => import('./ReelsView').then((m) => ({ default: m.ReelsView })));
const MeetingView = lazy(() => import('./MeetingView').then((m) => ({ default: m.MeetingView })));
const GoLiveModal = lazy(() => import('./GoLiveModal').then((m) => ({ default: m.GoLiveModal })));
const StreamViewer = lazy(() => import('./StreamViewer').then((m) => ({ default: m.StreamViewer })));
const ShareModal = lazy(() => import('./ShareModal').then((m) => ({ default: m.ShareModal })));
const GlobalSearch = lazy(() => import('./GlobalSearch').then((m) => ({ default: m.GlobalSearch })));
const LeftSidebar = lazy(() => import('./LeftSidebar').then((m) => ({ default: m.LeftSidebar })));
const RightSidebar = lazy(() => import('./RightSidebar').then((m) => ({ default: m.RightSidebar })));
const PrayerMeetingModal = lazy(() => import('./PrayerMeetingModal').then((m) => ({ default: m.PrayerMeetingModal })));
const InstallPrompt = lazy(() => import('./InstallPrompt').then((m) => ({ default: m.InstallPrompt })));
const NotificationToasts = lazy(() => import('./NotificationToasts').then((m) => ({ default: m.NotificationToasts })));

export function AppShell() {
  const { users, currentUserId, groups, groupsLoading, activeGroupId, setActiveGroup } = useStore();
  const {
    view,
    setView,
    groupRouteId,
    goLiveOpen,
    setGoLiveOpen,
    setPrayerMeetingOpen,
    openStreamId,
    shareOpen,
    rightOpen,
    setRightOpen,
    openThreadId,
  } = useUI();
  const { t } = useI18n();
  const safeUsers = Array.isArray(users) ? users : [];
  const me = safeUsers.find((u) => u?.id === currentUserId);
  const adminAccess = hasAdminAccess(me);
  const [leftOpen, setLeftOpen] = useState(false);

  useEffect(() => {
    if (view === 'admin' && !adminAccess) setView('feed');
  }, [adminAccess, setView, view]);

  useEffect(() => {
    const groupList = Array.isArray(groups) ? groups : [];
    if (view === 'group' && groupRouteId) {
      if (!groupsLoading && !groupList.some((group) => group?.id === groupRouteId)) {
        setView('groups');
        return;
      }
      if (activeGroupId !== groupRouteId) {
        void setActiveGroup(groupRouteId).catch((error) => console.error('Failed to open group', error));
      }
      return;
    }
    if (activeGroupId !== null) {
      void setActiveGroup(null).catch((error) => console.error('Failed to close group', error));
    }
  }, [activeGroupId, groupRouteId, groups, groupsLoading, setActiveGroup, setView, view]);

  if (!me) return <FeedSkeleton />;

  if (view === 'meet') {
    return (
      <ErrorBoundary name="Prayer meeting" variant="section" resetKeys={[view]}>
        <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
          <MeetingView />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
          <button
            onClick={() => setLeftOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <button onClick={() => setView('feed')} className="hidden h-9 shrink-0 items-center sm:flex" aria-label={t('nav.feed')}>
            <Logo size={32} withText />
          </button>
          <button onClick={() => setView('feed')} className="flex h-9 shrink-0 items-center sm:hidden" aria-label={t('nav.feed')}>
            <Logo size={32} />
          </button>

          {/* Global search */}
          <ErrorBoundary
            name="Search"
            resetKeys={[currentUserId]}
            fallback={(reset) => (
              <button type="button" onClick={reset} className="ghost-btn h-9 shrink-0 px-3 text-xs">
                Retry search
              </button>
            )}
          >
            <Suspense fallback={<div className="h-9 w-9 shrink-0 rounded-full bg-ink-850 md:mx-2 md:flex-1 md:max-w-md" />}>
              <GlobalSearch className="min-w-0 shrink-0 md:mx-2 md:flex-1 md:max-w-md" />
            </Suspense>
          </ErrorBoundary>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              onClick={() => setPrayerMeetingOpen(true)}
              className="ghost-btn hidden h-9 shrink-0 rounded-full px-3 py-0 text-sm lg:flex"
            >
              <Video size={16} /> Prayer Meeting
            </button>
            <button
              onClick={() => setPrayerMeetingOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-ink-300 shadow-sm transition-colors hover:border-gold-400/60 hover:bg-ink-800 hover:text-gold-200 lg:hidden"
              title="Start a prayer meeting"
              aria-label="Start a prayer meeting"
            >
              <Video size={17} />
            </button>

            <button
              onClick={() => setGoLiveOpen(true)}
              className="gold-btn hidden h-9 shrink-0 rounded-full px-3 py-0 text-sm lg:flex"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-red-500/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {t('header.goLive')}
            </button>
            <button
              onClick={() => setGoLiveOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition-colors hover:bg-red-500 lg:hidden"
              title={t('header.goLive')}
              aria-label={t('header.goLive')}
            >
              <Radio size={17} />
            </button>

            <button
              type="button"
              onClick={() => setView('network')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-ink-300 shadow-sm transition-colors hover:border-gold-400/60 hover:bg-ink-800 hover:text-gold-200 focus-visible:outline-none"
              aria-label={t('nav.network')}
              title={t('nav.network')}
            >
              <Users size={19} aria-hidden="true" />
            </button>

            <ErrorBoundary
              name="Notifications"
              resetKeys={[currentUserId]}
              fallback={<span className="h-9 w-9 shrink-0 rounded-full bg-ink-850" aria-label="Notifications unavailable" />}
            >
              <NotificationBell activeThreadId={view === 'messenger' ? openThreadId : null} />
            </ErrorBoundary>

            {adminAccess && (
              <ErrorBoundary
                name="Admin notifications"
                resetKeys={[currentUserId]}
                fallback={<span className="h-9 w-9 shrink-0 rounded-full bg-ink-850" aria-label="Admin notifications unavailable" />}
              >
                <AdminNotificationBell />
              </ErrorBoundary>
            )}

            <button
              onClick={() => setView('profile')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-none"
              aria-label={t('nav.profile')}
            >
              <Avatar src={me.photo} name={me.name} size={34} ring="gold" online />
            </button>
          </div>
        </div>
      </header>

      {/* Main layout container */}
      <div className={`mx-auto flex gap-0 px-0 ${view === 'reels' ? 'max-w-none' : 'max-w-[1500px] lg:px-4 lg:py-4'}`}>
        {/* Left sidebar */}
        <div className={`hidden w-64 shrink-0 lg:block ${view === 'reels' ? 'lg:!hidden' : ''}`}>
          <div className="sticky top-[4.5rem] card !rounded-2xl">
            <ErrorBoundary name="Navigation" variant="section" resetKeys={[currentUserId]}>
              <Suspense fallback={<FeedSkeleton />}>
                <LeftSidebar />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

        {/* Middle content wrapper */}
        <main className={`min-w-0 flex-1 ${view === 'reels' ? 'p-0' : 'px-1 py-2 sm:px-4 lg:px-4'}`}>
          <div className={view === 'reels' || view === 'groups' ? 'mx-auto max-w-5xl' : 'mx-auto max-w-2xl'}>
            <ErrorBoundary name="This page" variant="section" resetKeys={[view, groupRouteId, activeGroupId]}>
              <Suspense fallback={<FeedSkeleton />}>
                {view === 'feed' && (activeGroupId === null ? <FeedView /> : <FeedSkeleton />)}
                {view === 'groups' && <GroupsView />}
                {view === 'group' && <GroupFeedView />}
                {view === 'reels' && <ReelsView />}
                {view === 'network' && <NetworkView />}
                {view === 'messenger' && <MessengerView />}
                {view === 'calendar' && <CalendarView />}
                {view === 'admin' && adminAccess && <AdminView />}
                {view === 'profile' && <ProfileView />}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* Right sidebar */}
        <div className={`hidden w-80 shrink-0 xl:block ${view === 'reels' ? 'xl:!hidden' : ''}`}>
          <div className="sticky top-[4.5rem]">
            <div className="card !rounded-2xl h-[calc(100vh-6rem)]">
              <ErrorBoundary name="Community sidebar" variant="section" resetKeys={[currentUserId]}>
                <Suspense fallback={<FeedSkeleton />}>
                  <RightSidebar />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile left drawer */}
      {leftOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setLeftOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] animate-slide-right border-r border-ink-700 bg-ink-900">
            <ErrorBoundary name="Navigation" variant="section" resetKeys={[leftOpen]}>
              <Suspense fallback={<FeedSkeleton />}>
                <LeftSidebar onClose={() => setLeftOpen(false)} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Mobile right drawer */}
      {rightOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setRightOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[90%] animate-slide-right border-l border-ink-700 bg-ink-900">
            <ErrorBoundary name="Community sidebar" variant="section" resetKeys={[rightOpen]}>
              <Suspense fallback={<FeedSkeleton />}>
                <RightSidebar onClose={() => setRightOpen(false)} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Global overlays */}
      <ErrorBoundary name="Live video" fallback={null} resetKeys={[goLiveOpen, openStreamId]}>
        <Suspense fallback={null}>
          {goLiveOpen && <GoLiveModal />}
          {openStreamId && <StreamViewer />}
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="Sharing" fallback={null} resetKeys={[shareOpen]}>
        <Suspense fallback={null}>{shareOpen && <ShareModal />}</Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="Prayer meeting dialog" fallback={null}>
        <Suspense fallback={null}><PrayerMeetingModal /></Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="Install prompt" fallback={null}>
        <Suspense fallback={null}><InstallPrompt /></Suspense>
      </ErrorBoundary>
      <ErrorBoundary name="Notification toasts" fallback={null} resetKeys={[currentUserId]}>
        <Suspense fallback={null}><NotificationToasts /></Suspense>
      </ErrorBoundary>
    </div>
  );
}
