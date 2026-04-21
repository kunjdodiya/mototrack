import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClub } from '../features/community/clubs'
import { CLUB_ACCENTS, type ClubAccent } from '../types/club'
import {
  ACCENT_GRADIENT_CLASS,
  ACCENT_LABEL,
  clubInitials,
} from '../features/community/accents'
import BackLink from './BackLink'

export default function NewClubScreen() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState<ClubAccent>('sunrise')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const disabled = busy || trimmedName.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled) return
    setBusy(true)
    setError(null)
    try {
      const club = await createClub({
        name: trimmedName,
        description: description || null,
        city: city || null,
        accent,
      })
      navigate(`/community/clubs/${club.id}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create club.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <BackLink to="/community" />

      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          New club
        </span>
        <h1 className="font-display text-4xl font-bold leading-tight">
          Start a <span className="text-gradient">crew</span>.
        </h1>
        <p className="text-sm text-neutral-400">
          You'll be the owner and the first member. You can host rides and
          invite riders right away.
        </p>
      </header>

      <section
        aria-hidden
        className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
      >
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_GRADIENT_CLASS[accent]} font-display text-base font-bold text-white shadow-glow-orange`}
        >
          {clubInitials(trimmedName || 'New club')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold tracking-tight">
            {trimmedName || 'Your club'}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {[city.trim(), description.trim()].filter(Boolean).join(' · ') ||
              'Motorcycle club'}
          </div>
        </div>
      </section>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Club name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Twisties & Tacos"
            maxLength={60}
            required
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            City / region
          </span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="E.g. Bay Area, CA"
            maxLength={80}
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Vibe (one line)
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Weekend canyon runs · chill pace"
            maxLength={120}
            className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3.5 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Color
          </span>
          <div className="grid grid-cols-5 gap-2">
            {CLUB_ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAccent(a)}
                aria-label={ACCENT_LABEL[a]}
                aria-pressed={accent === a}
                className={[
                  'aspect-square rounded-xl bg-gradient-to-br transition-all duration-300',
                  ACCENT_GRADIENT_CLASS[a],
                  accent === a
                    ? 'ring-2 ring-white shadow-glow-orange scale-105'
                    : 'opacity-75 hover:opacity-100',
                ].join(' ')}
              />
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="rounded-2xl bg-brand-gradient py-4 font-display text-base font-bold tracking-tight text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create club'}
        </button>
      </form>
    </div>
  )
}
