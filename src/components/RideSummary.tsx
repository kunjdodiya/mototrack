import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Ride } from '../types/ride'
import { getRide, deleteRide, renameRide, trimRide } from '../features/storage/rides'
import { pushDeleteRide, pushRide } from '../features/storage/sync'
import { renderSharePng } from '../features/share/exportPng'
import { renderOverlayPng } from '../features/share/exportOverlayPng'
import { renderGlassPng } from '../features/share/exportGlassPng'
import { platform } from '../features/platform'
import { formatDateTime } from '../features/stats/format'
import RideMap from './RideMap'
import ShareCard from './ShareCard'
import ShareFormatPicker, { type ShareFormat } from './ShareFormatPicker'
import ForgotToStopSheet from './ForgotToStopSheet'

export default function RideSummary() {
  const { id } = useParams()
  const [ride, setRide] = useState<Ride | null | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [trimOpen, setTrimOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

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
    // Push the delete to Supabase first — if we only delete locally, the
    // next `pullFromCloud()` tick re-pulls the still-present server row and
    // the ride reappears in history.
    const ok = await pushDeleteRide(id)
    if (!ok) {
      alert("Couldn't delete this ride — check your connection and try again.")
      return
    }
    await deleteRide(id)
    window.location.href = '/history'
  }

  const startEdit = () => {
    if (!ride) return
    setNameDraft(ride.name ?? '')
    setEditingName(true)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  const cancelEdit = () => {
    setEditingName(false)
    setNameDraft('')
  }

  const handleRename = async () => {
    if (!id || !ride) return
    const trimmed = nameDraft.trim()
    if ((ride.name ?? '') === trimmed) {
      cancelEdit()
      return
    }
    const updated = await renameRide(id, trimmed)
    setEditingName(false)
    setNameDraft('')
    if (updated) {
      setRide(updated)
      void pushRide(updated)
    }
  }

  const handleTrim = async (newEndedAt: number) => {
    if (!id) return
    const updated = await trimRide(id, newEndedAt)
    setTrimOpen(false)
    if (updated) {
      setRide(updated)
      void pushRide(updated)
    }
  }

  const handleShare = async (format: ShareFormat) => {
    setPicker(false)
    setExporting(true)
    setExportError(null)
    try {
      const blob =
        format === 'overlay'
          ? await renderOverlayPng({ ride })
          : format === 'glass'
            ? await renderGlassPng({ ride })
            : await renderSharePng({ ride })
      const suffix =
        format === 'overlay'
          ? 'overlay'
          : format === 'glass'
            ? 'glass'
            : 'story'
      await platform.sharePng({
        blob,
        filename: `mototrack-${suffix}-${ride.id.slice(0, 8)}.png`,
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
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleRename()
            }}
            className="flex flex-col gap-2"
          >
            <input
              ref={nameInputRef}
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              placeholder={formatDateTime(ride.startedAt)}
              maxLength={80}
              aria-label="Ride name"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-display text-2xl font-bold tracking-tight text-white placeholder:text-neutral-600 focus:border-moto-orange/60 focus:bg-white/[0.06] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-orange transition active:scale-[0.98]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-neutral-200 transition active:scale-[0.98] hover:bg-white/[0.08]"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <h1 className="flex-1 font-display text-3xl font-bold leading-tight tracking-tight">
              {title}
            </h1>
            <button
              type="button"
              onClick={startEdit}
              aria-label="Rename ride"
              className="mt-1 shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-2 text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
          </div>
        )}
        {!editingName && subtitle && (
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

      <Link
        to={ride.tripId ? `/trips/${ride.tripId}` : '/trips'}
        className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-center text-base font-semibold text-neutral-200 transition active:scale-[0.98] hover:bg-white/[0.08]"
        style={{ animationDelay: '90ms' }}
      >
        {ride.tripId ? 'View trip →' : 'Add to a trip →'}
      </Link>

      <div className="grid animate-fade-up grid-cols-2 gap-3" style={{ animationDelay: '120ms' }}>
        <button
          type="button"
          onClick={() => setPicker(true)}
          disabled={exporting}
          className="rounded-2xl bg-brand-gradient py-4 text-base font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-60"
        >
          {exporting ? 'Generating…' : 'Share'}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-base font-semibold text-neutral-200 transition active:scale-[0.98] hover:bg-white/[0.08]"
        >
          Delete
        </button>
      </div>

      <button
        type="button"
        onClick={() => setTrimOpen(true)}
        className="mx-auto -mt-2 animate-fade-up text-xs font-semibold text-neutral-400 underline decoration-dotted underline-offset-4 transition hover:text-white"
        style={{ animationDelay: '150ms' }}
      >
        Forgot to stop? Trim ride →
      </button>

      <p className="-mt-2 text-center text-xs text-neutral-500">
        Pick a branded Story poster, a frosted-glass poster you can drop your
        photo behind, or a transparent overlay for on top of your photo.
      </p>

      {exportError && (
        <p className="text-center text-sm text-red-400">Export failed: {exportError}</p>
      )}

      {picker && (
        <ShareFormatPicker
          onPick={(format) => void handleShare(format)}
          onClose={() => setPicker(false)}
        />
      )}

      {trimOpen && (
        <ForgotToStopSheet
          startedAt={ride.startedAt}
          points={ride.track}
          liveDistanceMeters={ride.stats.distanceMeters}
          liveDurationMs={ride.stats.durationMs}
          endReference={ride.endedAt}
          eyebrow="Trim this ride"
          title="Rewind the end"
          description="Rewind when this ride ended if you forgot to stop and the phone kept recording. We'll drop everything after the new end."
          confirmLabel="Trim ride"
          onConfirm={handleTrim}
          onClose={() => setTrimOpen(false)}
        />
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
