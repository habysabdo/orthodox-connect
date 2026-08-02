/*
# Create posts table for OrthodoxConnect live feed

1. New Tables
- `posts`
  - `id` (uuid, primary key)
  - `content` (text, not null) — the post body text
  - `author_name` (text, not null) — display name of the author
  - `author_id` (text, not null) — app-level user id (not auth.users)
  - `image_url` (text, nullable) — optional image attachment URL
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `posts`.
- Allow anon + authenticated CRUD because this is a community feed (no Supabase auth sign-in screen; the app uses its own in-memory user model).
*/

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  author_name text NOT NULL,
  author_id text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_posts" ON posts;
CREATE POLICY "anon_select_posts" ON posts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_posts" ON posts;
CREATE POLICY "anon_insert_posts" ON posts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_posts" ON posts;
CREATE POLICY "anon_update_posts" ON posts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_posts" ON posts;
CREATE POLICY "anon_delete_posts" ON posts FOR DELETE
  TO anon, authenticated USING (true);
