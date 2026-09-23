/**
 * Times the hot paths against a school the size a real one reaches.
 *
 *   npm run bench            2,000 students, a year of attendance
 *   npm run bench -- 5000    any size
 *
 * Written as a script rather than `TOOL=bench vite build && …` in package.json
 * because that prefix syntax does not work in the Windows command prompt.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const size = process.argv.find((a) => /^\d+$/.test(a)) ?? '2000'

execFileSync(npx, ['vite', 'build', '--config', 'vite.seed.config.ts'], {
  cwd: ROOT, stdio: 'ignore', env: { ...process.env, TOOL: 'bench' },
})
execFileSync(npx, ['electron', 'dist-electron/bench-cli.js', size, '--no-sandbox'], { cwd: ROOT, stdio: 'inherit' })
