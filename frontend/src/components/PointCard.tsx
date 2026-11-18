import { ArrowRightOutlined, PictureOutlined, WarningOutlined } from '@ant-design/icons'
import { Tag } from 'antd'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/SettingsContext'
import { formatDateOnly, localized } from '../lib/format'
import type { MonitoringPoint } from '../lib/types'

export function PointCard({
  point,
  onOpen,
}: {
  point: MonitoringPoint
  onOpen: (slug: string) => void
}) {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const name = localized(point.name_i18n, locale, point.slug)

  return (
    <button
      type="button"
      data-testid="point-card"
      data-slug={point.slug}
      onClick={() => onOpen(point.slug)}
      className="group flex w-full items-stretch gap-3 rounded-2xl border border-[var(--mz-line)] bg-[var(--mz-surface)] p-2.5 text-left transition-colors hover:border-[var(--mz-primary)] hover:bg-[var(--mz-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mz-sun)]"
      aria-label={`${name} — ${t('sidebar.photoCount', { count: point.photo_count })}`}
    >
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--mz-surface-2)]">
        {point.latest_thumb_url ? (
          <img
            src={point.latest_thumb_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-2xl text-[var(--mz-muted)]">
            <PictureOutlined aria-hidden="true" />
          </div>
        )}
        {point.demo ? (
          <Tag color="gold" className="!absolute !left-1 !top-1 !m-0 !text-[10px]">
            {t('common.demo')}
          </Tag>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-1">
          <span className="line-clamp-2 text-sm font-bold leading-snug text-[var(--mz-ink)]">
            {name}
          </span>
          <ArrowRightOutlined
            aria-hidden="true"
            className="ml-auto mt-1 shrink-0 text-[var(--mz-muted)] transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Tag color={point.type === 'water' ? 'blue' : 'cyan'} className="!m-0 !text-[10px]">
            {t(`type.${point.type}`)}
          </Tag>
          {!point.coords_verified ? (
            <Tag icon={<WarningOutlined />} color="orange" className="!m-0 !text-[10px]">
              {t('common.unverified')}
            </Tag>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-[11px] text-[var(--mz-muted)]">
          <span>{t('sidebar.photoCount', { count: point.photo_count })}</span>
          {point.latest_photo_at ? (
            <span>· {formatDateOnly(point.latest_photo_at, locale)}</span>
          ) : null}
          {point.elevation_m ? <span>· {point.elevation_m} m</span> : null}
        </div>
      </div>
    </button>
  )
}
