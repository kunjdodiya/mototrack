import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import BottomTabBar from './BottomTabBar'
import { platform } from '../features/platform'

vi.mock('../features/platform', () => ({
  platform: { hapticTap: vi.fn() },
}))

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

  it('does not fire a haptic on initial mount', () => {
    vi.mocked(platform.hapticTap).mockClear()
    render(
      <MemoryRouter initialEntries={['/history']}>
        <BottomTabBar />
      </MemoryRouter>,
    )
    expect(platform.hapticTap).not.toHaveBeenCalled()
  })

  it('fires a haptic when the active tab changes', () => {
    vi.mocked(platform.hapticTap).mockClear()

    function Jumper() {
      const navigate = useNavigate()
      useEffect(() => {
        navigate('/community')
      }, [navigate])
      return null
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<BottomTabBar />} />
        </Routes>
        <Jumper />
      </MemoryRouter>,
    )

    expect(platform.hapticTap).toHaveBeenCalledWith('light')
  })
})
