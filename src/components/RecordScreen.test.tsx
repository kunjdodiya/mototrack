import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RecordScreen from './RecordScreen'
import { useRecorder } from '../features/recorder/useRecorder'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

vi.mock('./RideMap', () => ({
  default: () => <div data-testid="live-map" />,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (_fn: unknown, _deps?: unknown, def?: unknown) => def,
}))

vi.mock('../features/storage/db', () => ({
  db: {
    bikes: { orderBy: () => ({ toArray: vi.fn().mockResolvedValue([]) }) },
    rides: { count: vi.fn().mockResolvedValue(0) },
  },
}))

vi.mock('../features/storage/bikes', () => ({ addBike: vi.fn() }))
vi.mock('../features/storage/sync', () => ({ pushBike: vi.fn() }))
vi.mock('../features/recorder/sound', () => ({
  playStartChime: vi.fn(),
  playPauseChime: vi.fn(),
  playResumeChime: vi.fn(),
  playStopChime: vi.fn(),
}))
vi.mock('../features/platform', () => ({
  platform: { hapticTap: vi.fn() },
}))

function frameOf(mapEl: HTMLElement): HTMLElement {
  const frame = mapEl.parentElement?.parentElement
  if (!frame) throw new Error('live map frame not found')
  return frame
}

describe('RecordScreen live map frame', () => {
  beforeEach(() => {
    useRecorder.setState({
      status: 'idle',
      points: [],
      startedAt: null,
      name: null,
      bikeId: null,
      liveDistanceMeters: 0,
      liveDurationMs: 0,
      liveSpeedMps: null,
      error: null,
    })
  })

  it('wraps the live map in an animated brand-gradient frame while recording', () => {
    useRecorder.setState({ status: 'recording', startedAt: Date.now() })
    const { getByTestId } = render(
      <MemoryRouter>
        <RecordScreen />
      </MemoryRouter>,
    )
    const frame = frameOf(getByTestId('live-map'))
    expect(frame.className).toMatch(/bg-brand-gradient/)
    expect(frame.className).toMatch(/animate-gradient-shift/)
    expect(frame.className).toMatch(/shadow-glow-orange/)
    expect(frame.className).not.toMatch(/opacity-60/)
  })

  it('shows the first-ride walkthrough card on the idle screen', () => {
    const { getByLabelText, getByText } = render(
      <MemoryRouter>
        <RecordScreen />
      </MemoryRouter>,
    )
    const card = getByLabelText("What you'll get")
    expect(card.textContent).toMatch(/First ride/i)
    expect(card.textContent).toMatch(/Instagram/i)
    expect(card.textContent).toMatch(/WhatsApp/i)
    expect(getByText(/top speed, average speed/i)).toBeDefined()
  })

  it('dims the frame and stops the animation while paused', () => {
    useRecorder.setState({ status: 'paused', startedAt: Date.now() })
    const { getByTestId } = render(
      <MemoryRouter>
        <RecordScreen />
      </MemoryRouter>,
    )
    const frame = frameOf(getByTestId('live-map'))
    expect(frame.className).toMatch(/bg-brand-gradient/)
    expect(frame.className).toMatch(/opacity-60/)
    expect(frame.className).not.toMatch(/animate-gradient-shift/)
    expect(frame.className).not.toMatch(/shadow-glow-orange/)
  })
})
