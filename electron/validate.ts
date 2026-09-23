/**
 * The rules data must satisfy before it reaches the database.
 *
 * These are called from the services themselves rather than from the IPC
 * layer, because the dangerous input does not only arrive over IPC: a school's
 * spreadsheet goes through `importStudents` and the build-time seeder, and both
 * call the services directly. A check that lives only at the IPC boundary
 * never sees them.
 *
 * Two kinds of rule, deliberately different:
 *   - normalise where the meaning is clear: a spreadsheet saying "M", "Male"
 *     or "ذكر" means male, and refusing a 500-row import over it helps nobody;
 *   - refuse where it is not: an attendance mark of "hacked" has no meaning,
 *     and storing it would quietly corrupt every attendance percentage.
 */

export class ValidationError extends Error {}

const fail = (message: string): never => { throw new ValidationError(message) }

/* ---------------- dates ---------------- */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A real calendar date as YYYY-MM-DD. Dates are compared as text throughout,
 * so "2026-9-1" or "yesterday" would not just be wrong — they would sort into
 * the wrong place and fall out of every date-range report.
 */
export function isoDate(value: unknown, label: string): string {
  const s = String(value ?? '').trim()
  const m = ISO_DATE.exec(s)
  if (!m) fail(`${label} must be a date like 2026-09-01.`)
  const [y, mo, d] = [Number(m![1]), Number(m![2]), Number(m![3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  // 2026-02-31 passes the pattern; round-tripping through Date catches it.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    fail(`${label} is not a real date: ${s}.`)
  }
  if (y < 1900 || y > 2200) fail(`${label} is outside any sensible range: ${s}.`)
  return s
}

export const optionalDate = (value: unknown, label: string): string | null =>
  value === null || value === undefined || String(value).trim() === '' ? null : isoDate(value, label)

/* ---------------- money ---------------- */

/** Larger than any real school payment, far below where float sums misbehave. */
const MAX_AMOUNT = 10_000_000

/**
 * A payment amount. `Number("1e308")` is a perfectly valid number, and one
 * such row turns every financial total in the school into Infinity.
 */
export function amount(value: unknown, label = 'The amount'): number {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value)
  if (!Number.isFinite(n)) fail(`${label} must be a number.`)
  if (n <= 0) fail(`${label} must be greater than zero.`)
  if (n > MAX_AMOUNT) fail(`${label} is too large.`)
  // Money is kept to two decimal places, so 0.1 + 0.2 stays 0.3 in reports.
  return Math.round(n * 100) / 100
}

/* ---------------- choices ---------------- */

/** One of a fixed set, or refused. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const s = String(value ?? '').trim().toLowerCase()
  if (!(allowed as readonly string[]).includes(s)) fail(`${label} must be one of: ${allowed.join(', ')}.`)
  return s as T
}

export const ATTENDANCE = ['present', 'absent', 'late', 'excused'] as const
export const STAFF_ATTENDANCE = ['present', 'absent', 'late', 'leave'] as const
export const PAYMENT_METHODS = ['cash', 'bank', 'card', 'other'] as const

/**
 * Gender as the spreadsheets actually write it. Unclear values become null
 * rather than failing an import: a missing gender is harmless, a refused
 * import of a whole school is not.
 */
export function gender(value: unknown): 'male' | 'female' | null {
  const s = String(value ?? '').trim().toLowerCase()
  if (!s) return null
  if (['male', 'm', 'boy', 'ذكر', 'ولد', 'm.'].includes(s)) return 'male'
  if (['female', 'f', 'girl', 'أنثى', 'انثى', 'بنت', 'f.'].includes(s)) return 'female'
  return null
}

/** A payment method, defaulting to cash when none was given. */
export const paymentMethod = (value: unknown): (typeof PAYMENT_METHODS)[number] =>
  value === undefined || value === null || value === '' ? 'cash' : oneOf(value, PAYMENT_METHODS, 'The payment method')

/* ---------------- text and ids ---------------- */

/**
 * A name or other short text: trimmed, required, and bounded. Unbounded text
 * lets one pasted document fill a column the interface renders on every row.
 */
export function text(value: unknown, label: string, max = 200): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!s) fail(`Please type ${label.toLowerCase()}.`)
  if (s.length > max) fail(`${label} is too long (at most ${max} characters).`)
  return s
}

export const optionalText = (value: unknown, label: string, max = 500): string | null => {
  const s = String(value ?? '').trim()
  if (!s) return null
  if (s.length > max) fail(`${label} is too long (at most ${max} characters).`)
  return s
}

/** A row id: a positive whole number, never a string that merely looks like one. */
export function id(value: unknown, label: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) fail(`${label} is missing or not valid.`)
  return n
}

export const optionalId = (value: unknown, label: string): number | null =>
  value === null || value === undefined || value === '' ? null : id(value, label)

export const STUDENT_STATUS = ['active', 'inactive', 'graduated', 'transferred'] as const

/**
 * A date as a school's spreadsheet is likely to write it. Libyan offices
 * write 15/03/2015 far more often than 2015-03-15, and refusing that would
 * refuse the import. Anything understood becomes ISO; anything not becomes
 * null — a missing birthday is harmless, a garbled one sorts into nonsense.
 *
 * Only used for dates on a person (birth, enrolment). Dates that drive
 * reports — attendance, payments — use the strict `isoDate` instead.
 */
export function lenientDate(value: unknown): string | null {
  const s = String(value ?? '').trim()
  if (!s) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  // Day first, as written in Libya and most of the Arab world.
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null
  if (!parts) return null
  const candidate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  try {
    return isoDate(candidate, 'date')
  } catch {
    return null
  }
}
