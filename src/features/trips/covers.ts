import type { TripCover } from '../../types/trip'

export const TRIP_COVER_CLASS: Record<TripCover, string> = {
  sunrise: 'from-moto-orange to-moto-magenta',
  neon: 'from-moto-magenta to-moto-violet',
  ocean: 'from-moto-violet to-moto-cyan',
  aurora: 'from-moto-cyan via-moto-violet to-moto-magenta',
  ember: 'from-red-500 to-moto-orange',
}

export const TRIP_COVER_LABEL: Record<TripCover, string> = {
  sunrise: 'Sunrise',
  neon: 'Neon',
  ocean: 'Ocean',
  aurora: 'Aurora',
  ember: 'Ember',
}

/**
 * Gradient stops used by the canvas share compositor.
 * Order matches TRIP_COVER_CLASS — `from → (via?) → to`.
 */
export const TRIP_COVER_HEX: Record<TripCover, string[]> = {
  sunrise: ['#ff4d00', '#ff2d87'],
  neon: ['#ff2d87', '#7c3aed'],
  ocean: ['#7c3aed', '#22d3ee'],
  aurora: ['#22d3ee', '#7c3aed', '#ff2d87'],
  ember: ['#ef4444', '#ff4d00'],
}
