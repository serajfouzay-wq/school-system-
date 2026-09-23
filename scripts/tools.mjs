/**
 * The build's own tools, started directly rather than through npx.
 *
 * On Windows npx is `npx.cmd`, a batch file, and Node refuses to start batch
 * files without a shell (the fix for CVE-2024-27980). A shell would then split
 * a school called "Al Noor School System" into three arguments. Starting each
 * tool's JavaScript with this same Node, and Electron by its real path, needs
 * no shell at all, so the build behaves the same on Windows as anywhere else.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const SCRIPTS = {
  tsc: 'node_modules/typescript/bin/tsc',
  vite: 'node_modules/vite/bin/vite.js',
  'electron-builder': 'node_modules/electron-builder/cli.js',
}

/** Runs a Node script, or one of the tools above by name. */
export function node(script, args = [], options = {}) {
  const file = path.join(ROOT, SCRIPTS[script] ?? script)
  return execFileSync(process.execPath, [file, ...args], { cwd: ROOT, ...options })
}

/** Runs Electron itself: the electron package resolves to its executable. */
export function electron(args = [], options = {}) {
  return execFileSync(require('electron'), args, { cwd: ROOT, ...options })
}
