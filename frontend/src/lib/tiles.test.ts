import { describe, expect, it } from 'vitest'

import {
  boundsFromPoints,
  latToTileY,
  lonToTileX,
  tileUrl,
  tilesForBounds,
  tilesForBoundsAtZoom,
} from './tiles'

describe('slippy map tile maths', () => {
  it('maps the origin to the middle tile at zoom 1', () => {
    expect(lonToTileX(0, 1)).toBe(1)
    expect(latToTileY(0, 1)).toBe(1)
  })

  it('maps the north-west corner to tile 0,0', () => {
    expect(Math.floor(lonToTileX(-180, 3))).toBe(0)
    expect(Math.floor(latToTileY(85, 3))).toBe(0)
  })

  it('produces a unique, inclusive tile range', () => {
    const bounds = { west: 76.9, south: 42.95, east: 77.2, north: 43.15 }
    const tiles = tilesForBoundsAtZoom(bounds, 10)
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.every((tile) => tile.z === 10)).toBe(true)
    const keys = new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`))
    expect(keys.size).toBe(tiles.length)
  })

  it('covers several zooms without duplicate cache keys', () => {
    const bounds = { west: 76.95, south: 42.98, east: 77.15, north: 43.12 }
    const tiles = tilesForBounds(bounds, [10, 11, 12])
    const keys = new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`))
    expect(keys.size).toBe(tiles.length)
    expect(new Set(tiles.map((tile) => tile.z))).toEqual(new Set([10, 11, 12]))
  })

  it('respects the download limit', () => {
    const bounds = { west: 76.5, south: 42.7, east: 77.5, north: 43.4 }
    expect(tilesForBounds(bounds, [9, 10, 11, 12, 13, 14], 48)).toHaveLength(48)
  })

  it('fills a tile template', () => {
    expect(tileUrl('green', { z: 10, x: 3, y: 4 })).toBe(
      'https://tile.openstreetmap.org/10/3/4.png',
    )
  })

  it('pads the bounds around monitoring points', () => {
    const bounds = boundsFromPoints(
      [
        { lat: 43, lon: 77 },
        { lat: 43.1, lon: 77.2 },
      ],
      0.05,
    )
    expect(bounds.south).toBeCloseTo(42.95)
    expect(bounds.north).toBeCloseTo(43.15)
    expect(bounds.west).toBeCloseTo(76.95)
    expect(bounds.east).toBeCloseTo(77.25)
  })
})
