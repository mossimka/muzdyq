import {
  Badge,
  Button,
  Drawer,
  Layout,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
  App as AntApp,
} from 'antd'
import {
  ArrowUpOutlined,
  CloudUploadOutlined,
  DisconnectOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { useSettings } from '../context/SettingsContext'
import { SYNC_EVENT, setupSync, type SyncResult } from '../lib/sync'
import { useOnlineStatus } from '../lib/network'
import { useQueue } from '../lib/useQueue'
import type { Locale } from '../lib/types'

const { Header, Content, Footer } = Layout

const NAV_ITEMS: Array<{ to: string; key: string; end?: boolean }> = [
  { to: '/', key: 'nav.map', end: true },
  { to: '/about', key: 'nav.about' },
  { to: '/data', key: 'nav.data' },
  { to: '/ethics', key: 'nav.ethics' },
  { to: '/contribute', key: 'nav.contribute' },
]

const LOCALES: Array<{ value: Locale; short: string }> = [
  { value: 'en', short: 'EN' },
  { value: 'ru', short: 'RU' },
  { value: 'kk', short: 'KK' },
]

function BrandMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-9 w-9 shrink-0 rounded-xl"
      role="presentation"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill="#0f766e" />
      <circle cx="48" cy="18" r="6" fill="#fbbf24" />
      <path d="M6 52 24 20l9 15 6-7 19 24Z" fill="#e8f7f3" />
      <path d="M24 20l9 15-6 3-3-5Z" fill="#9fe3d7" />
      <path d="M6 52h52L39 38l-7 8-8-4L6 52Z" fill="#062b27" />
    </svg>
  )
}

function SyncWatcher() {
  const { message } = AntApp.useApp()
  const { t } = useTranslation()

  useEffect(() => setupSync(), [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SyncResult>).detail
      if (detail?.uploaded) message.success(t('queue.syncDone'))
    }
    window.addEventListener(SYNC_EVENT, handler)
    return () => window.removeEventListener(SYNC_EVENT, handler)
  }, [message, t])

  return null
}

function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useSettings()
  const { t } = useTranslation()
  return (
    <Select<Locale>
      aria-label={t('common.language')}
      data-testid="lang-select"
      value={locale}
      onChange={setLocale}
      popupMatchSelectWidth={false}
      size={compact ? 'small' : 'middle'}
      style={{ width: compact ? 68 : 84 }}
      options={LOCALES.map((item) => ({
        value: item.value,
        label: item.short,
        title: t(`locale.${item.value}`),
      }))}
      title={t('common.language')}
    />
  )
}

function GreenModeSwitch({ withLabel = false }: { withLabel?: boolean }) {
  const { greenMode, setGreenMode } = useSettings()
  const { t } = useTranslation()
  return (
    <Space size={6} align="center">
      <ThunderboltOutlined aria-hidden="true" className="text-[var(--mz-primary)]" />
      {withLabel ? (
        <span className="hidden text-sm text-[var(--mz-muted)] xl:inline">
          {t('common.greenMode')}
        </span>
      ) : null}
      <Switch
        size="small"
        checked={greenMode}
        onChange={setGreenMode}
        aria-label={t('common.greenMode')}
        title={greenMode ? t('common.greenOn') : t('common.greenOff')}
      />
    </Space>
  )
}

function HeaderBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { theme, toggleTheme } = useSettings()
  const { t } = useTranslation()
  const queue = useQueue()
  const queued = queue.items.length

  return (
    <Header className="mz-header">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Link
          to="/"
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl font-bold no-underline"
          aria-label={t('nav.home')}
        >
          <BrandMark />
          <span className="font-display text-xl leading-none text-[var(--mz-ink)]">Muzdyq</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label={t('nav.menu')}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors ${
                  isActive
                    ? 'bg-[var(--mz-primary-soft)] text-[var(--mz-primary-strong)]'
                    : 'text-[var(--mz-muted)] hover:bg-[var(--mz-surface-2)] hover:text-[var(--mz-ink)]'
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Green mode has its own control in the mobile menu, so the header
              can drop it below sm and keep a 360 px layout free of overflow. */}
          <div className="hidden sm:block">
            <GreenModeSwitch withLabel />
          </div>
          <LanguageSwitcher compact />
          <Tooltip title={theme === 'dark' ? t('common.light') : t('common.dark')}>
            <Button
              type="text"
              shape="circle"
              aria-label={theme === 'dark' ? t('common.light') : t('common.dark')}
              onClick={toggleTheme}
              icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            />
          </Tooltip>
          <Tooltip title={t('queue.open')}>
            <Link
              to="/queue"
              aria-label={t('queue.open')}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg text-[var(--mz-ink)]"
            >
              <Badge count={queued} size="small" offset={[2, -2]}>
                <CloudUploadOutlined />
              </Badge>
            </Link>
          </Tooltip>
          <Button
            type="text"
            shape="circle"
            className="md:hidden"
            aria-label={t('nav.menu')}
            onClick={onOpenMenu}
            icon={<MenuOutlined />}
          />
        </div>
      </div>
    </Header>
  )
}

