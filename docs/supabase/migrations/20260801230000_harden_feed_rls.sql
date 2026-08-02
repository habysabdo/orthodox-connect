-- Supabase-only migration for a native public.posts/public.profiles feed.
-- Do not place this file in netlify/database/migrations: auth.uid() and the
-- supabase_realtime publication belong to the Supabase project database.

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_global_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select profiles.is_admin
    from public.profiles
    where profiles.id = check_user_id
  ), false);
$$;

revoke all on function public.is_global_admin(uuid) from public;
grant execute on function public.is_global_admin(uuid) to authenticated;

alter table public.posts enable row level security;
alter table public.profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('posts', 'profiles')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

create policy "Authenticated users can read posts"
on public.posts
for select
to authenticated
using (true);

create policy "Authenticated users can create posts"
on public.posts
for insert
to authenticated
with check (user_id = auth.uid() or public.is_global_admin());

create policy "Post owners and admins can update posts"
on public.posts
for update
to authenticated
using (user_id = auth.uid() or public.is_global_admin())
with check (user_id = auth.uid() or public.is_global_admin());

create policy "Post owners and admins can delete posts"
on public.posts
for delete
to authenticated
using (user_id = auth.uid() or public.is_global_admin());

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users and admins can create profiles"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_global_admin());

create policy "Users and admins can update profiles"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_global_admin())
with check (id = auth.uid() or public.is_global_admin());

create policy "Users and admins can delete profiles"
on public.profiles
for delete
to authenticated
using (id = auth.uid() or public.is_global_admin());

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
