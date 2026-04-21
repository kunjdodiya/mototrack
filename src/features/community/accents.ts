import type { ClubAccent } from '../../types/club'

export const ACCENT_GRADIENT_CLASS: Record<ClubAccent, string> = {
  sunrise: 'from-moto-orange to-moto-magenta',
  neon: 'from-moto-magenta to-moto-violet',
  ocean: 'from-moto-violet to-moto-cyan',
  aurora: 'from-moto-cyan via-moto-violet to-moto-magenta',
  ember: 'from-red-500 to-moto-orange',
}

export const ACCENT_LABEL: Record<ClubAccent, string> = {
  sunrise: 'Sunrise',
  neon: 'Neon',
  ocean: 'Ocean',
  aurora: 'Aurora',
  ember: 'Ember',
}

export function clubInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
}
