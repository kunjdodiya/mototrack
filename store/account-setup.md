# One-time account setup (only the owner can do these)

These are the things I, an agent, cannot do for you. Walk through them once.

## 1. Apple Developer Program — $99/year

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your personal Apple ID (or create a new one for the business)
3. Choose "Individual" enrollment unless you have a registered company with a D-U-N-S number
4. Pay $99. Approval is usually 24-48 hours; sometimes Apple emails for ID verification

## 2. App Store Connect listing — after Apple approves you

1. Go to https://appstoreconnect.apple.com → "My Apps" → "+"
2. Platforms: iOS only (for now)
3. Bundle ID: `com.kunjdodiya.mototrack` — should already be in the dropdown after `cap sync`. If not, register it at https://developer.apple.com/account/resources/identifiers/list
4. SKU: `MOTOTRACK-001` (anything unique)
5. Primary language: English (U.S.)
6. Fill in everything from [`apple.md`](./apple.md)

## 3. Google Play Console — $25 one-time

1. Go to https://play.google.com/console
2. Create a Google account specifically for the developer profile (recommended — easier to transfer to a business later)
3. Pay $25. Identity verification can take 1-7 days
4. Set up a payment profile (required even for free apps if you ever want to publish a paid app or in-app purchases)

## 4. Play Console listing — after approval

1. "Create app" → fill in the basics from [`google.md`](./google.md)
2. Complete the required policy declarations BEFORE you upload a build:
   - App access (sign-in required: yes; provide demo Google credentials)
   - Ads (no)
   - Content rating (run the questionnaire)
   - Target audience (18+, not appealing to children)
   - News app (no)
   - COVID-19 contact tracing (no)
   - Data safety (use the table in `google.md`)
   - Government apps (no)
   - Financial features (no)

## 5. Generate the Android upload keystore (one command on your Mac)

This signs every Android build you upload to Play. Lose this file and you cannot ship updates — back it up.

```bash
keytool -genkey -v -keystore ~/mototrack-upload-keystore.jks \
  -alias mototrack \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype JKS
```

When it prompts:
- **Keystore password** — pick a strong one and save it in your password manager
- **Key password** — use the same password (Android Studio expects this)
- **Name / Organization** — your name and "MotoTrack" are fine

Then in Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle**, point at `~/mototrack-upload-keystore.jks`, enter the passwords, build the release `.aab`.

**Back up the keystore.** Copy it to a USB stick, iCloud Drive, and 1Password attachment. If it's lost, the only path forward is to publish under a new package name (= new app, lose all reviews).

## 6. Supabase auth configuration

In your Supabase dashboard → Authentication → URL Configuration:

- Add `com.kunjdodiya.mototrack://auth/callback` to **Redirect URLs** (alongside `https://mototrack.pages.dev/**` which is already there for web)

### Profile photos + legal documents (Storage)

The profile page lets riders upload a custom photo and store their licence/insurance. Both need Supabase Storage buckets:

1. Dashboard → **SQL Editor** → New query → paste the contents of [`supabase/storage.sql`](../supabase/storage.sql) → Run.
2. That script is idempotent and creates two buckets — `avatars` (public, so the profile photo URL works anywhere) and `documents` (private, served via short-lived signed URLs) — plus RLS policies that scope every object to its owning user's folder (`<user_id>/...`).

That's it. **Do NOT add the `com.kunjdodiya.mototrack://...` URL to Google Cloud Console** — Google never sees the custom scheme. The OAuth flow is:

1. App opens browser → `accounts.google.com` (Google's `redirect_uri` is Supabase's callback, e.g. `https://<project>.supabase.co/auth/v1/callback`, which is already wired)
2. Google redirects to Supabase
3. **Supabase** redirects to `com.kunjdodiya.mototrack://auth/callback` — and Supabase is the one that validates this URL against the allow-list above.

Google would actually reject a `com.kunjdodiya.mototrack://...` entry on a "Web application" OAuth client (custom schemes are only valid on iOS/Android client types, which we don't need for this PKCE flow).

## 7. Community tables (clubs, events, RSVPs)

The Community tab (clubs + ride hosting + RSVPs) needs four tables + RLS:

1. Dashboard → **SQL Editor** → New query → paste the contents of [`supabase/community.sql`](../supabase/community.sql) → Run.
2. Idempotent — safe to re-run when schema changes ship. Creates `public.clubs`, `public.club_members`, `public.club_events`, `public.event_rsvps` with RLS policies that open read-access to any signed-in user (needed for discovery and attendee counts) and scope writes to the signed-in rider. Triggers maintain `clubs.member_count` and `club_events.going_count` automatically.

No extra dashboard UI to click. Once the script runs, riders can create a club, invite friends to join, host rides inside their clubs, and RSVP — all from the Community tab.

## 7b. Trips table (multi-session tours)

Trips let riders group multiple ride sessions into one combined recap.

1. Dashboard → **SQL Editor** → New query → paste the contents of [`supabase/trips.sql`](../supabase/trips.sql) → Run.
2. Idempotent — safe to re-run. Creates `public.trips` (RLS scoped by `auth.uid()`) and adds a nullable `trip_id` foreign key on `public.rides` with `ON DELETE SET NULL` so deleting a trip detaches its rides but never deletes them.

Until this runs, the Trips tab shows no cloud data and new trips only live on the device that created them.

## 8. Apple-specific: distribution certificate + provisioning profile

Xcode handles most of this automatically once your Apple ID is part of the Developer Program:

1. Open Xcode (after `npm run cap:ios`)
2. Select the **App** target → Signing & Capabilities
3. Tick **Automatically manage signing**
4. Pick your team (the Developer Program account)

Xcode will create the cert + profile and complain about anything missing.

## 9. Apple-specific: capabilities

In Xcode → Signing & Capabilities → "+ Capability":
- Background Modes → tick **Location updates**

(Already declared in `Info.plist`, but Xcode also needs the entitlement.)

## 10. Optional but recommended: TestFlight + Play internal testing

Don't go straight to public release. Both stores let you push the build to a small group of testers (you, your friends) without going through review. Validate that:
- The OAuth flow really completes on a real device
- Background recording survives a 30-min ride with the screen off
- The share card image renders correctly
- App doesn't crash on a slow network

Once that works, click Submit for Review.
