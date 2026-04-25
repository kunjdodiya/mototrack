const DEFAULT_BIKE_KEY = 'mototrack:default-bike-id'

export function readDefaultBikeId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(DEFAULT_BIKE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function writeDefaultBikeId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id && id.trim()) {
      window.localStorage.setItem(DEFAULT_BIKE_KEY, id.trim())
    } else {
      window.localStorage.removeItem(DEFAULT_BIKE_KEY)
    }
  } catch {
    // storage blocked — the preference is best-effort
  }
}
