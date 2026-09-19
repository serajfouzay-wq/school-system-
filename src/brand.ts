/**
 * What one school's branding looks like. The values themselves live in
 * `brand.generated.ts`, written by `scripts/brand.mjs` from a file in brands/.
 */
export interface Brand {
  id: string
  /** What the program calls itself: window title, installer, shortcut. */
  appName: string
  appNameAr: string | null
  /** The colour as the school gave it. */
  color: string
  /** The eleven shades derived from it. */
  palette: Record<string, string>
  /** Readable text on a brand-coloured surface. */
  foreground: string
  /** Pre-fills the setup wizard so nobody retypes what is already known. */
  school: {
    name?: string
    name_ar?: string
    address?: string
    phone?: string
    email?: string
    currency?: string
    country_code?: string
    language?: 'en' | 'ar'
    calendar_type?: string
    numeral_system?: string
    grading_scale?: string
  }
  /** Anything extra the school wanted staff to see on the Help screen. */
  notes: string | null
}
