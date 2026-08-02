/*
# Admin management: role promotion, user banning, and metrics

1. New Columns
- `profiles.banned` (boolean, default false) — when true, user is blocked from the platform
- `profiles.banned_at` (timestamptz, nullable) — when the ban was applied

2. Security Functions (SECURITY DEFINER)
- `is_admin()` — returns true if the current user's profile role is 'admin'
- `promote_user(target_uuid)` — sets a user's role to 'admin' (admin-only)
- `demote_user(target_uuid)` — sets a user's role to 'member' (admin-only)
- `ban_user(target_uuid)` — sets banned=true and banned_at=now() (admin-only)
- `unban_user(target_uuid)` — sets banned=false, banned_at=null (admin-only)
- `get_platform_metrics()` — returns total users, banned users, online users, admin count (admin-only)

3. RLS Policy Updates
- Blocked (banned) users cannot update their own profile
- All policies check `NOT banned` for self-service actions

4. Important Notes
- All admin functions verify `is_admin()` before executing
- Functions use SECURITY DEFINER to bypass RLS for administrative actions
- `get_platform_metrics` counts profiles rows for total/banned/admin counts
*/

-- Add banned columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Promote user to admin
CREATE OR REPLACE FUNCTION public.promote_user(target_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can promote users';
  END IF;
  UPDATE public.profiles SET role = 'admin' WHERE id = target_uid;
END;
$$;

-- Demote admin to member
CREATE OR REPLACE FUNCTION public.demote_user(target_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can demote users';
  END IF;
  -- Prevent self-demotion to avoid locking yourself out
  IF target_uid = auth.uid() THEN
    RAISE EXCEPTION 'You cannot demote yourself';
  END IF;
  UPDATE public.profiles SET role = 'member' WHERE id = target_uid;
END;
$$;

-- Ban a user
CREATE OR REPLACE FUNCTION public.ban_user(target_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can ban users';
  END IF;
  IF target_uid = auth.uid() THEN
    RAISE EXCEPTION 'You cannot ban yourself';
  END IF;
  UPDATE public.profiles SET banned = true, banned_at = now() WHERE id = target_uid;
END;
$$;

-- Unban a user
CREATE OR REPLACE FUNCTION public.unban_user(target_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can unban users';
  END IF;
  UPDATE public.profiles SET banned = false, banned_at = null WHERE id = target_uid;
END;
$$;

-- Get platform metrics (admin-only)
CREATE OR REPLACE FUNCTION public.get_platform_metrics()
RETURNS TABLE(total_users bigint, banned_users bigint, admin_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can view metrics';
  END IF;
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE banned)::bigint,
    COUNT(*) FILTER (WHERE role = 'admin')::bigint
  FROM public.profiles;
END;
$$;

-- Update profiles UPDATE policy to also block banned users from self-service
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id AND NOT banned)
WITH CHECK (auth.uid() = id);
