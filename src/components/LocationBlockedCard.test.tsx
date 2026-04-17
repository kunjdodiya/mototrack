import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LocationBlockedCard from './LocationBlockedCard'
import { isIOSSafari } from '../lib/isIOSSafari'

describe('isIOSSafari', () => {
  it('detects an iPhone Safari UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
    expect(isIOSSafari(ua)).toBe(true)
  })

  it('rejects an iPhone Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'
    expect(isIOSSafari(ua)).toBe(false)
  })

  it('rejects a desktop Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(isIOSSafari(ua)).toBe(false)
  })

  it('rejects an Android Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(isIOSSafari(ua)).toBe(false)
  })
})

describe('LocationBlockedCard', () => {
  it('renders the block title and retry button', () => {
    render(<LocationBlockedCard onRetry={() => {}} />)
    expect(screen.getByText(/Location is blocked/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('calls onRetry when the user taps the button', () => {
    const onRetry = vi.fn()
    render(<LocationBlockedCard onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows iOS-specific copy when UA is iPhone Safari', () => {
    const original = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    try {
      render(<LocationBlockedCard onRetry={() => {}} />)
      expect(screen.getByText(/On your iPhone/i)).toBeInTheDocument()
      expect(screen.getByText(/aA/)).toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: original,
        configurable: true,
      })
    }
  })
})
