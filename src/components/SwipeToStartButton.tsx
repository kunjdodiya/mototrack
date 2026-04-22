import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  onConfirm: () => void
  disabled?: boolean
  label?: string
}

const KNOB_SIZE = 64
const EDGE_PAD = 4
const THRESHOLD = 0.85

export default function SwipeToStartButton({
  onConfirm,
  disabled = false,
  label = 'Swipe to start the ride',
}: Props) {
  const trackElRef = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)
  const [trackWidth, setTrackWidth] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const trackRef = useCallback((node: HTMLDivElement | null) => {
    trackElRef.current = node
    if (node) setTrackWidth(node.getBoundingClientRect().width)
  }, [])

  useEffect(() => {
    const node = trackElRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTrackWidth(entry.contentRect.width)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const maxDrag = Math.max(0, trackWidth - KNOB_SIZE - EDGE_PAD * 2)
  const effectiveDragX = disabled ? 0 : dragX
  const progress = maxDrag > 0 ? Math.min(1, effectiveDragX / maxDrag) : 0

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    fired.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled || fired.current) return
    const node = trackElRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const liveMax = Math.max(0, rect.width - KNOB_SIZE - EDGE_PAD * 2)
    const relX = e.clientX - rect.left - KNOB_SIZE / 2 - EDGE_PAD
    const clamped = Math.max(0, Math.min(liveMax, relX))
    setDragX(clamped)
    if (liveMax > 0 && clamped >= liveMax * THRESHOLD) {
      fired.current = true
      setDragX(liveMax)
      setDragging(false)
      onConfirm()
    }
  }

  const handlePointerEnd = () => {
    if (!dragging) return
    setDragging(false)
    if (!fired.current) setDragX(0)
  }

  return (
    <div
      className={[
        'h-16 w-full rounded-full bg-brand-gradient bg-[length:200%_200%] p-[2px]',
        disabled ? 'opacity-40' : 'animate-gradient-shift shadow-glow-orange',
      ].join(' ')}
    >
      <div
        ref={trackRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={[
          'relative h-full w-full select-none overflow-hidden rounded-full bg-neutral-950',
          disabled ? '' : 'touch-none',
        ].join(' ')}
        data-testid="swipe-to-start"
      >
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient"
          style={{
            width: effectiveDragX + KNOB_SIZE / 2 + EDGE_PAD,
            opacity: 0.55 + progress * 0.45,
          }}
        />

        {!dragging && progress === 0 && !disabled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
        )}

        <span
          className={[
            'pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.22em] text-white transition-opacity',
            progress > 0.1 ? 'opacity-30' : 'opacity-80',
          ].join(' ')}
        >
          {label}
        </span>

        <div
          aria-hidden
          className={[
            'absolute flex h-14 w-14 items-center justify-center rounded-full bg-white text-moto-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]',
            dragging ? '' : 'transition-transform duration-300 ease-out',
          ].join(' ')}
          style={{
            left: EDGE_PAD,
            top: '50%',
            transform: `translate(${effectiveDragX}px, -50%)`,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
