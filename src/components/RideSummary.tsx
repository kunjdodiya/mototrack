import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Ride } from '../types/ride'
import { getRide, deleteRide } from '../features/storage/rides'
import { renderSharePng } from '../features/share/exportPng'
import { platform } from '../features/platform'
import RideMap from './RideMap'
import ShareCard from './ShareCard'

export default function RideSummary() {
  const { id } = useParams()
  const [ride, setRide] = useState<Ride | null | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const posterRef = useRef<HTMLDivElement>(null)

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
    return <div className="p-6 text-neutral-400">Loading…</div>
  }
  if (ride === null) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="text-neutral-400">Ride not found.</p>
        <Link to="/history" className="mt-4 inline-block text-moto-orange">
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

  const handleExport = async () => {
    if (!posterRef.current) return
    setExporting(true)
    setExportError(null)
    try {
      const blob = await renderSharePng({
        ride,
        cardNode: posterRef.current,
      })
      await platform.sharePng({
        blob,
        filename: `mototrack-${ride.id.slice(0, 8)}.png`,
        title: 'MotoTrack ride',
        text: ride.name ?? 'My ride',
      })
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div className="h-64">
        <RideMap
          points={ride.track}
          fitAll
          className="h-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
        />
      </div>

      <ShareCard ride={ride} />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="rounded-xl bg-moto-orange py-3 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {exporting ? 'Generating…' : 'Export PNG'}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-xl border border-neutral-800 py-3 font-semibold text-neutral-300 transition active:scale-[0.98]"
        >
          Delete
        </button>
      </div>

      {exportError && (
        <p className="text-sm text-red-400">Export failed: {exportError}</p>
      )}

      <Link
        to="/history"
        className="mt-2 text-center text-sm text-neutral-400 hover:text-white"
      >
        ← Back to history
      </Link>

      {/* Off-screen poster-sized card used only during PNG export. */}
      <div
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div ref={posterRef}>
          <ShareCard ride={ride} poster />
        </div>
      </div>
    </div>
  )
}
