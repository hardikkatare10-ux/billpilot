import { defineConfig } from 'vite'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Works in both native-ESM and bundled config loading (no __dirname needed)
const rootDir = path.dirname(fileURLToPath(import.meta.url))

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(rootDir, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, rootDir, '')
  const packageVersion = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version
  return ({
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __WINDOWS_INSTALLER_URL__: JSON.stringify(buildEnv.VITE_WINDOWS_INSTALLER_URL || ''),
    __WINDOWS_INSTALLER_SIZE__: JSON.stringify(buildEnv.VITE_WINDOWS_INSTALLER_SIZE || ''),
  },
  base: '/',
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      manifest: {
        name: 'DukanYantra',
        short_name: 'DukanYantra',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        lang: 'en-IN',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,avif,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname === 'identitytoolkit.googleapis.com' ||
              url.hostname === 'securetoken.googleapis.com' ||
              url.hostname === 'firestore.googleapis.com' ||
              url.hostname === 'firebasestorage.googleapis.com' ||
              url.hostname === 'firebaseinstallations.googleapis.com' ||
              url.hostname === 'storage.googleapis.com' ||
              url.hostname.endsWith('.firebaseio.com') ||
              url.hostname.endsWith('.firebasedatabase.app') ||
              url.hostname.endsWith('.firebaseapp.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  // No server proxy needed — auth is fully local (localStorage)
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    // Main bundle is ~1.9 MB (charts + inventory parser); raise the warning threshold
    chunkSizeWarningLimit: 2500,
  },
  })
})
