import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import SwipeToStartButton from './SwipeToStartButton'

function stubTrackWidth(el: HTMLElement, width: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: 56,
    width,
    height: 56,
    toJSON() {
      return {}
    },
  })
}

describe('SwipeToStartButton', () => {
  it('fires onConfirm after the knob is dragged past the threshold', () => {
    const onConfirm = vi.fn()
    const { getByTestId } = render(<SwipeToStartButton onConfirm={onConfirm} />)
    const track = getByTestId('swipe-to-start')
    track.setPointerCapture = vi.fn()
    stubTrackWidth(track, 320)

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 28 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 30 })
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.pointerMove(track, { pointerId: 1, clientX: 310 })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the swipe is released before the threshold', () => {
    const onConfirm = vi.fn()
    const { getByTestId } = render(<SwipeToStartButton onConfirm={onConfirm} />)
    const track = getByTestId('swipe-to-start')
    track.setPointerCapture = vi.fn()
    stubTrackWidth(track, 320)

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 28 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 120 })
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 120 })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ignores interaction while disabled', () => {
    const onConfirm = vi.fn()
    const { getByTestId } = render(
      <SwipeToStartButton onConfirm={onConfirm} disabled />,
    )
    const track = getByTestId('swipe-to-start')
    track.setPointerCapture = vi.fn()
    stubTrackWidth(track, 320)

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 28 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 310 })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(track.getAttribute('aria-disabled')).toBe('true')
  })

  it('fires only once per swipe', () => {
    const onConfirm = vi.fn()
    const { getByTestId } = render(<SwipeToStartButton onConfirm={onConfirm} />)
    const track = getByTestId('swipe-to-start')
    track.setPointerCapture = vi.fn()
    stubTrackWidth(track, 320)

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 28 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 300 })
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 305 })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
