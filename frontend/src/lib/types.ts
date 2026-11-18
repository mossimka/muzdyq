export type Locale = 'en' | 'ru' | 'kk'
export type PointType = 'glacier' | 'water'
export type ThemeMode = 'light' | 'dark'

export type LocalizedText = Partial<Record<Locale, string>> & { en?: string }

export type WeatherTag = 'clear' | 'partly_cloudy' | 'overcast' | 'fog' | 'rain' | 'snow'
export type VisibilityTag = 'good' | 'medium' | 'poor'
export type SnowCoverTag = 'none' | 'partial' | 'full'

export interface PhotoTags {
  weather?: WeatherTag
  visibility?: VisibilityTag
  snow_cover?: SnowCoverTag
  demo?: boolean
}

export interface Viewpoint {
  id: string
  heading_deg: number | null
  note_i18n: LocalizedText
  reference_photo_url: string | null
}

export interface MonitoringPoint {
  id: number
  slug: string
  type: PointType
  name_i18n: LocalizedText
  description_i18n: LocalizedText
  safety_note_i18n: LocalizedText
  lat: number
  lon: number
  elevation_m: number | null
  coords_verified: boolean
  viewpoints: Viewpoint[]
  photo_count: number
  latest_photo_at: string | null
  latest_thumb_url: string | null
  demo: boolean
}

export interface Photo {
  id: string
  point_id: number
  point_slug: string
  viewpoint_id: string | null
  taken_at: string
  uploaded_at: string
  width: number
  height: number
  bytes: number
  license: string
  tags: PhotoTags
  is_demo: boolean
  url: string
  thumb_url: string
  download_url: string
}

export interface PhotoList {
  items: Photo[]
  next_cursor: string | null
}

export interface UploadResult {
  photo: Photo
  duplicate: boolean
}

export type UploadStatus = 'pending' | 'uploading' | 'failed'

export interface QueueItem {
  /** Client-generated idempotency UUID. Reused for every retry. */
  id: string
  pointSlug: string
  pointName: string
  viewpointId: string
  takenAt: string
  tags: PhotoTags
  blob: Blob
  thumb: Blob | null
  bytes: number
  createdAt: number
  attempts: number
  nextAttemptAt: number
  status: UploadStatus
  lastError: string | null
}

export interface UploadPayload {
  clientUuid: string
  pointSlug: string
  viewpointId: string
  takenAt: string
  tags: PhotoTags
  blob: Blob
}

export type ExportKind = 'csv' | 'geojson' | 'json' | 'zip'

export interface HealthStatus {
  status: 'ok' | 'degraded'
  version: string
  time: string
  database: 'ok' | 'error'
  storage: 'ok' | 'error'
  counts: Record<string, number>
  face_detection: Record<string, unknown>
}
