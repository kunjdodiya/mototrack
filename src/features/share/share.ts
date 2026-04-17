/**
 * Platform-agnostic share entrypoint. On web, uses the Web Share API's file
 * support (iOS 15+, Android Chrome 89+) with a download-link fallback.
 * Capacitor native plugin will replace this later via the platform adapter.
 */
export type ShareArgs = {
  blob: Blob
  filename: string
  title?: string
  text?: string
}

export async function sharePng(args: ShareArgs): Promise<'shared' | 'downloaded'> {
  const file = new File([args.blob], args.filename, { type: args.blob.type })

  // Prefer Web Share with files.
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: args.title, text: args.text })
      return 'shared'
    } catch (err: unknown) {
      // User cancelled or feature rejected — fall through to download.
      if (
        err instanceof DOMException &&
        (err.name === 'AbortError' || err.name === 'NotAllowedError')
      ) {
        return 'shared' // user cancelled; treat as success so caller stops
      }
    }
  }

  // Fallback: trigger a download.
  const url = URL.createObjectURL(args.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = args.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
