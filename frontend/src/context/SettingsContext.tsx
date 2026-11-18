import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import i18n, { currentLocale, LOCALE_STORAGE_KEY } from '../i18n'
import type { Locale, ThemeMode } from '../lib/types'

const THEME_KEY = 'muzdyq-theme'
const GREEN_KEY = 'muzdyq-green'

interface SettingsContextValue {
  theme: ThemeMode
  locale: Locale
  greenMode: boolean
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  setGreenMode: (enabled: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in strict private modes; the in-memory state
    // still works for the session.
  }
}

function initialTheme(): ThemeMode {
  const stored = readStored(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function initialGreenMode(): boolean {
  const stored = readStored(GREEN_KEY)
  return stored === null ? true : stored === '1'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme)
  const [locale, setLocaleState] = useState<Locale>(() => currentLocale())
  const [greenMode, setGreenState] = useState<boolean>(initialGreenMode)

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    writeStored(THEME_KEY, next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
      writeStored(THEME_KEY, next)
      return next
    })
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeStored(LOCALE_STORAGE_KEY, next)
    void i18n.changeLanguage(next)
  }, [])

  const setGreenMode = useCallback((enabled: boolean) => {
    setGreenState(enabled)
    writeStored(GREEN_KEY, enabled ? '1' : '0')
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#071613' : '#0f766e')
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.green = greenMode ? 'on' : 'off'
    root.lang = locale
  }, [greenMode, locale])

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      locale,
      greenMode,
      setTheme,
      toggleTheme,
      setLocale,
      setGreenMode,
    }),
    [theme, locale, greenMode, setTheme, toggleTheme, setLocale, setGreenMode],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
