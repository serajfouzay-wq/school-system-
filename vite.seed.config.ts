import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'

/**
 * Bundles for the headless tools that run on the machine making a package:
 * the data builder (TOOL=seed, the default) and the benchmark (TOOL=bench).
 * Kept out of the main config so nothing about the app's own build can be
 * disturbed by them, and excluded from the package in electron-builder.yml.
 */
const TOOL = process.env.TOOL === 'bench' ? 'bench' : 'seed'
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    lib: { entry: `electron/${TOOL}-cli.ts`, formats: ['cjs'], fileName: () => `${TOOL}-cli.js` },
    rollupOptions: {
      // Both spellings: rollup treats `node:fs` and `fs` as different ids, and
      // bundling either one turns it into a stub that throws at run time.
      external: [
        'better-sqlite3', 'electron-updater', 'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
})
