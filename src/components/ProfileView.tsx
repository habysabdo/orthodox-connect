import { CalendarDays, Church, Edit3, Mail, Phone, Users, Video, Grid3x3, Bookmark, Heart } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, Modal } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/store/i18n';
import { timeAgo } from '@/utils/format';
import { PARISHES } from '@/types';
import { PostCard } from './PostCard';
import type { Post } from '@/types';

type Tab = 'posts' | 'saved' | 'liked';

export function ProfileView() {
  const state = useStore();
  const { setView, setOpenThreadId, setCallPeerId, setCallGroupLabel } = useUI();
  const { t } = useI18n();
  const me = state.users.find((u) => u.id === state.currentUserId);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(me?.name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [parish, setParish] = useState(me?.parish ?? '');
  const [photo, setPhoto] = useState(me?.photo ?? '');
  const [tab, setTab] = useState<Tab>('posts');
  const [lightbox, setLightbox] = useState<Post | null>(null);

  if (!me) return null;

  const myPosts = state.posts.filter((p) => p.authorId === me.id);
  const savedPosts = myPosts.filter((p) => p.bookmarks?.includes(me.id));
  const likedPosts = myPosts.filter((p) => p.likes.includes(me.id));

  const save = () => {
    state.completeOnboarding({ name: name.trim() || me.name, age: me.age, photo, parish });
    setEditOpen(false);
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  };

  const tabPosts = tab === 'posts' ? myPosts : tab === 'saved' ? savedPosts : likedPosts;
  const followerCount = me.followers.length;
  const followingCount = me.following.length;

  return (
    <div className="space-y-4">
      {/* Banner + identity */}
      <div className="card overflow-hidden">
        <div className="relative h-36 bg-gradient-to-r from-gold-700/30 via-ink-800 to-ink-850 md:h-44">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(212,175,55,0.15),transparent_60%)]" />
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between">
            <Avatar src={me.photo} name={me.name} size={96} ring="gold" />
            <div className="flex gap-2">
              <button
                onClick={() => { setCallPeerId(me.id); setCallGroupLabel(`Call with ${me.name}`); }}
                className="ghost-btn p-2 text-xs"
                title="Audio call"
              >
                <Phone size={14} />
              </button>
              <button
                onClick={() => { setCallPeerId(me.id); setCallGroupLabel(`Video call with ${me.name}`); }}
                className="ghost-btn p-2 text-xs"
                title="Video call"
              >
                <Video size={14} />
              </button>
              <button onClick={() => setEditOpen(true)} className="ghost-btn py-2 text-xs">
                <Edit3 size={13} /> Edit profile
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold">{me.name}</h1>
              {me.role === 'admin' && <span className="gold-chip">Admin / Owner</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-400">
              <span className="flex items-center gap-1"><Church size={12} /> {me.parish || t('nav.noParish')}</span>
              <span className="flex items-center gap-1"><Mail size={12} /> {me.email}</span>
              <span>Age {me.age}</span>
              <span>Joined {timeAgo(me.joinedAt)} ago</span>
            </div>
            {me.bio && <p className="mt-3 text-sm text-ink-200">{me.bio}</p>}

            {/* Follow stats */}
            <div className="mt-3 flex gap-5">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-ink-100">{followingCount}</span>
                <span className="text-xs text-ink-400">{t('profile.following')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-ink-100">{followerCount}</span>
                <span className="text-xs text-ink-400">{t('profile.followers')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-ink-100">{myPosts.length}</span>
                <span className="text-xs text-ink-400">{t('profile.posts')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users size={16} />} label={t('profile.connections')} value={followingCount} />
        <StatCard icon={<Edit3 size={16} />} label={t('profile.posts')} value={myPosts.length} />
        <StatCard icon={<CalendarDays size={16} />} label={t('profile.events')} value={state.events.filter((e) => e.createdBy === me.id).length} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-ink-700">
        <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={<Grid3x3 size={16} />} label={t('profile.posts')} />
        <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} icon={<Bookmark size={16} />} label={t('profile.saved')} />
        <TabButton active={tab === 'liked'} onClick={() => setTab('liked')} icon={<Heart size={16} />} label={t('profile.liked')} />
      </div>

      {/* Post grid */}
      {tabPosts.length === 0 ? (
        <div className="card py-10 text-center text-sm text-ink-400">
          {tab === 'posts' && "You haven't posted yet."}
          {tab === 'saved' && 'No saved posts yet.'}
          {tab === 'liked' && 'No liked posts yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {tabPosts.map((p) => (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setLightbox(p)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-ink-800"
            >
              {p.image ? (
                <img
                  src={p.image}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center">
                  <span className="line-clamp-4 text-[10px] text-ink-400">{p.text}</span>
                </div>
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-3 text-white">
                  <span className="flex items-center gap-1 text-xs">
                    <Heart size={14} className="fill-white" /> {p.likes.length}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <Edit3 size={14} /> {p.comments.length}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Lightbox / post detail */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <PostCard post={lightbox} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} size="md">
        <div className="p-5">
          <h2 className="font-serif text-xl font-semibold">{t('profile.edit')}</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar src={photo} name={name} size={72} ring="gold" />
            <label className="ghost-btn cursor-pointer text-xs">
              <Edit3 size={13} /> {t('profile.changePhoto')}
              <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
            </label>
          </div>
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
                placeholder="Type your church or parish"
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
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setEditOpen(false)} className="ghost-btn py-2">{t('common.cancel')}</button>
            <button onClick={save} className="gold-btn py-2">{t('common.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-gold-400 text-gold-200'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      {icon}
      {label}
    </button>
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
