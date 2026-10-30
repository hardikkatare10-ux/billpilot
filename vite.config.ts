import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  base: '/',
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
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
