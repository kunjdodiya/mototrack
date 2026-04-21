import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Ride } from '../types/ride'
import { getRide, deleteRide } from '../features/storage/rides'
import { renderSharePng } from '../features/share/exportPng'
import { platform } from '../features/platform'
import { formatDateTime } from '../features/stats/format'
import RideMap from './RideMap'
import ShareCard from './ShareCard'
import AddToTripSheet from './AddToTripSheet'

export default function RideSummary() {
  const { id } = useParams()
  const [ride, setRide] = useState<Ride | null | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void getRide(id).then((r) => {
      if (!cancelled) setRide(r ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (ride === undefined) {
    return (
      <div className="mx-auto flex max-w-xl items-center justify-center px-5 pb-10 pt-8 text-sm text-neutral-400">
        Loading…
      </div>
    )
  }
  if (ride === null) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-10 pt-8">
        <header className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Ride Recap
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Ride not <span className="text-gradient">found</span>.
          </h1>
        </header>
        <Link
          to="/history"
          className="text-sm font-semibold text-gradient transition hover:opacity-80"
        >
          ← Back to history
        </Link>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Delete this ride? This cannot be undone.')) return
    await deleteRide(id)
    window.location.href = '/history'
  }

  const handleShare = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const blob = await renderSharePng({ ride })
      await platform.sharePng({
        blob,
        filename: `mototrack-${ride.id.slice(0, 8)}.png`,
        title: 'MotoTrack ride',
        text: ride.name ?? 'My ride on MotoTrack',
      })
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const title = ride.name ?? formatDateTime(ride.startedAt)
  const subtitle = ride.name ? formatDateTime(ride.startedAt) : null

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10 pt-8">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
          Ride Recap
        </span>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-neutral-400">{subtitle}</p>
        )}
      </header>

      <div className="h-64 animate-fade-up overflow-hidden rounded-2xl border border-white/5 shadow-lg">
        <RideMap
          points={ride.track}
          fitAll
          className="h-full bg-neutral-950"
        />
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
        <ShareCard ride={ride} />
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '90ms' }}>
        <AddToTripSheet
          rideId={ride.id}
          currentTripId={ride.tripId ?? null}
          onChange={async () => {
            const fresh = await getRide(ride.id)
            if (fresh) setRide(fresh)
          }}
        />
      </div>

      <div className="grid animate-fade-up grid-cols-2 gap-3" style={{ animationDelay: '120ms' }}>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={exporting}
          className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-60"
        >
          {exporting ? 'Generating…' : 'Share to Story'}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-base font-semibold text-neutral-200 transition active:scale-[0.98] hover:bg-white/[0.08]"
        >
          Delete
        </button>
      </div>

      <p className="-mt-2 text-center text-xs text-neutral-500">
        Exports a 1080×1920 Instagram Story — pick Instagram, WhatsApp, or any other app from your share sheet.
      </p>

      {exportError && (
        <p className="text-center text-sm text-red-400">Export failed: {exportError}</p>
      )}

      <Link
        to="/history"
        className="mt-1 text-center text-sm font-semibold text-neutral-400 transition hover:text-white"
      >
        ← Back to history
      </Link>
    </div>
  )
}
