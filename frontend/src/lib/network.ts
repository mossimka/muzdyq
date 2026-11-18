import { useSyncExternalStore } from 'react'

let online = typeof navigator === 'undefined' ? true : navigator.onLine
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function handleOnline(): void {
  online = true
  emit()
}

function handleOffline(): void {
  online = false
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

export function isOnline(): boolean {
  return online
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => true,
  )
}
