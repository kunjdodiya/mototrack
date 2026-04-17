import {
  useInstallPrompt,
  useIosInstallHint,
} from '../features/pwa/useInstallPrompt'

/**
 * Banner shown at the top of the app that explains how to install the PWA.
 * Hidden when already installed or dismissed.
 */
export default function InstallHint() {
  const { canInstall, prompt } = useInstallPrompt()
  const { show: showIos, dismiss: dismissIos } = useIosInstallHint()

  if (canInstall) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm">
        <span>Install MotoTrack for faster access.</span>
        <button
          type="button"
          onClick={() => void prompt()}
          className="rounded-md bg-moto-orange px-3 py-1 font-semibold text-white"
        >
          Install
        </button>
      </div>
    )
  }

  if (showIos) {
    return (
      <div className="flex items-start justify-between gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-300">
        <span>
          To install: tap the <b>Share</b> icon in Safari, then{' '}
          <b>Add to Home Screen</b>.
        </span>
        <button
          type="button"
          onClick={dismissIos}
          aria-label="Dismiss"
          className="shrink-0 rounded-md border border-neutral-700 px-2 py-0.5 text-neutral-400 hover:text-white"
        >
          ✕
        </button>
      </div>
    )
  }

  return null
}
