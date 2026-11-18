import {
  CameraOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Empty, Image, Select, Space, Spin, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useSettings } from '../context/SettingsContext'
import { exportUrl, getAllPhotos } from '../lib/api'
import { formatCoord, formatDateOnly, localized, yearOf } from '../lib/format'
import type { ExportKind, MonitoringPoint, Photo } from '../lib/types'
import { useIsDesktop } from '../lib/useMediaQuery'
import { CompareSlider } from './CompareSlider'
import { PhotoGallery } from './PhotoGallery'
import { Timelapse } from './Timelapse'

const { Paragraph, Text, Title } = Typography

const EMPTY_PHOTOS: Photo[] = []

export interface PointPanelProps {
  point: MonitoringPoint | null
  open: boolean
  onClose: () => void
}

const EXPORTS: Array<{ kind: ExportKind; labelKey: string }> = [
  { kind: 'csv', labelKey: 'sidebar.csv' },
  { kind: 'geojson', labelKey: 'sidebar.geojson' },
  { kind: 'json', labelKey: 'sidebar.json' },
  { kind: 'zip', labelKey: 'sidebar.zip' },
]

export function PointPanel({ point, open, onClose }: PointPanelProps) {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const slug = point?.slug ?? ''

  const [viewpointId, setViewpointId] = useState<string | null>(
    point?.viewpoints[0]?.id ?? null,
  )
  const [year, setYear] = useState<number | 'all'>('all')
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)

  const photosQuery = useQuery({
    queryKey: ['photos', slug],
    queryFn: ({ signal }) => getAllPhotos(slug, signal),
    enabled: Boolean(slug) && open,
    staleTime: 60_000,
  })

  const photos = photosQuery.data ?? EMPTY_PHOTOS
  const years = useMemo(() => {
    const unique = new Set<number>()
    for (const photo of photos) {
      const value = yearOf(photo.taken_at)
      if (value) unique.add(value)
    }
    return [...unique].sort((a, b) => b - a)
  }, [photos])

  const filtered = useMemo(() => {
    if (year === 'all') return photos
    return photos.filter((photo) => yearOf(photo.taken_at) === year)
  }, [photos, year])

  const chronological = useMemo(
    () => [...filtered].sort((a, b) => a.taken_at.localeCompare(b.taken_at)),
    [filtered],
  )

  const before = chronological.find((photo) => photo.id === beforeId) ?? chronological[0]
  const after =
    chronological.find((photo) => photo.id === afterId) ??
    chronological[chronological.length - 1]

  if (!point) {
    return null
  }

  const name = localized(point.name_i18n, locale, point.slug)
  const description = localized(point.description_i18n, locale)
  const safety = localized(point.safety_note_i18n, locale, t('sidebar.safetyDefault'))
  const viewpoint = point.viewpoints.find((item) => item.id === viewpointId) ?? null
  const photoYears = years.map((value) => ({ value, label: String(value) }))
  const compareOptions = chronological.map((photo) => ({
    value: photo.id,
    label: formatDateOnly(photo.taken_at, locale),
  }))
  const hasDemo = photos.some((photo) => photo.is_demo)

  const addPhoto = () => {
    if (!point.viewpoints.length) return
    const target = viewpointId ?? point.viewpoints[0]?.id
    if (!target) return
    navigate(`/p/${point.slug}/${target}`)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement={isDesktop ? 'right' : 'bottom'}
      size={isDesktop ? 560 : '88%'}
      destroyOnHidden
      title={
        <div className="pr-2">
          <div className="font-display text-lg font-bold leading-tight">{name}</div>
          <Space size={4} wrap className="mt-1">
            <Tag color={point.type === 'water' ? 'blue' : 'cyan'} className="!m-0">
              {t(`type.${point.type}`)}
            </Tag>
            {point.demo ? (
              <Tag color="gold" className="!m-0">
                {t('common.demo')}
              </Tag>
            ) : null}
            {!point.coords_verified ? (
              <Tag icon={<WarningOutlined />} color="orange" className="!m-0">
                {t('common.unverified')}
              </Tag>
            ) : null}
          </Space>
        </div>
      }
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex flex-col gap-4 p-4 pb-8">
        {!point.coords_verified ? (
          <Alert
            type="warning"
            showIcon
            title={t('common.unverified')}
            description={t('map.coordsNote')}
          />
        ) : null}

        {description ? <Paragraph className="!mb-0">{description}</Paragraph> : null}

        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          title={t('sidebar.safety')}
          description={safety}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--mz-muted)]">
          <span>
            <EnvironmentOutlined aria-hidden="true" className="mr-1" />
            {formatCoord(point.lat)}, {formatCoord(point.lon)}
          </span>
          {point.elevation_m ? <span>{t('sidebar.elevation', { m: point.elevation_m })}</span> : null}
          <span>{t('sidebar.observations', { count: point.photo_count })}</span>
        </div>

        <section aria-labelledby="viewpoint-heading">
          <Title level={4} id="viewpoint-heading" className="!mb-2 !text-base">
            {t('sidebar.viewpoint')}
          </Title>
          {point.viewpoints.length ? (
            <>
              <Select
                className="w-full"
                value={viewpoint?.id}
                onChange={(value) => setViewpointId(value)}
                options={point.viewpoints.map((item, index) => ({
                  value: item.id,
                  label: `${t('sidebar.viewpoint')} ${index + 1}${
                    item.heading_deg !== null ? ` · ${t('sidebar.viewpointHeading', { deg: item.heading_deg })}` : ''
                  }`,
                }))}
                aria-label={t('capture.chooseViewpoint')}
              />
              {viewpoint ? (
                <div className="mt-2 text-sm text-[var(--mz-muted)]">
                  {localized(viewpoint.note_i18n, locale)}
                </div>
              ) : null}
              {viewpoint?.reference_photo_url ? (
                <div className="mt-3">
                  <Image
                    src={viewpoint.reference_photo_url}
                    alt={t('sidebar.reference')}
                    width="100%"
                    height={170}
                    style={{ objectFit: 'cover', borderRadius: 12 }}
                  />
                  <p className="mt-1 text-xs font-semibold text-[var(--mz-muted)]">
                    {t('sidebar.reference')}
                  </p>
                </div>
              ) : (
                <Alert className="!mt-3" type="info" showIcon title={t('capture.noReference')} />
              )}
              <Button
                type="primary"
                size="large"
                block
                icon={<CameraOutlined />}
                className="!mt-3"
                onClick={addPhoto}
              >
                {t('sidebar.addPhotoFrom')}
              </Button>
            </>
          ) : (
            <Alert type="info" showIcon title={t('capture.noViewpoints')} />
          )}
        </section>

        <section aria-labelledby="gallery-heading" className="border-t border-[var(--mz-line)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Title level={4} id="gallery-heading" className="!mb-0 !text-base">
              {t('sidebar.gallery')}
            </Title>
            <Select
              value={year}
              onChange={setYear}
              options={[{ value: 'all', label: t('sidebar.allYears') }, ...photoYears]}
              aria-label={t('sidebar.filterYear')}
              style={{ minWidth: 130 }}
              disabled={!years.length}
            />
          </div>

          {hasDemo ? (
            <Alert
              className="!mt-3"
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              title={t('sidebar.demoNotice')}
            />
          ) : null}

          {photosQuery.isLoading ? (
            <div className="grid place-items-center py-10">
              <Spin size="large" description={t('gallery.loading')} />
            </div>
          ) : photosQuery.isError ? (
            <Alert
              className="!mt-3"
              type="error"
              showIcon
              title={t('errors.loadPhotos')}
              action={
                <Button size="small" onClick={() => void photosQuery.refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          ) : !filtered.length ? (
            <Empty
              className="!mt-4"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={year === 'all' ? t('sidebar.noPhotos') : t('sidebar.noPhotosFiltered')}
            >
              {point.viewpoints.length ? (
                <Button type="primary" icon={<CameraOutlined />} onClick={addPhoto}>
                  {t('sidebar.addPhoto')}
                </Button>
              ) : null}
            </Empty>
          ) : (
            <>
              {chronological.length >= 2 && before && after && before.id !== after.id ? (
                <div className="mt-4">
                  <Title level={4} className="!mb-2 !text-base">
                    {t('sidebar.compare')}
                  </Title>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold text-[var(--mz-muted)]">
                      {t('sidebar.before')}
                      <Select
                        className="mt-1 w-full"
                        value={before.id}
                        onChange={setBeforeId}
                        options={compareOptions}
                        aria-label={t('sidebar.before')}
                      />
                    </label>
                    <label className="text-xs font-semibold text-[var(--mz-muted)]">
                      {t('sidebar.after')}
                      <Select
                        className="mt-1 w-full"
                        value={after.id}
                        onChange={setAfterId}
                        options={compareOptions}
                        aria-label={t('sidebar.after')}
                      />
                    </label>
                  </div>
                  <CompareSlider before={before} after={after} />
                </div>
              ) : null}

              {chronological.length >= 2 ? (
                <div className="mt-5">
                  <Title level={4} className="!mb-2 !text-base">
                    {t('sidebar.timelapse')}
                  </Title>
                  <Timelapse key={String(year)} photos={filtered} />
                </div>
              ) : null}

              <div className="mt-5">
                <PhotoGallery photos={filtered} />
              </div>
            </>
          )}
        </section>

        <section className="border-t border-[var(--mz-line)] pt-4">
          <Title level={4} className="!mb-1 !text-base">
            {t('sidebar.exportTitle')}
          </Title>
          <Paragraph className="!mb-2 !text-sm !text-[var(--mz-muted)]">
            {t('sidebar.exportBody')}
          </Paragraph>
          <div className="flex flex-wrap gap-2">
            {EXPORTS.map((item) => (
              <Button
                key={item.kind}
                icon={<DownloadOutlined />}
                onClick={() => {
                  window.location.href = exportUrl(item.kind, point.slug)
                }}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--mz-muted)]">
            <Link to="/data">{t('sidebar.openDataPage')}</Link> · {t('common.license')}
          </p>
        </section>

        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          title={t('sidebar.disclaimerTitle')}
          description={t('sidebar.disclaimer')}
        />

        <Text className="!text-xs !text-[var(--mz-muted)]">
          {t('gallery.attribution')} · {t('gallery.license')}
        </Text>
      </div>
    </Drawer>
  )
}
