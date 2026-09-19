import generated from '@/brand.generated'
import { buildPalette, foregroundFor, toRgbTriplet } from '@shared/palette.mjs'

/**
 * The school's colours, for the places Tailwind classes cannot reach: chart
 * libraries that want a colour string, and printed documents that are rendered
 * outside the app and cannot see its stylesheet.
 */
export { generated as brand }

/**
 * A shade as a CSS colour. Read from the live variable so it follows a colour
 * changed in Settings, and falls back to the built-in value when there is no
 * document to read — printing, or a test.
 */
export function brandColor(step: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 = 600): string {
  if (typeof document !== 'undefined') {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--brand-${step}`).trim()
    if (value) return `rgb(${value})`
  }
  return generated.palette[String(step)] ?? generated.color
}

/** The app's own name, as the school had it branded. */
export const appName = generated.appName

/** The name to show for the app in the given language. */
export function appNameFor(lang: 'en' | 'ar'): string {
  return (lang === 'ar' && generated.appNameAr) || generated.appName
}

/**
 * Repaints the interface in a colour chosen inside the app.
 *
 * The build ships with the colour from its brand file, which is what paints the
 * very first frame. A school that later picks a different one in Settings gets
 * it applied over the top here — so changing a colour never needs a new
 * installer, only a restart-free repaint.
 *
 * `null` puts the build's own colour back.
 */
export function applyBrandColor(color: string | null | undefined): void {
  const root = document.documentElement
  const palette = color ? safePalette(color) : generated.palette
  if (!palette) return
  for (const [step, hex] of Object.entries(palette)) {
    root.style.setProperty(`--brand-${step}`, toRgbTriplet(hex))
  }
  root.style.setProperty('--brand-fg', toRgbTriplet(foregroundFor(palette['600'])))
}

/** A colour typed by hand can be nonsense; a bad one leaves the app as it was. */
function safePalette(color: string): Record<string, string> | null {
  try {
    return buildPalette(color)
  } catch {
    return null
  }
}
