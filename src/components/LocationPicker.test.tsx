import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LocationPicker from './LocationPicker'
import { readStoredLocation } from '../features/community/location'

const STORAGE_KEY = 'mototrack:community-location'

describe('LocationPicker', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders placeholder text when value is null', () => {
    render(<LocationPicker value={null} onChange={() => {}} />)
    expect(
      screen.getByRole('button', { name: /change location filter/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/anywhere/i)).toBeInTheDocument()
  })

  it('shows the current value as "Near X" when set', () => {
    render(<LocationPicker value="San Francisco" onChange={() => {}} />)
    expect(screen.getByText(/near/i)).toBeInTheDocument()
    expect(screen.getByText('San Francisco')).toBeInTheDocument()
  })

  it('saves the typed value, writes to localStorage, and calls onChange', () => {
    const onChange = vi.fn()
    render(<LocationPicker value={null} onChange={onChange} />)
    fireEvent.click(
      screen.getByRole('button', { name: /change location filter/i }),
    )
    const input = screen.getByLabelText(/city, area, or country/i)
    fireEvent.change(input, { target: { value: '  Bay Area  ' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onChange).toHaveBeenCalledWith('Bay Area')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('Bay Area')
  })

  it('Clear removes the stored value and emits null', () => {
    window.localStorage.setItem(STORAGE_KEY, 'Mumbai')
    const onChange = vi.fn()
    render(<LocationPicker value="Mumbai" onChange={onChange} />)
    fireEvent.click(
      screen.getByRole('button', { name: /change location filter/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onChange).toHaveBeenCalledWith(null)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('readStoredLocation returns trimmed non-empty values', () => {
    window.localStorage.setItem(STORAGE_KEY, '  Goa  ')
    expect(readStoredLocation()).toBe('Goa')
    window.localStorage.setItem(STORAGE_KEY, '   ')
    expect(readStoredLocation()).toBeNull()
  })
})
