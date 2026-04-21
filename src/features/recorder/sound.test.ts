import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

type Ctor = new () => unknown

type SoundModule = typeof import('./sound')

const originalAudioCtx = (window as unknown as { AudioContext?: Ctor }).AudioContext
const originalWebkit = (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext

beforeEach(() => {
  // Reset the module so the cached AudioContext singleton from a prior test
  // doesn't leak into the next one.
  vi.resetModules()
})

afterEach(() => {
  ;(window as unknown as { AudioContext?: Ctor }).AudioContext = originalAudioCtx
  ;(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext = originalWebkit
  vi.restoreAllMocks()
})

async function loadSound(): Promise<SoundModule> {
  return import('./sound')
}

function installFakeAudio() {
  const oscStart = vi.fn()
  const oscStop = vi.fn()

  class FakeOsc {
    type = ''
    frequency = { setValueAtTime: vi.fn() }
    connect = vi.fn()
    start = oscStart
    stop = oscStop
  }
  class FakeGain {
    gain = {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    }
    connect = vi.fn()
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

  return { oscStart, oscStop }
}

describe('recorder chimes', () => {
  it('no-op silently when AudioContext is unavailable', async () => {
    ;(window as unknown as { AudioContext?: Ctor }).AudioContext = undefined
    ;(window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext = undefined
    const sound = await loadSound()
    expect(() => {
      sound.playStartChime()
      sound.playPauseChime()
      sound.playResumeChime()
      sound.playStopChime()
    }).not.toThrow()
  })

  it('start schedules two oscillators', async () => {
    const { oscStart } = installFakeAudio()
    const sound = await loadSound()
    sound.playStartChime()
    expect(oscStart).toHaveBeenCalledTimes(2)
  })

  it('pause schedules one oscillator', async () => {
    const { oscStart } = installFakeAudio()
    const sound = await loadSound()
    sound.playPauseChime()
    expect(oscStart).toHaveBeenCalledTimes(1)
  })

  it('resume schedules two oscillators', async () => {
    const { oscStart } = installFakeAudio()
    const sound = await loadSound()
    sound.playResumeChime()
    expect(oscStart).toHaveBeenCalledTimes(2)
  })

  it('stop schedules two oscillators', async () => {
    const { oscStart } = installFakeAudio()
    const sound = await loadSound()
    sound.playStopChime()
    expect(oscStart).toHaveBeenCalledTimes(2)
  })
})
