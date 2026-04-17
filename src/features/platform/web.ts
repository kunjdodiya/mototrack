import type { Platform } from './types'
import { watchPosition, checkLocationPermission } from '../recorder/geolocation'
import { requestWakeLock } from '../recorder/wakeLock'
import { sharePng } from '../share/share'

export const webPlatform: Platform = {
  watchPosition,
  checkLocationPermission,
  requestWakeLock,
  sharePng,
}
