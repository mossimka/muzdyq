import { Spin, Typography } from 'antd'
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre v6 ships its worker separately. Without this, Vite's dependency
// pre-bundling cannot resolve the worker URL in development.
setWorkerUrl(workerUrl)

import { useSettings } from '../context/SettingsContext'
import { localized } from '../lib/format'
import { TILE_SOURCES } from '../lib/tiles'
import type { MonitoringPoint } from '../lib/types'

const GLACIER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 19 9 7l3 5 2-3 7 10Z"/><path d="m9 7 1.5 3L9 11"/></svg>'
const WATER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"/><path d="M3 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"/></svg>'

function buildStyle(greenMode: boolean): StyleSpecification {
  const source = greenMode ? TILE_SOURCES.green : TILE_SOURCES.detailed
  const attribution = greenMode
    ? '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
    : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)'
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [source],
        tileSize: 256,
        maxzoom: 17,
        attribution,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#eaf2ef' },
      },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: { 'raster-opacity': greenMode ? 0.9 : 1 },
      },
    ],
  }
}

export interface MapViewProps {
  points: MonitoringPoint[]
  selectedSlug: string | null
  onSelect: (slug: string) => void
  greenMode: boolean
}

export function MapView({ points, selectedSlug, onSelect, greenMode }: MapViewProps) {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef(new Map<string, Marker>())
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!container.current || mapRef.current) return

    const map = new MapLibreMap({
      container: container.current,
      style: buildStyle(greenMode),
      center: [77.09, 43.04],
      zoom: 10.2,
      minZoom: 7,
      maxZoom: 16,
      attributionControl: false,
    })
    mapRef.current = map
    const markers = markersRef.current
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new AttributionControl({ compact: true }))
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => setReady(true))

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      markers.forEach((marker) => marker.remove())
      markers.clear()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // The map is created once; later props are applied in other effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setStyle(buildStyle(greenMode), { diff: false })
  }, [greenMode, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!points.length) return

    const bounds = new LngLatBounds()
    for (const point of points) bounds.extend([point.lon, point.lat])
    map.fitBounds(bounds, {
      padding: { top: 64, bottom: 64, left: 56, right: 56 },
      maxZoom: 12.4,
      duration: 0,
    })
  }, [points, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const active = markersRef.current
    const seen = new Set<string>()

    for (const point of points) {
      seen.add(point.slug)
      let marker = active.get(point.slug)
      if (!marker) {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = 'muzdyq-marker'
        element.dataset.testid = `map-marker-${point.slug}`
        if (point.type === 'water') element.classList.add('muzdyq-marker--water')
        element.innerHTML = point.type === 'water' ? WATER_ICON : GLACIER_ICON
        const label = document.createElement('span')
        label.className = 'muzdyq-marker-label'
        label.textContent = localized(point.name_i18n, locale, point.slug)
        element.appendChild(label)
        element.setAttribute(
          'aria-label',
          `${localized(point.name_i18n, locale, point.slug)} — ${point.photo_count} ${t('common.photos')}`,
        )
        element.addEventListener('click', (event) => {
          event.preventDefault()
          onSelectRef.current(point.slug)
        })
        marker = new Marker({ element, anchor: 'center' })
          .setLngLat([point.lon, point.lat])
          .addTo(map)
        active.set(point.slug, marker)
      }
    }

    for (const [slug, marker] of active) {
      if (!seen.has(slug)) {
        marker.remove()
        active.delete(slug)
      }
    }
  }, [points, ready, locale, t])

  useEffect(() => {
    markersRef.current.forEach((marker, slug) => {
      const element = marker.getElement()
      const selected = slug === selectedSlug
      element.classList.toggle('muzdyq-marker--selected', selected)
      element.setAttribute('aria-pressed', selected ? 'true' : 'false')
    })
  }, [selectedSlug, points])

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-[var(--mz-line)] bg-[var(--mz-surface-2)]">
      <div ref={container} className="h-full w-full" aria-label={t('map.title')} />
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center bg-[var(--mz-surface-2)]">
          <div className="text-center">
            <Spin size="large" />
            <Typography.Paragraph className="!mt-3 !mb-0 !text-sm !text-[var(--mz-muted)]">
              {t('map.loading')}
            </Typography.Paragraph>
          </div>
        </div>
      ) : null}
      {ready && !points.length ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 rounded-xl bg-[var(--mz-surface)] p-3 text-sm font-semibold shadow">
          {t('map.noPoints')}
        </div>
      ) : null}
    </div>
  )
}
