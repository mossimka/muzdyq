import { useEffect, useState } from 'react'

import { listQueue, QUEUE_EVENT } from './queue'
import type { QueueItem } from './types'

export interface QueueState {
  items: QueueItem[]
  pending: number
  failed: number
  loading: boolean
}

/**
 * Live view of the IndexedDB upload queue. Reads are cheap (the queue is
 * small) and every mutation emits a window event, so the header badge and the
 * queue page stay in sync without a global state library.
 */
export function useQueue(): QueueState {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = () => {
      void listQueue()
        .then((next) => {
          if (!active) return
          setItems(next)
          setLoading(false)
        })
        .catch(() => {
          if (active) setLoading(false)
        })
    }

    load()
    window.addEventListener(QUEUE_EVENT, load)
    const interval = window.setInterval(load, 20_000)
    return () => {
      active = false
      window.removeEventListener(QUEUE_EVENT, load)
      window.clearInterval(interval)
    }
  }, [])

  return {
    items,
    pending: items.filter((item) => item.status !== 'failed').length,
    failed: items.filter((item) => item.status === 'failed').length,
    loading,
  }
}
