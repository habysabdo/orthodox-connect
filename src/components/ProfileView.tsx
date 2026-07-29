import { ArrowLeft, CalendarDays, CheckCircle2, Church, Edit3, Globe, KeyRound, Loader2, LogOut, Mail, MessageSquare, Share2, UserPlus, Users } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useStore, friendsOf, friendshipBetween } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/utils/format';
import { useEffect, useState } from 'react';
import { PARISHES, type Post } from '@/types';
import { PostCard } from './PostCard';
import { hasAdminAccess } from '@/utils/users';
import { isImageFile, uploadProfilePhoto, validateImage } from '@/utils/imageUpload';
import { loadPostsByAuthor } from '@/utils/posts';
import { firstName, userName, userPhoto } from '@/utils/postSafety';
import { AvatarCropModal } from './AvatarCropModal';
import { supabase } from '@/lib/supabase';

/**
 * The member's posts, newest first: the copies held in the store win over the
 * fetched ones because they carry the freshest likes and comments as well as
 * anything published in this session. Group posts are deliberately left out —
 * a profile shows what the member shared with the whole community.
 */
function mergeProfilePosts(fetched: Post[], fromStore: Post[]): Post[] {
  const byId = new Map<string, Post>();
  for (const post of fetched) if (post?.id) byId.set(post.id, post);
  for (const post of fromStore) if (post?.id) byId.set(post.id, post);
  return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function ProfileView() {
  const state = useStore();
  const { t } = useI18n();
  const { profileUserId, setShareOpen, setView, setOpenThreadId } = useUI();
  const me = state.currentUserId
    ? state.users.find((user) => user?.id === state.currentUserId)
    : undefined;
  // `/profile` (or /profile/<my id>) is the editable own profile; any other id
  // is another member's public profile.
  const isOwnProfile = !profileUserId || profileUserId === state.currentUserId;
  const profileUser = isOwnProfile ? me : state.users.find((u) => u?.id === profileUserId);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(me?.name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [parish, setParish] = useState(me?.parish ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [photo, setPhoto] = useState(me?.photo ?? '');
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState('');
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar');
  const [authoredPosts, setAuthoredPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // The feed only holds a page of recent posts, so a profile fetches everything
  // its member authored rather than filtering whatever happens to be loaded.
  const viewedUserId = profileUser?.id;
  useEffect(() => {
    if (!state.currentUserId || !viewedUserId) return;
    let cancelled = false;
    setAuthoredPosts([]);
    setPostsLoading(true);
    loadPostsByAuthor(viewedUserId)
      .then((posts) => {
        if (!cancelled) setAuthoredPosts(posts);
      })
      .catch((error) => console.error('Failed to load the profile posts', error))
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.currentUserId, viewedUserId]);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  if (!me) return null;

  if (!profileUser) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        {state.usersLoading ? (
          <>
            <Loader2 size={26} className="animate-spin text-gold-300" />
            <p className="mt-3 text-sm text-ink-400">Loading profile…</p>
          </>
        ) : (
          <>
            <Users size={30} className="text-gold-300" />
            <p className="mt-3 font-semibold text-ink-100">This member could not be found</p>
            <p className="mt-1 text-sm text-ink-400">The account may have been removed.</p>
            <button onClick={() => setView('feed')} className="gold-btn mt-5 py-2 text-xs">
              <ArrowLeft size={14} /> Back to the feed
            </button>
          </>
        )}
      </div>
    );
  }

  const friends = friendsOf(state, profileUser.id);
  const displayName = userName(profileUser);
  const profilePosts = mergeProfilePosts(
    authoredPosts,
    state.posts.filter((p) => p?.authorId === profileUser.id && !p.groupId),
  );
  const userEvents = state.events.filter((e) => e?.createdBy === profileUser.id);
  const friendship = isOwnProfile ? undefined : friendshipBetween(state, me.id, profileUser.id);

  const messageMember = () => {
    const threadId = state.openThreadWith(profileUser.id);
    setOpenThreadId(threadId);
    setView('messenger');
  };

  const save = async () => {
    setPhotoError('');
    const changingPassword = newPassword.length > 0 || confirmPassword.length > 0;
    if (changingPassword && newPassword.length < 6) {
      setPhotoError('New password must be at least 6 characters.');
      return;
    }
    if (changingPassword && newPassword !== confirmPassword) {
      setPhotoError('New password and confirmation do not match.');
      return;
    }
    setUploadingPhoto(true);
    setPhotoProgress(0);
    try {
      let savedPhoto = photo;
      if (pendingPhoto) {
        // Straight into the Supabase Storage `avatars` bucket, so the photo is
        // never carried through a function request that a large file would blow
        // past. What lands on the profile record is its public URL.
        savedPhoto = await uploadProfilePhoto(pendingPhoto, setPhotoProgress);
      }

      await state.completeOnboarding({ name: name.trim() || userName(me), age: me.age ?? 0, photo: savedPhoto, parish, bio: bio.trim() });
      if (changingPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
      setPendingPhoto(null);
      setPendingPhotoPreview(null);
      setPhoto(savedPhoto);
      setNewPassword('');
      setConfirmPassword('');
      setEditOpen(false);
      setSuccessToast(changingPassword ? 'Profile and password updated successfully!' : 'Profile updated successfully!');
    } catch (error) {
      console.error('Saving the profile failed', error);
      setPhotoError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  };

  const clearPendingPhoto = () => {
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
  };

  const openEditor = () => {
    clearPendingPhoto();
    setName(me.name ?? '');
    setBio(me.bio ?? '');
    setParish(me.parish ?? '');
    setPhoto(userPhoto(me));
    setNewPassword('');
    setConfirmPassword('');
    setPhotoError('');
    setEditOpen(true);
  };

  const closeEditor = () => {
    closeCropper();
    clearPendingPhoto();
    setPhoto(userPhoto(me));
    setNewPassword('');
    setConfirmPassword('');
    setEditOpen(false);
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isImageFile(file)) {
      setPhotoError('Please select a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    setPhotoError('');
    closeCropper();
    setCropFileName(file.name);
    setCropSource(URL.createObjectURL(file));
  };

  const saveCroppedPhoto = async (file: File) => {
    // The cropped JPEG is what gets uploaded, so it is the one that has to fit.
    const validationError = validateImage(file, 'avatar');
    if (validationError) {
      setPhotoError(validationError);
      closeCropper();
      return;
    }
    setPhotoError('');
    if (pendingPhotoPreview) URL.revokeObjectURL(pendingPhotoPreview);
    const previewUrl = URL.createObjectURL(file);
    setPendingPhoto(file);
    setPendingPhotoPreview(previewUrl);
    setPhoto(previewUrl);
    closeCropper();
  };

  return (
    <div className="space-y-4">
      {successToast && (
        <div className="fixed right-4 top-4 z-[70] flex max-w-sm items-center gap-3 rounded-xl border border-emerald-400/30 bg-ink-900/95 px-4 py-3 text-sm font-medium text-emerald-100 shadow-2xl backdrop-blur" role="status" aria-live="polite">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
          {successToast}
        </div>
      )}
      {!isOwnProfile && (
        <button onClick={() => setView('feed')} className="ghost-btn py-2 text-xs">
          <ArrowLeft size={14} /> Back to the feed
        </button>
      )}

      {/* Banner + identity */}
      <div className="card overflow-hidden">
        <div className="relative h-36 bg-gradient-to-r from-gold-700/30 via-ink-800 to-ink-850 md:h-44">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(212,175,55,0.15),transparent_60%)]" />
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between">
            <Avatar src={userPhoto(profileUser)} name={displayName} size={96} ring="gold" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isOwnProfile ? (
                <>
                  <button onClick={() => setShareOpen(true)} className="ghost-btn py-2 text-xs">
                    <Share2 size={13} /> {t('share.invite')}
                  </button>
                  <button onClick={openEditor} className="ghost-btn py-2 text-xs">
                    <Edit3 size={13} /> {t('profile.editProfile')}
                  </button>
                  <button
                    type="button"
                    onClick={state.signOut}
                    className="group flex items-center gap-1.5 rounded-lg border border-red-400/45 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition-all hover:border-red-300/70 hover:bg-red-500/20 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                    aria-label={t('common.signOut')}
                  >
                    <LogOut size={14} className="transition-transform group-hover:translate-x-0.5" />
                    {t('common.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={messageMember} className="ghost-btn py-2 text-xs">
                    <MessageSquare size={13} /> Message
                  </button>
                  {friendship?.status === 'accepted' ? (
                    <span className="gold-chip">Connected</span>
                  ) : friendship?.status === 'outgoing' ? (
                    <span className="ghost-btn cursor-default py-2 text-xs opacity-70">Request sent</span>
                  ) : friendship?.status === 'incoming' ? (
                    <button onClick={() => void state.acceptFriend(profileUser.id)} className="gold-btn py-2 text-xs">
                      <UserPlus size={13} /> Accept request
                    </button>
                  ) : (
                    <button onClick={() => void state.addFriend(profileUser.id)} className="gold-btn py-2 text-xs">
                      <UserPlus size={13} /> Connect
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold">{displayName}</h1>
              {hasAdminAccess(profileUser) && <span className="gold-chip">{t('profile.adminOwner')}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-400">
              <span className="flex items-center gap-1"><Church size={12} /> {profileUser.parish || t('profile.noParishSet')}</span>
              {profileUser.email && <span className="flex items-center gap-1"><Mail size={12} /> {profileUser.email}</span>}
              {(profileUser.age ?? 0) > 0 && <span>{t('profile.age', { age: profileUser.age })}</span>}
              <span>{t('profile.joined', { time: timeAgo(profileUser.joinedAt ?? 0) })}</span>
            </div>
            {profileUser.bio
              ? <p className="mt-3 text-sm text-ink-200">{profileUser.bio}</p>
              : !isOwnProfile && <p className="mt-3 text-sm text-ink-500">This member hasn’t written a bio yet.</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid gap-3 ${isOwnProfile ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {isOwnProfile && <StatCard icon={<Users size={16} />} label={t('profile.connections')} value={friends.length} />}
        <StatCard icon={<Edit3 size={16} />} label={t('profile.posts')} value={profilePosts.length} />
        <StatCard icon={<CalendarDays size={16} />} label={t('profile.events')} value={userEvents.length} />
      </div>

      {/* Settings — language (own profile only) */}
      {isOwnProfile && (
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
            <Globe size={14} className="text-gold-300" /> {t('settings.title')}
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-100">{t('settings.language')}</div>
              <div className="mt-0.5 text-xs text-ink-400">{t('settings.languageDesc')}</div>
            </div>
            <LanguageSwitcher />
          </div>
        </section>
      )}

      {/* Posts and shared media by this member */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
          {isOwnProfile ? t('profile.yourPosts') : `Posts by ${firstName(displayName)}`}
        </h2>
        {postsLoading && profilePosts.length === 0 ? (
          <div className="card flex items-center justify-center gap-2 py-10 text-sm text-ink-400">
            <Loader2 size={16} className="animate-spin text-gold-300" /> Loading posts…
          </div>
        ) : profilePosts.length === 0 ? (
          <div className="card py-10 text-center text-sm text-ink-400">
            {isOwnProfile ? t('profile.noPosts') : 'This member hasn’t shared anything yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {profilePosts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={uploadingPhoto ? () => undefined : closeEditor} size="md">
        <div className="p-5">
          <h2 className="font-serif text-xl font-semibold">{t('profile.editTitle')}</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar src={photo} name={name} size={72} ring="gold" />
            <label className="ghost-btn cursor-pointer text-xs">
              <Edit3 size={13} /> {uploadingPhoto ? 'Uploading…' : t('profile.changePhoto')}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} disabled={uploadingPhoto} className="hidden" />
            </label>
          </div>
          {uploadingPhoto && pendingPhoto && (
            <div className="mt-3" aria-live="polite">
              <div className="mb-1 flex items-center justify-between text-[11px] text-ink-400">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Uploading your photo
                </span>
                <span>{photoProgress}%</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-ink-800"
                role="progressbar"
                aria-valuenow={photoProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-gold-400 transition-[width]" style={{ width: `${photoProgress}%` }} />
              </div>
            </div>
          )}
          {photoError && <p role="alert" className="mt-2 text-sm text-red-300">{photoError}</p>}
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">{t('profile.fullName')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">{t('profile.parish')}</label>
              <input
                value={parish}
                onChange={(e) => setParish(e.target.value)}
                list="parish-suggestions-edit"
                placeholder={t('profile.parishPlaceholder')}
                className="input"
                autoComplete="off"
              />
              <datalist id="parish-suggestions-edit">
                {PARISHES.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">{t('profile.bio')}</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input resize-none" placeholder={t('profile.bioPlaceholder')} />
            </div>
            <fieldset className="rounded-xl border border-ink-700/80 bg-ink-900/45 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-300">
                <span className="flex items-center gap-1.5"><KeyRound size={13} className="text-gold-300" /> Change Password</span>
              </legend>
              <p className="mb-3 text-xs text-ink-500">Optional. Leave both fields blank to keep your current password.</p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="profile-new-password" className="mb-1 block text-xs font-medium text-ink-300">New Password</label>
                  <input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="profile-confirm-password" className="mb-1 block text-xs font-medium text-ink-300">Confirm New Password</label>
                  <input
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                  />
                </div>
              </div>
            </fieldset>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={closeEditor} disabled={uploadingPhoto} className="ghost-btn py-2 disabled:opacity-50">{t('common.cancel')}</button>
            <button onClick={() => void save()} disabled={uploadingPhoto} className="gold-btn py-2 disabled:cursor-not-allowed disabled:opacity-50">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      <AvatarCropModal
        key={cropSource ?? 'closed-cropper'}
        imageSrc={cropSource}
        fileName={cropFileName}
        onClose={closeCropper}
        onConfirm={saveCroppedPhoto}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">{icon}</div>
      <div>
        <div className="text-xl font-bold text-ink-100">{value}</div>
        <div className="text-xs text-ink-400">{label}</div>
      </div>
    </div>
  );
}
