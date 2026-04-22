import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const pullFromCloud = vi.fn().mockResolvedValue(undefined)
const syncUnsyncedRides = vi.fn().mockResolvedValue(undefined)

vi.mock('./sync', () => ({
  pullFromCloud: (...a: unknown[]) => pullFromCloud(...a),
  syncUnsyncedRides: (...a: unknown[]) => syncUnsyncedRides(...a),
}))

let resumeHandler: (() => void) | null = null
const onAppResume = vi.fn((h: () => void) => {
  resumeHandler = h
  return () => {
    resumeHandler = null
  }
})

vi.mock('../platform', () => ({
  platform: { onAppResume: (h: () => void) => onAppResume(h) },
}))

import { startLiveSync } from './liveSync'

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  pullFromCloud.mockClear()
  syncUnsyncedRides.mockClear()
  onAppResume.mockClear()
  resumeHandler = null
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startLiveSync', () => {
  it('registers visibility, focus, and native-resume listeners', () => {
    const stop = startLiveSync()
    expect(onAppResume).toHaveBeenCalledTimes(1)
    expect(typeof resumeHandler).toBe('function')
    stop()
  })

  it('pulls when the tab becomes visible after being hidden', async () => {
    const stop = startLiveSync()
    pullFromCloud.mockClear()
    syncUnsyncedRides.mockClear()

    setVisibility('hidden')
    await flushMicrotasks()
    expect(pullFromCloud).not.toHaveBeenCalled()

    setVisibility('visible')
    await flushMicrotasks()
    expect(syncUnsyncedRides).toHaveBeenCalledTimes(1)
    expect(pullFromCloud).toHaveBeenCalledTimes(1)

    stop()
  })

  it('pulls on window focus', async () => {
    const stop = startLiveSync()
    pullFromCloud.mockClear()
    syncUnsyncedRides.mockClear()

    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()
    expect(pullFromCloud).toHaveBeenCalledTimes(1)
    stop()
  })

  it('pulls on native app resume', async () => {
    const stop = startLiveSync()
    pullFromCloud.mockClear()
    syncUnsyncedRides.mockClear()

    resumeHandler?.()
    await flushMicrotasks()
    expect(pullFromCloud).toHaveBeenCalledTimes(1)
    stop()
  })

  it('pulls periodically while visible and stops when hidden', async () => {
    const stop = startLiveSync()
    pullFromCloud.mockClear()
    syncUnsyncedRides.mockClear()

    await vi.advanceTimersByTimeAsync(90_000)
    expect(pullFromCloud).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(300_000)
    expect(pullFromCloud).toHaveBeenCalledTimes(1)

    stop()
  })

  it('tears down listeners + interval on stop', async () => {
    const stop = startLiveSync()
    stop()
    pullFromCloud.mockClear()
    syncUnsyncedRides.mockClear()

    setVisibility('visible')
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(200_000)

    expect(pullFromCloud).not.toHaveBeenCalled()
  })

  it('skips overlapping pulls when one is still in flight', async () => {
    const releases: Array<() => void> = []
    pullFromCloud.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve)
        }),
    )

    const stop = startLiveSync()
    pullFromCloud.mockClear()

    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()
    window.dispatchEvent(new Event('focus'))
    await flushMicrotasks()

    expect(pullFromCloud).toHaveBeenCalledTimes(1)

    releases.forEach((r) => r())
    stop()
  })
})
