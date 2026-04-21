export type ShareFormat = 'poster' | 'overlay'

type Props = {
  onPick: (format: ShareFormat) => void
  onClose: () => void
}

/**
 * Bottom-sheet modal that lets a rider pick which PNG to export when they
 * tap Share:
 *
 * - **poster** — the full 1080×1920 brand poster (dark map + stats grid).
 * - **overlay** — transparent 1080×1920 route + graph + distance/time only,
 *   designed to be composited on top of a photo the rider took on the ride.
 */
export default function ShareFormatPicker({ onPick, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick share format"
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-t-3xl border-t border-white/10 bg-neutral-950 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />

        <header className="mt-2 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Share as
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Pick a format
          </h2>
        </header>

        <button
          type="button"
          onClick={() => onPick('poster')}
          className="flex items-center gap-4 rounded-2xl border border-white/10 bg-brand-gradient-soft p-4 text-left shadow-glow-orange transition active:scale-[0.99]"
        >
          <PosterThumb />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold tracking-tight">
              Story poster
            </div>
            <div className="mt-0.5 text-xs text-white/85">
              Branded 1080×1920 Story with dark map + full stats grid.
            </div>
          </div>
          <Chevron />
        </button>

        <button
          type="button"
          onClick={() => onPick('overlay')}
          className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99]"
        >
          <OverlayThumb />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold tracking-tight">
              Transparent overlay
            </div>
            <div className="mt-0.5 text-xs text-neutral-400">
              Just the route, graph, distance, and time on a transparent PNG —
              drop it over your own photo.
            </div>
          </div>
          <Chevron />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 self-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-xs font-semibold text-neutral-300 transition hover:border-white/20 active:scale-[0.97]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PosterThumb() {
  return (
    <div
      aria-hidden
      className="relative flex h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-neutral-900"
    >
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-br from-moto-orange via-moto-magenta to-moto-violet opacity-80" />
      <div className="absolute inset-x-1 bottom-1 h-4 rounded-sm bg-white/10" />
    </div>
  )
}

function OverlayThumb() {
  return (
    <div
      aria-hidden
      className="relative flex h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/20"
      style={{
        backgroundImage:
          'linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%)',
        backgroundSize: '8px 8px',
        backgroundPosition: '0 0, 4px 4px',
      }}
    >
      <svg
        viewBox="0 0 40 56"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d="M6 42 C 12 24, 22 30, 18 18 S 30 10, 34 14"
          stroke="#ff4d00"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="6" cy="42" r="2.5" fill="#22c55e" />
        <circle cx="34" cy="14" r="2.5" fill="#ef4444" />
      </svg>
    </div>
  )
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-neutral-400"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
