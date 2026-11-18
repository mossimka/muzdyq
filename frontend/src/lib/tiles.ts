export const TILE_CACHE = 'muzdyq-tiles-v1'

export const TILE_SOURCES = {
  green: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  detailed: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
} as const

export type TileSource = keyof typeof TILE_SOURCES

export interface GeoBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface TileCoord {
  x: number
  y: number
  z: number
}

export function lonToTileX(lon: number, zoom: number): number {
  const n = 2 ** zoom
  return ((lon + 180) / 360) * n
}

export function latToTileY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const radians = (clamped * Math.PI) / 180
  const n = 2 ** zoom
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * n
}

export function tileUrl(source: TileSource, tile: TileCoord): string {
  return TILE_SOURCES[source]
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
}

/** Inclusive tile range covering a geographic bounding box at one zoom. */
export function tilesForBoundsAtZoom(bounds: GeoBounds, zoom: number): TileCoord[] {
  const n = 2 ** zoom
  const minX = Math.max(0, Math.floor(lonToTileX(bounds.west, zoom)))
  const maxX = Math.min(n - 1, Math.floor(lonToTileX(bounds.east, zoom)))
  const northY = Math.max(0, Math.floor(latToTileY(bounds.north, zoom)))
  const southY = Math.min(n - 1, Math.floor(latToTileY(bounds.south, zoom)))

  const tiles: TileCoord[] = []
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = northY; y <= southY; y += 1) {
      tiles.push({ x, y, z: zoom })
    }
  }
  return tiles
}

export function tilesForBounds(
  bounds: GeoBounds,
  zooms: readonly number[],
  limit = 800,
): TileCoord[] {
  const unique = new Map<string, TileCoord>()
  for (const zoom of zooms) {
    for (const tile of tilesForBoundsAtZoom(bounds, zoom)) {
      unique.set(`${tile.z}/${tile.x}/${tile.y}`, tile)
      if (unique.size >= limit) return [...unique.values()]
    }
  }
  return [...unique.values()]
}

export function boundsFromPoints(
  points: Array<{ lat: number; lon: number }>,
  paddingDegrees = 0.05,
): GeoBounds {
  if (!points.length) {
    return { west: 76.85, south: 42.95, east: 77.35, north: 43.18 }
  }
  let west = 180
  let east = -180
  let south = 90
  let north = -90
  for (const point of points) {
    west = Math.min(west, point.lon)
    east = Math.max(east, point.lon)
    south = Math.min(south, point.lat)
    north = Math.max(north, point.lat)
  }
  return {
    west: west - paddingDegrees,
    south: south - paddingDegrees,
    east: east + paddingDegrees,
    north: north + paddingDegrees,
  }
}

export function estimateDownloadBytes(tileCount: number): number {
  // OpenStreetMap raster tiles are typically 10–40 KB. Keep the estimate high
  // so contributors on mobile data are not surprised.
  return tileCount * 28 * 1024
}

export interface DownloadTilesOptions {
  source?: TileSource
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
  concurrency?: number
}

export interface DownloadTilesResult {
  saved: number
  failed: number
  total: number
}

/**
 * Fetch a region into the Cache API so MapLibre can use it offline. Safe to
 * run repeatedly: already cached tiles are reused.
 */
export async function downloadTiles(
  bounds: GeoBounds,
  zooms: readonly number[],
  options: DownloadTilesOptions = {},
): Promise<DownloadTilesResult> {
  if (typeof caches === 'undefined') {
    throw new Error('Offline tile storage is not supported by this browser')
  }
  const tiles = tilesForBounds(bounds, zooms)
  const source = options.source ?? 'green'
  const cache = await caches.open(TILE_CACHE)
  const concurrency = options.concurrency ?? 4

  let done = 0
  let saved = 0
  let failed = 0
  let cursor = 0

  options.onProgress?.(0, tiles.length)

  async function worker(): Promise<void> {
    while (cursor < tiles.length) {
      const tile = tiles[cursor]
      cursor += 1
      if (!tile) break
      if (options.signal?.aborted) return
      const url = tileUrl(source, tile)
      try {
        const cached = await cache.match(url)
        if (!cached) {
          const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
          if (!response.ok) throw new Error(`Tile ${response.status}`)
          await cache.put(url, response.clone())
          saved += 1
        }
      } catch {
        failed += 1
      } finally {
        done += 1
        options.onProgress?.(done, tiles.length)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return { saved, failed, total: tiles.length }
}

export async function countCachedTiles(): Promise<number> {
  if (typeof caches === 'undefined') return 0
  try {
    const cache = await caches.open(TILE_CACHE)
    return (await cache.keys()).length
  } catch {
    return 0
  }
}
