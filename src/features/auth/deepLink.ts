import { supabase } from './supabase'
import { platform } from '../platform'

/**
 * Handle a single deep-link URL: if it carries a Supabase OAuth `code` (PKCE
 * flow) or `error`, finish the sign-in by exchanging the code for a session
 * and dismissing the in-app browser. Returns true if the URL was an auth
 * callback (whether it succeeded or failed).
 */
export async function handleAuthDeepLink(rawUrl: string): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  // Accept both ?code= (query) and #code= (fragment) — Supabase historically
  // used the fragment for the implicit flow; PKCE uses the query string.
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const code = parsed.searchParams.get('code') ?? fragment.get('code')
  const oauthError =
    parsed.searchParams.get('error') ?? fragment.get('error')

  if (!code && !oauthError) return false

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    }
  } finally {
    // Always close the browser — succeed or fail, the user shouldn't be
    // staring at the OAuth page after we return to the app.
    await platform.closeAuthBrowser()
  }
  return true
}

/**
 * Subscribe to native deep-link events. Call once at app startup.
 * Returns the unsubscribe function. No-op on web.
 */
export function startAuthDeepLinkListener(): () => void {
  return platform.onAppUrl((url) => {
    void handleAuthDeepLink(url)
  })
}
