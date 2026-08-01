import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
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
  followUser as followUserRemote,
  loadFollows,
  unfollowUser as unfollowUserRemote,
} from '../utils/follows';
import { createNotification } from '../utils/notifications';
import type { Notification } from '../types';
import { createGroupRemote, loadGroups } from '../utils/groups';
import { apiFetch } from '../lib/api';
import {
  AUTH_EVENTS,
  onAuthChange,
  persistIdentityCookiesFromLocalStorage,
  restoreIdentitySession,
  signOutIdentity,
} from '../lib/auth';
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

const wait = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

type SessionOutcome =
  | { kind: 'user'; user: User }
  /** The request carried no usable session — it may just need a token refresh. */
  | { kind: 'unauthorized' }
  /** The account exists but is not allowed in (blocked); refreshing will not help. */
  | { kind: 'forbidden' };

// Ask the API who is signed in. The request carries the Identity session two ways
// — the `nf_jwt` cookie and a bearer token — so it is authorized even when cookies
// are unavailable (private browsing, or a cross-origin API proxy).
//
// `retries` exists for the moment right after a sign-in: Identity has just written
// the cookie, and a single 401 there used to bounce the member back to the login
// screen instead of letting them in.
async function loadSession({ retries = 0 }: { retries?: number } = {}): Promise<SessionOutcome> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await apiFetch(`/api/session?refresh=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) return { kind: 'user', user: (await response.json()) as User };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 401) {
      if (attempt >= retries) return { kind: 'unauthorized' };
      await wait(250 * (attempt + 1));
      continue;
    }
    throw new Error('Failed to load the signed-in account');
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Keep a live ref so action callbacks always read the freshest state,
  // regardless of how the actions memo is memoized.
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeUserIdRef = useRef(state.currentUserId);
  activeUserIdRef.current = state.currentUserId;
  const pendingPostIdsRef = useRef(new Set<string>());
  const postSavePromisesRef = useRef(new Map<string, Promise<boolean>>());

  useEffect(() => {
    let active = true;

    const forgetSignedInUser = () => {
      activeUserIdRef.current = null;
      pendingPostIdsRef.current.clear();
      postSavePromisesRef.current.clear();
      clearCachedAppState();
      dispatch({ type: 'SIGN_OUT' });
      dispatch({ type: 'AUTH_CHECKED' });
      // Drop any deep link that belongs to the previous session; the gate renders
      // the landing page from state, so no navigation or reload is needed.
      if (window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    };

    // Pull the account behind the current Identity session into the store. This is
    // the single path that takes a member from the sign-in form to the dashboard —
    // it never reloads the page, it just swaps the state the gate renders from.
    const syncSignedInUser = async (retries = 0) => {
      persistIdentityCookiesFromLocalStorage();
      try {
        const session = await loadSession({ retries });
        if (!active) return;
        if (session.kind === 'user') {
          dispatch({ type: 'SIGN_IN', user: session.user });
        } else if (session.kind === 'forbidden') {
          // The account is blocked: end the session rather than leave the member
          // staring at a login form that keeps accepting their password.
          forgetSignedInUser();
          void signOutIdentity().catch(() => {
            // Nothing to clean up if the session has already gone.
          });
        } else {
          console.warn('Identity reported a session but /api/session did not authorize it.');
        }
      } catch (err) {
        console.error('Failed to sync session', err);
      } finally {
        if (active) dispatch({ type: 'AUTH_CHECKED' });
      }
    };

    // Restore the session on every page load, before anything renders or any
    // query runs. The local Identity SDK failing to produce a user is not proof
    // that the member signed out — the stored access token may simply have
    // expired, and the API can still mint a new one from the refresh cookie.
    // Signing out here on the first miss is what sent members who refreshed the
    // browser back to the landing page.
    const refresh = async () => {
      try {
        const { error: supabaseSessionError } = await supabase.auth.getSession();
        if (supabaseSessionError) {
          console.warn('Failed to validate the Supabase session', supabaseSessionError);
        }
        const identity = await restoreIdentitySession().catch((error) => {
          console.warn('Could not restore the Identity session locally', error);
          return null;
        });
        if (!active) return;
        // With a local session, retry once to cover the token being rewritten
        // mid-flight. Without one, still ask the API: it authorizes from the
        // refresh cookie and is the only thing that can say "signed out".
        await syncSignedInUser(identity?.id ? 1 : 0);
      } catch (err) {
        console.error('Failed to restore session', err);
      } finally {
        if (active) dispatch({ type: 'AUTH_CHECKED' });
      }
    };
    refresh();

    // Identity auth events replace the old widget callbacks. They also fire from
    // other tabs, so signing in or out anywhere keeps every open tab in step.
    const unsubscribeFromIdentity = onAuthChange((event) => {
      if (!active) return;
      switch (event) {
        case AUTH_EVENTS.LOGIN:
        case AUTH_EVENTS.RECOVERY:
          void syncSignedInUser(3);
          break;
        case AUTH_EVENTS.TOKEN_REFRESH:
          // Keep the cookie our API reads in step with the refreshed token.
          persistIdentityCookiesFromLocalStorage();
          break;
        case AUTH_EVENTS.USER_UPDATED:
          void syncSignedInUser();
          break;
        case AUTH_EVENTS.LOGOUT:
          forgetSignedInUser();
          break;
        default:
          break;
      }
    });

    const { data: supabaseAuthListener } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_OUT') {
        // Supabase only backs storage and public profiles here — Netlify Identity
        // owns the session. Losing the Supabase session must not sign anybody out
        // of the app, which is what used to throw signed-in members back to the
        // login screen in a loop.
        if (!activeUserIdRef.current) return;
        console.warn('The Supabase session ended; the Netlify Identity session is unaffected.');
      }
    });

    return () => {
      active = false;
      unsubscribeFromIdentity();
      supabaseAuthListener.subscription.unsubscribe();
    };
  }, []);

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

  // Hydrate the signed-in user's profile from the database
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

  useEffect(() => {
    if (!state.currentUserId) return;
    loadGroups()
      .then((groups) => dispatch({ type: 'HYDRATE_GROUPS', groups }))
      .catch((err) => console.error('Failed to load groups', err));
  }, [state.currentUserId]);

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
        const graph = await loadFollows(userId);
        if (!cancelled && activeUserIdRef.current === userId) {
          dispatch({ type: 'HYDRATE_FOLLOWS', following: graph.following, followers: graph.followers });
        }
      },
      { intervalMs: 25000, onError: (error) => console.error('Failed to load follows', error) },
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
        if (!cancelled && activeUserIdRef.current === userId) {
          dispatch({ type: 'SET_POSTS_LOADING', loading: false });
        }
      } finally {
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

  useEffect(() => {
    if (!state.currentUserId) return;
    let cancelled = false;
    // Periodically confirm the session is still good. A single unauthorized answer
    // is not proof that the member signed out — the access token may simply have
    // aged out — so refresh the Identity session and only sign out when Identity
    // itself no longer has one. Signing out on the first 401 is what produced the
    // loop back to the login screen.
    const endSession = () => {
      dispatch({ type: 'SIGN_OUT' });
      void signOutIdentity().catch(() => {
        // The session is already gone locally; nothing left to clean up.
      });
    };

    const verify = async () => {
      try {
        const session = await loadSession({ retries: 1 });
        if (cancelled) return;
        if (session.kind === 'user') {
          dispatch({ type: 'SIGN_IN', user: session.user });
          return;
        }
        if (session.kind === 'forbidden') {
          endSession();
          return;
        }

        const identity = await restoreIdentitySession();
        if (cancelled) return;
        if (!identity?.id) {
          endSession();
          return;
        }

        const retried = await loadSession({ retries: 1 });
        if (cancelled) return;
        if (retried.kind === 'user') dispatch({ type: 'SIGN_IN', user: retried.user });
        else if (retried.kind === 'forbidden') endSession();
        else console.warn('The signed-in account could not be refreshed; keeping the session.');
      } catch (error) {
        console.error('Failed to verify session', error);
      }
    };
    const interval = setInterval(() => { void verify(); }, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.currentUserId]);

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
        void signOutIdentity().catch((err) => console.error('Failed to sign out via identity', err));
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

      // Following is instant and one-directional: the button flips first, the row
      // is written after, and a failure puts the button back the way it was.
      async followUser(otherId) {
        const me = getCurrent();
        if (!me || otherId === me.id) return;
        if (stateRef.current.following.includes(otherId)) return;
        dispatch({ type: 'FOLLOW_USER', userId: otherId });
        try {
          await followUserRemote(otherId);
          emit({
            userId: otherId,
            actorId: me.id,
            actorName: userName(me),
            type: 'follow',
            content: `${userName(me)} started following you`,
          });
        } catch (err) {
          console.error('Failed to follow member', err);
          dispatch({ type: 'UNFOLLOW_USER', userId: otherId });
        }
      },
      async unfollowUser(otherId) {
        const me = getCurrent();
        if (!me) return;
        if (!stateRef.current.following.includes(otherId)) return;
        dispatch({ type: 'UNFOLLOW_USER', userId: otherId });
        try {
          await unfollowUserRemote(otherId);
        } catch (err) {
          console.error('Failed to unfollow member', err);
          dispatch({ type: 'FOLLOW_USER', userId: otherId });
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

      goLive(title, sourceUrl) {
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
            ...(sourceUrl?.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
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