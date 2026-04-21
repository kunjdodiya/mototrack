import { useEffect, useState } from 'react'
import type { LegalDocument } from '../features/storage/documents'
import { getDocumentViewUrl } from '../features/storage/documents'

type Props = {
  doc: LegalDocument
  onClose: () => void
}

export default function DocumentViewer({ doc, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDocumentViewUrl(doc.storagePath)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not open document.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [doc.storagePath])

  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.label} preview`}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">
            {doc.label}
          </div>
          <div className="text-xs text-neutral-500 uppercase tracking-widest">
            {labelForKind(doc.kind)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800"
            >
              Open
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {!error && !url && (
          <p className="text-sm text-neutral-400">Loading…</p>
        )}
        {url && !error && (
          isPdf ? (
            <iframe
              src={url}
              title={doc.label}
              className="h-full w-full max-w-3xl border-0 bg-white"
            />
          ) : (
            <img
              src={url}
              alt={doc.label}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )
        )}
      </div>
    </div>
  )
}

function labelForKind(kind: LegalDocument['kind']): string {
  if (kind === 'license') return 'License'
  if (kind === 'insurance') return 'Insurance'
  return 'Document'
}
