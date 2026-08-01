import { Church, Mail, UserPlus, Users } from 'lucide-react';
import { Avatar, EmptyState, PeopleSkeleton } from './ui';
import { ProfileLink } from './ProfileLink';
import { FollowButton } from './FollowButton';
import { followerUsers, followingUsers, isFollowing, useStore } from '@/store/context';
import { useUI } from '@/store/ui';

export function NetworkView() {
  const state = useStore();
  const { setView, setOpenThreadId } = useUI();
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me) return null;

  const following = followingUsers(state);
  const followers = followerUsers(state);
  const others = Array.from(new Map(
    state.users.filter((user) => user.id !== me.id).map((user) => [user.id, user]),
  ).values());
  // Accounts worth following: everyone not already followed, newest members
  // first so a fresh sign-up surfaces at the top of the suggestions.
  const suggestions = others
    .filter((u) => !isFollowing(state, u.id))
    .sort((a, b) => b.joinedAt - a.joinedAt);

  // The roster is still loading and nothing has arrived yet — show placeholders
  // instead of a misleading "not following anybody" state.
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
          {following.length} Following · {followers.length} Follower{followers.length !== 1 ? 's' : ''}
        </p>
      </header>

      {loadingPeople && (
        <>
          <section>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
              <UserPlus size={14} /> Suggested accounts
            </h2>
            <PeopleSkeleton count={4} />
          </section>
          <section>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
              <Users size={14} /> Following
            </h2>
            <PeopleSkeleton count={3} />
          </section>
        </>
      )}

      {/* People to follow */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
            <UserPlus size={14} /> Suggested accounts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.slice(0, 12).map((u) => (
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
                <FollowButton userId={u.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Followers */}
      {followers.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
            <Users size={14} /> Followers
          </h2>
          <div className="space-y-2">
            {followers.map((u) => (
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
                <FollowButton userId={u.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Following grid */}
      {!loadingPeople && (
      <section>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-400">
          <Users size={14} /> Following
        </h2>
        {following.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title="You are not following anyone yet"
            subtitle="Follow people from the suggestions above to fill your feed."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {following.map((u) => (
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
                  {state.followers.includes(u.id) ? 'Follows you' : 'Following'}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => message(u.id)} className="ghost-btn flex-1 py-2 text-xs">
                    <Mail size={13} /> Message
                  </button>
                  <FollowButton userId={u.id} className="px-2.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
