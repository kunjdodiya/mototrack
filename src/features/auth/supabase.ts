import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Supabase is OPTIONAL for v1. When env vars are missing we run in pure
 * local-only mode — Dexie storage works, PNG export works, history works,
 * but rides aren't backed up to the cloud. This lets the app function
 * during development before a Supabase project is provisioned.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const cloudSyncEnabled = supabase != null
