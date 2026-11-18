import {
  CloudDownloadOutlined,
  CompassOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Progress,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { PointCard } from '../components/PointCard'
import { PointPanel } from '../components/PointPanel'
import { MapView } from '../components/MapView'
import { useSettings } from '../context/SettingsContext'
import { getPoints } from '../lib/api'
import {
  boundsFromPoints,
  downloadTiles,
  estimateDownloadBytes,
  tilesForBounds,
} from '../lib/tiles'

const { Paragraph, Title } = Typography

function OfflineDownload({ points }: { points: Array<{ lat: number; lon: number }> }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const zooms = useMemo(() => [10, 11, 12, 13], [])
  const bounds = useMemo(() => boundsFromPoints(points, 0.06), [points])
  const estimate = useMemo(
    () => estimateDownloadBytes(tilesForBounds(bounds, zooms).length),
    [bounds, zooms],
  )

  const start = async () => {
    setBusy(true)
    setError(false)
    setMessage(null)
    try {
      const result = await downloadTiles(bounds, zooms, {
        source: 'green',
        onProgress: (value, all) => {
          setDone(value)
          setTotal(all)
        },
      })
      setMessage(t('map.downloadDone', { count: result.saved }))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--mz-line)] bg-[var(--mz-surface-2)] p-3">
      <div className="flex items-start gap-2">
        <CloudDownloadOutlined aria-hidden="true" className="mt-1 text-lg text-[var(--mz-primary)]" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--mz-ink)]">{t('map.offlineTitle')}</p>
          <p className="mt-0.5 text-xs text-[var(--mz-muted)]">{t('map.offlineBody')}</p>
        </div>
      </div>
      {busy || (total > 0 && done < total) ? (
        <Progress
          className="!mt-2"
          percent={total ? Math.round((done / total) * 100) : 0}
          size="small"
          format={() => `${done}/${total}`}
        />
      ) : null}
      {message ? <p className="mt-2 text-xs font-semibold text-[var(--mz-primary-strong)]">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-[var(--mz-danger)]">{t('map.downloadFailed')}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="small" icon={<CloudDownloadOutlined />} loading={busy} onClick={() => void start()}>
          {busy ? t('map.downloading', { done, total }) : t('map.download')}
        </Button>
        <span className="text-[11px] text-[var(--mz-muted)]">
          {t('map.downloadSize', { mb: Math.max(1, Math.round(estimate / (1024 * 1024))) })}
        </span>
      </div>
    </div>
  )
}

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="mz-topo border-b border-[var(--mz-line)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-9 sm:px-5 lg:grid-cols-[1.5fr_1fr] lg:py-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mz-primary-strong)]">
            {t('hero.eyebrow')}
          </p>
          <Title level={1} className="!mb-3 !mt-2 !text-3xl !leading-tight sm:!text-4xl lg:!text-5xl">
            {t('hero.title')}
          </Title>
          <Paragraph className="!mb-5 max-w-2xl !text-base !text-[var(--mz-muted)] sm:!text-lg">
            {t('hero.body')}
          </Paragraph>
          <Space wrap size={10}>
            <Button
              type="primary"
              size="large"
              icon={<CompassOutlined />}
              onClick={() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t('hero.ctaExplore')}
            </Button>
            <Link to="/contribute">
              <Button size="large" icon={<SafetyCertificateOutlined />}>
                {t('hero.ctaContribute')}
              </Button>
            </Link>
          </Space>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--mz-muted)]">
            <Tag className="!m-0">{t('hero.sdg13')}</Tag>
            <Tag className="!m-0">{t('hero.sdg66')}</Tag>
            <Tag color="green" className="!m-0">
              {t('hero.openData')}
            </Tag>
            <span>{t('hero.meta')}</span>
          </div>
        </div>

        <Card className="mz-card-shadow !rounded-3xl !border-[var(--mz-line)] !bg-[var(--mz-surface)]">
          <Title level={3} className="!mb-2 !text-lg">
            {t('steps.title')}
          </Title>
          <ol className="m-0 list-none space-y-3 p-0">
            {(['one', 'two', 'three'] as const).map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mz-primary-soft)] text-sm font-bold text-[var(--mz-primary-strong)]">
                  {index + 1}
                </span>
                <div>
                  <p className="m-0 text-sm font-bold">{t(`steps.${step}.title`)}</p>
                  <p className="m-0 text-xs text-[var(--mz-muted)]">{t(`steps.${step}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </section>
  )
}

export function HomePage() {
  const { t } = useTranslation()
  const { greenMode } = useSettings()
  const [params, setParams] = useSearchParams()

  const pointsQuery = useQuery({
    queryKey: ['points'],
    queryFn: ({ signal }) => getPoints(signal),
    staleTime: 60_000,
  })

  const points = pointsQuery.data ?? []
  const selectedSlug = params.get('point')
  const selected = points.find((point) => point.slug === selectedSlug) ?? null

  const openPoint = (slug: string) => {
    const next = new URLSearchParams(params)
    next.set('point', slug)
    setParams(next, { replace: true })
  }

  const closePoint = () => {
    const next = new URLSearchParams(params)
    next.delete('point')
    setParams(next, { replace: true })
  }

  const totalPhotos = points.reduce((sum, point) => sum + point.photo_count, 0)

  return (
    <>
      <Hero />

      <section id="map" className="mx-auto max-w-7xl px-4 py-7 sm:px-5" aria-labelledby="map-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Title level={2} id="map-heading" className="!mb-1 !text-2xl">
              {t('map.title')}
            </Title>
            <Paragraph className="!mb-0 !text-sm !text-[var(--mz-muted)]">
              {t('map.subtitle')} · {points.length} {t('map.points')} · {totalPhotos}{' '}
              {t('common.photos')}
            </Paragraph>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag color={greenMode ? 'green' : 'default'} icon={<ThunderboltOutlined />} className="!m-0">
              {greenMode ? t('common.greenOn') : t('common.greenOff')}
            </Tag>
            <span className="text-xs text-[var(--mz-muted)]">{t('map.attribution')}</span>
          </div>
        </div>

        {pointsQuery.isError ? (
          <Alert
            className="!mb-4"
            type="error"
            showIcon
            title={t('errors.loadPoints')}
            action={
              <Button size="small" onClick={() => void pointsQuery.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[54vh] min-h-[360px] lg:h-[640px]">
            {pointsQuery.isLoading ? (
              <Skeleton.Node active className="h-full w-full !rounded-2xl" />
            ) : (
              <MapView
                points={points}
                selectedSlug={selectedSlug}
                onSelect={openPoint}
                greenMode={greenMode}
              />
            )}
          </div>

          <aside className="flex min-h-0 flex-col gap-3" aria-label={t('map.title')}>
            {points.length ? <OfflineDownload points={points} /> : null}
            <div className="flex items-center gap-3 rounded-xl border border-[var(--mz-line)] bg-[var(--mz-surface)] px-3 py-2 text-xs font-semibold text-[var(--mz-muted)]">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-[var(--mz-primary)]" aria-hidden="true" />
                {t('type.glacier')}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-[#1d4ed8]" aria-hidden="true" />
                {t('type.water')}
              </span>
              <Tooltip title={t('map.coordsNote')}>
                <InfoCircleOutlined aria-label={t('map.coordsNote')} />
              </Tooltip>
            </div>

            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-0.5 lg:max-h-[430px]">
              {pointsQuery.isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <Skeleton.Node key={index} active className="h-24 w-full !rounded-2xl" />
                  ))
                : points.map((point) => (
                    <PointCard key={point.slug} point={point} onOpen={openPoint} />
                  ))}
            </div>

            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              title={t('sidebar.disclaimerTitle')}
              description={t('sidebar.disclaimer')}
            />
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-5" aria-labelledby="steps-heading">
        <Title level={2} id="steps-heading" className="!mb-3 !text-2xl">
          {t('steps.title')}
        </Title>
        <div className="grid gap-3 md:grid-cols-3">
          {(['one', 'two', 'three'] as const).map((step, index) => (
            <Card key={step} className="!rounded-2xl !border-[var(--mz-line)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--mz-primary-strong)]">
                {index + 1}
              </span>
              <Title level={3} className="!mb-1 !mt-1 !text-base">
                {t(`steps.${step}.title`)}
              </Title>
              <Paragraph className="!mb-0 !text-sm !text-[var(--mz-muted)]">
                {t(`steps.${step}.body`)}
              </Paragraph>
            </Card>
          ))}
        </div>
      </section>

      <PointPanel
        key={selected?.slug ?? 'none'}
        point={selected}
        open={Boolean(selected)}
        onClose={closePoint}
      />
    </>
  )
}
