import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SpeedGraph from './SpeedGraph'
import type { TrackPoint } from '../types/ride'

function pt(i: number, speed: number): TrackPoint {
  return { lat: 0, lng: i * 0.0001, ts: i * 1_000, speed, alt: null, acc: 5 }
}

describe('SpeedGraph', () => {
  it('renders a placeholder for a too-short track', () => {
    const { getByText } = render(<SpeedGraph track={[]} />)
    expect(getByText(/not enough data/i)).toBeInTheDocument()
  })

  it('renders an SVG path for a valid track', () => {
    const track: TrackPoint[] = Array.from({ length: 10 }, (_, i) => pt(i, 10 + i))
    const { container } = render(<SpeedGraph track={track} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const path = container.querySelector('path[stroke="#ff4d00"]')
    expect(path).toBeTruthy()
    expect(path?.getAttribute('d')).toMatch(/^M/)
  })
})
