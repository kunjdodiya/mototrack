import { isIOSSafari } from '../lib/isIOSSafari'

type Props = {
  onRetry: () => void
}

export default function LocationBlockedCard({ onRetry }: Props) {
  const iosSafari = typeof navigator !== 'undefined' && isIOSSafari()

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-amber-900 bg-amber-950/60 p-5 text-amber-100">
      <h2 className="text-base font-semibold text-white">
        Location is blocked
      </h2>
      <p className="mt-1 text-sm text-amber-200/90">
        MotoTrack needs your GPS to record a ride. Your browser previously
        blocked location for this site, so we can't ask again from inside the
        app — you'll need to allow it in Settings.
      </p>

      {iosSafari ? (
        <div className="mt-4 space-y-3 text-sm text-amber-100">
          <p className="font-semibold">On your iPhone:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Tap the <strong>aA</strong> icon on the left side of Safari's
              address bar.
            </li>
            <li>
              Tap <strong>Website Settings</strong>.
            </li>
            <li>
              Set <strong>Location</strong> to <strong>Allow</strong>.
            </li>
            <li>Come back to this tab and tap Try again below.</li>
          </ol>
          <p className="pt-2 text-xs text-amber-200/80">
            If that doesn't work: open Settings → Safari → Location → Ask, then
            reload this page.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm text-amber-100">
          <p>
            In your browser's address bar, tap the site-info icon (lock or info
            button) and allow <strong>Location</strong> for this site, then tap
            Try again.
          </p>
          <p className="text-xs text-amber-200/80">
            On desktop Chrome: Settings → Privacy and security → Site settings
            → Location → allow.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-semibold text-neutral-900 transition active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  )
}
