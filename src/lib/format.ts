import type { Language } from '@shared/types'

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/** Western Arabic numerals are the norm in Libya, so they stay the default;
 *  Eastern Arabic-Indic digits are opt-in from Settings. */
export function toNumerals(text: string | number, system: string): string {
  const s = String(text)
  if (system !== 'arabic_indic') return s
  return s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])
}

/**
 * Grouping is deliberately the same in both languages ("24,665", never
 * "24.665"): the ar-LY convention puts a dot where English speakers expect a
 * decimal point, and a misread fee amount is a real-world problem. The choice
 * of digit shapes stays with the user, via the numerals setting.
 */
export function formatNumber(value: number | null | undefined, _lang: Language, numerals = 'western'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return toNumerals(new Intl.NumberFormat('en-GB').format(value), numerals)
}

/** Percentages are shown to one decimal place; "78.667%" reads as noise. */
export function formatPercent(value: number | null | undefined, numerals = 'western'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  return `${toNumerals(new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(rounded), numerals)}%`
}

export function formatMoney(value: number | null | undefined, currency: string, _lang: Language, numerals = 'western'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const num = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
  return `${toNumerals(num, numerals)} ${currency}`
}

const HIJRI_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

/**
 * Dates are stored as plain ISO strings; only display is localised. Hijri is
 * offered because some Libyan schools reference both calendars.
 */
export function formatDate(
  iso: string | null | undefined,
  lang: Language,
  opts: { calendar?: string; numerals?: string; style?: 'short' | 'long' } = {}
): string {
  if (!iso) return '—'
  const date = new Date(`${iso.length <= 10 ? `${iso}T00:00:00` : iso}`)
  if (Number.isNaN(date.getTime())) return iso
  const calendar = opts.calendar === 'hijri' ? 'islamic-umalqura' : 'gregory'
  const key = `${lang}-${calendar}-${opts.style ?? 'short'}`
  let fmt = HIJRI_FORMATTERS.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(
      `${lang === 'ar' ? 'ar-LY' : 'en-GB'}-u-ca-${calendar}-nu-latn`,
      opts.style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' }
    )
    HIJRI_FORMATTERS.set(key, fmt)
  }
  return toNumerals(fmt.format(date), opts.numerals ?? 'western')
}

export function formatTime(time: string | null | undefined, numerals = 'western'): string {
  if (!time) return '—'
  return toNumerals(time, numerals)
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime()
  const b = new Date(`${toIso}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Prefer the Arabic name when the interface is in Arabic, but never show a
 *  blank cell just because the Arabic name was left empty. */
export function localName(
  record: { [k: string]: unknown } | null | undefined,
  lang: Language,
  base = 'name'
): string {
  if (!record) return ''
  const arabic = record[`${base}_ar`]
  const latin = record[base]
  if (lang === 'ar' && typeof arabic === 'string' && arabic.trim()) return arabic
  return typeof latin === 'string' ? latin : typeof arabic === 'string' ? arabic : ''
}

export function studentName(
  s: { full_name?: string; full_name_ar?: string | null } | null | undefined,
  lang: Language
): string {
  if (!s) return ''
  if (lang === 'ar' && s.full_name_ar?.trim()) return s.full_name_ar
  return s.full_name ?? s.full_name_ar ?? ''
}

export function classLabel(
  s: { class_name?: string; class_name_ar?: string | null; section_name?: string; section_name_ar?: string | null } | null | undefined,
  lang: Language
): string {
  if (!s?.class_name && !s?.class_name_ar) return ''
  const cls = lang === 'ar' && s.class_name_ar ? s.class_name_ar : s.class_name ?? ''
  const sec = lang === 'ar' && s.section_name_ar ? s.section_name_ar : s.section_name ?? ''
  return sec ? `${cls} - ${sec}` : cls
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}
