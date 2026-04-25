import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthChange, signOut } from './session'
import SignInScreen from '../../components/SignInScreen'
import { syncWithCloud } from '../storage/sync'
import { startLiveSync } from '../storage/liveSync'
import { clearLocalUserData } from '../storage/db'

/**
 * Tracks the last user id that owned the local Dexie state. When a different
 * Google account signs in on the same device we wipe Dexie before the cloud
 * pull, so account A's rides/bikes/trips don't bleed into account B's history
 * and totals (RLS scopes the *server* select but Dexie carries the leftovers
 * locally).
 */
const LAST_USER_KEY = 'mototrack:lastUserId'

type Status = 'loading' | 'signed-in' | 'signed-out'

function isRealUser(session: Session | null): boolean {
  if (!session?.user) return false
  const u = session.user as Session['user'] & { is_anonymous?: boolean }
  if (u.is_anonymous === true) return false
  const provider = session.user.app_metadata?.provider
  if (provider && provider !== 'email') return true
  return !!u.email
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getSession().then((s) => {
      if (cancelled) return
      if (s && !isRealUser(s)) {
        void signOut().catch(() => {})
        setUserId(null)
        setStatus('signed-out')
        return
      }
      setUserId(s?.user?.id ?? null)
      setStatus(isRealUser(s) ? 'signed-in' : 'signed-out')
    })
    const unsubscribe = onAuthChange((s: Session | null) => {
      if (s && !isRealUser(s)) {
        void signOut().catch(() => {})
        setUserId(null)
        setStatus('signed-out')
        return
      }
      setUserId(s?.user?.id ?? null)
      setStatus(isRealUser(s) ? 'signed-in' : 'signed-out')
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const prev =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(LAST_USER_KEY)
          : null
      if (prev && prev !== userId) {
        await clearLocalUserData()
      }
      if (cancelled) return
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_USER_KEY, userId)
      }
      await syncWithCloud().catch(() => {})
    })()
    const stop = startLiveSync()
    return () => {
      cancelled = true
      stop()
    }
  }, [userId])

  if (status === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center text-neutral-500">
        Loading…
      </div>
    )
  }

  if (status === 'signed-out') return <SignInScreen />

  return <>{children}</>
}
