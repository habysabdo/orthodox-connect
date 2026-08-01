# Feed recovery and Supabase migration notes

## What caused the empty feed

OrthodoxConnect currently stores posts in Netlify Database and exposes them through `/api/posts`. Supabase is used by the browser for authentication and storage, but the active feed is not read directly from a Supabase `posts` table.

The feed request had two authentication gaps: the browser did not attach the saved identity bearer token, and the posts function called `requireAppUser` without passing its incoming request. The API therefore returned `401`, while the store logged the error and rendered the normal empty state.

## Active Netlify Database fix

1. Deploy the repository changes. Netlify applies `netlify/database/migrations/20260801194500_add_posts_author_foreign_key/migration.sql` automatically.
2. Sign out and sign back in so the browser has a current identity token.
3. Open the global feed and confirm `/api/posts` returns `200` in the browser Network panel.
4. Create a post and refresh. The post remains visible because it is stored in Netlify Database.

The new foreign key is intentionally `NOT VALID`: it enforces valid authors for all new or changed rows without making deployment fail on legacy rows whose authors were deleted. The migration first recovers blank `author_id` values from the stored JSON document.

## Optional Supabase-native feed

Use this path only if the feed is intentionally moved from Netlify Database to Supabase Postgres.

1. Back up the Supabase project.
2. Confirm `public.profiles.id` and `public.posts.user_id` use the same UUID type.
3. Run `docs/supabase/feed-rls.sql` in the Supabase SQL Editor.
4. Resolve any reported orphaned `posts.user_id` rows, then run the script again.
5. Run `docs/supabase/feed-seed.sql` to add five test posts.
6. Import `useFeed` from `src/hooks/useFeed.ts` in the Supabase-backed feed component.
7. Render `loading`, `error`, and `empty` before mapping `posts`.

Example state handling:

```tsx
const { posts, loading, error, empty, refetch } = useFeed();

if (loading) return <FeedSkeleton />;
if (error) return <FeedError message={error} onRetry={refetch} />;
if (empty) return <EmptyFeed />;

return posts.map((post) => <PostCard key={post.id} post={post} />);
```

The hook loads newest posts first, joins `profiles:user_id(id, full_name, avatar_url)`, and subscribes to `INSERT` events through `supabase.channel('public:posts')`. It re-fetches each inserted row so the live item includes its author profile before being prepended.

Apply `docs/supabase/migrations/20260801230000_harden_feed_rls.sql` to the Supabase project only if this optional native feed is enabled. The migration must not be moved into `netlify/database/migrations`, because that directory is applied to the production Netlify Database schema.

## Netlify environment

Set these values in **Netlify Dashboard → Site configuration → Environment variables** for Production, Deploy Previews, and Branch deploys as needed:

- `VITE_SUPABASE_URL`: the Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: the public anonymous browser key. Never use a service-role key in a `VITE_` variable.

The existing `netlify.toml` already contains the required SPA fallback:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

After changing environment variables, trigger a new deploy because Vite embeds `VITE_` variables at build time.
