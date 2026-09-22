/**
 * Dresses the app for one school.
 *
 * Everything that differs between schools lives in a single file under
 * brands/. This reads one and writes the generated pieces the build picks up:
 * the colour palette, the school's own details, the app's name, and its icon.
 * No source file is edited by hand for a new school, ever.
 *
 *   node scripts/brand.mjs brands/alnoor.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPalette, foregroundFor, toRgbTriplet, contrast } from '../shared/palette.mjs'
import { resolveModules, MODULE_NAMES } from '../shared/modules.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const GENERATED_NOTE = '/* Written by scripts/brand.mjs — do not edit by hand. */'

/* ---------------- Reading and checking the brand file ---------------- */

const REQUIRED = ['appName', 'color']

function loadBrand(file) {
  const full = path.resolve(ROOT, file)
  if (!fs.existsSync(full)) {
    throw new Error(`No brand file at ${full}\nCopy brands/example.json and edit it.`)
  }
  let brand
  try {
    brand = JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e.message}`)
  }
  const missing = REQUIRED.filter((k) => !brand[k])
  if (missing.length) throw new Error(`${file} is missing: ${missing.join(', ')}`)

  brand.id ||= String(brand.appName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  brand.school ||= {}
  // Dependencies are applied here, so what is written out is what the app will
  // actually do rather than what the file asked for.
  brand.modules = resolveModules(brand.modules)
  return { brand, full }
}

/* ---------------- The generated pieces ---------------- */

function writeCss(brand) {
  const palette = buildPalette(brand.color)
  const fg = foregroundFor(palette[600])
  const lines = Object.entries(palette).map(([step, hex]) => `  --brand-${step}: ${toRgbTriplet(hex)};`)
  lines.push(`  --brand-fg: ${toRgbTriplet(fg)};`)

  const css = `${GENERATED_NOTE}
/* ${brand.appName} — brand colour ${brand.color}
   White-on-600 contrast: ${contrast(palette[600], fg).toFixed(2)}:1 */
:root {
${lines.join('\n')}
}
`
  fs.writeFileSync(path.join(ROOT, 'src/brand.generated.css'), css)
  return { palette, fg }
}

function writeTs(brand, palette, fg) {
  const data = {
    id: brand.id,
    appName: brand.appName,
    appNameAr: brand.appNameAr ?? null,
    color: brand.color,
    palette,
    foreground: fg,
    school: brand.school,
    modules: brand.modules,
    notes: brand.notes ?? null,
  }
  fs.writeFileSync(
    path.join(ROOT, 'src/brand.generated.ts'),
    `${GENERATED_NOTE}\nimport type { Brand } from './brand'\n\n` +
      `const brand: Brand = ${JSON.stringify(data, null, 2)}\n\nexport default brand\n`
  )
  // The main process needs the name and the school's details too, and cannot
  // import from src/.
  fs.writeFileSync(
    path.join(ROOT, 'electron/brand.generated.json'),
    JSON.stringify(
      { id: brand.id, appName: brand.appName, color: brand.color, school: brand.school, modules: brand.modules },
      null,
      2
    ) + '\n'
  )
}

/* ---------------- Go ---------------- */

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/brand.mjs brands/<school>.json')
  process.exit(1)
}

const { brand } = loadBrand(file)
const { palette, fg } = writeCss(brand)
writeTs(brand, palette, fg)

const ratio = contrast(palette[600], fg)
console.log(`  brand:    ${brand.appName}`)
console.log(`  colour:   ${brand.color}  ->  600 = ${palette[600]}`)
console.log(`  text on it: ${fg} (${ratio.toFixed(2)}:1${ratio >= 4.5 ? ', readable' : ', TOO LOW'})`)
const off = MODULE_NAMES.filter((m) => !brand.modules[m])
console.log(`  modules:  ${off.length ? `all except ${off.join(', ')}` : 'all included'}`)
console.log(`  school:   ${brand.school.name ?? '(not set — the wizard will ask)'}${brand.school.name_ar ? ` / ${brand.school.name_ar}` : ''}`)
console.log(`  wrote:    src/brand.generated.css, src/brand.generated.ts,`)
console.log(`            electron/brand.generated.json`)
if (ratio < 4.5) {
  console.error('\n  Refusing to continue: text on the main buttons would be hard to read.')
  process.exit(1)
}
