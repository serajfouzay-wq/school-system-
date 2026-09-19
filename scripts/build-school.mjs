/**
 * Builds the app for one school, start to finish.
 *
 *   npm run school -- brands/alnoor.json           just the branding + bundle
 *   npm run school -- brands/alnoor.json --win     ... and a Windows package
 *   npm run school -- brands/alnoor.json --linux
 *
 * Nothing in src/ or electron/ is edited for a new school. Copy
 * brands/example.json, change the name and the colour, run this.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('-'))
const targets = args.filter((a) => ['--win', '--mac', '--linux', '--dir'].includes(a))

if (!file) {
  console.error('Usage: npm run school -- brands/<school>.json [--win|--mac|--linux|--dir]')
  process.exit(1)
}

const run = (cmd, cmdArgs, label) => {
  try {
    execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' })
  } catch {
    console.error(`\n  Stopped: ${label} failed.`)
    process.exit(1)
  }
}

const brand = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
// Windows will not accept these in a file name, and the installer is named
// after the product.
const productName = String(brand.appName).replace(/[<>:"/\\|?*]/g, '').trim()
const appId = `com.schoolsystem.${String(brand.id ?? productName).toLowerCase().replace(/[^a-z0-9]/g, '')}`
// Linux names the binary after package.json unless told otherwise; Windows and
// macOS already follow productName.
const executableName = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

console.log(`\n== ${productName} ==\n`)

console.log('Step 1 of 4  branding')
run('node', ['scripts/brand.mjs', file], 'branding')

console.log('\nStep 2 of 4  icon')
run(npx, ['electron', 'scripts/make-icon.mjs', file, '--no-sandbox'], 'the icon')

console.log('\nStep 3 of 4  bundle')
run(npx, ['tsc', '--noEmit', '-p', 'tsconfig.json'], 'the typecheck')
run(npx, ['vite', 'build'], 'the bundle')

if (!targets.length) {
  console.log(`\nDone. Branded bundle ready. Add --win, --linux or --dir to make a package.\n`)
  process.exit(0)
}

console.log(`\nStep 4 of 4  package (${targets.join(' ')})`)
run(npx, [
  'electron-builder',
  ...targets,
  `-c.productName=${productName}`,
  `-c.appId=${appId}`,
  `-c.nsis.shortcutName=${productName}`,
  `-c.linux.executableName=${executableName}`,
], 'the package')

console.log(`\nDone. Look in release/ for "${productName}".\n`)
