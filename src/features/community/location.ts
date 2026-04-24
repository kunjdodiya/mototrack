const STORAGE_KEY = 'mototrack:community-location'

export function readStoredLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function writeStoredLocation(value: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (value && value.trim()) {
      window.localStorage.setItem(STORAGE_KEY, value.trim())
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage blocked — the in-memory state still works for this session
  }
}
