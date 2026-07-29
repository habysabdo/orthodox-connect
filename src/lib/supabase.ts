import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseConfig } from './config';

if (!hasSupabaseConfig) {
  // Surface the misconfiguration in the console instead of crashing the whole
  // UI with an uncaught "Invalid supabaseUrl" error on startup.
  console.error(
    'Supabase is not configured correctly: a valid endpoint (VITE_SUPABASE_PROXY_URL ' +
      'or VITE_SUPABASE_URL) and VITE_SUPABASE_ANON_KEY must be set. Auth features are disabled.',
  );
}

// When the config is missing or malformed, fall back to a syntactically valid
// placeholder URL/key. This keeps createClient from throwing at module load, so
// the app still renders; auth calls simply return errors instead of crashing.
// When a custom regional domain/proxy is configured it is preferred (resolved in
// ./config), so both auth and Storage bucket fetches follow the configured DNS
// route rather than a hardcoded project endpoint.
const clientUrl = hasSupabaseConfig ? (SUPABASE_URL as string) : 'https://placeholder.supabase.co';
const clientAnonKey = hasSupabaseConfig ? SUPABASE_ANON_KEY : 'public-anon-key';

// A single shared browser client. `persistSession` + `autoRefreshToken` (both
// on by default) store the session in localStorage and refresh it in the
// background, which is what keeps the user signed in across page reloads.
export const supabase = createClient(clientUrl, clientAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