function OfflineBar() {
  const online = useOnlineStatus()
  const { t } = useTranslation()
  if (online) return null
  return (
    <div
      role="status"
      className="border-y border-[var(--mz-line)] bg-[var(--mz-sun-soft)] px-4 py-2 text-center text-sm font-semibold text-[var(--mz-ink)]"
    >
      <DisconnectOutlined aria-hidden="true" className="mr-2" />
      {t('common.offline')} — {t('map.offlineOnly')}
    </div>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={300}
      title={t('nav.menu')}
      styles={{ body: { padding: 16 } }}
    >
      <nav className="flex flex-col gap-1" aria-label={t('nav.menu')}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `min-h-11 rounded-xl px-3 py-3 text-base font-semibold no-underline ${
                isActive
                  ? 'bg-[var(--mz-primary-soft)] text-[var(--mz-primary-strong)]'
                  : 'text-[var(--mz-ink)] hover:bg-[var(--mz-surface-2)]'
              }`
            }
          >
            {t(item.key)}
          </NavLink>
        ))}
        <NavLink
          to="/queue"
          onClick={onClose}
          className="min-h-11 rounded-xl px-3 py-3 text-base font-semibold text-[var(--mz-ink)] no-underline hover:bg-[var(--mz-surface-2)]"
        >
          {t('queue.open')}
        </NavLink>
      </nav>
      <div className="mt-5 border-t border-[var(--mz-line)] pt-5">
        <Space size={10} align="center">
          <GreenModeSwitch withLabel />
        </Space>
        <p className="mt-2 text-sm text-[var(--mz-muted)]">{t('map.greenHint')}</p>
      </div>
    </Drawer>
  )
}

function SiteFooter() {
  const { t } = useTranslation()
  return (
    <Footer className="mt-10 border-t border-[var(--mz-line)] bg-[var(--mz-surface)] px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="font-display text-xl font-bold text-[var(--mz-ink)]">Muzdyq</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-[var(--mz-muted)]">{t('footer.tagline')}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--mz-muted)]">
            {t('footer.noTracking')}
          </p>
        </div>
        <nav aria-label={t('footer.docs')} className="flex flex-col gap-2 text-sm">
          <Link to="/data" className="font-semibold no-underline">
            {t('footer.data')} · {t('common.license')}
          </Link>
          <Link to="/ethics" className="font-semibold no-underline">
            {t('footer.privacy')}
          </Link>
          <Link to="/contribute" className="font-semibold no-underline">
            {t('footer.safety')}
          </Link>
          <a
            href="/docs"
            className="font-semibold no-underline"
            target="_blank"
            rel="noreferrer"
          >
            {t('footer.docs')}
          </a>
        </nav>
        <div className="text-sm text-[var(--mz-muted)]">
          <p className="font-semibold text-[var(--mz-ink)]">{t('footer.madeWith')}</p>
          <p className="mt-2">{t('contribute.license')}</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-[var(--mz-primary-strong)]"
          >
            <ArrowUpOutlined aria-hidden="true" /> {t('footer.backToTop')}
          </button>
        </div>
      </div>
      <Typography.Paragraph className="mx-auto mt-6 max-w-7xl !mb-0 !text-xs !text-[var(--mz-muted)]">
        {t('sidebar.disclaimer')}
      </Typography.Paragraph>
    </Footer>
  )
}

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])
  return null
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <Layout className="min-h-screen !bg-[var(--mz-bg)]">
      <a href="#main" className="skip-link">
        {t('nav.skip')}
      </a>
      <SyncWatcher />
      <ScrollToTop />
      <HeaderBar onOpenMenu={() => setMenuOpen(true)} />
      <OfflineBar />
      <Content id="main" tabIndex={-1} className="min-h-[60vh] outline-none">
        {children}
      </Content>
      <SiteFooter />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </Layout>
  )
}
