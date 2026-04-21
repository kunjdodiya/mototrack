# App Store Connect — listing fields

Copy these straight into the "App Information" and "Version Information" pages of App Store Connect.

## Identity

| Field | Value |
|---|---|
| App name | MotoTrack |
| Subtitle (max 30) | GPS ride tracker for bikes |
| Bundle ID | `com.kunjdodiya.mototrack` |
| Primary category | Sports |
| Secondary category | Travel |
| Content rights | You own / have licensed all content |
| Age rating | 4+ (no objectionable content) |

## Promotional text (max 170)

Track every motorcycle ride with proper background GPS, lean-angle estimates, and a one-tap shareable stats card. Your rides stay yours — no ads, no trackers.

## Description

See [shared-description.md](./shared-description.md).

## Keywords (max 100 chars, comma-separated, no spaces after commas)

motorcycle,gps,tracker,ride,bike,touring,route,record,speed,lean,strava,offline,riding,biker

## Support URL

https://mototrack.pages.dev

## Marketing URL

https://mototrack.pages.dev

## Privacy Policy URL

https://mototrack.pages.dev/privacy

## What's New in This Version (v1.0)

First release. Record motorcycle rides with full background GPS, sync them to your private cloud, and share a route+stats image.

## Privacy nutrition label answers

Tap "Edit" under "App Privacy" → "Data Types":

- **Location → Precise Location** → Used for: App Functionality. Linked to user: YES. Used for tracking: NO.
- **Identifiers → User ID** → Used for: App Functionality. Linked to user: YES. Used for tracking: NO. (This is your Supabase user_id, derived from your Google account.)
- **Contact Info → Email Address** → Used for: App Functionality. Linked to user: YES. Used for tracking: NO. (Stored as part of the Supabase auth user record.)

Everything else: NO.

## Sign-in info for the reviewer

Apple's reviewer needs to be able to sign in to test. In "App Review Information":

- **Sign-in required:** YES
- **Demo Google account:** *(create a throwaway Google account just for review and put the email + password here. Do not use your personal account.)*
- **Notes:**
  > MotoTrack requires Google Sign-In. Tap "Continue with Google" on launch and use the demo credentials above. The app's main screen records GPS rides; tap "Start" to record. To verify the privacy policy, the reviewer can also visit https://mototrack.pages.dev/privacy directly without signing in.

## Build pipeline

1. `npm run cap:ios` (builds web bundle, syncs Capacitor, opens Xcode)
2. In Xcode: select **Any iOS Device (arm64)** → Product → Archive
3. Window → Organizer → Distribute App → App Store Connect
4. Wait ~10 min for the build to appear under TestFlight
5. Add it to the v1.0 listing → Submit for Review

## TestFlight beta (recommended before Submit for Review)

- Internal testing track is free + instant. Add yourself by Apple ID.
- Run a real ride end-to-end before clicking Submit.
