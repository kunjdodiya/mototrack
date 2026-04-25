import { describe, it, expect, beforeEach } from 'vitest'
import {
  readDefaultBikeId,
  writeDefaultBikeId,
} from './preferences'

beforeEach(() => {
  window.localStorage.clear()
})

describe('default bike preference', () => {
  it('returns null when no default is set', () => {
    expect(readDefaultBikeId()).toBeNull()
  })

  it('round-trips an id through write + read', () => {
    writeDefaultBikeId('bike-123')
    expect(readDefaultBikeId()).toBe('bike-123')
  })

  it('clears the value when written with null', () => {
    writeDefaultBikeId('bike-123')
    writeDefaultBikeId(null)
    expect(readDefaultBikeId()).toBeNull()
  })

  it('clears the value when written with an empty string', () => {
    writeDefaultBikeId('bike-123')
    writeDefaultBikeId('   ')
    expect(readDefaultBikeId()).toBeNull()
  })

  it('trims surrounding whitespace on read and write', () => {
    writeDefaultBikeId('  bike-123  ')
    expect(readDefaultBikeId()).toBe('bike-123')
  })
})
