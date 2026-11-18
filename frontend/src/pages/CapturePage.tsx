import {
  CameraOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Result,
  Select,
  Slider,
  Space,
  Spin,
  Steps,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useSettings } from '../context/SettingsContext'
import { ApiError, getPoint } from '../lib/api'
import { localized } from '../lib/format'
import { makeThumbnail, processImage } from '../lib/image'
import { isOnline } from '../lib/network'
import { enqueuePhoto } from '../lib/queue'
import { requestBackgroundSync, syncQueue } from '../lib/sync'
import type { PhotoTags, SnowCoverTag, VisibilityTag, WeatherTag } from '../lib/types'

const { Paragraph, Text, Title } = Typography

const WEATHER: WeatherTag[] = ['clear', 'partly_cloudy', 'overcast', 'fog', 'rain', 'snow']
const VISIBILITY: VisibilityTag[] = ['good', 'medium', 'poor']
const SNOW: SnowCoverTag[] = ['none', 'partial', 'full']

interface CapturedPhoto {
  blob: Blob
  previewUrl: string
  width: number
  height: number
  facesBlurred: number
}

function grabVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas is not available'))
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the frame'))),
      'image/jpeg',
      0.92,
    )
  })
}

export function CapturePage() {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const { slug = '', viewpointId = '' } = useParams()
  const navigate = useNavigate()

  const pointQuery = useQuery({
    queryKey: ['point', slug],
    queryFn: ({ signal }) => getPoint(slug, signal),
    enabled: Boolean(slug),
    retry: false,
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [showGhost, setShowGhost] = useState(true)
  const [ghostOpacity, setGhostOpacity] = useState(45)
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tags, setTags] = useState<PhotoTags>({})

  const point = pointQuery.data
  const name = point ? localized(point.name_i18n, locale, point.slug) : ''
  const viewpoint = point?.viewpoints.find((item) => item.id === viewpointId) ?? null

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [photo])

  const startCamera = async () => {
    setCameraBusy(true)
    setCameraError(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      // The video element is rendered after the state update.
      window.setTimeout(() => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        void video.play().catch(() => setCameraError(true))
      }, 0)
    } catch {
      setCameraError(true)
      setCameraActive(false)
    } finally {
      setCameraBusy(false)
    }
  }

  const prepare = async (blob: Blob) => {
    setProcessing(true)
    setProcessError(false)
    try {
      const processed = await processImage(blob, {
        maxEdge: 1600,
        quality: 0.75,
        blurFaces: true,
      })
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      setPhoto({
        blob: processed.blob,
        previewUrl: URL.createObjectURL(processed.blob),
        width: processed.width,
        height: processed.height,
        facesBlurred: processed.facesBlurred,
      })
      stopCamera()
    } catch {
      setProcessError(true)
    } finally {
      setProcessing(false)
    }
  }

  const shoot = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    try {
      const frame = await grabVideoFrame(video)
      await prepare(frame)
    } catch {
      setProcessError(true)
    }
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await prepare(file)
  }

  const save = async () => {
    if (!photo || !point || !viewpoint || saving) return
    setSaving(true)
    try {
      const thumb = await makeThumbnail(photo.blob).catch(() => null)
      await enqueuePhoto({
        pointSlug: point.slug,
        pointName: name,
        viewpointId: viewpoint.id,
        takenAt: new Date().toISOString(),
        tags,
        blob: photo.blob,
        thumb,
      })
      requestBackgroundSync()
      void syncQueue()
      setSaved(true)
      stopCamera()
    } catch {
      setProcessError(true)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
    setSaved(false)
    setProcessError(false)
    setTags({})
  }

  if (pointQuery.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spin size="large" />
      </div>
    )
  }

  if (pointQuery.isError) {
    const notFound = pointQuery.error instanceof ApiError && pointQuery.error.status === 404
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? t('notFound.title') : t('common.error')}
        subTitle={notFound ? t('notFound.body') : t('errors.loadPoints')}
        extra={
          <Link to="/">
            <Button type="primary">{t('notFound.home')}</Button>
          </Link>
        }
      />
    )
  }

  if (point && !viewpoint) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert type="error" showIcon title={t('capture.invalidViewpoint')} />
        <Link to="/">
          <Button className="!mt-4">{t('capture.backToMap')}</Button>
        </Link>
      </div>
    )
  }

  if (!point || !viewpoint) return null

  if (saved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Result
          status="success"
          icon={<CheckCircleOutlined className="text-[var(--mz-primary)]" />}
          title={t('capture.savedTitle')}
          subTitle={isOnline() ? t('capture.savedOnline') : t('capture.savedFailed')}
          extra={
            <Space wrap>
              <Button type="primary" onClick={reset}>
                {t('capture.addAnother')}
              </Button>
              <Button onClick={() => navigate('/queue')}>{t('capture.queueLink')}</Button>
              <Link to="/">
                <Button>{t('capture.backToMap')}</Button>
              </Link>
            </Space>
          }
        />
        <Alert
          className="!mt-4"
          type="info"
          showIcon
          title={t('queue.offlineNote')}
          description={t('queue.storageNote')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-5">
      <div className="mb-4">
        <Text className="!text-xs !font-bold !uppercase !tracking-wider !text-[var(--mz-primary-strong)]">
          {t('capture.point')} · {name}
        </Text>
        <Title level={1} className="!mb-1 !mt-1 !text-2xl sm:!text-3xl">
          {t('capture.title')}
        </Title>
        <Paragraph className="!mb-0 !text-sm !text-[var(--mz-muted)]">
          {t('capture.subtitle')}
        </Paragraph>
      </div>

      <Alert
        className="!mb-4"
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        title={t('capture.safetyTitle')}
        description={localized(point.safety_note_i18n, locale, t('capture.safetyBody'))}
      />

      <Card className="!mb-4 !rounded-2xl !border-[var(--mz-line)]">
        <Steps
          size="small"
          current={photo ? 1 : 0}
          items={[
            { title: t('capture.alignTitle') },
            { title: t('capture.tagsTitle') },
            { title: t('capture.processTitle') },
          ]}
        />
      </Card>

      {!photo ? (
        <>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#081b18]">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {viewpoint.reference_photo_url && showGhost ? (
                  <img
                    src={viewpoint.reference_photo_url}
                    alt={t('capture.alignSlider')}
                    className="mz-ghost"
                    style={{ opacity: ghostOpacity / 100 }}
                  />
                ) : null}
                <div className="mz-frame" aria-hidden="true" />
                <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-bold text-white">
                  {t('capture.alignBody')}
                </div>
              </>
            ) : (
              <div className="grid h-full w-full place-items-center p-6 text-center text-white">
                <div>
                  <CameraOutlined className="text-4xl" aria-hidden="true" />
                  <p className="mt-3 max-w-md text-sm text-white/80">{t('capture.cameraPrivacy')}</p>
                  <Space wrap className="mt-4 justify-center">
                    <Button
                      type="primary"
                      size="large"
                      icon={<CameraOutlined />}
                      loading={cameraBusy}
                      onClick={() => void startCamera()}
                    >
                      {cameraBusy ? t('capture.cameraStarting') : t('capture.cameraStart')}
                    </Button>
                    <Button
                      size="large"
                      icon={<PictureOutlined />}
                      onClick={() => fileRef.current?.click()}
                    >
                      {t('capture.chooseFile')}
                    </Button>
                  </Space>
                </div>
              </div>
            )}
            {processing ? (
              <div className="absolute inset-0 grid place-items-center bg-black/60 p-6 text-center text-white">
                <div>
                  <Spin size="large" />
                  <p className="mt-3 text-sm font-semibold">{t('capture.processing')}</p>
                </div>
              </div>
            ) : null}
          </div>

          {cameraActive ? (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[var(--mz-line)] bg-[var(--mz-surface)] p-3 sm:flex-row sm:items-center">
              <Space size={8} align="center" className="shrink-0">
                <Switch
                  checked={showGhost}
                  onChange={setShowGhost}
                  aria-label={t('capture.showGhost')}
                />
                <span className="text-sm font-semibold">{t('capture.showGhost')}</span>
              </Space>
              <div className="flex flex-1 items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-[var(--mz-muted)]">
                  {t('capture.ghostOpacity')}
                </span>
                <Slider
                  className="!mb-0 flex-1"
                  min={0}
                  max={90}
                  value={ghostOpacity}
                  onChange={setGhostOpacity}
                  disabled={!showGhost}
                  aria-label={t('capture.ghostOpacity')}
                />
              </div>
              <Button
                type="primary"
                size="large"
                icon={<CameraOutlined />}
                onClick={() => void shoot()}
                disabled={processing}
              >
                {t('capture.shoot')}
              </Button>
            </div>
          ) : null}

          {cameraError ? (
            <Alert
              className="!mt-3"
              type="warning"
              showIcon
              title={t('capture.cameraDenied')}
              description={t('capture.permissionHelp')}
            />
          ) : null}
          {processError ? (
            <Alert className="!mt-3" type="error" showIcon title={t('errors.capture')} />
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void onFile(event)}
            aria-label={t('capture.chooseFile')}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {viewpoint.reference_photo_url ? (
              <Card size="small" className="!rounded-2xl" title={t('sidebar.reference')}>
                <img
                  src={viewpoint.reference_photo_url}
                  alt={t('sidebar.reference')}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
                {point.demo ? <Tag className="!mt-2">{t('capture.demoRef')}</Tag> : null}
              </Card>
            ) : (
              <Alert type="info" showIcon title={t('capture.noReference')} />
            )}
            <Card size="small" className="!rounded-2xl" title={t('capture.offTrail')}>
              <Paragraph className="!mb-0 !text-sm">{t('capture.fileHint')}</Paragraph>
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#081b18]">
            <img
              src={photo.previewUrl}
              alt={t('capture.preview')}
              className="h-full w-full object-cover"
            />
            {viewpoint.reference_photo_url && showGhost ? (
              <img
                src={viewpoint.reference_photo_url}
                alt={t('capture.alignSlider')}
                className="mz-ghost"
                style={{ opacity: ghostOpacity / 100 }}
              />
            ) : null}
            <div className="mz-frame" aria-hidden="true" />
            <div className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-bold text-white">
              {t('capture.preview')} · {photo.width}×{photo.height}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--mz-line)] bg-[var(--mz-surface)] p-3">
            <Space size={8} align="center">
              <Switch checked={showGhost} onChange={setShowGhost} aria-label={t('capture.alignSlider')} />
              <span className="text-sm font-semibold">{t('capture.showGhost')}</span>
            </Space>
            <div className="flex min-w-[160px] flex-1 items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-[var(--mz-muted)]">
                {t('capture.ghostOpacity')}
              </span>
              <Slider
                className="!mb-0 flex-1"
                min={0}
                max={90}
                value={ghostOpacity}
                onChange={setGhostOpacity}
                disabled={!showGhost}
                aria-label={t('capture.ghostOpacity')}
              />
            </div>
            <Button onClick={reset}>{t('capture.retake')}</Button>
          </div>

          <Card
            className="!mt-4 !rounded-2xl !border-[var(--mz-line)]"
            title={t('capture.tagsTitle')}
          >
            <Paragraph className="!mb-3 !text-sm !text-[var(--mz-muted)]">
              {t('capture.tagsBody')}
            </Paragraph>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold">
                {t('capture.tagWeather')}
                <Select<WeatherTag>
                  className="mt-1 w-full"
                  allowClear
                  placeholder={t('capture.tagsOptional')}
                  value={tags.weather}
                  onChange={(value) => setTags((current) => ({ ...current, weather: value }))}
                  options={WEATHER.map((value) => ({ value, label: t(`weather.${value}`) }))}
                />
              </label>
              <label className="text-sm font-semibold">
                {t('capture.tagVisibility')}
                <Select<VisibilityTag>
                  className="mt-1 w-full"
                  allowClear
                  placeholder={t('capture.tagsOptional')}
                  value={tags.visibility}
                  onChange={(value) => setTags((current) => ({ ...current, visibility: value }))}
                  options={VISIBILITY.map((value) => ({ value, label: t(`visibility.${value}`) }))}
                />
              </label>
              <label className="text-sm font-semibold">
                {t('capture.tagSnow')}
                <Select<SnowCoverTag>
                  className="mt-1 w-full"
                  allowClear
                  placeholder={t('capture.tagsOptional')}
                  value={tags.snow_cover}
                  onChange={(value) => setTags((current) => ({ ...current, snow_cover: value }))}
                  options={SNOW.map((value) => ({ value, label: t(`snow.${value}`) }))}
                />
              </label>
            </div>
          </Card>

          <Card
            className="!mt-4 !rounded-2xl !border-[var(--mz-line)]"
            title={t('capture.processTitle')}
          >
            <ul className="m-0 list-none space-y-2 p-0 text-sm">
              <li className="flex gap-2">
                <InfoCircleOutlined className="mt-1 text-[var(--mz-primary)]" aria-hidden="true" />
                <span>{t('capture.size', { kb: Math.round(photo.blob.size / 1024) })}</span>
              </li>
              <li className="flex gap-2">
                <InfoCircleOutlined className="mt-1 text-[var(--mz-primary)]" aria-hidden="true" />
                <span>{t('capture.privacy')}</span>
              </li>
              <li className="flex gap-2">
                <InfoCircleOutlined className="mt-1 text-[var(--mz-primary)]" aria-hidden="true" />
                <span>
                  {t('capture.faceBlur')}
                  {photo.facesBlurred > 0 ? ` · ${photo.facesBlurred}` : ''}
                </span>
              </li>
              <li className="flex gap-2 font-semibold text-[var(--mz-sun)]">
                <SafetyCertificateOutlined className="mt-1" aria-hidden="true" />
                <span>{t('capture.gpsWarning')}</span>
              </li>
            </ul>
            <Space wrap className="mt-4">
              <Button type="primary" size="large" loading={saving} onClick={() => void save()}>
                {saving ? t('capture.saving') : t('capture.save')}
              </Button>
              <Button size="large" onClick={reset}>
                {t('capture.retake')}
              </Button>
            </Space>
          </Card>

          {processError ? (
            <Alert className="!mt-3" type="error" showIcon title={t('errors.capture')} />
          ) : null}
        </>
      )}

      <Alert
        className="!mt-4"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        title={t('capture.gpsWarning')}
        description={t('capture.privacy')}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Tag>{localized(viewpoint.note_i18n, locale)}</Tag>
        <Link to="/queue">{t('capture.queueLink')}</Link>
      </div>
    </div>
  )
}
