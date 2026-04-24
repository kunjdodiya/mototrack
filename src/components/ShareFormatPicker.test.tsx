import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShareFormatPicker from './ShareFormatPicker'

describe('ShareFormatPicker', () => {
  it('renders all three format choices + a Cancel button', () => {
    render(<ShareFormatPicker onPick={() => undefined} onClose={() => undefined} />)
    expect(screen.getByRole('button', { name: /story poster/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /glass poster/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /transparent overlay/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onPick("poster") when the Story poster tile is tapped', () => {
    const onPick = vi.fn()
    render(<ShareFormatPicker onPick={onPick} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /story poster/i }))
    expect(onPick).toHaveBeenCalledWith('poster')
  })

  it('calls onPick("glass") when the Glass poster tile is tapped', () => {
    const onPick = vi.fn()
    render(<ShareFormatPicker onPick={onPick} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /glass poster/i }))
    expect(onPick).toHaveBeenCalledWith('glass')
  })

  it('calls onPick("overlay") when the Transparent overlay tile is tapped', () => {
    const onPick = vi.fn()
    render(<ShareFormatPicker onPick={onPick} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /transparent overlay/i }))
    expect(onPick).toHaveBeenCalledWith('overlay')
  })

  it('calls onClose when Cancel is tapped', () => {
    const onClose = vi.fn()
    render(<ShareFormatPicker onPick={() => undefined} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
