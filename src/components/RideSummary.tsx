import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Ride } from '../types/ride'
import { getRide, deleteRide } from '../features/storage/rides'
import RideMap from './RideMap'
import ShareCard from './ShareCard'

export default function RideSummary() {
  const { id } = useParams()
  const [ride, setRide] = useState<Ride | null | undefined>(undefined)

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
          disabled
          className="rounded-xl bg-moto-orange py-3 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          Export PNG (next step)
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-xl border border-neutral-800 py-3 font-semibold text-neutral-300 transition active:scale-[0.98]"
        >
          Delete
        </button>
      </div>

      <Link
        to="/history"
        className="mt-2 text-center text-sm text-neutral-400 hover:text-white"
      >
        ← Back to history
      </Link>
    </div>
  )
}
