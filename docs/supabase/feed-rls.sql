-- Optional Supabase feed schema hardening.
-- Run this only when `posts` and `profiles` live in Supabase Postgres.
-- OrthodoxConnect currently serves its production feed from Netlify Database.

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.posts
  add column if not exists visibility text not null default 'global';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and conname = 'posts_visibility_check'
  ) then
    alter table public.posts
      add constraint posts_visibility_check
      check (visibility in ('public', 'global', 'private'));
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from public.posts p
    left join public.profiles pr on pr.id = p.user_id
    where pr.id is null
  ) then
    raise exception 'Cannot add posts_user_id_profiles_id_fk: orphaned posts.user_id values exist.';
  end if;
end
$$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.posts'::regclass
      and c.contype = 'f'
      and a.attname = 'user_id'
  loop
    execute format('alter table public.posts drop constraint %I', constraint_name);
  end loop;

  alter table public.posts
    add constraint posts_user_id_profiles_id_fk
    foreign key (user_id)
    references public.profiles(id)
    on update cascade
    on delete cascade;
end
$$;

create or replace function public.is_feed_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (is_admin is true or role = 'admin')
  );
$$;

revoke all on function public.is_feed_admin() from public;
grant execute on function public.is_feed_admin() to authenticated;

alter table public.posts enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Authenticated users read visible posts" on public.posts;
create policy "Authenticated users read visible posts"
on public.posts for select
to authenticated
using (
  user_id = auth.uid()
  or visibility in ('public', 'global')
);

drop policy if exists "Admins read every post" on public.posts;
create policy "Admins read every post"
on public.posts for select
to authenticated
using (public.is_feed_admin());

drop policy if exists "Authenticated users create own posts" on public.posts;
create policy "Authenticated users create own posts"
on public.posts for insert
to authenticated
with check (user_id = auth.uid() or public.is_feed_admin());

drop policy if exists "Authenticated users update own posts" on public.posts;
create policy "Authenticated users update own posts"
on public.posts for update
to authenticated
using (user_id = auth.uid() or public.is_feed_admin())
with check (user_id = auth.uid() or public.is_feed_admin());

drop policy if exists "Authenticated users delete own posts" on public.posts;
create policy "Authenticated users delete own posts"
on public.posts for delete
to authenticated
using (user_id = auth.uid() or public.is_feed_admin());

drop policy if exists "Authenticated users read profiles" on public.profiles;
create policy "Authenticated users read profiles"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Authenticated users create own profile" on public.profiles;
create policy "Authenticated users create own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() or public.is_feed_admin());

drop policy if exists "Authenticated users update own profile" on public.profiles;
create policy "Authenticated users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_feed_admin())
with check (id = auth.uid() or public.is_feed_admin());

drop policy if exists "Authenticated users delete own profile" on public.profiles;
create policy "Authenticated users delete own profile"
on public.profiles for delete
to authenticated
using (id = auth.uid() or public.is_feed_admin());

grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end
$$;

commit;
