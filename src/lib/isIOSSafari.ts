export function isIOSSafari(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  const isIDevice = /iPhone|iPad|iPod/.test(ua)
  if (!isIDevice) return false
  const isCriOS = /CriOS/.test(ua)
  const isFxiOS = /FxiOS/.test(ua)
  const isEdgiOS = /EdgiOS/.test(ua)
  return !isCriOS && !isFxiOS && !isEdgiOS
}
