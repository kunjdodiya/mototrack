/** Meters → "12.4 km" (or "840 m" if < 1 km). */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

/** Ms → "1:23:45" or "23:45". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** m/s → "54 km/h". Null-safe → "—". */
export function formatSpeed(mps: number | null): string {
  if (mps == null) return '—'
  return `${Math.round(mps * 3.6)} km/h`
}

/** Meters → "123 m" or "—" if null. */
export function formatElevation(m: number | null): string {
  if (m == null) return '—'
  return `${Math.round(m)} m`
}

/** Ms epoch → "Apr 17, 2026 · 11:55 AM" */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
