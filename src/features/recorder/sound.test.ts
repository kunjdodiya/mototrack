import { describe, it, expect, afterEach, vi } from 'vitest'
import { playStartChime } from './sound'

type Ctor = new () => unknown

const originalAudioCtx = (window as unknown as { AudioContext?: Ctor }).AudioContext
const originalWebkit = (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext

afterEach(() => {
  ;(window as unknown as { AudioContext?: Ctor }).AudioContext = originalAudioCtx
  ;(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext = originalWebkit
  vi.restoreAllMocks()
})

describe('playStartChime', () => {
  it('no-ops silently when AudioContext is unavailable', () => {
    ;(window as unknown as { AudioContext?: Ctor }).AudioContext = undefined
    ;(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext = undefined
    expect(() => playStartChime()).not.toThrow()
  })

  it('schedules two oscillators on a live AudioContext', () => {
    const oscStart = vi.fn()
    const oscStop = vi.fn()
    const oscConnect = vi.fn()
    const gainConnect = vi.fn()
    const setValueAtTime = vi.fn()
    const linearRamp = vi.fn()
    const expRamp = vi.fn()

    class FakeOsc {
      type = ''
      frequency = { setValueAtTime }
      connect = oscConnect
      start = oscStart
      stop = oscStop
    }
    class FakeGain {
      gain = {
        setValueAtTime,
        linearRampToValueAtTime: linearRamp,
        exponentialRampToValueAtTime: expRamp,
      }
      connect = gainConnect
    }
    class FakeCtx {
      state = 'running'
      currentTime = 0
      destination = {}
      createOscillator() {
        return new FakeOsc()
      }
      createGain() {
        return new FakeGain()
      }
      resume() {
        return Promise.resolve()
      }
    }

    ;(window as unknown as { AudioContext: Ctor }).AudioContext = FakeCtx as unknown as Ctor

    playStartChime()

    expect(oscStart).toHaveBeenCalledTimes(2)
    expect(oscStop).toHaveBeenCalledTimes(2)
  })
})
