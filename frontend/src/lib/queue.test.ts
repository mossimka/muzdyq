import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  uploadPhoto: vi.fn(),
  describeApiError: (error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error',
}))

import { uploadPhoto } from './api'
import { clearQueue, enqueuePhoto, listQueue } from './queue'
import { backoffDelay, syncQueue } from './sync'

const upload = vi.mocked(uploadPhoto)

async function makeItem() {
  return enqueuePhoto({
    pointSlug: 'tuyuksu-glacier',
    pointName: 'Tuyuksu Glacier',
    viewpointId: 'tuyuksu-glacier-v1',
    takenAt: '2026-07-01T09:00:00.000Z',
    tags: { weather: 'clear', snow_cover: 'partial' },
    blob: new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }),
    thumb: null,
  })
}

describe('offline upload queue', () => {
  beforeEach(async () => {
    upload.mockReset()
    await clearQueue()
  })

  it('keeps a failed upload and schedules an exponential retry', async () => {
    upload.mockRejectedValueOnce(new Error('network down'))
    const item = await makeItem()

    const result = await syncQueue()
    expect(result).toMatchObject({ uploaded: 0, failed: 1 })
    expect(result.offline).toBe(false)

    const [stored] = await listQueue()
    expect(stored).toBeDefined()
    expect(stored?.id).toBe(item.id)
    expect(stored?.attempts).toBe(1)
    expect(stored?.status).toBe('failed')
    expect(stored?.lastError).toBe('network down')
    expect(stored?.nextAttemptAt).toBeGreaterThan(Date.now())
  })

  it('retries with the same client UUID so uploads stay idempotent', async () => {
    upload
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({} as never)
    const item = await makeItem()

    await syncQueue()
    const second = await syncQueue({ force: true })

    expect(second.uploaded).toBe(1)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls[0]?.[0].clientUuid).toBe(item.id)
    expect(upload.mock.calls[1]?.[0].clientUuid).toBe(item.id)
    expect(await listQueue()).toHaveLength(0)
  })

  it('does not retry before nextAttemptAt unless forced', async () => {
    upload.mockRejectedValueOnce(new Error('offline'))
    await makeItem()

    await syncQueue()
    const automatic = await syncQueue()
    expect(automatic.skipped).toBe(1)
    expect(upload).toHaveBeenCalledTimes(1)

    upload.mockResolvedValueOnce({} as never)
    const forced = await syncQueue({ force: true })
    expect(forced.uploaded).toBe(1)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('grows the retry delay exponentially and caps it at 30 minutes', () => {
    expect(backoffDelay(1)).toBe(5_000)
    expect(backoffDelay(2)).toBe(10_000)
    expect(backoffDelay(3)).toBe(20_000)
    expect(backoffDelay(10)).toBeGreaterThan(backoffDelay(4))
    expect(backoffDelay(50)).toBe(30 * 60 * 1000)
  })
})
