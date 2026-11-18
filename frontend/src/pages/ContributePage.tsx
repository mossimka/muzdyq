import {
  BookOutlined,
  CameraOutlined,
  CodeOutlined,
  DownloadOutlined,
  GithubOutlined,
  GlobalOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, QRCode, Select, Space, Spin, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useSettings } from '../context/SettingsContext'
import { getPoints } from '../lib/api'
import { localized } from '../lib/format'

const { Paragraph, Text, Title } = Typography

export function ContributePage() {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const pointsQuery = useQuery({ queryKey: ['points'], queryFn: ({ signal }) => getPoints(signal) })
  const points = useMemo(() => pointsQuery.data ?? [], [pointsQuery.data])

  const [slug, setSlug] = useState('')
  const [viewpointId, setViewpointId] = useState('')

  const point = points.find((item) => item.slug === slug) ?? points[0] ?? null
  const viewpoint =
    point?.viewpoints.find((item) => item.id === viewpointId) ?? point?.viewpoints[0] ?? null

  const captureUrl = useMemo(() => {
    if (!point || !viewpoint || typeof window === 'undefined') return ''
    return `${window.location.origin}/p/${point.slug}/${viewpoint.id}`
  }, [point, viewpoint])

  const steps = [t('contribute.step1'), t('contribute.step2'), t('contribute.step3'), t('contribute.step4')]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
      <Title level={1} className="!mb-2 !text-3xl sm:!text-4xl">
        {t('contribute.title')}
      </Title>
      <Paragraph className="!text-lg !text-[var(--mz-muted)]">{t('contribute.lead')}</Paragraph>

      <Alert
        className="!mb-6"
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        title={t('contribute.safetyTitle')}
        description={t('contribute.safetyBody')}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('contribute.stepsTitle')}>
          <ol className="m-0 list-none space-y-3 p-0">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--mz-primary-soft)] text-sm font-bold text-[var(--mz-primary-strong)]">
                  {index + 1}
                </span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ol>
          <Alert
            className="!mt-4"
            type="info"
            showIcon
            title={t('contribute.beforeTitle')}
            description={t('contribute.beforeBody')}
          />
          <Link to="/">
            <Button type="primary" size="large" icon={<CameraOutlined />} className="!mt-4">
              {t('hero.ctaExplore')}
            </Button>
          </Link>
        </Card>

        <Card
          className="!rounded-2xl !border-[var(--mz-line)] print:shadow-none"
          title={
            <span>
              <QrcodeOutlined aria-hidden="true" className="mr-2" />
              {t('contribute.standsTitle')}
            </span>
          }
        >
          <Paragraph className="!text-sm !text-[var(--mz-muted)]">{t('contribute.standsBody')}</Paragraph>
          {pointsQuery.isLoading ? (
            <div className="grid place-items-center py-8">
              <Spin />
            </div>
          ) : (
            <>
              <label className="text-sm font-semibold">
                {t('contribute.selectPoint')}
                <Select
                  className="mt-1 w-full"
                  value={point?.slug}
                  onChange={(value) => {
                    setSlug(value)
                    const next = points.find((item) => item.slug === value)
                    setViewpointId(next?.viewpoints[0]?.id ?? '')
                  }}
                  options={points.map((item) => ({
                    value: item.slug,
                    label: localized(item.name_i18n, locale, item.slug),
                  }))}
                />
              </label>
              <label className="mt-3 block text-sm font-semibold">
                {t('contribute.selectViewpoint')}
                <Select
                  className="mt-1 w-full"
                  value={viewpoint?.id}
                  onChange={setViewpointId}
                  options={(point?.viewpoints ?? []).map((item, index) => ({
                    value: item.id,
                    label: `${t('sidebar.viewpoint')} ${index + 1}${
                      item.heading_deg !== null ? ` · ${item.heading_deg}°` : ''
                    }`,
                  }))}
                />
              </label>

              {captureUrl ? (
                <div className="mt-4 flex flex-col items-center rounded-2xl border border-[var(--mz-line)] bg-white p-4">
                  <QRCode value={captureUrl} size={176} bordered={false} marginSize={1} />
                  <p className="mt-2 text-center text-xs text-[var(--mz-muted)]">
                    {t('contribute.qrCaption', { viewpoint: viewpoint?.id ?? '' })}
                  </p>
                </div>
              ) : null}

              <Space wrap className="mt-3">
                <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={!captureUrl}>
                  {t('contribute.standsTitle')}
                </Button>
                {captureUrl ? (
                  <Link to={`/p/${point?.slug}/${viewpoint?.id}`}>
                    <Button type="link" icon={<CameraOutlined />}>
                      {t('contribute.openCapture')}
                    </Button>
                  </Link>
                ) : null}
              </Space>
              <Paragraph className="!mb-0 !mt-2 !text-xs !text-[var(--mz-muted)]">
                {t('contribute.printHint')}
              </Paragraph>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('contribute.codeTitle')}>
          <Paragraph className="!text-sm">{t('contribute.codeBody')}</Paragraph>
          <Space wrap>
            <Tag icon={<CodeOutlined />}>MIT</Tag>
            <a
              href="https://github.com/muzdyq/muzdyq"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold"
            >
              <GithubOutlined aria-hidden="true" className="mr-1" />
              {t('contribute.repo')}
            </a>
          </Space>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('contribute.translateTitle')}>
          <Paragraph className="!text-sm">{t('contribute.translateBody')}</Paragraph>
          <Tag icon={<GlobalOutlined />}>EN · RU · KK</Tag>
        </Card>
        <Card className="!rounded-2xl !border-[var(--mz-line)]" title={t('contribute.dataTitle')}>
          <Paragraph className="!text-sm">{t('contribute.dataBody')}</Paragraph>
          <Space wrap>
            <Tag icon={<BookOutlined />}>{t('footer.data')}</Tag>
            <Link to="/data" className="text-sm font-semibold">
              <DownloadOutlined aria-hidden="true" className="mr-1" />
              {t('nav.data')}
            </Link>
          </Space>
        </Card>
      </div>

      <Alert
        className="!mt-4"
        type="info"
        showIcon
        title={t('contribute.contactTitle')}
        description={t('contribute.contactBody')}
      />
      <Text className="!mt-3 !block !text-xs !text-[var(--mz-muted)]">
        {t('contribute.noAccounts')} · {t('contribute.license')}
      </Text>
    </div>
  )
}
