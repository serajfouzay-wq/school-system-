/**
 * Draws an icon without needing a screen. Used when the Electron-rendered one
 * (which carries the school's initials) cannot be produced.
 *
 *   node scripts/icon-fallback.mjs brands/<school>.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPalette } from '../shared/palette.mjs'
import { roundedSquarePng } from './png.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/icon-fallback.mjs brands/<school>.json'); process.exit(1) }

const brand = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
const palette = buildPalette(brand.color)
const out = path.join(ROOT, 'build', 'icon.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, roundedSquarePng(palette[500], palette[700]))
console.log(`  icon:     plain mark in ${brand.color} (no screen available for the lettered one)`)
