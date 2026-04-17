import type { Platform } from './types'
import { webPlatform } from './web'

// When migrating to native (v2), swap this line:
//   import { capacitorPlatform as platform } from './capacitor'
// Nothing else in the app imports platform-specific APIs directly.
export const platform: Platform = webPlatform

export type { Platform, GeoError, ShareArgs, ShareResult } from './types'
