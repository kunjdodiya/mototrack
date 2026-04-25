import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import ForgotToStopSheet from './ForgotToStopSheet'
import type { TrackPoint } from '../types/ride'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="trim-map">{children}</div>
  ),
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  useMap: () => ({
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    panTo: vi.fn(),
  }),
}))
vi.mock('leaflet', () => ({
  default: { latLngBounds: vi.fn(() => ({})) },
}))
vi.mock('../features/map/leafletIcons', () => ({}))

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

  it('renders the three rewind sliders + cancel + confirm', () => {
    const { getByLabelText, getByText } = render(
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
    expect(getByLabelText('Scrub the map')).toBeDefined()
    expect(getByLabelText('Hours back')).toBeDefined()
    expect(getByLabelText('Minutes back')).toBeDefined()
    expect(getByText('Cancel')).toBeDefined()
    expect(getByText('Save trimmed ride')).toBeDefined()
  })

  it('caps the hours slider at the ride duration', () => {
    // Ride is only 1 hr long — minus the 1-min safety floor that's 59 min,
    // so the hours slider can never advance past 0.
    const { getByLabelText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 3600_000}
        points={[]}
        liveDistanceMeters={0}
        liveDurationMs={3600_000}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const hours = getByLabelText('Hours back') as HTMLInputElement
    expect(hours.max).toBe('0')
    expect(hours.disabled).toBe(true)
    const minutes = getByLabelText('Minutes back') as HTMLInputElement
    expect(minutes.max).toBe('59')
    expect(minutes.disabled).toBe(false)
  })

  it('confirm fires onConfirm with the cutoff derived from the hour+minute sliders', () => {
    const onConfirm = vi.fn()
    const { getByLabelText, getByText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 5 * 3600_000}
        points={[
          point(5 * 3600_000),
          point(4 * 3600_000),
          point(3 * 3600_000),
        ]}
        liveDistanceMeters={1000}
        liveDurationMs={5 * 3600_000}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(getByLabelText('Hours back'), { target: { value: '2' } })
    fireEvent.change(getByLabelText('Minutes back'), {
      target: { value: '15' },
    })
    fireEvent.click(getByText('Save trimmed ride'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(
      NOW - (2 * 3600_000 + 15 * 60_000),
    )
  })

  it('the map-scrub slider drives the same cutoff', () => {
    const onConfirm = vi.fn()
    const { getByLabelText, getByText } = render(
      <ForgotToStopSheet
        startedAt={NOW - 5 * 3600_000}
        points={[]}
        liveDistanceMeters={0}
        liveDurationMs={5 * 3600_000}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    )
    // Rewind 90 minutes via the scrub slider (5400s).
    fireEvent.change(getByLabelText('Scrub the map'), {
      target: { value: '5400' },
    })
    fireEvent.click(getByText('Save trimmed ride'))
    expect(onConfirm).toHaveBeenCalledWith(NOW - 5400 * 1000)
  })

  it('anchors the cutoff on endReference when provided (recap "trim" mode)', () => {
    const onConfirm = vi.fn()
    const rideEnd = NOW - 3 * 3600_000
    const rideStart = NOW - 10 * 3600_000
    const { getByLabelText, getByText } = render(
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
    fireEvent.change(getByLabelText('Hours back'), { target: { value: '1' } })
    fireEvent.click(getByText('Trim ride'))
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

  it('renders the trim map preview when points exist', () => {
    const { getByTestId } = render(
      <ForgotToStopSheet
        startedAt={NOW - 3600_000}
        points={[
          point(3600_000, 20.7619, 73.377),
          point(1800_000, 20.7625, 73.378),
          point(0, 20.763, 73.379),
        ]}
        liveDistanceMeters={1500}
        liveDurationMs={3600_000}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(getByTestId('trim-map')).toBeDefined()
  })
})
