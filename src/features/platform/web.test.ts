import { describe, it, expect, afterEach, vi } from 'vitest'
import { webPlatform } from './web'

const originalVibrate = navigator.vibrate?.bind(navigator)

afterEach(() => {
  if (originalVibrate) {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: originalVibrate,
    })
  } else {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate
  }
  vi.restoreAllMocks()
})

describe('webPlatform.hapticTap', () => {
  it('calls navigator.vibrate with a light ms pulse', () => {
    const spy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: spy })
    webPlatform.hapticTap('light')
    expect(spy).toHaveBeenCalledWith(12)
  })

  it('calls navigator.vibrate with a heavy pattern', () => {
    const spy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: spy })
    webPlatform.hapticTap('heavy')
    expect(spy).toHaveBeenCalledWith([30, 40, 60])
  })

  it('no-ops silently when Vibration API is absent', () => {
    delete (navigator as unknown as { vibrate?: unknown }).vibrate
    expect(() => webPlatform.hapticTap('medium')).not.toThrow()
  })

  it('swallows vibrate() throwing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => {
        throw new Error('not allowed')
      },
    })
    expect(() => webPlatform.hapticTap()).not.toThrow()
  })
})
