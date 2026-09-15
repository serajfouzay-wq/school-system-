import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { builtinModules } from 'node:module'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'electron-updater', 'electron', ...builtinModules],
              // CommonJS keeps `__dirname` and `require()` working in both the
              // main process and the preload, on every Electron version.
              output: { format: 'cjs', entryFileNames: '[name].js' },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', ...builtinModules],
              output: { format: 'cjs', entryFileNames: '[name].js' },
            },
          },
        },
      },
    }),
    renderer(),
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
