import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSettings } from '../context/SettingsContext'
import { formatDateOnly } from '../lib/format'
import type { Photo } from '../lib/types'

export interface CompareSliderProps {
  before: Photo
  after: Photo
}

export function CompareSlider({ before, after }: CompareSliderProps) {
  const { t } = useTranslation()
  const { locale } = useSettings()
  const [value, setValue] = useState(50)

  return (
    <div>
      <div className="mz-compare aspect-[4/3] w-full focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--mz-sun)]">
        <img
          src={after.url}
          alt={`${t('sidebar.after')} — ${formatDateOnly(after.taken_at, locale)}`}
          loading="lazy"
          draggable={false}
        />
        <div
          className="mz-compare__before"
          style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
        >
          <img
            src={before.url}
            alt={`${t('sidebar.before')} — ${formatDateOnly(before.taken_at, locale)}`}
            loading="lazy"
            draggable={false}
          />
        </div>
        <div className="mz-compare__divider" style={{ left: `${value}%` }} aria-hidden="true">
          <div className="mz-compare__handle">
            <span aria-hidden="true">↔</span>
          </div>
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-bold text-white">
          {formatDateOnly(before.taken_at, locale)}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-bold text-white">
          {formatDateOnly(after.taken_at, locale)}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-label={t('sidebar.compareHint')}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--mz-muted)]">{t('sidebar.compareHint')}</p>
    </div>
  )
}
