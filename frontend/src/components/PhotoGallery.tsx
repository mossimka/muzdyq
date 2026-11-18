import { Empty, Image, Tag } from 'antd'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/SettingsContext'
import { formatDateOnly } from '../lib/format'
import type { Photo, PhotoTags } from '../lib/types'

function PhotoTagsRow({ tags }: { tags: PhotoTags }) {
  const { t } = useTranslation()
  const chips: string[] = []
  if (tags.weather) chips.push(t(`weather.${tags.weather}`))
  if (tags.visibility) chips.push(t(`visibility.${tags.visibility}`))
  if (tags.snow_cover) chips.push(`${t('capture.tagSnow')}: ${t(`snow.${tags.snow_cover}`)}`)
  if (!chips.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <Tag key={chip} className="!m-0 !text-[11px]">
          {chip}
        </Tag>
      ))}
    </div>
  )
}

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const { t } = useTranslation()
  const { locale } = useSettings()

  if (!photos.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('gallery.empty')} />
  }

  return (
    <div>
      <Image.PreviewGroup
        preview={{ actionsRender: () => null }}
        items={photos.map((photo) => photo.url)}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="m-0 overflow-hidden rounded-xl border border-[var(--mz-line)] bg-[var(--mz-surface-2)]"
            >
              <div className="relative">
                <Image
                  src={photo.thumb_url}
                  alt={`${t('gallery.taken', {
                    date: formatDateOnly(photo.taken_at, locale),
                  })} — Muzdyq`}
                  width="100%"
                  height={116}
                  style={{ objectFit: 'cover', display: 'block' }}
                  preview={{ src: photo.url }}
                />
                {photo.is_demo ? (
                  <Tag color="gold" className="!absolute !left-1 !top-1 !m-0 !text-[10px]">
                    {t('common.demo')}
                  </Tag>
                ) : null}
              </div>
              <figcaption className="px-2 py-1.5">
                <div className="text-xs font-bold text-[var(--mz-ink)]">
                  {formatDateOnly(photo.taken_at, locale)}
                </div>
                <PhotoTagsRow tags={photo.tags} />
              </figcaption>
            </figure>
          ))}
        </div>
      </Image.PreviewGroup>
      <p className="mt-2 text-xs text-[var(--mz-muted)]">{t('gallery.attribution')}</p>
    </div>
  )
}
