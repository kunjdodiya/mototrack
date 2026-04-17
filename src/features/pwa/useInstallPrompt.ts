import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Returns a trigger for the Android/desktop Chrome install prompt if the
 * `beforeinstallprompt` event fires. iOS Safari does not fire this event —
 * see useIosInstallHint for that case.
 */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const prompt = async () => {
    if (!event) return
    await event.prompt()
    setEvent(null)
  }

  return { canInstall: event != null, prompt }
}

/**
 * iOS Safari never fires beforeinstallprompt. Detect iOS-Safari-not-standalone
 * and show a one-time dismissable hint: "Tap Share → Add to Home Screen".
 */
export function useIosInstallHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const isIos = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
    // @ts-expect-error -- navigator.standalone is non-standard but iOS-only
    const standalone = window.navigator.standalone === true
    const dismissed = localStorage.getItem('mototrack.iosHint.dismissed') === '1'
    setShow(isIos && !standalone && !dismissed)
  }, [])

  const dismiss = () => {
    localStorage.setItem('mototrack.iosHint.dismissed', '1')
    setShow(false)
  }

  return { show, dismiss }
}
