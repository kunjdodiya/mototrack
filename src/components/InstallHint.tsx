import {
  useInstallPrompt,
  useIosInstallHint,
} from '../features/pwa/useInstallPrompt'

/**
 * Floating toast shown at the top of the app that explains how to install
 * the PWA. Hidden when already installed or dismissed.
 */
export default function InstallHint() {
  const { canInstall, prompt } = useInstallPrompt()
  const { show: showIos, dismiss: dismissIos } = useIosInstallHint()

  if (canInstall) {
    return (
      <div className="pointer-events-none sticky top-0 z-30 flex justify-center px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="glass-strong pointer-events-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <span className="text-neutral-200">
            Install MotoTrack for faster access.
          </span>
          <button
            type="button"
            onClick={() => void prompt()}
            className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow-orange transition active:scale-[0.97]"
          >
            Install
          </button>
        </div>
      </div>
    )
  }

  if (showIos) {
    return (
      <div className="pointer-events-none sticky top-0 z-30 flex justify-center px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="glass-strong pointer-events-auto flex w-full max-w-xl items-start justify-between gap-3 rounded-2xl px-4 py-2.5 text-xs text-neutral-300 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <span>
            To install: tap the <b>Share</b> icon in Safari, then{' '}
            <b>Add to Home Screen</b>.
          </span>
          <button
            type="button"
            onClick={dismissIos}
            aria-label="Dismiss"
            className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-neutral-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}
