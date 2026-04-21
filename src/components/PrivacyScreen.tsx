import { Link } from 'react-router-dom'

const LAST_UPDATED = '2026-04-21'
const CONTACT_EMAIL = 'support@mototrack.app'

export default function PrivacyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-neutral-200">
      <Link
        to="/"
        className="mb-8 inline-block text-sm text-neutral-400 hover:text-neutral-200"
      >
        ← Back to MotoTrack
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Last updated: {LAST_UPDATED}
      </p>

      <Section title="What this app does">
        MotoTrack records the GPS route of a motorcycle ride, computes
        statistics from it (distance, duration, speed, lean angle, elevation),
        and lets the rider review or share that ride later.
      </Section>

      <Section title="Data we collect">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Location data</strong> — only while you have an active
            recording. The route is a list of coordinates, timestamps, speed,
            and accuracy values produced by your device's GPS.
          </li>
          <li>
            <strong>Account identity</strong> — your Google account email and
            unique user id, used to identify your rides on our cloud database
            so they sync across your devices.
          </li>
          <li>
            <strong>Bike names</strong> — text you enter for any bikes you
            register, so you can tag rides.
          </li>
          <li>
            <strong>Device id</strong> — a random UUID generated on first
            launch and stored locally, used for debugging issues. It is not
            tied to any device hardware identifier.
          </li>
        </ul>
      </Section>

      <Section title="What we do NOT collect">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Your Google password (Google handles that directly).</li>
          <li>
            Your contacts, calendar, photos, microphone, or any other sensor
            besides GPS.
          </li>
          <li>Advertising identifiers or marketing/analytics cookies.</li>
          <li>
            Your location when you are not actively recording a ride. Even with
            the "always" location permission, MotoTrack only writes points to
            disk while a recording is in progress.
          </li>
        </ul>
      </Section>

      <Section title="Where your data lives">
        <p>
          Every ride is written first to your device (local IndexedDB on web,
          local app storage on iOS/Android). It is then copied — best-effort —
          to our cloud database hosted on{' '}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Supabase
          </a>
          . Each ride row is scoped to your Google account id by row-level
          security; nobody else can read your rides.
        </p>
        <p className="mt-3">
          The cloud database lives in Supabase's hosted infrastructure (AWS
          regions). Authentication is handled by Supabase Auth using Google as
          the identity provider.
        </p>
      </Section>

      <Section title="Sharing">
        <p>
          MotoTrack never sells your data and never shares it with any third
          party for advertising. The only outbound traffic from the app is to
          our own Supabase project (rides + bikes) and to OpenStreetMap tile
          servers (map background — your IP address is visible to them in the
          normal course of an HTTP request, but no ride data is sent).
        </p>
      </Section>

      <Section title="Background location use">
        <p>
          MotoTrack requests "Always" / background location access so that
          recording continues when you lock your phone or switch apps mid-ride.
          We do not use this permission for any purpose other than continuing
          the active recording. On Android, a persistent notification is shown
          while a ride is being recorded so you always know the app is using
          your location.
        </p>
      </Section>

      <Section title="Your controls">
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Stop recording</strong> at any time from the Record screen.
          </li>
          <li>
            <strong>Delete a ride</strong> from its detail page. The ride is
            removed from your device and the cloud.
          </li>
          <li>
            <strong>Sign out</strong> from the header. The cloud session ends
            immediately; locally stored rides remain on the device until you
            sign in again or clear app storage.
          </li>
          <li>
            <strong>Revoke Google access</strong> at{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              myaccount.google.com/permissions
            </a>{' '}
            at any time.
          </li>
          <li>
            <strong>Delete your account</strong> by emailing us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We will erase all rides and account records linked to your
            Google id within 30 days.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          MotoTrack is not directed to children under 13 and we do not
          knowingly collect data from them.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, deletion requests, or anything else: email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-neutral-300">{children}</div>
    </section>
  )
}
