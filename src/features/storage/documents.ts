import { supabase } from '../auth/supabase'
import { getUserId } from '../auth/session'

const DOCS_BUCKET = 'documents'
const MAX_DOC_BYTES = 10 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 10
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

export type DocumentKind = 'license' | 'insurance' | 'other'

export type LegalDocument = {
  storagePath: string
  label: string
  kind: DocumentKind
  mimeType: string
  sizeBytes: number
  uploadedAt: number
}

type StorageFile = {
  name: string
  created_at?: string | null
  updated_at?: string | null
  metadata?: { size?: number; mimetype?: string } | null
}

export async function listDocuments(): Promise<LegalDocument[]> {
  const userId = await getUserId()
  if (!userId) return []

  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .list(userId, { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 })
  if (error) {
    console.warn('Document list failed:', error.message)
    return []
  }

  const files = (data ?? []) as StorageFile[]
  return files
    .filter((f) => !!f.name)
    .map((f) => toLegalDocument(userId, f))
}

export async function uploadDocument(
  file: File,
  kind: DocumentKind,
  label: string,
): Promise<LegalDocument> {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error('Document must be 10 MB or smaller.')
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Only PDF, JPG, PNG, WebP or HEIC are supported.')
  }
  const trimmedLabel = label.trim()
  if (!trimmedLabel) throw new Error('Please name this document.')

  const userId = await getUserId()
  if (!userId) throw new Error('You must be signed in to upload a document.')

  const ext = extensionFor(file)
  const safeLabel = slugify(trimmedLabel)
  const fileName = `${Date.now()}__${kind}__${safeLabel}.${ext}`
  const path = `${userId}/${fileName}`

  const { error } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error

  return {
    storagePath: path,
    label: trimmedLabel,
    kind,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: Date.now(),
  }
}

export async function getDocumentViewUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Could not create a view link for this document.')
  }
  return data.signedUrl
}

export async function deleteDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCS_BUCKET).remove([path])
  if (error) throw error
}

function toLegalDocument(userId: string, f: StorageFile): LegalDocument {
  const storagePath = `${userId}/${f.name}`
  const parsed = parseFileName(f.name)
  const mimeType = f.metadata?.mimetype ?? mimeFromExtension(parsed.ext)
  const uploadedAt = f.created_at
    ? Date.parse(f.created_at)
    : (parsed.timestamp ?? Date.now())
  return {
    storagePath,
    label: parsed.label,
    kind: parsed.kind,
    mimeType,
    sizeBytes: f.metadata?.size ?? 0,
    uploadedAt,
  }
}

function parseFileName(name: string): {
  label: string
  kind: DocumentKind
  ext: string
  timestamp: number | null
} {
  const base = name.replace(/\.[^.]+$/, '')
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
  const parts = base.split('__')
  if (parts.length >= 3) {
    const [tsStr, rawKind, ...rest] = parts
    const ts = Number(tsStr)
    const kind = normalizeKind(rawKind)
    const label = rest.join(' ').replace(/[-_]+/g, ' ').trim() || 'Document'
    return {
      label: prettify(label),
      kind,
      ext,
      timestamp: Number.isFinite(ts) ? ts : null,
    }
  }
  return {
    label: prettify(base),
    kind: 'other',
    ext,
    timestamp: null,
  }
}

function normalizeKind(raw: string): DocumentKind {
  if (raw === 'license' || raw === 'insurance' || raw === 'other') return raw
  return 'other'
}

function prettify(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'document'
}

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  return 'bin'
}

function mimeFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    default:
      return 'application/octet-stream'
  }
}
