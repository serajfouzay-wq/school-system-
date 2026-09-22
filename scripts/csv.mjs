/**
 * A small CSV reader for the files a school hands over.
 *
 * Deliberately forgiving, because these arrive as exports from whatever the
 * office already uses: it copes with quoted fields, embedded commas and
 * newlines, semicolon separators, a UTF-8 byte-order mark, and Windows line
 * endings. Header names are matched loosely, so "Student Name", "student_name"
 * and "name" all land in the same place.
 */

export function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, '')
  // Whichever of comma or semicolon appears more often on the header line.
  const header = clean.slice(0, clean.indexOf('\n') + 1 || undefined)
  const sep = (header.match(/;/g) ?? []).length > (header.match(/,/g) ?? []).length ? ';' : ','

  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === sep) { row.push(field); field = ''; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    if (c === '\r') continue
    field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Letters and digits of any script: stripping to [a-z0-9] would erase an
// Arabic header completely and make every field match the first column.
const normalise = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Turns rows into objects keyed by the field names we understand.
 * `aliases` maps a field to the header spellings that mean it.
 */
export function readTable(text, aliases) {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const header = rows[0].map(normalise)
  const columnFor = {}
  for (const [field, spellings] of Object.entries(aliases)) {
    const idx = header.findIndex((h) => h !== '' && spellings.some((s) => normalise(s) === h))
    if (idx >= 0) columnFor[field] = idx
  }
  return rows.slice(1).map((r) => {
    const obj = {}
    for (const [field, idx] of Object.entries(columnFor)) {
      const value = (r[idx] ?? '').trim()
      if (value) obj[field] = value
    }
    return obj
  })
}

export const STUDENT_COLUMNS = {
  full_name: ['full name', 'name', 'student', 'student name', 'الاسم', 'اسم الطالب'],
  full_name_ar: ['name ar', 'arabic name', 'full name ar', 'الاسم بالعربية'],
  class: ['class', 'grade', 'year', 'الصف'],
  section: ['section', 'division', 'stream', 'الشعبة'],
  dob: ['dob', 'date of birth', 'birth date', 'تاريخ الميلاد'],
  gender: ['gender', 'sex', 'الجنس'],
  guardian_name: ['guardian', 'guardian name', 'parent', 'parent name', 'ولي الأمر'],
  guardian_phone: ['guardian phone', 'phone', 'mobile', 'parent phone', 'الهاتف'],
  guardian_address: ['address', 'guardian address', 'العنوان'],
  enrollment_date: ['enrollment date', 'enrolled', 'joined', 'تاريخ التسجيل'],
}

export const STAFF_COLUMNS = {
  full_name: ['full name', 'name', 'staff', 'teacher', 'الاسم'],
  full_name_ar: ['name ar', 'arabic name', 'الاسم بالعربية'],
  role: ['role', 'job', 'position', 'title', 'الوظيفة'],
  phone: ['phone', 'mobile', 'الهاتف'],
  email: ['email', 'البريد'],
  address: ['address', 'العنوان'],
  hire_date: ['hire date', 'joined', 'start date', 'تاريخ التعيين'],
}

export const CLASS_COLUMNS = {
  name: ['class', 'name', 'grade', 'الصف'],
  name_ar: ['name ar', 'arabic name', 'الصف بالعربية'],
  grade_level: ['level', 'grade level', 'order', 'المستوى'],
  sections: ['sections', 'divisions', 'الشعب'],
}

export const SUBJECT_COLUMNS = {
  name: ['subject', 'name', 'المادة'],
  name_ar: ['name ar', 'arabic name', 'المادة بالعربية'],
}
