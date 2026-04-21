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

type ChimeNote = { freq: number; offset: number; duration: number }

function playChime(notes: readonly ChimeNote[]): void {
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') {
      void audio.resume()
    }
    const now = audio.currentTime
    for (const n of notes) {
      tone(audio, n.freq, now + n.offset, n.duration)
    }
  } catch {
    // Audio is a nice-to-have — never let it break a recorder action.
  }
}

// Rising two-tone: "tracking is live."
export function playStartChime(): void {
  playChime([
    { freq: 659.25, offset: 0, duration: 0.14 }, // E5
    { freq: 987.77, offset: 0.11, duration: 0.2 }, // B5
  ])
}

// Single soft mid note: "paused, hold."
export function playPauseChime(): void {
  playChime([{ freq: 523.25, offset: 0, duration: 0.16 }]) // C5
}

// Rising pair echoing Start, but softer: "back on."
export function playResumeChime(): void {
  playChime([
    { freq: 523.25, offset: 0, duration: 0.1 }, // C5
    { freq: 783.99, offset: 0.08, duration: 0.16 }, // G5
  ])
}

// Descending pair: "ride saved."
export function playStopChime(): void {
  playChime([
    { freq: 783.99, offset: 0, duration: 0.14 }, // G5
    { freq: 392.0, offset: 0.12, duration: 0.22 }, // G4
  ])
}
