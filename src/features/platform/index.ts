import { Capacitor } from '@capacitor/core'
import type { Platform } from './types'
import { webPlatform } from './web'
import { capacitorPlatform } from './capacitor'

/**
 * Runtime platform selection. The same Vite bundle ships to
 * mototrack.pages.dev AND gets wrapped by Capacitor — we pick the right
 * adapter based on where we're actually running.
 *
 * On the web: isNativePlatform() === false → webPlatform.
 * Inside a Capacitor shell: isNativePlatform() === true → capacitorPlatform.
 *
 * This means ONE bundle, ONE deploy, and native rides just work when the
 * user launches the app from the iOS/Android home-screen shortcut vs the
 * browser — no separate build pipeline.
 */
export const platform: Platform = Capacitor.isNativePlatform()
  ? capacitorPlatform
  : webPlatform

export type {
  Platform,
  GeoError,
  GeoErrorKind,
  PermissionState,
  ShareArgs,
  ShareResult,
} from './types'
