import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import ForgotToStopSheet from './ForgotToStopSheet'
import type { TrackPoint } from '../types/ride'

const NOW = 1_700_000_000_000

function point(tsOffset: number, lat = 0, lng = 0): TrackPoint {
  return { ts: NOW - tsOffset, lat, lng, speed: 10, alt: null, acc: 5 }
}

describe('ForgotToStopSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders presets + custom input + cancel', () => {
    const { getByText, getByLabelText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 6 * 3600_000}
        points={[]}
        liveDistanceMeters={0}
        liveDurationMs={6 * 3600_000}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(getByLabelText('Stop ride earlier')).toBeDefined()
    expect(getByText('1 hr ago')).toBeDefined()
    expect(getByText('4 hr ago')).toBeDefined()
    expect(getByText('Cancel')).toBeDefined()
    expect(getByText('Save trimmed ride')).toBeDefined()
  })

  it('disables presets larger than the ride duration', () => {
    // Ride is only 1 hr — 2+ hr presets should be disabled.
    const { getByText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 3600_000}
        points={[]}
        liveDistanceMeters={0}
        liveDurationMs={3600_000}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect((getByText('2 hr ago') as HTMLButtonElement).disabled).toBe(true)
    expect((getByText('4 hr ago') as HTMLButtonElement).disabled).toBe(true)
    expect((getByText('30 min ago') as HTMLButtonElement).disabled).toBe(false)
  })

  it('confirm fires onConfirm with the selected cutoff timestamp', () => {
    const onConfirm = vi.fn()
    const { getByText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 5 * 3600_000}
        points={[point(5 * 3600_000), point(4 * 3600_000), point(3 * 3600_000)]}
        liveDistanceMeters={1000}
        liveDurationMs={5 * 3600_000}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(getByText('2 hr ago'))
    fireEvent.click(getByText('Save trimmed ride'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(NOW - 2 * 3600_000)
  })

  it('anchors presets on endReference when provided (recap "trim" mode)', () => {
    const onConfirm = vi.fn()
    // Ride ran from 10 hr ago to 3 hr ago, user opens the sheet now.
    const rideEnd = NOW - 3 * 3600_000
    const rideStart = NOW - 10 * 3600_000
    const { getByText } = render(
      <ForgotToStopSheet
        startedAt={rideStart}
        endReference={rideEnd}
        points={[point(10 * 3600_000), point(4 * 3600_000)]}
        liveDistanceMeters={1000}
        liveDurationMs={7 * 3600_000}
        onConfirm={onConfirm}
        onClose={vi.fn()}
        confirmLabel="Trim ride"
      />,
    )
    fireEvent.click(getByText('1 hr ago'))
    fireEvent.click(getByText('Trim ride'))
    // 1 hr before the ride's end, not 1 hr before "now".
    expect(onConfirm).toHaveBeenCalledWith(rideEnd - 3600_000)
  })

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 3600_000}
        points={[]}
        liveDistanceMeters={0}
        liveDurationMs={3600_000}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.click(getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
