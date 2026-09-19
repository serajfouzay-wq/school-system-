/** Types for palette.mjs, which is plain JavaScript so both the build scripts
 *  (run by node) and the app (bundled by vite) can use the same maths. */

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

/** The eleven shades derived from one colour, keyed by step. */
export function buildPalette(base: string): Record<string, string>

/** WCAG contrast ratio between two hex colours. */
export function contrast(hexA: string, hexB: string): number

/** Readable text colour for a brand-coloured surface. */
export function foregroundFor(hex: string): string

/** "37 95 227" — the form a CSS variable needs for rgb(... / alpha). */
export function toRgbTriplet(hex: string): string

export function hexToRgb(hex: string): number[]
export function rgbToHex(rgb: number[]): string
