import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import type { Locale } from '../lib/types'
import en from './locales/en.json'
import kk from './locales/kk.json'
import ru from './locales/ru.json'

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ru', 'kk']
export const LOCALE_STORAGE_KEY = 'muzdyq-lang'

export const resources = {
  en: { translation: en },
  ru: { translation: ru },
  kk: { translation: kk },
} as const

function normalizeLocale(value: string | undefined): Locale {
  const [base = 'en'] = (value ?? 'en').toLowerCase().split('-')
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en'
}

export function currentLocale(): Locale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
}

export function applyDocumentLanguage(locale: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLocale(locale)
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

i18n.on('languageChanged', applyDocumentLanguage)
applyDocumentLanguage(i18n.resolvedLanguage ?? 'en')

export default i18n
