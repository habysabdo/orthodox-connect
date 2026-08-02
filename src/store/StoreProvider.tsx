import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import netlifyIdentity from 'netlify-identity-widget';
import { type CalendarEvent, type ChatAttachment, type CommunityAlert, type Post, type User } from '../types';
import {
  StoreContext,
  groupCacheKey,
  threadIdFor,
  uid,
  useStore,
  type AppActions,
  type Store,
} from './context';
import { initialState, reducer } from './reducer';
import { loadUserProfile, saveUserProfile } from '../utils/profile';
import { loadUsers } from '../utils/users';
import {
  deletePost as deletePostRemote,
  createReshare,
  loadPost,
  loadPosts,
  savePost,
} from '../utils/posts';
import {
  buildThreads,
  loadMessages,
  markMessagesRead,
  saveMessage,
} from '../utils/messages';
import { publishMessageChange, subscribeToMessageChanges } from '../utils/messageRealtime';
import {
  deleteFriendship,
  loadFriendships,
  saveFriendship,
} from '../utils/friendships';
import { createNotification } from '../utils/notifications';
import type { Notification } from '../types';
import { createGroupRemote, loadGroups } from '../utils/groups';
import { apiUrl } from '../lib/config';
import {
  identityAuthorizationHeaders,
  persistIdentityCookiesFromLocalStorage,
  restoreIdentitySession,
} from '../lib/auth';
import {
  clearLocalAuthStorage,
  recoverFromUnauthorizedSession,
  verifySupabaseSession,
} from '../lib/sessionRecovery';
import { clearCachedAppState, saveCachedAppState } from './persistence';
import { postComments, postLikes, userName } from '../utils/postSafety';
import { supabase } from '../lib/supabase';
import { startVisiblePolling } from '../utils/visiblePolling';

const GOOGLE_PHOTOS = [
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg',
  'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg',
];

const SESSION_RECHECK_INTERVAL_MS = 60_000;
const AUTH_RESTORE_TIMEOUT_MS = 12_000;

