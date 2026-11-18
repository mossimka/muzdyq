import { openDB, type DBSchema } from 'idb'

import { newClientUuid } from './device'
import type { PhotoTags, QueueItem, UploadStatus } from './types'

export const QUEUE_EVENT = 'muzdyq:queue-changed'

interface MuzdyqDatabase extends DBSchema {
  queue: {
    key: string
    value: QueueItem
    indexes: { createdAt: number }
  }
}

const dbPromise = openDB<MuzdyqDatabase>('muzdyq-offline', 1, {
  upgrade(database) {
    if (!database.objectStoreNames.contains('queue')) {
      const store = database.createObjectStore('queue', { keyPath: 'id' })
      store.createIndex('createdAt', 'createdAt')
    }
  },
})

export function notifyQueueChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
  }
}

export interface NewQueueItem {
  pointSlug: string
  pointName: string
  viewpointId: string
  takenAt: string
  tags: PhotoTags
  blob: Blob
  thumb: Blob | null
}

export async function enqueuePhoto(input: NewQueueItem): Promise<QueueItem> {
  const item: QueueItem = {
    id: newClientUuid(),
    pointSlug: input.pointSlug,
    pointName: input.pointName,
    viewpointId: input.viewpointId,
    takenAt: input.takenAt,
    tags: input.tags,
    blob: input.blob,
    thumb: input.thumb,
    bytes: input.blob.size,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
    lastError: null,
  }
  const db = await dbPromise
  await db.put('queue', item)
  notifyQueueChange()
  return item
}

export async function listQueue(): Promise<QueueItem[]> {
  const db = await dbPromise
  const items = await db.getAllFromIndex('queue', 'createdAt')
  return items.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  const db = await dbPromise
  return db.get('queue', id)
}

export async function updateQueueItem(
  id: string,
  patch: Partial<Omit<QueueItem, 'id'>>,
): Promise<QueueItem | undefined> {
  const db = await dbPromise
  const current = await db.get('queue', id)
  if (!current) return undefined
  const next: QueueItem = { ...current, ...patch }
  await db.put('queue', next)
  notifyQueueChange()
  return next
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await dbPromise
  await db.delete('queue', id)
  notifyQueueChange()
}

export async function clearQueue(): Promise<void> {
  const db = await dbPromise
  await db.clear('queue')
  notifyQueueChange()
}

export async function countQueue(status?: UploadStatus): Promise<number> {
  const items = await listQueue()
  return status ? items.filter((item) => item.status === status).length : items.length
}

/**
 * If the browser was closed mid-upload, the item can be left in the
 * "uploading" state. Put such items back into the retryable state at startup.
 */
export async function resetInterruptedUploads(): Promise<void> {
  const items = await listQueue()
  let changed = false
  for (const item of items) {
    if (item.status === 'uploading') {
      await updateQueueItem(item.id, {
        status: 'failed',
        nextAttemptAt: 0,
        lastError: item.lastError ?? 'Upload was interrupted',
      })
      changed = true
    }
  }
  if (changed) notifyQueueChange()
}
