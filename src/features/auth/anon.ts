import { supabase } from './supabase'

/**
 * Ensure we have an anonymous session. Supabase issues a real auth.uid()
 * against which Row Level Security policies scope every query, so even
 * without a login the user's rides are isolated from other anonymous
 * devices.
 *
 * Idempotent — safe to call on every app boot. The session persists in
 * localStorage via Supabase's own storage layer.
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  if (!supabase) return null

  const { data: existing } = await supabase.auth.getSession()
  if (existing.session?.user?.id) return existing.session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('Anonymous sign-in failed:', error.message)
    return null
  }
  return data.user?.id ?? null
}