async function loadSessionUser(): Promise<User | null> {
  const response = await fetch(apiUrl(`/api/session?refresh=${Date.now()}`), {
    cache: 'no-store',
    credentials: 'include',
    headers: identityAuthorizationHeaders(),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error('Failed to load the signed-in account');
  return response.json();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const stateRef = useRef(state);
  stateRef.current = state;
  const activeUserIdRef = useRef(state.currentUserId);
  activeUserIdRef.current = state.currentUserId;
  const pendingPostIdsRef = useRef(new Set<string>());
  const postSavePromisesRef = useRef(new Map<string, Promise<boolean>>());

  // 1. Initial Auth Restore Effect
  useEffect(() => {
    let active = true;
    let authRestoreFinished = false;

    const finishAuthRestore = (timedOut = false) => {
      if (!active || authRestoreFinished) return;
      authRestoreFinished = true;
      window.clearTimeout(authRestoreTimeoutId);
      if (timedOut) {
        console.error(
          `Authentication restore exceeded ${AUTH_RESTORE_TIMEOUT_MS}ms; releasing the loading screen.`,
        );
      }
      dispatch({ type: 'AUTH_CHECKED' });
    };

    const authRestoreTimeoutId = window.setTimeout(
      () => finishAuthRestore(true),
      AUTH_RESTORE_TIMEOUT_MS,
    );

    try {
      netlifyIdentity.init();
    } catch {
      // Safe fallback
    }

    const resetToSignedOut = () => {
      activeUserIdRef.current = null;
      pendingPostIdsRef.current.clear();
      postSavePromisesRef.current.clear();
      clearCachedAppState();
      dispatch({ type: 'SIGN_OUT' });
      dispatch({ type: 'AUTH_CHECKED' });
      if (window.location.pathname !== '/login') window.location.replace('/login');
    };

    const handleExpiredSession = async (reason: string) => {
      await recoverFromUnauthorizedSession(reason);
      if (!active) return;
      resetToSignedOut();
    };

    const refresh = async () => {
      try {
        const sessionCheck = await verifySupabaseSession();
        if (!active) return;
        if (sessionCheck.status === 'expired') {
          await handleExpiredSession('the stored session was rejected while restoring it');
          return;
        }
        if (sessionCheck.status === 'unknown') {
          console.warn('Could not validate the Supabase session', sessionCheck.error);
        }
        const identity = await restoreIdentitySession();
        const user = identity?.id ? await loadSessionUser() : null;
        if (!active) return;
        if (user) dispatch({ type: 'SIGN_IN', user });
        else if (!identity) dispatch({ type: 'SIGN_OUT' });
      } catch (err) {
        console.error('Failed to restore session', err);
      } finally {
        finishAuthRestore();
      }
    };
    refresh();

    const handleLogout = () => {
      persistIdentityCookiesFromLocalStorage();
      if (active) resetToSignedOut();
    };

    const handleLogin = (user: unknown) => {
      try {
        netlifyIdentity.close();
      } catch {
        // Safe fallback
      }
      persistIdentityCookiesFromLocalStorage();
      loadSessionUser()
        .then((sessionUser) => {
          if (!active) return;
          if (sessionUser) {
            dispatch({ type: 'SIGN_IN', user: sessionUser });
          } else if (user) {
            window.location.reload();
          }
          dispatch({ type: 'AUTH_CHECKED' });
        })
        .catch((err) => {
          console.error('Failed to sync session', err);
          window.location.reload();
        });
    };

    netlifyIdentity.on('logout', handleLogout);
    netlifyIdentity.on('login', handleLogin);

    let supabaseAuthListener: ReturnType<typeof supabase.auth.onAuthStateChange>['data'] | null = null;
    const authListenerSetupTimeoutId = window.setTimeout(
      () => finishAuthRestore(true),
      AUTH_RESTORE_TIMEOUT_MS,
    );

    try {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        const authEventTimeoutId = window.setTimeout(
          () => finishAuthRestore(true),
          AUTH_RESTORE_TIMEOUT_MS,
        );

        try {
          if (!active || event === 'TOKEN_REFRESHED') return;
          if (event === 'SIGNED_OUT') {
            clearLocalAuthStorage();
            resetToSignedOut();
          }
        } catch (error) {
          console.error('Failed to process the Supabase auth state change', error);
        } finally {
          window.clearTimeout(authEventTimeoutId);
        }
      });
      supabaseAuthListener = data;
    } catch (error) {
      console.error('Failed to subscribe to Supabase auth state changes', error);
    } finally {
      window.clearTimeout(authListenerSetupTimeoutId);
    }

    let lastSessionCheck = Date.now();
    const revalidateSession = async () => {
      if (!active || document.visibilityState !== 'visible') return;
      if (Date.now() - lastSessionCheck < SESSION_RECHECK_INTERVAL_MS) return;
      lastSessionCheck = Date.now();

      const sessionCheck = await verifySupabaseSession();
      if (!active || sessionCheck.status !== 'expired') return;
      await handleExpiredSession('the session could not be refreshed after the app returned to the foreground');
    };

    const handleForeground = () => void revalidateSession();
    document.addEventListener('visibilitychange', handleForeground);
    window.addEventListener('focus', handleForeground);

    return () => {
      active = false;
      window.clearTimeout(authRestoreTimeoutId);
      netlifyIdentity.off('logout', handleLogout);
      netlifyIdentity.off('login', handleLogin);
      document.removeEventListener('visibilitychange', handleForeground);
      window.removeEventListener('focus', handleForeground);
      supabaseAuthListener?.subscription.unsubscribe();
    };
  }, []);

  // 2. Local State Caching
  useEffect(() => {
    const user = state.users.find((candidate) => candidate?.id === state.currentUserId);
    if (!user) {
      if (state.authChecked) clearCachedAppState();
      return;
    }
    saveCachedAppState({
      user,
      postsCache: state.postsCache,
      postsHasMoreCache: state.postsHasMoreCache,
    });
  }, [state.authChecked, state.currentUserId, state.postsCache, state.postsHasMoreCache, state.users]);

  // 3. User Profile Hydration
  useEffect(() => {
    const userId = state.currentUserId;
    if (!userId) return;
    let cancelled = false;
    loadUserProfile(userId)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          const profile = data as Partial<User>;
          const safeProfile = { ...profile };
          delete safeProfile.id;
          delete safeProfile.email;
          delete safeProfile.role;
          delete safeProfile.status;
          dispatch({ type: 'HYDRATE_PROFILE', userId, data: safeProfile });
        } else {
          const me = stateRef.current.users.find((u) => u?.id === userId);
          if (me) {
            saveUserProfile(userId, me).catch((err) =>
              console.error('Failed to register user profile', err),
            );
          }
        }
      })
      .catch((err) => console.error('Failed to load user profile', err));
    return () => {
      cancelled = true;
    };
  }, [state.currentUserId]);

  // 4. Groups Hydration
  useEffect(() => {
    if (!state.currentUserId) return;
    loadGroups()
      .then((groups) => dispatch({ type: 'HYDRATE_GROUPS', groups }))
      .catch((err) => console.error('Failed to load groups', err));
  }, [state.currentUserId]);

  // 5. Users & Friendships Polling
  useEffect(() => {
    const userId = state.currentUserId;
    if (!userId) return;
    let cancelled = false;
    const stopPolling = startVisiblePolling(
      async () => {
        const users = await loadUsers();
        if (!cancelled && activeUserIdRef.current === userId) {
          dispatch({ type: 'HYDRATE_USERS', users });
        }
      },
      { intervalMs: 20000, onError: (error) => console.error('Failed to load users', error) },
    );
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [state.currentUserId]);

  useEffect(() => {
    const userId = state.currentUserId;
    if (!userId) return;
    let cancelled = false;
    const stopPolling = startVisiblePolling(
      async () => {
        const friendships = await loadFriendships(userId);
        if (!cancelled && activeUserIdRef.current === userId) {
          dispatch({ type: 'HYDRATE_FRIENDSHIPS', friendships });
        }
      },
      { intervalMs: 25000, onError: (error) => console.error('Failed to load friendships', error) },
    );
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [state.currentUserId]);

  // 6. Posts Hydration & Fetching (FIXED UNAUTHENTICATED GATE)
  useEffect(() => {
    const userId = state.currentUserId;
    
    // 🎯 FIX: Release posts loading immediately if no user is signed in
    if (!userId) {
      dispatch({ type: 'SET_POSTS_LOADING', loading: false });
      return;
    }

    let cancelled = false;
    let refreshing = false;
    const key = groupCacheKey(state.activeGroupId);
    const cached = stateRef.current.postsCache[key];

    if (cached) {
      dispatch({
        type: 'HYDRATE_POSTS',
        posts: cached,
        hasMore: stateRef.current.postsHasMoreCache[key] ?? false,
      });
    } else {
      dispatch({ type: 'SET_POSTS_LOADING', loading: true });
    }

    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const posts = await loadPosts(state.activeGroupId, { limit: 10 });
        if (!cancelled && activeUserIdRef.current === userId) {
          const cachedPosts = stateRef.current.postsCache[key] ?? [];
          const pendingPosts = stateRef.current.posts.filter(
            (post) => pendingPostIdsRef.current.has(post.id) && groupCacheKey(post.groupId) === key,
          );
          const pendingIds = new Set(pendingPosts.map((post) => post.id));
          const fetchedIds = new Set(posts.map((post) => post.id));
          const oldestFetched = posts[posts.length - 1]?.createdAt;
          const cachedOlderPosts = oldestFetched
            ? cachedPosts.filter((post) => post.createdAt < oldestFetched && !fetchedIds.has(post.id) && !pendingIds.has(post.id))
            : [];
          dispatch({
            type: 'HYDRATE_POSTS',
            posts: [
              ...pendingPosts,
              ...posts.filter((post) => !pendingIds.has(post.id)),
              ...cachedOlderPosts,
            ],
            cacheKey: key,
            hasMore: cachedOlderPosts.length > 0
              ? stateRef.current.postsHasMoreCache[key] ?? true
              : posts.length === 10,
          });
        }
      } catch (err) {
        console.error('Failed to load posts', err);
      } finally {
        if (!cancelled && activeUserIdRef.current === userId) {
          dispatch({ type: 'SET_POSTS_LOADING', loading: false });
        }
        refreshing = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    const interval = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [state.currentUserId, state.activeGroupId]);

  // 7. Messaging Threads
  useEffect(() => {
    const userId = state.currentUserId;
    if (!userId) return;
    let cancelled = false;
    let refreshing = false;

    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const messages = await loadMessages();
        if (!cancelled) {
          dispatch({ type: 'HYDRATE_THREADS', threads: buildThreads(messages, []) });
        }
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        refreshing = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    const unsubscribe = subscribeToMessageChanges(userId, refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [state.currentUserId]);

  // 8. Actions Dispatcher Setup
  const actions = useMemo<AppActions>(() => {
    const getCurrent = (): User | undefined =>
      stateRef.current.users.find((u) => u?.id === stateRef.current.currentUserId);

    const emit = (n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
      if (!n.userId || n.userId === n.actorId) return;
      const notification: Notification = {
        ...n,
        id: uid('n'),
        isRead: false,
        createdAt: Date.now(),
      };
      createNotification(notification).catch((err) =>
        console.error('Failed to create notification', err),
      );
    };

    return {
      async completeOnboarding(data) {
        const current = getCurrent();
        if (current) {
          const merged: User = { ...current, ...data, onboarded: true };
          await saveUserProfile(current.id, merged);
          dispatch({ type: 'COMPLETE_ONBOARDING', data });
        }
      },

      signOut() {
        activeUserIdRef.current = null;
        pendingPostIdsRef.current.clear();
        postSavePromisesRef.current.clear();
        clearCachedAppState();
        dispatch({ type: 'SIGN_OUT' });
        void supabase.auth.signOut().catch((err) => console.error('Failed to clear the Supabase session', err));
        try {
          netlifyIdentity.logout();
        } catch (err) {
          console.error('Failed to sign out via identity', err);
        }
        clearLocalAuthStorage();
      },

      async refreshGroups() {
        const groups = await loadGroups();
        dispatch({ type: 'HYDRATE_GROUPS', groups });
      },

      async createGroup(name, description) {
        const group = await createGroupRemote(name, description);
        const groups = await loadGroups();
        dispatch({ type: 'HYDRATE_GROUPS', groups });
        dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
        return group;
      },

      async setActiveGroup(groupId) {
        dispatch({ type: 'SET_ACTIVE_GROUP', groupId });
      },

      createPost({ text, image, video, videoStatus, meeting }) {
        const me = getCurrent();
        if (!me) return;
        const groupId = stateRef.current.activeGroupId;
        const cacheKey = groupCacheKey(groupId);
        const post: Post = {
          id: uid('p'),
          authorId: me.id,
          text,
          image,
          video,
          videoStatus,
          videoUploadStartedAt: videoStatus === 'uploading' ? Date.now() : undefined,
          createdAt: Date.now(),
          likes: [],
          comments: [],
          groupId,
          meeting,
        };
        pendingPostIdsRef.current.add(post.id);
        dispatch({ type: 'CREATE_POST', post, cacheKey });
        const persistence = savePost(post)
          .then(() => {
            pendingPostIdsRef.current.delete(post.id);
            return true;
          })
          .catch((err) => {
            pendingPostIdsRef.current.delete(post.id);
            dispatch({ type: 'DELETE_POST', postId: post.id });
            console.error('Failed to save post', err);
            return false;
          })
          .finally(() => {
            if (postSavePromisesRef.current.get(post.id) === persistence) {
              postSavePromisesRef.current.delete(post.id);
            }
          });
        postSavePromisesRef.current.set(post.id, persistence);
        return post;
      },

      async createPromoPost({ title, text, image, video, videoStatus }) {
        const me = getCurrent();
        if (!me) return;
        const post: Post = {
          id: uid('p'),
          authorId: me.id,
          text,
          image,
          video,
          videoStatus,
          videoUploadStartedAt: videoStatus === 'uploading' ? Date.now() : undefined,
          createdAt: Date.now(),
          likes: [],
          comments: [],
          groupId: null,
          postType: 'promo',
          status: 'pending',
          promoTitle: title,
        };
        await savePost(post);
        return post;
      },

      async resharePost(postId, kind, quote = '') {
        try {
          const post = await createReshare(postId, kind, quote);
          dispatch({
            type: 'RESHARE_POST',
            post,
            cacheKey: groupCacheKey(post.groupId),
            originalPostId: post.originalPostId ?? postId,
          });
          return post;
        } catch (err) {
          console.error('Failed to re-share post', err);
          return undefined;
        }
      },

      async updatePostVideo(postId, video, status = video ? 'ready' : 'failed', error) {
        const post = stateRef.current.posts.find((candidate) => candidate.id === postId);
        if (!post) return;
        const updated: Post = {
          ...post,
          video,
          videoStatus: status,
          videoError: status === 'failed' ? error || 'The video could not be uploaded. Please try posting it again.' : undefined,
          videoUploadStartedAt: undefined,
        };
        dispatch({ type: 'UPDATE_POST', post: updated });
        try {
          const persisted = await postSavePromisesRef.current.get(postId);
          if (persisted === false || !stateRef.current.posts.some((candidate) => candidate.id === postId)) return;
          await savePost(updated);
        } catch (err) {
          console.error('Failed to update the post video', err);
        }
      },

      async loadMorePosts() {
        const current = stateRef.current;
        const userId = current.currentUserId;
        if (!userId || current.postsLoadingMore || !current.postsHasMore) return;
        const cacheKey = groupCacheKey(current.activeGroupId);
        const oldestPost = current.posts[current.posts.length - 1];
        if (!oldestPost) return;
        dispatch({ type: 'SET_POSTS_LOADING_MORE', loading: true });
        try {
          const posts = await loadPosts(current.activeGroupId, { limit: 10, before: oldestPost.createdAt });
          if (activeUserIdRef.current !== userId) return;
          dispatch({ type: 'APPEND_POSTS', posts, cacheKey, hasMore: posts.length === 10 });
        } catch (err) {
          if (activeUserIdRef.current === userId) {
            dispatch({ type: 'SET_POSTS_LOADING_MORE', loading: false });
          }
          console.error('Failed to load more posts', err);
        }
      },

      async loadPostById(postId) {
        const userId = activeUserIdRef.current;
        if (!userId || !postId) return;
        try {
          const post = await loadPost(postId);
          if (activeUserIdRef.current !== userId) return;
          dispatch({ type: 'UPSERT_POST', post, cacheKey: groupCacheKey(post.groupId) });
        } catch (err) {
          console.error('Failed to load post', err);
        }
      },

      toggleLike(postId, sourcePost) {
        const me = getCurrent();
        if (!me) return;
        const post = stateRef.current.posts.find((p) => p.id === postId) ?? sourcePost;
        const currentLikes = postLikes(post);
        const isNewLike = post ? !currentLikes.includes(me.id) : false;
        dispatch({ type: 'TOGGLE_LIKE', postId, userId: me.id });
        if (post) {
          const likes = currentLikes.includes(me.id)
            ? currentLikes.filter((id) => id !== me.id)
            : [...currentLikes, me.id];
          savePost({ ...post, likes }).catch((err) => console.error('Failed to save post', err));
          if (isNewLike && post.authorId !== me.id) {
            emit({
              userId: post.authorId,
              actorId: me.id,
              actorName: userName(me),
              type: 'like',
              content: 'liked your post',
              postId: post.id,
            });
          }
        }
      },

      addComment(postId, text, sourcePost) {
        const me = getCurrent();
        if (!me) return;
        const comment = { id: uid('c'), authorId: me.id, text, createdAt: Date.now() };
        dispatch({ type: 'ADD_COMMENT', postId, comment });
        const post = stateRef.current.posts.find((p) => p.id === postId) ?? sourcePost;
        if (post) {
          savePost({ ...post, comments: [...postComments(post), comment] }).catch((err) =>
            console.error('Failed to save post', err),
          );
        }
      },

      flagPost(postId, reason) {
        dispatch({ type: 'FLAG_POST', postId, reason });
        const post = stateRef.current.posts.find((p) => p.id === postId);
        if (post) {
          savePost({ ...post, flagged: true, flagReason: reason }).catch((err) =>
            console.error('Failed to save post', err),
          );
        }
      },

      unflagPost(postId) {
        dispatch({ type: 'UNFLAG_POST', postId });
        const post = stateRef.current.posts.find((p) => p.id === postId);
        if (post) {
          savePost({ ...post, flagged: false, flagReason: undefined }).catch((err) =>
            console.error('Failed to save post', err),
          );
        }
      },

      deletePost(postId) {
        dispatch({ type: 'DELETE_POST', postId });
        deletePostRemote(postId).catch((err) => console.error('Failed to delete post', err));
      },

      async addFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        try {
          await saveFriendship(me.id, otherId, 'pending');
          dispatch({ type: 'ADD_FRIEND', from: me.id, to: otherId });
        } catch (err) {
          console.error('Failed to save friend request', err);
        }
      },

      async acceptFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        try {
          await saveFriendship(otherId, me.id, 'accepted', Date.now());
          dispatch({ type: 'ACCEPT_FRIEND', from: otherId, to: me.id });
        } catch (err) {
          console.error('Failed to accept friend request', err);
        }
      },

      async removeFriend(otherId) {
        const me = getCurrent();
        if (!me) return;
        try {
          await deleteFriendship(me.id, otherId);
          dispatch({ type: 'REMOVE_FRIEND', a: me.id, b: otherId });
        } catch (err) {
          console.error('Failed to remove connection', err);
        }
      },

      sendMessage(threadId, text, attachments: ChatAttachment[] = []) {
        const me = getCurrent();
        if (!me) return;
        const message = {
          id: uid('m'),
          threadId,
          senderId: me.id,
          text,
          attachments,
          createdAt: Date.now(),
          isRead: false,
          readAt: null,
        };
        dispatch({ type: 'SEND_MESSAGE', message });
        const recipient = threadId.split('__').find((id) => id !== me.id);
        saveMessage(message)
          .then(() => {
            if (recipient) publishMessageChange(recipient);
          })
          .catch((err) => console.error('Failed to save message', err));
        if (recipient) {
          emit({
            userId: recipient,
            actorId: me.id,
            actorName: me.name,
            type: 'message',
            content: 'sent you a message',
            threadId,
          });
        }
      },

      markThreadRead(threadId) {
        const me = getCurrent();
        if (!me) return;
        const thread = stateRef.current.threads.find((candidate) => candidate.id === threadId);
        const unreadMessageIds = thread?.messages
          ?.filter((message) => message.senderId !== me.id && !message.isRead)
          .map((message) => message.id) ?? [];
        if (!unreadMessageIds.length) return;
        const readAt = Date.now();
        dispatch({ type: 'MARK_THREAD_READ', threadId, userId: me.id, readAt });
        markMessagesRead(threadId, unreadMessageIds)
          .then(() => {
            const senderId = thread?.participantIds?.find((id) => id !== me.id);
            if (senderId) publishMessageChange(senderId);
          })
          .catch((err) => console.error('Failed to mark messages as read', err));
      },

      openThreadWith(otherId) {
        const me = getCurrent();
        if (!me) return '';
        const tid = threadIdFor(me.id, otherId);
        dispatch({
          type: 'ENSURE_THREAD',
          thread: { id: tid, participantIds: [me.id, otherId], messages: [] },
        });
        return tid;
      },

      goLive(title) {
        const me = getCurrent();
        if (!me) return '';
        const id = uid('live');
        dispatch({
          type: 'GO_LIVE',
          stream: {
            id,
            hostId: me.id,
            title: title || `${me.name} is live`,
            startedAt: Date.now(),
            viewers: 0,
            viewerIds: [],
            active: true,
            kind: 'user',
            chat: [],
          },
        });
        return id;
      },

      endLive(streamId) {
        const me = getCurrent();
        dispatch({ type: 'END_LIVE', streamId, hostId: me?.id ?? '' });
      },

      joinStream(streamId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'JOIN_STREAM', streamId, userId: me.id });
      },

      leaveStream(streamId) {
        const me = getCurrent();
        if (!me) return;
        dispatch({ type: 'LEAVE_STREAM', streamId, userId: me.id });
      },

      sendLiveChat(streamId, text) {
        const me = getCurrent();
        if (!me) return;
        dispatch({
          type: 'LIVE_CHAT',
          message: { id: uid('lc'), streamId, senderId: me.id, text, createdAt: Date.now() },
        });
      },

      addEvent(data) {
        const me = getCurrent();
        if (!me) return;
        const event: CalendarEvent = { ...data, id: uid('e'), createdBy: me.id };
        dispatch({ type: 'ADD_EVENT', event });
      },

      addAlert(data) {
        const me = getCurrent();
        if (!me) return;
        const alert: CommunityAlert = {
          ...data,
          id: uid('a'),
          createdAt: Date.now(),
          createdBy: me.id,
        };
        dispatch({ type: 'ADD_ALERT', alert });
      },

      dismissAlert(id) {
        dispatch({ type: 'DISMISS_ALERT', id });
      },
    };
  }, []);

  const value = useMemo<Store>(() => ({ ...state, ...actions }), [state, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export { useStore };

export function pickGooglePhoto(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GOOGLE_PHOTOS[h % GOOGLE_PHOTOS.length];
}