import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploadSpy = vi.fn().mockResolvedValue({ error: null })
const listSpy = vi.fn()
const signedUrlSpy = vi.fn()
const removeSpy = vi.fn().mockResolvedValue({ error: null })
let userId: string | null = 'u-1'

vi.mock('../auth/session', () => ({
  getUserId: () => Promise.resolve(userId),
}))

vi.mock('../auth/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, file: File, opts: unknown) => uploadSpy(path, file, opts),
        list: (prefix: string, opts: unknown) => listSpy(prefix, opts),
        createSignedUrl: (path: string, ttl: number) => signedUrlSpy(path, ttl),
        remove: (paths: string[]) => removeSpy(paths),
      }),
    },
  },
}))

import {
  listDocuments,
  uploadDocument,
  getDocumentViewUrl,
  deleteDocument,
} from './documents'

beforeEach(() => {
  uploadSpy.mockClear()
  listSpy.mockClear()
  signedUrlSpy.mockClear()
  removeSpy.mockClear()
  userId = 'u-1'
})

describe('uploadDocument', () => {
  it('uploads a PDF under the user folder with kind+label encoded in the name', async () => {
    const file = new File([new Uint8Array(8)], 'my-licence.pdf', {
      type: 'application/pdf',
    })
    const doc = await uploadDocument(file, 'license', 'Driving licence')

    expect(uploadSpy).toHaveBeenCalledTimes(1)
    const [path, , opts] = uploadSpy.mock.calls[0]
    expect(path).toMatch(/^u-1\/\d+__license__driving-licence\.pdf$/)
    expect(opts).toMatchObject({ contentType: 'application/pdf', upsert: false })
    expect(doc).toMatchObject({
      label: 'Driving licence',
      kind: 'license',
      mimeType: 'application/pdf',
    })
  })

  it('rejects unsupported MIME types', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await expect(uploadDocument(file, 'other', 'Note')).rejects.toThrow(/PDF/)
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rejects files over 10 MB', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    })
    await expect(uploadDocument(big, 'other', 'Big')).rejects.toThrow(/10 MB/)
  })

  it('rejects a blank label', async () => {
    const file = new File([new Uint8Array(4)], 'x.pdf', { type: 'application/pdf' })
    await expect(uploadDocument(file, 'license', '   ')).rejects.toThrow(/name/i)
  })

  it('throws when no signed-in user', async () => {
    userId = null
    const file = new File([new Uint8Array(4)], 'x.pdf', { type: 'application/pdf' })
    await expect(uploadDocument(file, 'license', 'Licence')).rejects.toThrow(/signed in/)
  })
})

describe('listDocuments', () => {
  it('maps Supabase storage rows to LegalDocument objects', async () => {
    listSpy.mockResolvedValueOnce({
      data: [
        {
          name: '1700000000000__license__driving-licence.pdf',
          created_at: new Date(1_700_000_000_000).toISOString(),
          metadata: { size: 1234, mimetype: 'application/pdf' },
        },
        {
          name: '1700000111111__insurance__policy-2025.jpg',
          created_at: new Date(1_700_000_111_111).toISOString(),
          metadata: { size: 2048, mimetype: 'image/jpeg' },
        },
      ],
      error: null,
    })

    const docs = await listDocuments()

    expect(listSpy).toHaveBeenCalledWith('u-1', expect.any(Object))
    expect(docs).toHaveLength(2)
    expect(docs[0]).toMatchObject({
      storagePath: 'u-1/1700000000000__license__driving-licence.pdf',
      label: 'Driving licence',
      kind: 'license',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
    })
    expect(docs[1]).toMatchObject({
      kind: 'insurance',
      mimeType: 'image/jpeg',
    })
  })

  it('returns [] and swallows errors', async () => {
    listSpy.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    expect(await listDocuments()).toEqual([])
  })

  it('returns [] when signed out', async () => {
    userId = null
    expect(await listDocuments()).toEqual([])
    expect(listSpy).not.toHaveBeenCalled()
  })
})

describe('getDocumentViewUrl', () => {
  it('requests a short-lived signed URL', async () => {
    signedUrlSpy.mockResolvedValueOnce({
      data: { signedUrl: 'https://s.test/sig' },
      error: null,
    })
    const url = await getDocumentViewUrl('u-1/x.pdf')
    expect(url).toBe('https://s.test/sig')
    const [path, ttl] = signedUrlSpy.mock.calls[0]
    expect(path).toBe('u-1/x.pdf')
    expect(ttl).toBeGreaterThan(60)
  })

  it('throws when Supabase returns an error', async () => {
    signedUrlSpy.mockResolvedValueOnce({
      data: null,
      error: { message: 'denied' },
    })
    await expect(getDocumentViewUrl('u-1/x.pdf')).rejects.toBeDefined()
  })
})

describe('deleteDocument', () => {
  it('removes the given storage path', async () => {
    await deleteDocument('u-1/x.pdf')
    expect(removeSpy).toHaveBeenCalledWith(['u-1/x.pdf'])
  })
})
