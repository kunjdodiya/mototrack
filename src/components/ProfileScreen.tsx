import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../features/storage/db'
import { addBike, deleteBike } from '../features/storage/bikes'
import { pushBike } from '../features/storage/sync'
import { sumTotals } from '../features/stats/totals'
import {
  formatDistance,
  formatDuration,
  formatLeanAngle,
  formatSpeed,
} from '../features/stats/format'
import { getSession, onAuthChange } from '../features/auth/session'
import {
  getProfileInfo,
  resetAvatar,
  uploadAvatar,
  type ProfileInfo,
} from '../features/storage/profile'
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
  type DocumentKind,
  type LegalDocument,
} from '../features/storage/documents'
import DocumentViewer from './DocumentViewer'
import SignOutButton from './SignOutButton'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileInfo>({
    name: null,
    email: null,
    avatarUrl: null,
  })
  const [newBike, setNewBike] = useState('')
  const [adding, setAdding] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const hasGoogleAvatar = Boolean(profile.avatarUrl)

  useEffect(() => {
    void getSession().then((s) => setProfile(getProfileInfo(s)))
    return onAuthChange((s) => setProfile(getProfileInfo(s)))
  }, [])

  const rides = useLiveQuery(() => db.rides.toArray(), [], [])
  const bikes = useLiveQuery(() => db.bikes.orderBy('createdAt').toArray(), [], [])
  const totals = sumTotals(rides)

  const rideCountByBike = new Map<string, number>()
  for (const r of rides) {
    if (r.bikeId) rideCountByBike.set(r.bikeId, (rideCountByBike.get(r.bikeId) ?? 0) + 1)
  }

  const handleAddBike = async () => {
    const name = newBike.trim()
    if (!name) return
    setAdding(true)
    try {
      const bike = await addBike(name)
      setNewBike('')
      void pushBike(bike)
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteBike = async (id: string, name: string) => {
    const count = rideCountByBike.get(id) ?? 0
    const msg =
      count > 0
        ? `Remove "${name}"? ${count} ride${count === 1 ? '' : 's'} will keep their history but lose the bike label.`
        : `Remove "${name}"?`
    if (!confirm(msg)) return
    await deleteBike(id)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      await uploadAvatar(file)
      const s = await getSession()
      setProfile(getProfileInfo(s))
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleResetAvatar = async () => {
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      await resetAvatar()
      const s = await getSession()
      setProfile(getProfileInfo(s))
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Could not reset photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

  const displayName = profile.name ?? profile.email ?? 'Rider'
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-7 px-5 pb-10 pt-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-brand-gradient-soft p-6 shadow-glow-violet">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            {hasGoogleAvatar ? (
              <img
                src={profile.avatarUrl ?? ''}
                alt=""
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl border border-white/20 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-black/30 font-display text-2xl font-bold tracking-tight text-white shadow-lg backdrop-blur">
                {initials || '?'}
              </div>
            )}
            {avatarBusy && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-xs text-neutral-100">
                …
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight">
              {displayName}
            </h1>
            {profile.email && profile.name && (
              <p className="mt-0.5 truncate text-sm text-white/80">{profile.email}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/40 disabled:opacity-50"
              >
                {hasGoogleAvatar ? 'Change photo' : 'Add photo'}
              </button>
              {hasGoogleAvatar && (
                <button
                  type="button"
                  onClick={() => void handleResetAvatar()}
                  disabled={avatarBusy}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition hover:text-white disabled:opacity-50"
                >
                  Use Google photo
                </button>
              )}
            </div>
            {avatarError && (
              <p className="mt-2 text-xs text-red-200">{avatarError}</p>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleAvatarChange(e)}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="Totals" hint="All-time" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatTile label="Rides" value={String(totals.rideCount)} />
          <StatTile
            label="Distance"
            value={formatDistance(totals.totalDistanceMeters)}
            accent
          />
          <StatTile label="Total time" value={formatDuration(totals.totalDurationMs)} />
          <StatTile
            label="Moving time"
            value={formatDuration(totals.totalMovingDurationMs)}
          />
          <StatTile label="Top speed" value={formatSpeed(totals.topSpeedMps)} accent />
          <StatTile label="Max lean" value={formatLeanAngle(totals.maxLeanAngleDeg)} />
        </div>
        <div className="mt-3 text-right text-sm">
          <Link
            to="/history"
            className="font-semibold text-gradient transition hover:opacity-80"
          >
            See all rides →
          </Link>
        </div>
      </section>

      <section>
        <SectionHeading title="My bikes" />
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newBike}
            onChange={(e) => setNewBike(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAddBike()
            }}
            placeholder="e.g. KTM 390 Duke"
            maxLength={40}
            className="flex-1 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-base font-medium text-white placeholder:text-neutral-600 transition focus:border-moto-orange/60 focus:bg-white/[0.05] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleAddBike()}
            disabled={adding || !newBike.trim()}
            className="rounded-2xl bg-brand-gradient px-5 py-3 font-display font-semibold tracking-tight text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {bikes.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
            Add your first bike and you can tag each ride with it.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {bikes.map((b, i) => {
              const count = rideCountByBike.get(b.id) ?? 0
              return (
                <li
                  key={b.id}
                  className="flex animate-fade-up items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 transition hover:border-white/10"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div>
                    <div className="font-display font-semibold tracking-tight">
                      {b.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {count === 0 ? 'No rides yet' : `${count} ride${count === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteBike(b.id, b.name)}
                    className="text-xs font-semibold uppercase tracking-wider text-neutral-500 transition hover:text-red-400"
                    aria-label={`Remove ${b.name}`}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <LegalDocumentsSection />

      <section className="flex justify-center pt-2">
        <SignOutButton />
      </section>
    </div>
  )
}

function LegalDocumentsSection() {
  const [docs, setDocs] = useState<LegalDocument[] | null>(null)
  const [kind, setKind] = useState<DocumentKind>('license')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<LegalDocument | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listDocuments().then((next) => {
      if (!cancelled) setDocs(next)
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const refresh = () => setReloadKey((k) => k + 1)

  const pendingLabel = label.trim() || defaultLabelFor(kind)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadDocument(file, kind, pendingLabel)
      setLabel('')
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (doc: LegalDocument) => {
    if (!confirm(`Remove "${doc.label}"?`)) return
    try {
      await deleteDocument(doc.storagePath)
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <section>
      <SectionHeading title="Legal documents" hint="Licence · Insurance" />
      <p className="mt-2 text-sm text-neutral-400">
        Keep your license, insurance, and other ride paperwork in one place.
        PDF, JPG, or PNG, up to 10 MB.
      </p>

      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:flex-row">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DocumentKind)}
          className="rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-sm text-white focus:border-moto-orange/60 focus:outline-none"
          aria-label="Document type"
        >
          <option value="license">Driving licence</option>
          <option value="insurance">Insurance</option>
          <option value="other">Other</option>
        </select>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={defaultLabelFor(kind)}
          maxLength={60}
          className="flex-1 rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-moto-orange/60 focus:outline-none"
          aria-label="Document label"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow-orange transition active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {docs === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-neutral-400">
          No documents yet. Upload your licence or insurance so they're always
          within reach.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {docs.map((d, i) => (
            <li
              key={d.storagePath}
              className="flex animate-fade-up items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-display font-semibold tracking-tight">
                  {d.label}
                </div>
                <div className="text-xs text-neutral-500">
                  {kindLabel(d.kind)} · {fileTypeLabel(d.mimeType)}
                  {d.sizeBytes ? ` · ${formatSize(d.sizeBytes)}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewing(d)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-white/20"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(d)}
                className="text-xs font-semibold uppercase tracking-wider text-neutral-500 transition hover:text-red-400"
                aria-label={`Remove ${d.label}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      )}
    </section>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {hint}
        </span>
      )}
    </div>
  )
}

function defaultLabelFor(kind: DocumentKind): string {
  if (kind === 'license') return 'Driving licence'
  if (kind === 'insurance') return 'Insurance policy'
  return 'Document'
}

function kindLabel(kind: DocumentKind): string {
  if (kind === 'license') return 'Licence'
  if (kind === 'insurance') return 'Insurance'
  return 'Other'
}

function fileTypeLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('image/')) return mime.slice('image/'.length).toUpperCase()
  return mime
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-4 transition',
        accent
          ? 'border-moto-orange/25 bg-gradient-to-br from-moto-orange/10 via-moto-magenta/5 to-transparent'
          : 'border-white/5 bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div
        className={[
          'mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight',
          accent ? 'text-gradient' : 'text-white',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}
