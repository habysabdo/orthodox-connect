import { Check, Church, Mail, UserPlus, Users, X } from 'lucide-react';
import { Avatar, EmptyState, PeopleSkeleton } from './ui';
import { ProfileLink } from './ProfileLink';
import { useStore, friendsOf, friendshipBetween } from '@/store/context';
import { useUI } from '@/store/ui';
import { timeAgo } from '@/utils/format';

export function NetworkView() {
  const state = useStore();
  const { setView, setOpenThreadId } = useUI();
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me) return null;

  const friends = friendsOf(state, me.id);
  const others = Array.from(new Map(
    state.users.filter((user) => user.id !== me.id).map((user) => [user.id, user]),
  ).values());
  // Newest members first so a fresh sign-up surfaces at the top of suggestions.
  const suggestions = others
    .filter((u) => {
      const f = friendshipBetween(state, me.id, u.id);
      return !f || f.status === 'none' || f.status === 'outgoing';
    })
    .sort((a, b) => b.joinedAt - a.joinedAt);
  const incoming = others.filter((u) => {
    const f = friendshipBetween(state, me.id, u.id);
    return f?.status === 'incoming';
  });

  // The roster is still loading and nothing has arrived yet — show placeholders
  // instead of a misleading "no connections" state.
  const loadingPeople = state.usersLoading && others.length === 0;

  const message = (id: string) => {
    const tid = state.openThreadWith(id);
    setOpenThreadId(tid);
    setView('messenger');
  };

  return (
    <div className="space-y-5">
      <header className="card p-5">
        <h1 className="font-serif text-2xl font-semibold">My <span className="gold-text">Network</span></h1>
        <p className="mt-1 text-sm text-ink-400">
          {friends.length} connection{friends.length !== 1 ? 's' : ''} · {incoming.length} pending request{incoming.length !== 1 ? 's' : ''}
        </p>
      </header>

      {loadingPeople && (
        <>
          <section>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
              <UserPlus size={14} /> Suggested connections
            </h2>
            <PeopleSkeleton count={4} />
          </section>
          <section>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
              <Users size={14} /> Your connections
            </h2>
            <PeopleSkeleton count={3} />
          </section>
        </>
      )}

      {/* Pending requests */}
      {incoming.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">Pending requests</h2>
          <div className="space-y-2">
            {incoming.map((u) => (
              <div key={u.id} className="card flex items-center gap-3 p-3">
                <ProfileLink userId={u.id} label={`View ${u.name}'s profile`} className="shrink-0 !rounded-full">
                  <Avatar src={u.photo} name={u.name} size={48} online={u.online} ring="gold" />
                </ProfileLink>
                <div className="min-w-0 flex-1">
                  <ProfileLink
                    userId={u.id}
                    className="block truncate font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline"
                  >
                    {u.name}
                  </ProfileLink>
                  <div className="flex items-center gap-1 truncate text-xs text-ink-400">
                    <Church size={11} /> {u.parish}
                  </div>
                </div>
                <button onClick={() => void state.acceptFriend(u.id)} className="gold-btn py-2 text-xs">
                  <Check size={14} /> Accept
                </button>
                <button onClick={() => void state.removeFriend(u.id)} className="ghost-btn py-2 text-xs">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
            <UserPlus size={14} /> Suggested connections
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.slice(0, 12).map((u) => {
              const f = friendshipBetween(state, me.id, u.id);
              return (
                <div key={u.id} className="card flex items-center gap-3 p-3">
                  <ProfileLink userId={u.id} label={`View ${u.name}'s profile`} className="shrink-0 !rounded-full">
                    <Avatar src={u.photo} name={u.name} size={48} online={u.online} ring="gold" />
                  </ProfileLink>
                  <div className="min-w-0 flex-1">
                    <ProfileLink
                      userId={u.id}
                      className="block truncate font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline"
                    >
                      {u.name}
                    </ProfileLink>
                    <div className="flex items-center gap-1 truncate text-xs text-ink-400">
                      <Church size={11} /> {u.parish}
                    </div>
                  </div>
                  {f?.status === 'outgoing' ? (
                    <span className="chip text-emerald-300">Pending</span>
                  ) : (
                    <button onClick={() => void state.addFriend(u.id)} className="gold-btn py-2 text-xs">
                      <UserPlus size={14} /> Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* My network grid */}
      {!loadingPeople && (
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
          <Users size={14} /> Your connections
        </h2>
        {friends.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title="No connections yet"
            subtitle="Add people from the suggestions above to build your parish network."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((u) => {
              const f = friendshipBetween(state, me.id, u.id);
              return (
                <div key={u.id} className="card group p-4 text-center">
                  <div className="mx-auto w-fit">
                    <ProfileLink userId={u.id} label={`View ${u.name}'s profile`} className="!rounded-full">
                      <Avatar src={u.photo} name={u.name} size={72} online={u.online} ring="gold" />
                    </ProfileLink>
                  </div>
                  <ProfileLink
                    userId={u.id}
                    className="mt-3 block truncate font-semibold text-ink-100 transition-colors hover:text-gold-200 hover:underline"
                  >
                    {u.name}
                  </ProfileLink>
                  <div className="mt-0.5 flex items-center justify-center gap-1 truncate text-xs text-ink-400">
                    <Church size={11} /> {u.parish}
                  </div>
                  <div className="mt-1 text-[10px] text-ink-500">
                    {f?.since ? `Friends since ${timeAgo(f.since)} ago` : 'Connected'}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => message(u.id)} className="ghost-btn flex-1 py-2 text-xs">
                      <Mail size={13} /> Message
                    </button>
                    <button
                      onClick={() => void state.removeFriend(u.id)}
                      className="ghost-btn px-2.5 py-2 text-xs text-ink-400 hover:text-red-300"
                      title="Remove connection"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
