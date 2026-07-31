/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Add any other custom VITE_ variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
