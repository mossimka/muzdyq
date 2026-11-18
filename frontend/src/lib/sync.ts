import { describeApiError, uploadPhoto } from './api'
import { getDeviceToken } from './device'
import { isOnline } from './network'
import {
  listQueue,
  notifyQueueChange,
  removeQueueItem,
  resetInterruptedUploads,
  updateQueueItem,
} from './queue'

export const SYNC_EVENT = 'muzdyq:sync-finished'
const BACKGROUND_SYNC_TAG = 'muzdyq-upload'
const MAX_BACKOFF_MS = 30 * 60 * 1000
const BASE_BACKOFF_MS = 5 * 1000

export interface SyncResult {
  uploaded: number
  failed: number
  skipped: number
  offline: boolean
}

let inFlight: Promise<SyncResult> | null = null

/** Exponential backoff with a 30 minute ceiling. Exported for tests. */
export function backoffDelay(attempts: number): number {
  const exponent = Math.max(0, attempts - 1)
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.min(exponent, 12), MAX_BACKOFF_MS)
}

export interface SyncOptions {
  /** Ignore the scheduled retry time (manual "Retry" / "Upload now"). */
  force?: boolean
  /** Restrict to specific queue item ids. */
  ids?: string[]
}

export function syncQueue(options: SyncOptions = {}): Promise<SyncResult> {
  if (inFlight) return inFlight
  inFlight = runSync(options).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runSync(options: SyncOptions): Promise<SyncResult> {
  const result: SyncResult = { uploaded: 0, failed: 0, skipped: 0, offline: false }
  if (!isOnline()) {
    return { ...result, offline: true }
  }

  const items = await listQueue()
  const filter = options.ids ? new Set(options.ids) : null
  const now = Date.now()

  for (const item of items) {
    if (!isOnline()) {
      result.offline = true
      break
    }
    if (filter && !filter.has(item.id)) continue
    if (!options.force && item.nextAttemptAt > now) {
      result.skipped += 1
      continue
    }

    await updateQueueItem(item.id, { status: 'uploading' })
    try {
      await uploadPhoto(
        {
          clientUuid: item.id,
          pointSlug: item.pointSlug,
          viewpointId: item.viewpointId,
          takenAt: item.takenAt,
          tags: item.tags,
          blob: item.blob,
        },
        { deviceToken: getDeviceToken() },
      )
      await removeQueueItem(item.id)
      result.uploaded += 1
    } catch (error) {
      const attempts = item.attempts + 1
      result.failed += 1
      await updateQueueItem(item.id, {
        status: 'failed',
        attempts,
        nextAttemptAt: Date.now() + backoffDelay(attempts),
        lastError: describeApiError(error).slice(0, 300),
      })
      // A 4xx response other than a rate limit will not fix itself with time.
      // Keep the item so the contributor can decide what to do with it.
    }
  }

  if (result.uploaded || result.failed) {
    notifyQueueChange()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<SyncResult>(SYNC_EVENT, { detail: result }))
    }
  }
  return result
}

export function requestBackgroundSync(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready
    .then((registration) => {
      const sync = (
        registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> }
        }
      ).sync
      return sync?.register(BACKGROUND_SYNC_TAG)
    })
    .catch(() => {
      // Background Sync is not available in every browser; the in-page
      // scheduler still retries while the app is open.
    })
}

/**
 * Wire automatic retries to connectivity changes, returning to the tab, and
 * the service worker's background sync message. Returns a cleanup function.
 */
export function setupSync(): () => void {
  void resetInterruptedUploads()
  void syncQueue()

  const onOnline = () => {
    void syncQueue()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncQueue()
  }
  const onServiceWorkerMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null
    if (data?.type === 'muzdyq:sync') void syncQueue()
  }

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  let serviceWorker: ServiceWorkerContainer | null = null
  if ('serviceWorker' in navigator) {
    serviceWorker = navigator.serviceWorker
    serviceWorker.addEventListener('message', onServiceWorkerMessage)
  }

  const interval = window.setInterval(() => {
    void syncQueue()
  }, 30_000)

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    serviceWorker?.removeEventListener('message', onServiceWorkerMessage)
    window.clearInterval(interval)
  }
}
