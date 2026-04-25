import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import '../features/map/leafletIcons'
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
  /**
   * The timestamp that the rewind sliders count back from. Defaults to
   * `Date.now()` for the live-recording path; pass `ride.endedAt` when trimming
   * a finished ride from its recap screen so the rewind anchors on when the
   * ride ended, not when the rider opened the sheet.
   */
  endReference?: number
  /** Overrides the header copy — useful for the recap "trim" variant. */
  eyebrow?: string
  title?: string
  description?: string
  confirmLabel?: string
}

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

function findCutoffIndex(points: TrackPoint[], cutoff: number): number {
  if (points.length === 0) return -1
  if (points[0].ts > cutoff) return -1
  let lo = 0
  let hi = points.length - 1
  if (points[hi].ts <= cutoff) return hi
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid].ts <= cutoff) lo = mid
    else hi = mid - 1
  }
  return lo
}

export default function ForgotToStopSheet({
  startedAt,
  points,
  liveDistanceMeters,
  liveDurationMs,
  onConfirm,
  onClose,
  endReference,
  eyebrow = 'Forgot to stop?',
  title = 'Stop ride earlier',
  description = "If you forgot to stop and the phone kept recording, rewind to when your ride actually ended. We'll drop everything after that.",
  confirmLabel = 'Save trimmed ride',
}: Props) {
  const [reference] = useState(() => endReference ?? Date.now())
  const maxRewindSec = Math.max(
    0,
    Math.floor((reference - startedAt) / 1000) - 60,
  )
  const [rewindSec, setRewindSec] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  const clampedSec = Math.min(Math.max(0, rewindSec), maxRewindSec)
  const hours = Math.floor(clampedSec / 3600)
  const minutes = Math.floor((clampedSec % 3600) / 60)
  const maxHours = Math.floor(maxRewindSec / 3600)
  const cutoff = reference - clampedSec * 1000

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

  const cutoffIndex = useMemo(
    () => findCutoffIndex(points, cutoff),
    [points, cutoff],
  )
  const cutoffPoint = cutoffIndex >= 0 ? points[cutoffIndex] : null

  const handleHours = (h: number) => {
    const next = h * 3600 + minutes * 60
    setRewindSec(Math.min(maxRewindSec, next))
  }
  const handleMinutes = (m: number) => {
    const next = hours * 3600 + m * 60
    setRewindSec(Math.min(maxRewindSec, next))
  }

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm(cutoff)
    } finally {
      setSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stop ride earlier"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-white/10 bg-neutral-950 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-4">
          <header className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {eyebrow}
            </span>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-neutral-400">{description}</p>
          </header>

          {points.length > 1 && (
            <TrimMap
              points={points}
              cutoffPoint={cutoffPoint}
              cutoffIndex={cutoffIndex}
            />
          )}

          <SliderRow
            label="Scrub the map"
            value={clampedSec}
            min={0}
            max={maxRewindSec}
            step={10}
            disabled={maxRewindSec === 0}
            onChange={setRewindSec}
            displayValue={
              clampedSec === 0
                ? 'Keep full ride'
                : `−${formatDuration(clampedSec * 1000)}`
            }
            hint={
              cutoffPoint
                ? `Cutoff at ${formatDateTime(cutoffPoint.ts)}`
                : 'Slide left to rewind along the route'
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <SliderRow
              label="Hours back"
              value={hours}
              min={0}
              max={Math.max(0, maxHours)}
              step={1}
              disabled={maxHours === 0}
              onChange={handleHours}
              displayValue={`${hours} hr`}
            />
            <SliderRow
              label="Minutes back"
              value={minutes}
              min={0}
              max={59}
              step={1}
              disabled={maxRewindSec === 0}
              onChange={handleMinutes}
              displayValue={`${minutes} min`}
            />
          </div>

          <section
            aria-label="Trimmed ride preview"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            {clampedSec === 0 ? (
              <p className="text-sm text-neutral-400">
                Slide the dials above to rewind when this ride ended.
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
        </div>

        <div className="mt-3 flex flex-col gap-2 px-5">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || clampedSec === 0}
            className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : confirmLabel}
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
    </div>,
    document.body,
  )
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  displayValue,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (v: number) => void
  displayValue: string
}) {
  return (
    <label
      className={[
        'flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {label}
        </span>
        <span className="font-display text-sm font-semibold tabular-nums text-white">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="moto-slider w-full"
      />
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </label>
  )
}

function TrimMap({
  points,
  cutoffPoint,
  cutoffIndex,
}: {
  points: TrackPoint[]
  cutoffPoint: TrackPoint | null
  cutoffIndex: number
}) {
  const all = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  )
  const kept = useMemo(() => {
    if (cutoffIndex < 0) return [] as [number, number][]
    return points
      .slice(0, cutoffIndex + 1)
      .map((p) => [p.lat, p.lng] as [number, number])
  }, [points, cutoffIndex])

  return (
    <div className="h-44 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
      <MapContainer
        center={[points[0].lat, points[0].lng]}
        zoom={14}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          crossOrigin="anonymous"
          maxZoom={19}
        />
        <Polyline
          positions={all}
          pathOptions={{
            color: '#525252',
            weight: 4,
            opacity: 0.6,
            dashArray: '4 6',
          }}
        />
        {kept.length > 1 && (
          <Polyline
            positions={kept}
            pathOptions={{ color: '#ff4d00', weight: 5, opacity: 0.95 }}
          />
        )}
        {cutoffPoint && (
          <CircleMarker
            center={[cutoffPoint.lat, cutoffPoint.lng]}
            radius={8}
            pathOptions={{
              stroke: true,
              color: '#ffffff',
              weight: 2,
              fillColor: '#ff4d00',
              fillOpacity: 1,
            }}
          />
        )}
        <FitAndSize points={all} />
      </MapContainer>
    </div>
  )
}

function FitAndSize({ points }: { points: [number, number][] }) {
  const map = useMap()

  // Fit-bounds once on mount; bounds don't change as the cutoff moves.
  useEffect(() => {
    if (points.length > 1) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [24, 24] })
    }
    // The portal mounts before the sheet has its final size, leaving leaflet
    // with stale tile dimensions until the user interacts. Force a recompute
    // on the next paint so tiles fill the panel immediately.
    const id = window.setTimeout(() => map.invalidateSize(), 0)
    return () => window.clearTimeout(id)
  }, [points, map])

  return null
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
