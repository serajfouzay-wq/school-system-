/**
 * Draws the app icon for one school.
 *
 * If the brand file points at a logo, that image is used. Otherwise a mark is
 * drawn from the school's initials on the brand colour, so a brand file with
 * nothing but a name and a colour still produces a real icon rather than the
 * stock Electron one.
 *
 * Runs under Electron because that is the only image engine the project
 * already has — no extra dependency for a job done once per school.
 *
 *   npx electron scripts/make-icon.mjs brands/alnoor.json
 */
import { app, BrowserWindow, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPalette, foregroundFor } from '../shared/palette.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 512

/** Up to two letters: "Al Nahda Model School" -> "AN", "مدرسة النور" -> "من". */
function initials(name) {
  const words = String(name).trim().split(/\s+/).filter((w) => !/^(al|the|school|schools|مدرسة|مدارس)$/i.test(w))
  const pick = (words.length ? words : String(name).trim().split(/\s+/)).slice(0, 2)
  return pick.map((w) => [...w][0] ?? '').join('').toUpperCase() || 'S'
}

function markSvg(letters, palette, fg) {
  // A rounded square in the brand colour with the initials centred. The
  // gradient keeps it from looking flat at small sizes in the taskbar.
  const long = [...letters].length > 1
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Cairo'; src: url('${path.join(ROOT, 'src/assets/fonts/cairo-latin.woff2')}') format('woff2'); }
    @font-face { font-family: 'Cairo'; src: url('${path.join(ROOT, 'src/assets/fonts/cairo-arabic.woff2')}') format('woff2');
                 unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFC; }
    html, body { margin: 0; width: ${SIZE}px; height: ${SIZE}px; background: transparent; }
    .mark {
      width: ${SIZE}px; height: ${SIZE}px; border-radius: ${SIZE * 0.22}px;
      background: linear-gradient(145deg, ${palette[500]}, ${palette[700]});
      display: flex; align-items: center; justify-content: center;
      font-family: 'Cairo', sans-serif; font-weight: 800; color: ${fg};
      font-size: ${long ? SIZE * 0.36 : SIZE * 0.5}px; letter-spacing: -0.02em;
    }
  </style></head><body><div class="mark">${letters}</div></body></html>`
}

async function run() {
  const file = process.argv[2]
  if (!file) throw new Error('Usage: npx electron scripts/make-icon.mjs brands/<school>.json')
  const brand = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
  const out = path.join(ROOT, 'build/icon.png')

  await app.whenReady()

  if (brand.logo) {
    const source = path.resolve(ROOT, brand.logo)
    if (!fs.existsSync(source)) throw new Error(`Logo not found: ${source}`)
    const image = nativeImage.createFromPath(source)
    if (image.isEmpty()) throw new Error(`Could not read ${source} as an image`)
    // electron-builder needs at least 256x256 to make a Windows .ico.
    const sized = image.resize({ width: SIZE, height: SIZE, quality: 'best' })
    fs.writeFileSync(out, sized.toPNG())
    console.log(`  icon:     from ${brand.logo} (${SIZE}x${SIZE})`)
  } else {
    const palette = buildPalette(brand.color)
    const letters = initials(brand.school?.name || brand.appName)
    const win = new BrowserWindow({
      width: SIZE, height: SIZE, show: false, frame: false, transparent: true,
      webPreferences: { sandbox: false },
    })
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      markSvg(letters, palette, foregroundFor(palette[600]))
    ))
    await new Promise((r) => setTimeout(r, 600))
    const shot = await win.webContents.capturePage()
    fs.writeFileSync(out, shot.toPNG())
    win.destroy()
    console.log(`  icon:     drawn from "${letters}" on ${brand.color} (${SIZE}x${SIZE})`)
  }

  const written = nativeImage.createFromPath(out)
  if (written.isEmpty()) throw new Error('The icon came out empty')
  const { width, height } = written.getSize()
  if (width < 256 || height < 256) throw new Error(`Icon is ${width}x${height}; at least 256x256 is needed`)
  app.exit(0)
}

run().catch((e) => {
  console.error(`  icon FAILED: ${e.message}`)
  app.exit(1)
})
