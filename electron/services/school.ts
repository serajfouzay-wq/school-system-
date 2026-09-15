import { getDb, getSetting, setSetting } from '../db/index'
import type { School } from '../../shared/types'

export function getSchool(): School | null {
  const row = getDb().prepare(`SELECT * FROM schools WHERE deleted_at IS NULL ORDER BY id LIMIT 1`).get()
  return (row as School) ?? null
}

export function isSetupComplete(): boolean {
  const s = getSchool()
  return !!s && s.setup_complete === 1
}

export function saveSchool(patch: Partial<School>): School {
  const d = getDb()
  const existing = getSchool()
  const fields: (keyof School)[] = [
    'name', 'name_ar', 'logo_path', 'address', 'phone', 'email',
    'academic_year_start', 'academic_year_end', 'currency', 'language',
    'grading_scale', 'calendar_type', 'numeral_system', 'setup_complete',
  ]
  if (!existing) {
    d.prepare(
      `INSERT INTO schools (name, name_ar, logo_path, address, phone, email,
        academic_year_start, academic_year_end, currency, language,
        grading_scale, calendar_type, numeral_system, setup_complete)
       VALUES (@name, @name_ar, @logo_path, @address, @phone, @email,
        @academic_year_start, @academic_year_end, @currency, @language,
        @grading_scale, @calendar_type, @numeral_system, @setup_complete)`
    ).run({
      name: patch.name ?? 'My School',
      name_ar: patch.name_ar ?? null,
      logo_path: patch.logo_path ?? null,
      address: patch.address ?? null,
      phone: patch.phone ?? null,
      email: patch.email ?? null,
      academic_year_start: patch.academic_year_start ?? null,
      academic_year_end: patch.academic_year_end ?? null,
      currency: patch.currency ?? 'LYD',
      language: patch.language ?? 'en',
      grading_scale: patch.grading_scale ?? 'percentage',
      calendar_type: patch.calendar_type ?? 'gregorian',
      numeral_system: patch.numeral_system ?? 'western',
      setup_complete: patch.setup_complete ?? 0,
    })
  } else {
    const updates = fields.filter((f) => patch[f] !== undefined)
    if (updates.length) {
      const setClause = updates.map((f) => `${f} = @${f}`).join(', ')
      const params: Record<string, unknown> = { id: existing.id }
      for (const f of updates) params[f] = patch[f]
      d.prepare(`UPDATE schools SET ${setClause} WHERE id = @id`).run(params)
    }
  }
  return getSchool()!
}

/** Preferences that are per-installation rather than per-school. */
export function getPreferences(): Record<string, string> {
  const rows = getDb().prepare(`SELECT key, value FROM app_settings`).all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setPreference(key: string, value: string): void {
  setSetting(key, value)
}

export function getPreference(key: string): string | null {
  return getSetting(key)
}
