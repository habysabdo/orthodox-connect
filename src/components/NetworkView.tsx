import { Church, Users, Video, UserCheck, UserPlus } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { useI18n } from '@/store/i18n';

export function NetworkView() {
  const state = useStore();
  const { setView, setOpenThreadId, setCallPeerId, setCallGroupLabel } = useUI();
  const { t } = useI18n();
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me) return null;

  const others = state.users.filter((u) => u.id !== me.id);
  const following = others.filter((u) => me.following.includes(u.id));
  const followers = others.filter((u) => me.followers.includes(u.id));
  const mutuals = following.filter((u) => me.followers.includes(u.id));
  const suggested = others.filter((u) => !me.following.includes(u.id));

  const message = (id: string) => {
    const tid = state.openThreadWith(id);
    setOpenThreadId(tid);
    setView('messenger');
  };

  return (
    <div className="space-y-5">
      <header className="card p-5">
        <h1 className="font-serif text-2xl font-semibold">{t('network.title')}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-ink-400">
            <Users size={14} className="text-gold-300" />
            <strong className="text-ink-100">{following.length}</strong> {t('network.connections')}
          </span>
          <span className="flex items-center gap-1.5 text-ink-400">
            <UserCheck size={14} className="text-gold-300" />
            <strong className="text-ink-100">{followers.length}</strong> {t('profile.followers')}
          </span>
          <span className="flex items-center gap-1.5 text-ink-400">
            <UserPlus size={14} className="text-gold-300" />
            <strong className="text-ink-100">{mutuals.length}</strong> mutual
          </span>
        </div>
      </header>

      {/* Group Video Rooms */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
          <Video size={14} /> {t('network.groupRooms')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <GroupRoomCard
            title="Bible Study — Romans"
            subtitle="Wednesdays 8 PM"
            parish="St. Nicholas Cathedral"
            participants={3}
            onJoin={() => { setCallPeerId('u_michael'); setCallGroupLabel('Bible Study — Romans'); }}
          />
          <GroupRoomCard
            title="Youth Fellowship"
            subtitle="Fridays 7 PM"
            parish="St. George Coptic Orthodox"
            participants={5}
            onJoin={() => { setCallPeerId('u_michael'); setCallGroupLabel('Youth Fellowship'); }}
          />
          <GroupRoomCard
            title="Women's Prayer Circle"
            subtitle="Saturdays 9 AM"
            parish="Theotokos of Axion Estin"
            participants={4}
            onJoin={() => { setCallPeerId('u_theresa'); setCallGroupLabel("Women's Prayer Circle"); }}
          />
          <GroupRoomCard
            title="Choir Rehearsal"
            subtitle="Thursdays 6 PM"
            parish="St. Sophia Cathedral"
            participants={6}
            onJoin={() => { setCallPeerId('u_sophia'); setCallGroupLabel('Choir Rehearsal'); }}
          />
        </div>
      </section>

      {/* Suggested */}
      {suggested.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
            <UserPlus size={14} /> {t('network.suggested')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((u) => (
              <div key={u.id} className="card p-4 text-center">
                <div className="mx-auto w-fit">
                  <Avatar src={u.photo} name={u.name} size={72} online={u.online} ring="gold" />
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 truncate font-semibold text-ink-100">
                  {u.name}
                  {u.verified && <VerifiedBadge />}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-ink-400">
                  <Church size={11} /> {u.parish}
                </div>
                <div className="mt-1 text-[10px] text-ink-500">
                  {u.followers.length} {t('profile.followers')}
                </div>
                <button
                  onClick={() => state.follow(u.id)}
                  className="gold-btn mt-3 w-full py-2 text-xs"
                >
                  {t('common.follow')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Following */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
          <Users size={14} /> {t('network.yourConnections')}
        </h2>
        {following.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title={t('network.noConnections')}
            subtitle={t('network.noConnectionsSub')}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {following.map((u) => (
              <div key={u.id} className="card group p-4 text-center">
                <div className="mx-auto w-fit">
                  <Avatar src={u.photo} name={u.name} size={72} online={u.online} ring="gold" />
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 truncate font-semibold text-ink-100">
                  {u.name}
                  {u.verified && <VerifiedBadge />}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-ink-400">
                  <Church size={11} /> {u.parish}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => message(u.id)} className="ghost-btn py-2 text-xs">
                    {t('common.message')}
                  </button>
                  <button
                    onClick={() => { setCallPeerId(u.id); setCallGroupLabel(`Video call with ${u.name}`); }}
                    className="ghost-btn py-2 text-xs"
                    title="Video call"
                  >
                    <Video size={13} /> {t('common.call')}
                  </button>
                </div>
                <button
                  onClick={() => state.unfollow(u.id)}
                  className="mt-2 w-full rounded-xl border border-ink-600 py-2 text-xs font-semibold text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
                >
                  {t('common.following')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-gold-400" fill="currentColor">
      <path d="M12 1l2.5 4.5L19.5 6 18 11l4.5 3-4 3.5 1 5L14 20l-2 4-2-4-5.5 2.5 1-5L2 14l4.5-3L5 6l5-.5L12 1z" opacity="0.2" />
      <path d="M9.5 12l2 2 4-4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupRoomCard({
  title,
  subtitle,
  parish,
  participants,
  onJoin,
}: {
  title: string;
  subtitle: string;
  parish: string;
  participants: number;
  onJoin: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="card group relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-400/15 text-gold-300">
            <Video size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink-100">{title}</div>
            <div className="text-xs text-ink-400">{subtitle}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-ink-400">
          <Church size={11} /> {parish}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <Users size={12} /> {participants} {t('network.joined')}
          </span>
          <button onClick={onJoin} className="gold-btn py-1.5 text-xs">
            <Video size={12} /> {t('common.joinRoom')}
          </button>
        </div>
      </div>
    </div>
  );
}
