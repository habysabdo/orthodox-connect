import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { meetingPath, sanitizeMeetingId } from '@/utils/meetings';

export type ViewKey = 'feed' | 'groups' | 'group' | 'reels' | 'network' | 'messenger' | 'calendar' | 'admin' | 'profile' | 'meet';

/** Tabs of the Global Admin Console, hoisted here so anything outside the
 * console (e.g. an admin alert) can deep-link straight to the right tab. */
export type AdminTabKey = 'users' | 'auth-users' | 'promo-moderation' | 'groups';

interface Route {
  view: ViewKey;
  groupId: string | null;
  threadId: string | null;
  profileUserId: string | null;
  meetingRoomId: string | null;
}

function routeFromLocation(): Route {
  if (typeof window === 'undefined') {
    return { view: 'feed', groupId: null, threadId: null, profileUserId: null, meetingRoomId: null };
  }
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  const threadId = search.get('thread');
  const base = { groupId: null, threadId: null, profileUserId: null, meetingRoomId: null };
  // `/meet/:roomId` is the group video meeting (prayer room). The id in the link
  // is the whole identity of the room, so a shared link always resolves.
  if (path.startsWith('/meet/')) {
    const encodedRoomId = path.slice('/meet/'.length);
    if (encodedRoomId) {
      let roomId = encodedRoomId;
      try {
        roomId = decodeURIComponent(encodedRoomId);
      } catch {
        // keep the raw segment
      }
      const sanitized = sanitizeMeetingId(roomId);
      if (sanitized) {
        return { ...base, view: 'meet', meetingRoomId: sanitized };
      }
    }
    return { ...base, view: 'feed' };
  }
  if (search.get('view') === 'messenger') return { ...base, view: 'messenger', threadId };
  if (path === '/chat') return { ...base, view: 'messenger' };
  if (path.startsWith('/chat/')) {
    const encodedThreadId = path.slice('/chat/'.length);
    if (!encodedThreadId) return { ...base, view: 'messenger' };
    try {
      return { ...base, view: 'messenger', threadId: decodeURIComponent(encodedThreadId) };
    } catch {
      return { ...base, view: 'messenger' };
    }
  }
  if (path === '/admin') return { ...base, view: 'admin' };
  if (path === '/groups') return { ...base, view: 'groups' };
  if (path.startsWith('/groups/')) {
    const encodedGroupId = path.slice('/groups/'.length);
    if (!encodedGroupId) return { ...base, view: 'groups' };
    try {
      return { ...base, view: 'group', groupId: decodeURIComponent(encodedGroupId) };
    } catch {
      return { ...base, view: 'groups' };
    }
  }
  // `/profile` is the signed-in member's own profile; `/profile/:userId` is any
  // member's public profile.
  if (path === '/profile') return { ...base, view: 'profile' };
  if (path.startsWith('/profile/')) {
    const encodedUserId = path.slice('/profile/'.length);
    if (!encodedUserId) return { ...base, view: 'profile' };
    try {
      return { ...base, view: 'profile', profileUserId: decodeURIComponent(encodedUserId) };
    } catch {
      return { ...base, view: 'profile' };
    }
  }
  return { ...base, view: 'feed' };
}

interface UIState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  groupRouteId: string | null;
  openGroup: (groupId: string) => void;
  /** member whose public profile is being viewed; null means the signed-in user's own profile */
  profileUserId: string | null;
  /** open a member's public profile (or your own when omitted) */
  openProfile: (userId?: string | null) => void;
  /** path a profile link should point at, so it works as a real anchor */
  profileHref: (userId: string) => string;
  /** video to focus when opening the reels viewer */
  selectedReelId: string | null;
  openReel: (id: string) => void;
  /** open a live stream viewer by id */
  openStreamId: string | null;
  setOpenStreamId: (id: string | null) => void;
  /** open the Go Live creator */
  goLiveOpen: boolean;
  setGoLiveOpen: (v: boolean) => void;
  /** open the "Start Prayer Meeting" creator */
  prayerMeetingOpen: boolean;
  setPrayerMeetingOpen: (v: boolean) => void;
  /** room id of the meeting currently open at `/meet/:roomId` */
  meetingRoomId: string | null;
  /** title to show above the meeting, when the invite carried one */
  meetingTitle: string | null;
  /** join a meeting room, optionally with the title from its invite */
  openMeeting: (roomId: string, title?: string) => void;
  /** open the Share & QR invite sheet */
  shareOpen: boolean;
  setShareOpen: (v: boolean) => void;
  /** open a DM thread from anywhere */
  openThreadId: string | null;
  setOpenThreadId: (id: string | null) => void;
  /** post to scroll to and highlight in the feed (e.g. from a like notification) */
  focusedPostId: string | null;
  setFocusedPostId: (id: string | null) => void;
  /** selected Admin Console tab */
  adminTab: AdminTabKey;
  setAdminTab: (tab: AdminTabKey) => void;
  /** jump to the Admin Console with a specific tab already selected */
  openAdminTab: (tab: AdminTabKey) => void;
  /** right sidebar collapsed on small screens */
  rightOpen: boolean;
  setRightOpen: (v: boolean) => void;
}

