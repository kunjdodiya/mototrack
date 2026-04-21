# Google Play Console — listing fields

## Identity

| Field | Value |
|---|---|
| App name (max 30) | MotoTrack |
| Short description (max 80) | GPS ride tracker for motorcyclists. Background recording, lean angle, share. |
| Package name | `com.kunjdodiya.mototrack` |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Choose now (cannot change a free app to paid later) |
| Category | Sports |

## Full description

See [shared-description.md](./shared-description.md).

## Privacy Policy

https://mototrack.pages.dev/privacy

## Data safety form (Play Console → App content → Data safety)

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Yes |
| Is all data collected encrypted in transit? | Yes (HTTPS to Supabase) |
| Do you provide a way for users to request that their data is deleted? | Yes (email request to support@mototrack.app, completed within 30 days) |

**Data types collected** — declare these:

| Type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Location → Precise location | YES | NO | Required | App functionality |
| Personal info → Email address | YES | NO | Required | Account management |
| Personal info → User IDs | YES | NO | Required | Account management |
| App activity → App interactions | NO | — | — | — |
| Device or other IDs | NO | — | — | — |

For Location, also tick: "Data is collected only when the app is in active use" and "User can request data deletion".

## Permissions declarations

Play warns about sensitive permissions. Be ready to justify:

- **ACCESS_BACKGROUND_LOCATION** — declare in the Permissions Declaration form. The use-case template:
  > MotoTrack records the rider's GPS route during a motorcycle ride. The recording must continue while the screen is locked or the app is backgrounded so the rider can put their phone in a tank bag and ride. The data is shown to the user immediately after the ride ends and is never used for advertising. A persistent foreground-service notification informs the user that location is being used.

- **POST_NOTIFICATIONS** — only used to display the "recording ride" foreground-service notification.

## Content rating questionnaire

Answer NO to everything except:
- "Does your app share the user's current physical location with other users or the public?" → NO. (We never share location externally.)

Resulting rating: PEGI 3 / ESRB Everyone.

## Target audience and content

- Target age groups: 18+ (motorcycle riders)
- Appeals to children: NO
- Ads: NO

## Build pipeline

1. `npm run cap:android` (builds web bundle, syncs, opens Android Studio)
2. In Android Studio: **Build → Generate Signed App Bundle** → Android App Bundle (`.aab`)
3. Use the keystore generated via `store/account-setup.md` step 5
4. Upload the `.aab` to Play Console → "Production" → "Create new release"
5. Internal testing track is the recommended first stop — instant, no review.
