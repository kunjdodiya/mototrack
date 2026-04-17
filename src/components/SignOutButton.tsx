import { useState } from 'react'
import { signOut } from '../features/auth/session'

export default function SignOutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true)
        try {
          await signOut()
        } finally {
          setBusy(false)
        }
      }}
      disabled={busy}
      className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition hover:text-white disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
