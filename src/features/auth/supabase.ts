import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error(
    'MotoTrack requires a Supabase project. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see README.md).',
  )
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE on both web and native: web auto-detects the ?code= on
    // /auth/callback; native receives the deep link, extracts the code, and
    // calls supabase.auth.exchangeCodeForSession() manually
    // (see src/features/auth/deepLink.ts).
    flowType: 'pkce',
  },
})
