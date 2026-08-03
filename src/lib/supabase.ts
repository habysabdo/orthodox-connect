import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createSafeClient(): SupabaseClient {
  return createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
    auth: { persistSession: false },
  });
}

let supabase: SupabaseClient;

if (!url || !anonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
      'using a disabled fallback client. Database and auth features will not work.',
  );
  supabase = createSafeClient();
} else {
  supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export { supabase };
