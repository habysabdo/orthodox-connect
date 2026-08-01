-- Optional Supabase test data.
-- Run after `feed-rls.sql` while signed in, or after at least one profile exists.

do $$
declare
  seed_user_id uuid;
begin
  seed_user_id := auth.uid();

  if seed_user_id is null then
    select id
    into seed_user_id
    from public.profiles
    order by id
    limit 1;
  end if;

  if seed_user_id is null then
    raise exception 'No profile exists. Sign in once or create a profile before seeding posts.';
  end if;

  insert into public.posts (id, user_id, content, visibility, created_at)
  values
    (gen_random_uuid(), seed_user_id, 'Welcome to OrthodoxConnect. Share a prayer, reflection, or parish update with the community.', 'global', now() - interval '4 minutes'),
    (gen_random_uuid(), seed_user_id, 'Please keep our catechumens in your prayers as they continue their journey toward reception into the Church.', 'global', now() - interval '3 minutes'),
    (gen_random_uuid(), seed_user_id, 'Vespers begins at 6:00 PM tonight. Everyone is welcome, and a fellowship meal follows the service.', 'public', now() - interval '2 minutes'),
    (gen_random_uuid(), seed_user_id, 'Today’s reflection: small acts of mercy can become quiet icons of Christ’s love.', 'global', now() - interval '1 minute'),
    (gen_random_uuid(), seed_user_id, 'Our food pantry needs canned vegetables and rice this weekend. Thank you for helping our neighbors.', 'public', now())
  on conflict (id) do nothing;
end
$$;
