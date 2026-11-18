import { App as AntApp, ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import enUS from 'antd/locale/en_US'
import kkKZ from 'antd/locale/kk_KZ'
import ruRU from 'antd/locale/ru_RU'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { AboutPage } from './pages/AboutPage'
import { CapturePage } from './pages/CapturePage'
import { ContributePage } from './pages/ContributePage'
import { DataPage } from './pages/DataPage'
import { EthicsPage } from './pages/EthicsPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { QueuePage } from './pages/QueuePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

const ANTD_LOCALES = { en: enUS, ru: ruRU, kk: kkKZ }

function ThemedRoot() {
  const { theme, locale } = useSettings()

  const themeConfig = useMemo<ThemeConfig>(
    () => ({
      algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#0f766e',
        colorInfo: '#0f766e',
        colorSuccess: '#15803d',
        colorWarning: '#b45309',
        colorError: '#b42318',
        colorLink: theme === 'dark' ? '#5eead4' : '#0b5c56',
        borderRadius: 10,
        fontFamily:
          "'Inter var', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        colorBgBase: theme === 'dark' ? '#071613' : '#f3f7f5',
        colorTextBase: theme === 'dark' ? '#edf7f3' : '#0a2520',
        controlHeight: 40,
      },
      components: {
        Layout: {
          bodyBg: 'transparent',
          headerBg: 'transparent',
          footerBg: 'transparent',
          headerPadding: 0,
        },
        Button: { fontWeight: 600 },
        Card: { borderRadiusLG: 16 },
        Drawer: { colorBgElevated: theme === 'dark' ? '#0d2420' : '#ffffff' },
        Table: { headerBg: theme === 'dark' ? '#12312b' : '#eaf2ef' },
        Collapse: { headerBg: theme === 'dark' ? '#0d2420' : '#ffffff' },
        Alert: { borderRadiusLG: 14 },
      },
    }),
    [theme],
  )

  return (
    <ConfigProvider locale={ANTD_LOCALES[locale]} theme={themeConfig}>
      <AntApp component={false}>
        <QueryClientProvider client={queryClient}>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/ethics" element={<EthicsPage />} />
              <Route path="/contribute" element={<ContributePage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/p/:slug/:viewpointId" element={<CapturePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ThemedRoot />
    </SettingsProvider>
  )
}
