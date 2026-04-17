import type { Platform } from './types'
import { watchPosition } from '../recorder/geolocation'
import { requestWakeLock } from '../recorder/wakeLock'
import { sharePng } from '../share/share'

/** Web implementation of the Platform contract. Active in dev and on the PWA. */
export const webPlatform: Platform = {
  watchPosition,
  requestWakeLock,
  sharePng,
}
