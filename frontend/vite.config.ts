import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const backend = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/media': { target: backend, changeOrigin: false },
      '/docs': { target: backend, changeOrigin: false },
      '/redoc': { target: backend, changeOrigin: false },
      '/openapi.json': { target: backend, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/media': { target: backend, changeOrigin: false },
      '/docs': { target: backend, changeOrigin: false },
      '/openapi.json': { target: backend, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design'))
            return 'antd'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next'))
            return 'i18n'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.{ts,tsx}'],
    },
  },
})
