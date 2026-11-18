interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // The app works without the service worker; offline support is simply
      // unavailable.
    })
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  deferredPrompt = null
  emit()
  return choice.outcome
}

export function canInstall(): boolean {
  return deferredPrompt !== null
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  )
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
