import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '小树游戏屋',
        short_name: '游戏屋',
        description: '没有广告、可以离线玩的家庭小游戏。',
        theme_color: '#173f35',
        background_color: '#f8f1df',
        display: 'standalone',
        orientation: 'any',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2,mp3,m4a,wav}'],
        // 素材先优化再入包；不再通过放宽单文件上限绕过体积问题。
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        manifestTransforms: [async entries => {
          const bytes = entries.reduce((sum, entry) => sum + entry.size, 0)
          if (bytes > 32 * 1024 * 1024) {
            throw new Error(`Offline precache ${(bytes / 1024 / 1024).toFixed(2)} MiB exceeds 32 MiB; optimize assets before adding more.`)
          }
          return { manifest: entries, warnings: [] }
        }],
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
