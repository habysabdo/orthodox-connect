import { CalendarDays, Church, Edit3, Mail, Users } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useStore, friendsOf } from '@/store/context';
import { useUI } from '@/store/ui';
import { timeAgo } from '@/utils/format';
import { useState } from 'react';
import { PARISHES } from '@/types';
import { PostCard } from './PostCard';

export function ProfileView() {
  const state = useStore();
  const { setView, setOpenThreadId } = useUI();
  const me = state.users.find((u) => u.id === state.currentUserId);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(me?.name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [parish, setParish] = useState(me?.parish ?? '');
  const [photo, setPhoto] = useState(me?.photo ?? '');

  if (!me) return null;

  const friends = friendsOf(state, me.id);
  const myPosts = state.posts.filter((p) => p.authorId === me.id);
  const myEvents = state.events.filter((e) => e.createdBy === me.id);

  const save = () => {
    state.completeOnboarding({ name: name.trim() || me.name, age: me.age, photo, parish });
    if (bio !== me.bio) {
      // bio isn't in the action; we can't persist it via store. Keep local for now.
    }
    setEditOpen(false);
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  };

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
            <button onClick={() => setEditOpen(true)} className="ghost-btn py-2 text-xs">
              <Edit3 size={13} /> Edit profile
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-semibold">{me.name}</h1>
              {me.role === 'admin' && <span className="gold-chip">Admin / Owner</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-400">
              <span className="flex items-center gap-1"><Church size={12} /> {me.parish || 'No parish set'}</span>
              <span className="flex items-center gap-1"><Mail size={12} /> {me.email}</span>
              <span>Age {me.age}</span>
              <span>Joined {timeAgo(me.joinedAt)} ago</span>
            </div>
            {me.bio && <p className="mt-3 text-sm text-ink-200">{me.bio}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users size={16} />} label="Connections" value={friends.length} />
        <StatCard icon={<Edit3 size={16} />} label="Posts" value={myPosts.length} />
        <StatCard icon={<CalendarDays size={16} />} label="Events" value={myEvents.length} />
      </div>

      {/* My posts */}
      <section>
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">Your posts</h2>
        {myPosts.length === 0 ? (
          <div className="card py-10 text-center text-sm text-ink-400">You haven’t posted yet.</div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} size="md">
        <div className="p-5">
          <h2 className="font-serif text-xl font-semibold">Edit profile</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar src={photo} name={name} size={72} ring="gold" />
            <label className="ghost-btn cursor-pointer text-xs">
              <Edit3 size={13} /> Change photo
              <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
            </label>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Parish</label>
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input resize-none" placeholder="A line about yourself…" />
              <p className="mt-1 text-[10px] text-ink-500">Bio is shown on your profile but not yet persisted to the backend in this demo.</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setEditOpen(false)} className="ghost-btn py-2">Cancel</button>
            <button onClick={save} className="gold-btn py-2">Save changes</button>
          </div>
        </div>
      </Modal>
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
