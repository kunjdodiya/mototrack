import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyScreen from './PrivacyScreen'

describe('PrivacyScreen', () => {
  it('renders the policy headline and the key data-collection statements', () => {
    render(
      <MemoryRouter>
        <PrivacyScreen />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: /privacy policy/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/data we collect/i)).toBeInTheDocument()
    expect(screen.getByText(/Background location use/i)).toBeInTheDocument()
    expect(screen.getByText(/never sells your data/i)).toBeInTheDocument()
    // Back link works without a router wrapping the route tree.
    expect(
      screen.getByRole('link', { name: /back to mototrack/i }),
    ).toHaveAttribute('href', '/')
  })
})
