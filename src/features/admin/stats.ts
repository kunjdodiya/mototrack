import { supabase } from '../auth/supabase'
import type { AdminDashboard } from '../../types/admin'

/**
 * Returns true only when the signed-in user's email is in the
 * `public.admins` allowlist. Backed by the `am_i_admin()` security-definer
 * RPC — the client never reads the admins table directly.
 *
 * Errors are swallowed (returns false) because a failed check should never
 * surface the admin UI to a non-admin.
 */
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_admin')
  if (error) {
    console.warn('am_i_admin failed:', error.message)
    return false
  }
  return data === true
}

/**
 * Fetches the owner dashboard payload. Throws if the signed-in user isn't
 * in the admins allowlist — the server raises `insufficient_privilege` and
 * we propagate the message so the UI can render a forbidden state.
 */
export async function loadAdminDashboard(): Promise<AdminDashboard> {
  const { data, error } = await supabase.rpc('admin_dashboard')
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Empty dashboard payload.')
  return data as AdminDashboard
}
