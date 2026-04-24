import { useRef, useState } from 'react'
import { writeStoredLocation } from '../features/community/location'

export default function LocationPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (next: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement | null>(null)

  function toggle() {
    if (!open) {
      setDraft(value ?? '')
      setOpen(true)
      queueMicrotask(() => inputRef.current?.focus())
    } else {
      setOpen(false)
    }
  }

  function save() {
    const next = draft.trim() || null
    writeStoredLocation(next)
    onChange(next)
    setOpen(false)
  }

  function clear() {
    setDraft('')
    writeStoredLocation(null)
    onChange(null)
    setOpen(false)
  }

  return (
    <div className="glass flex flex-col gap-2 rounded-2xl p-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Change location filter"
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PinIcon />
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {value ? 'Near' : 'Location'}
            </span>
            <span className="truncate text-sm font-semibold text-white">
              {value ?? 'Anywhere · tap to set city, area, or country'}
            </span>
          </span>
        </span>
        <span
          className={[
            'shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-neutral-300 transition',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 pt-1">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setDraft(value ?? '')
                setOpen(false)
              }
            }}
            placeholder="e.g. San Francisco · California · India"
            aria-label="City, area, or country"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-white/20"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition active:scale-[0.97]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white shadow-glow-orange transition active:scale-[0.97]"
            >
              Save
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Matches any club whose city contains your text. Leave blank to see
            every club.
          </p>
        </div>
      )}
    </div>
  )
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-neutral-400"
      aria-hidden
    >
      <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
