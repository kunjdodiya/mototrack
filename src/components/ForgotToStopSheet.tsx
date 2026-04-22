import { useMemo, useState } from 'react'
import type { TrackPoint } from '../types/ride'
import { haversine } from '../features/stats/haversine'
import {
  formatDistance,
  formatDuration,
  formatDateTime,
} from '../features/stats/format'

type Props = {
  startedAt: number
  points: TrackPoint[]
  liveDistanceMeters: number
  liveDurationMs: number
  onConfirm: (endedAt: number) => void | Promise<void>
  onClose: () => void
}

type Preset = { label: string; minutes: number }

const PRESETS: Preset[] = [
  { label: '15 min ago', minutes: 15 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hr ago', minutes: 120 },
  { label: '3 hr ago', minutes: 180 },
  { label: '4 hr ago', minutes: 240 },
  { label: '6 hr ago', minutes: 360 },
  { label: '8 hr ago', minutes: 480 },
]

function trimmedDistance(points: TrackPoint[], cutoff: number): number {
  let total = 0
  let prev: TrackPoint | null = null
  for (const p of points) {
    if (p.ts > cutoff) break
    if (prev) total += haversine(prev.lat, prev.lng, p.lat, p.lng)
    prev = p
  }
  return total
}

export default function ForgotToStopSheet({
  startedAt,
  points,
  liveDistanceMeters,
  liveDurationMs,
  onConfirm,
  onClose,
}: Props) {
  const [now] = useState(() => Date.now())
  const [minutes, setMinutes] = useState<number>(60)
  const [customHours, setCustomHours] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const maxTrimMinutes = Math.max(0, Math.floor((now - startedAt) / 60000) - 1)

  const effectiveMinutes = useMemo(() => {
    const h = parseFloat(customHours)
    if (!Number.isNaN(h) && h > 0) return Math.round(h * 60)
    return minutes
  }, [customHours, minutes])

  const clampedMinutes = Math.min(
    Math.max(0, effectiveMinutes),
    maxTrimMinutes,
  )
  const tooMuch = effectiveMinutes > maxTrimMinutes
  const cutoff = now - clampedMinutes * 60000

  const previewDistance = useMemo(
    () => trimmedDistance(points, cutoff),
    [points, cutoff],
  )
  const previewDurationMs = Math.max(0, cutoff - startedAt)
  const trimmedDistanceMeters = Math.max(
    0,
    liveDistanceMeters - previewDistance,
  )
  const trimmedDurationMs = Math.max(0, liveDurationMs - previewDurationMs)

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm(cutoff)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stop ride earlier"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-t-3xl border-t border-white/10 bg-neutral-950 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />

        <header className="mt-1 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Forgot to stop?
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Stop ride earlier
          </h2>
          <p className="text-sm text-neutral-400">
            If you forgot to stop and the phone kept recording, rewind to when
            your ride actually ended. We'll drop everything after that.
          </p>
        </header>

        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const disabled = p.minutes > maxTrimMinutes
            const active = !customHours && minutes === p.minutes && !disabled
            return (
              <button
                key={p.minutes}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setCustomHours('')
                  setMinutes(p.minutes)
                }}
                className={[
                  'rounded-xl border px-2 py-2.5 text-xs font-semibold transition',
                  active
                    ? 'border-moto-orange/60 bg-brand-gradient text-white shadow-glow-orange'
                    : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20',
                  disabled ? 'cursor-not-allowed opacity-30 hover:border-white/10' : '',
                ].join(' ')}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Custom
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.25}
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value)}
            placeholder="hours"
            className="w-full bg-transparent text-base font-medium text-white placeholder:text-neutral-600 focus:outline-none"
          />
          <span className="text-xs text-neutral-500">hr ago</span>
        </label>

        <section
          aria-label="Trimmed ride preview"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          {tooMuch ? (
            <p className="text-sm text-amber-300">
              Your ride is only {formatDuration(now - startedAt)} long. Pick a
              smaller value.
            </p>
          ) : clampedMinutes === 0 ? (
            <p className="text-sm text-neutral-400">
              Pick a time or hours above. Zero rewind is the same as tapping
              Stop now.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Ride ends
                </span>
                <span className="font-display text-sm font-semibold text-white">
                  {formatDateTime(cutoff)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PreviewStat
                  label="Kept"
                  primary={formatDistance(previewDistance)}
                  secondary={formatDuration(previewDurationMs)}
                />
                <PreviewStat
                  label="Dropped"
                  primary={formatDistance(trimmedDistanceMeters)}
                  secondary={formatDuration(trimmedDurationMs)}
                  muted
                />
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || tooMuch || clampedMinutes === 0}
            className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save trimmed ride'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="self-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-semibold text-neutral-300 transition hover:border-white/20 active:scale-[0.97]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewStat({
  label,
  primary,
  secondary,
  muted,
}: {
  label: string
  primary: string
  secondary: string
  muted?: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border p-3',
        muted
          ? 'border-white/5 bg-white/[0.02] text-neutral-500'
          : 'border-moto-orange/30 bg-gradient-to-br from-moto-orange/10 to-moto-magenta/5 text-white',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div
        className={[
          'mt-1 font-display text-lg font-bold tabular-nums tracking-tight',
          muted ? 'text-neutral-400' : 'text-gradient',
        ].join(' ')}
      >
        {primary}
      </div>
      <div className="mt-0.5 text-xs tabular-nums text-neutral-500">
        {secondary}
      </div>
    </div>
  )
}
