import type {
  ExportKind,
  HealthStatus,
  MonitoringPoint,
  Photo,
  PhotoList,
  PhotoTags,
  UploadPayload,
  UploadResult,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status = 0, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function detailToString(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry && typeof entry === 'object' && 'msg' in entry) {
          return String((entry as { msg: unknown }).msg)
        }
        return ''
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.msg === 'string') return record.msg
  }
  return fallback
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // The body may be empty or plain text.
  }
  const detail =
    payload && typeof payload === 'object' && 'detail' in payload
      ? (payload as { detail: unknown }).detail
      : null
  const code =
    detail && typeof detail === 'object' && detail !== null && 'code' in detail
      ? String((detail as { code: unknown }).code)
      : null
  const message = detailToString(detail, `Request failed (${response.status})`)
  return new ApiError(message, response.status, code)
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

export function getPoints(signal?: AbortSignal): Promise<MonitoringPoint[]> {
  return getJson<MonitoringPoint[]>('/api/points', signal)
}

export function getPoint(slug: string, signal?: AbortSignal): Promise<MonitoringPoint> {
  return getJson<MonitoringPoint>(`/api/points/${encodeURIComponent(slug)}`, signal)
}

export interface PhotoQuery {
  year?: number
  limit?: number
  cursor?: string
  from?: string
  to?: string
}

export function getPhotos(
  slug: string,
  query: PhotoQuery = {},
  signal?: AbortSignal,
): Promise<PhotoList> {
  const params = new URLSearchParams()
  if (query.year) params.set('year', String(query.year))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const suffix = params.size ? `?${params.toString()}` : ''
  return getJson<PhotoList>(
    `/api/points/${encodeURIComponent(slug)}/photos${suffix}`,
    signal,
  )
}

/**
 * Fetch the published series for one point, following the cursor up to a
 * generous safety limit. Seeded points have a handful of photos; this keeps
 * the client light while still handling a growing archive.
 */
export async function getAllPhotos(slug: string, signal?: AbortSignal): Promise<Photo[]> {
  const items: Photo[] = []
  let cursor: string | undefined
  for (let page = 0; page < 6; page += 1) {
    const result = await getPhotos(slug, { limit: 100, cursor }, signal)
    items.push(...result.items)
    cursor = result.next_cursor ?? undefined
    if (!cursor) break
  }
  return items
}

export function exportUrl(kind: ExportKind, pointSlug?: string): string {
  const params = new URLSearchParams()
  if (pointSlug) params.set('point', pointSlug)
  const suffix = params.size ? `?${params.toString()}` : ''
  return `/api/export/photos.${kind}${suffix}`
}

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return getJson<HealthStatus>('/api/health', signal)
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

function appendTags(form: FormData, tags: PhotoTags): void {
  const clean: PhotoTags = {}
  if (tags.weather) clean.weather = tags.weather
  if (tags.visibility) clean.visibility = tags.visibility
  if (tags.snow_cover) clean.snow_cover = tags.snow_cover
  form.append('tags', JSON.stringify(clean))
}

/**
 * Upload a queued photo with progress. XMLHttpRequest is used instead of fetch
 * so that the queue can show upload progress on slow mountain connections.
 * The client UUID is the idempotency key: a retry can never create a duplicate.
 */
export function uploadPhoto(
  payload: UploadPayload,
  options: {
    deviceToken?: string | null
    onProgress?: (percent: number) => void
    signal?: AbortSignal
  } = {},
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    const filename = `muzdyq-${payload.clientUuid}.jpg`
    form.append('file', payload.blob, filename)
    form.append('viewpoint_id', payload.viewpointId)
    form.append('taken_at', payload.takenAt)
    form.append('client_uuid', payload.clientUuid)
    appendTags(form, payload.tags)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/points/${encodeURIComponent(payload.pointSlug)}/photos`)
    xhr.responseType = 'text'
    xhr.setRequestHeader('Accept', 'application/json')
    if (options.deviceToken) xhr.setRequestHeader('X-Device-Token', options.deviceToken)

    const abort = () => xhr.abort()
    options.signal?.addEventListener('abort', abort, { once: true })

    const cleanup = () => options.signal?.removeEventListener('abort', abort)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      options.onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      cleanup()
      let payloadJson: unknown = null
      try {
        payloadJson = JSON.parse(xhr.responseText || 'null')
      } catch {
        // Fall through to the status-based error below.
      }
      if (xhr.status === 200 || xhr.status === 201) {
        resolve(payloadJson as UploadResult)
        return
      }
      const detail =
        payloadJson && typeof payloadJson === 'object' && 'detail' in payloadJson
          ? (payloadJson as { detail: unknown }).detail
          : null
      const code =
        detail && typeof detail === 'object' && detail !== null && 'code' in detail
          ? String((detail as { code: unknown }).code)
          : null
      reject(
        new ApiError(
          detailToString(detail, `Upload failed (${xhr.status})`),
          xhr.status,
          code,
        ),
      )
    }

    xhr.onerror = () => {
      cleanup()
      reject(new ApiError('Network error while uploading', 0, 'network'))
    }
    xhr.ontimeout = () => {
      cleanup()
      reject(new ApiError('Upload timed out', 0, 'timeout'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new ApiError('Upload cancelled', 0, 'aborted'))
    }

    xhr.send(form)
  })
}
