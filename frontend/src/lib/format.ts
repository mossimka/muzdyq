import type { Locale, LocalizedText, PhotoTags } from './types'

const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  kk: 'kk-KZ',
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale]
}

export function localized(
  value: LocalizedText | null | undefined,
  locale: Locale,
  fallback = '',
): string {
  if (!value) return fallback
  return value[locale] ?? value.en ?? Object.values(value).find(Boolean) ?? fallback
}

export function formatDate(
  iso: string | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date)
}

export function formatDateOnly(iso: string | null | undefined, locale: Locale): string {
  return formatDate(iso, locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateLong(iso: string | null | undefined, locale: Locale): string {
  return formatDate(iso, locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatCoord(value: number): string {
  return value.toFixed(4)
}

export function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear()
}

export function tagList(tags: PhotoTags): string[] {
  const parts: string[] = []
  if (tags.weather) parts.push(tags.weather)
  if (tags.visibility) parts.push(tags.visibility)
  if (tags.snow_cover) parts.push(tags.snow_cover)
  return parts
}