const UICtx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const initialRoute = routeFromLocation();
  const [view, setViewState] = useState<ViewKey>(initialRoute.view);
  const [groupRouteId, setGroupRouteId] = useState<string | null>(initialRoute.groupId);
  const [profileUserId, setProfileUserId] = useState<string | null>(initialRoute.profileUserId);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [prayerMeetingOpen, setPrayerMeetingOpen] = useState(false);
  const [meetingRoomId, setMeetingRoomId] = useState<string | null>(initialRoute.meetingRoomId);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(initialRoute.threadId);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTabKey>('users');
  const [rightOpen, setRightOpen] = useState(false);
  const setView = (nextView: ViewKey) => {
    setViewState(nextView);
    if (nextView !== 'group') setGroupRouteId(null);
    if (nextView !== 'meet') {
      setMeetingRoomId(null);
      setMeetingTitle(null);
    }
    // Navigating to the profile tab always means "my profile"; a third-party
    // profile is opened through openProfile().
    setProfileUserId(null);
    if (typeof window !== 'undefined') {
      const path = nextView === 'admin'
        ? '/admin'
        : nextView === 'groups'
          ? '/groups'
          : nextView === 'profile'
            ? '/profile'
            : '/';
      window.history.pushState({}, '', path);
    }
  };

  const openMeeting = (roomId: string, title?: string) => {
    const sanitized = sanitizeMeetingId(roomId);
    if (!sanitized) return;
    setGroupRouteId(null);
    setProfileUserId(null);
    setMeetingRoomId(sanitized);
    setMeetingTitle(title?.trim() || null);
    setPrayerMeetingOpen(false);
    setViewState('meet');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', meetingPath(sanitized));
      window.scrollTo({ top: 0 });
    }
  };

  const profileHref = (userId: string) => `/profile/${encodeURIComponent(userId)}`;

  const openProfile = (userId?: string | null) => {
    setGroupRouteId(null);
    setProfileUserId(userId ?? null);
    setViewState('profile');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', userId ? profileHref(userId) : '/profile');
      window.scrollTo({ top: 0 });
    }
  };

  const openGroup = (groupId: string) => {
    setGroupRouteId(groupId);
    setMeetingRoomId(null);
    setMeetingTitle(null);
    setViewState('group');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/groups/${encodeURIComponent(groupId)}`);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const route = routeFromLocation();
      setViewState(route.view);
      setGroupRouteId(route.groupId);
      setOpenThreadId(route.threadId);
      setProfileUserId(route.profileUserId);
      setMeetingRoomId(route.meetingRoomId);
      if (!route.meetingRoomId) setMeetingTitle(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <UICtx.Provider
      value={{
        view,
        setView,
        groupRouteId,
        openGroup,
        profileUserId,
        openProfile,
        profileHref,
        selectedReelId,
        openReel: (id) => {
          setSelectedReelId(id);
          setView('reels');
        },
        openStreamId,
        setOpenStreamId,
        goLiveOpen,
        setGoLiveOpen,
        prayerMeetingOpen,
        setPrayerMeetingOpen,
        meetingRoomId,
        meetingTitle,
        openMeeting,
        shareOpen,
        setShareOpen,
        openThreadId,
        setOpenThreadId,
        focusedPostId,
        setFocusedPostId,
        adminTab,
        setAdminTab,
        openAdminTab: (tab) => {
          setAdminTab(tab);
          setView('admin');
        },
        rightOpen,
        setRightOpen,
      }}
    >
      {children}
    </UICtx.Provider>
  );
}

export function useUI(): UIState {
  const ctx = useContext(UICtx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
