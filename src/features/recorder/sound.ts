// Start-of-ride confirmation chime. Synthesized via Web Audio so we don't
// ship an audio asset. Must be invoked from a user-gesture (e.g. onClick);
// iOS Safari blocks AudioContext outside one.

type AudioCtxCtor = typeof AudioContext

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const W = window as unknown as {
    AudioContext?: AudioCtxCtor
    webkitAudioContext?: AudioCtxCtor
  }
  const Ctor = W.AudioContext ?? W.webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

function tone(audio: AudioContext, freq: number, startAt: number, durationSec: number) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, startAt)

  // Quick attack + exponential decay — a clean "confirm" blip, not a beep.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.02)
}

export function playStartChime(): void {
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') {
      void audio.resume()
    }
    const now = audio.currentTime
    tone(audio, 659.25, now, 0.14) // E5
    tone(audio, 987.77, now + 0.11, 0.2) // B5
  } catch {
    // Audio is a nice-to-have — never let it break Start.
  }
}
