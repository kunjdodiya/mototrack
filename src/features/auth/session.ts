import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { platform } from '../platform'

/**
 * Custom URL scheme registered on both platforms — see
 *   ios/App/App/Info.plist (CFBundleURLTypes)
 *   android/app/src/main/AndroidManifest.xml (intent-filter)
 * The Supabase project must have this exact URL allow-listed under
 * Authentication → URL Configuration → Redirect URLs.
 */
export const NATIVE_AUTH_REDIRECT = 'com.kunjdodiya.mototrack://auth/callback'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.id ?? null
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = platform.isNative
    ? NATIVE_AUTH_REDIRECT
    : `${window.location.origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
      // On native we must open the URL ourselves (otherwise Supabase tries
      // to navigate the WebView, which loses the in-app back button and
      // breaks the deep-link return).
      skipBrowserRedirect: platform.isNative,
    },
  })
  if (error) throw error

  if (platform.isNative) {
    if (!data?.url) throw new Error('No OAuth URL returned by Supabase')
    await platform.openAuthUrl(data.url)
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthChange(
  cb: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session)
  })
  return () => data.subscription.unsubscribe()
}
