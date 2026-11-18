import { PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Button, Slider, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/SettingsContext'
import { formatDateLong } from '../lib/format'
import type { Photo } from '../lib/types'

export function Timelapse({ photos }: { photos: Photo[] }) {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const ordered = useMemo(
    () => [...photos].sort((a, b) => a.taken_at.localeCompare(b.taken_at)),
    [photos],
  )
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing || ordered.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ordered.length)
    }, 1100)
    return () => window.clearInterval(timer)
  }, [playing, ordered.length])

  const current = ordered[index] ?? ordered[0]
  if (!current) return null

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-[#081b18]">
        <img
          src={current.url}
          alt={formatDateLong(current.taken_at, locale)}
          className="block aspect-[4/3] w-full object-cover"
        />
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-2 rounded-lg bg-black/65 px-2 py-1.5 text-xs font-semibold text-white">
          <span>{formatDateLong(current.taken_at, locale)}</span>
          <span className="ml-auto tabular-nums">
            {index + 1} / {ordered.length}
          </span>
        </div>
        {current.is_demo ? (
          <Tag color="gold" className="!absolute !left-2 !top-2 !m-0">
            {t('common.demo')}
          </Tag>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="primary"
          shape="circle"
          size="large"
          aria-label={playing ? t('sidebar.timelapsePause') : t('sidebar.timelapsePlay')}
          title={playing ? t('sidebar.timelapsePause') : t('sidebar.timelapsePlay')}
          onClick={() => setPlaying((value) => !value)}
          disabled={ordered.length < 2}
          icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        />
        <Slider
          className="!mb-0 flex-1"
          min={0}
          max={Math.max(0, ordered.length - 1)}
          value={index}
          onChange={(value) => {
            setPlaying(false)
            setIndex(value)
          }}
          tooltip={{ formatter: (value) => `#${(value ?? 0) + 1}` }}
          aria-label={t('sidebar.timelapse')}
        />
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--mz-sun)]">
        {t('sidebar.timelapseLabel')}
      </p>
    </div>
  )
}
