import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CommunityScreen from './CommunityScreen'

describe('CommunityScreen', () => {
  it('renders the community heading and clubs tab by default', () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /find your/i,
    )
    expect(screen.getByRole('tab', { name: /clubs/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/featured clubs/i)).toBeInTheDocument()
  })

  it('switches to host panel when Host tab is activated', () => {
    render(
      <MemoryRouter>
        <CommunityScreen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('tab', { name: /host/i }))
    expect(screen.getByRole('tab', { name: /host/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('button', { name: /create a ride/i })).toBeInTheDocument()
    expect(screen.getByText(/host tools/i)).toBeInTheDocument()
  })
})
