import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomTabBar from './BottomTabBar'

describe('BottomTabBar', () => {
  it('renders all four primary tab labels', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /ride now/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my rides/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /community/i })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /my profile/i }),
    ).toBeInTheDocument()
  })

  it('links tabs to the correct routes', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /ride now/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: /my rides/i })).toHaveAttribute(
      'href',
      '/history',
    )
    expect(screen.getByRole('link', { name: /community/i })).toHaveAttribute(
      'href',
      '/community',
    )
    expect(screen.getByRole('link', { name: /my profile/i })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('marks the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/community']}>
        <BottomTabBar />
      </MemoryRouter>,
    )
    const community = screen.getByRole('link', { name: /community/i })
    expect(community).toHaveAttribute('aria-current', 'page')
  })
})
