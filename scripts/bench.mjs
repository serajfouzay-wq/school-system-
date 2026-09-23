/**
 * Times the hot paths against a school the size a real one reaches.
 *
 *   npm run bench            2,000 students, a year of attendance
 *   npm run bench -- 5000    any size
 *
 * Written as a script rather than `TOOL=bench vite build && …` in package.json
 * because that prefix syntax does not work in the Windows command prompt.
 */
import { node, electron } from './tools.mjs'

const size = process.argv.find((a) => /^\d+$/.test(a)) ?? '2000'

node('vite', ['build', '--config', 'vite.seed.config.ts'], {
  stdio: 'ignore', env: { ...process.env, TOOL: 'bench' },
})
electron(['dist-electron/bench-cli.js', size, '--no-sandbox'], { stdio: 'inherit' })
