import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared server-side access to the Supabase project, used by the profile
// helpers and by image uploads. Nothing here ever reaches the browser.
//
// Configuration:
//   SUPABASE_URL                 project endpoint (falls back to VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    service role key — required for admin work such
//                                as creating a storage bucket or signing an
//                                upload. Also accepts SUPABASE_SERVICE_KEY or
//                                SUPABASE_SECRET_KEY.
//   VITE_SUPABASE_ANON_KEY       used for reads when no service key is set.

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

/** The project endpoint, without a trailing slash so paths can be appended. */
export function supabaseProjectUrl(): string {
  return (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
}

export function supabaseServiceKey(): string {
  return env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY') || env('SUPABASE_SECRET_KEY');
}

/**
 * A server client, or `null` when the project is not configured. Pass
 * `requireAdmin` for work the anon key cannot do — bucket management, signing an
 * upload, or reading the auth admin API.
 */
export function createSupabaseServerClient(requireAdmin = false): SupabaseClient | null {
  const url = supabaseProjectUrl();
  const serviceKey = supabaseServiceKey();
  const key = serviceKey || (!requireAdmin ? env('VITE_SUPABASE_ANON_KEY') : '');
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
