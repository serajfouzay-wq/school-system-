import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'

/**
 * A second, tiny bundle: the headless data builder. It is kept out of the main
 * config so nothing about the app's own build can be disturbed by it, and it
 * never ships — it runs on the machine making the package.
 */
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
    lib: { entry: 'electron/seed-cli.ts', formats: ['cjs'], fileName: () => 'seed-cli.js' },
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
