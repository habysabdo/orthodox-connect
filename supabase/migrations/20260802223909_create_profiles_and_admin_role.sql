/*
# Create profiles table and auto-admin trigger

1. New Tables
- `profiles` — extends auth.users with app-level data (display name, parish, bio, photo, role, verified)
  - `id` (uuid, PK, references auth.users)
  - `email` (text)
  - `display_name` (text)
  - `photo_url` (text)
  - `parish` (text)
  - `bio` (text)
  - `role` (text, default 'member')
  - `verified` (boolean, default false)
  - `onboarded` (boolean, default false)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on `profiles`.
- Users can read all profiles (community directory).
- Users can update their own profile only.
- INSERT is handled by the trigger, not by clients.

3. Trigger
- `handle_new_user` — fires on auth.users INSERT, creates a matching profiles row.
- Auto-assigns role='admin' and verified=true when the email is lucasautocode@gmail.com.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  photo_url text DEFAULT '',
  parish text DEFAULT '',
  bio text DEFAULT '',
  role text NOT NULL DEFAULT 'member',
  verified boolean NOT NULL DEFAULT false,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles (community directory)
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all"
ON profiles FOR SELECT
TO authenticated USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- No direct INSERT via API — handled by trigger
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN LOWER(NEW.email) = 'lucasautocode@gmail.com' THEN 'admin' ELSE 'member' END,
    CASE WHEN LOWER(NEW.email) = 'lucasautocode@gmail.com' THEN true ELSE false END
  );
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger for idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
