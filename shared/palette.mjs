/**
 * Turns one colour into the eleven shades the interface needs.
 *
 * The ramp is built in OKLCH rather than HSL: lightness there matches what the
 * eye actually sees, so the same recipe gives an even ramp for a blue, a green
 * and an orange alike. HSL does not — it would make yellow look washed out at
 * the same numbers that suit blue.
 */

/* ---------- sRGB <-> OKLab ---------- */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function hexToRgb(hex) {
  const clean = String(hex).trim().replace(/^#/, '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`"${hex}" is not a colour like #1f5ceb`)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
}

const rgbToHex = (rgb) =>
  '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')

function rgbToOklab([r, g, b]) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

const oklabToOklch = ([L, a, b]) => [L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI]
const oklchToOklab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]

const inGamut = (rgb) => rgb.every((c) => c >= -0.0001 && c <= 1.0001)

/** Pull chroma back until the colour is one a screen can actually show. */
function clampToGamut([L, C, h]) {
  let lo = 0, hi = C
  if (inGamut(oklabToRgb(oklchToOklab([L, C, h])))) return oklabToRgb(oklchToOklab([L, C, h]))
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklabToRgb(oklchToOklab([L, mid, h])))) lo = mid
    else hi = mid
  }
  return oklabToRgb(oklchToOklab([L, lo, h])).map((c) => Math.min(1, Math.max(0, c)))
}

/* ---------- Contrast, so the result is readable ---------- */

const relLuminance = ([r, g, b]) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

export function contrast(hexA, hexB) {
  const a = relLuminance(hexToRgb(hexA)), b = relLuminance(hexToRgb(hexB))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/* ---------- The ramp ---------- */

// Lightness for each step, and how much of the base colour's chroma to keep.
// The pale end loses chroma so it stays a tint rather than a wash of colour;
// the dark end loses a little so it does not turn muddy.
const STEPS = [
  { key: 50,  L: 0.972, c: 0.09 },
  { key: 100, L: 0.940, c: 0.18 },
  { key: 200, L: 0.888, c: 0.34 },
  { key: 300, L: 0.815, c: 0.55 },
  { key: 400, L: 0.724, c: 0.82 },
  { key: 500, L: 0.652, c: 0.98 },
  { key: 600, L: 0.578, c: 1.00 },
  { key: 700, L: 0.505, c: 0.94 },
  { key: 800, L: 0.443, c: 0.84 },
  { key: 900, L: 0.396, c: 0.74 },
  { key: 950, L: 0.276, c: 0.60 },
]

/**
 * `base` is the school's colour, treated as the 600 shade — the one on the
 * main buttons. Everything else is derived from its hue and chroma.
 *
 * The ramp is anchored rather than fixed. A school may pick a pale green or an
 * amber, and at the textbook lightness for a "600" white text on it would be
 * unreadable; the anchor is therefore pushed darker until white passes WCAG AA
 * (4.5:1). The pale and dark ends stay put and the rest is re-spaced between
 * them, so the ramp stays ordered and evenly stepped whatever colour goes in.
 */
export function buildPalette(base) {
  const [baseL, C, h] = oklabToOklch(rgbToOklab(hexToRgb(base)))
  const chroma = Math.min(Math.max(C, 0.04), 0.21)

  const shade = (L, c) => rgbToHex(clampToGamut([L, chroma * c, h]))
  const LIGHT_END = STEPS[0].L
  const DARK_END = STEPS[STEPS.length - 1].L
  const NOMINAL = STEPS.find((s) => s.key === 600).L

  // Start from the colour's own lightness so a deliberately dark or light
  // brand is not dragged to the middle, then darken until white text works.
  let anchor = Math.min(Math.max(baseL, 0.40), 0.64)
  const chromaAt600 = STEPS.find((s) => s.key === 600).c
  for (let i = 0; i < 40 && contrast(shade(anchor, chromaAt600), '#ffffff') < 4.5; i++) {
    anchor -= 0.01
    if (anchor <= DARK_END) { anchor = DARK_END; break }
  }

  // Re-space every other step around the anchor, keeping both ends fixed.
  const remap = (L) =>
    L >= NOMINAL
      ? anchor + ((L - NOMINAL) / (LIGHT_END - NOMINAL)) * (LIGHT_END - anchor)
      : DARK_END + ((L - DARK_END) / (NOMINAL - DARK_END)) * (anchor - DARK_END)

  const out = {}
  for (const { key, L, c } of STEPS) out[key] = shade(key === 600 ? anchor : remap(L), c)
  return out
}

/**
 * White text on a mid-tone button is the assumption throughout the interface.
 * For a pale or yellow-ish brand colour that assumption fails, so the palette
 * says which foreground to use and the interface follows it.
 */
export function foregroundFor(hex) {
  const onWhite = contrast(hex, '#ffffff')
  const onInk = contrast(hex, '#23272f')
  return onWhite >= 4.5 || onWhite >= onInk ? '#ffffff' : '#23272f'
}

export const toRgbTriplet = (hex) =>
  hexToRgb(hex).map((c) => Math.round(c * 255)).join(' ')

export { hexToRgb, rgbToHex }
