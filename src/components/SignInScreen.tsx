import { useState } from 'react'
import { signInWithGoogle } from '../features/auth/session'

export default function SignInScreen() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-10 px-6 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          <span className="text-moto-orange">Moto</span>Track
        </h1>
        <p className="mt-3 text-neutral-400">
          Record every ride. Keep every route.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow transition active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleG />
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>

      {error && (
        <p role="alert" className="max-w-sm text-center text-sm text-red-400">
          {error}
        </p>
      )}

      <p className="max-w-sm text-center text-xs text-neutral-500">
        We use your Google account only to save your rides to your personal
        cloud. No email, no spam.
      </p>
    </div>
  )
}

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.2 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.8-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6h.1l6.2 5.2C37.1 39.8 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}
