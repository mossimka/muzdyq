import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined
    }
    const media = window.matchMedia(query)
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }
    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }

  const getSnapshot = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  }

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
