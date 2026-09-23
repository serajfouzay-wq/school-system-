import fs from 'node:fs'
import path from 'node:path'
import { gender, lenientDate, oneOf, optionalId, optionalText, text, STUDENT_STATUS } from '../validate'
import { getDb, softDelete, filesDir, today } from '../db/index'
import type { Student, StudentProfile } from '../../shared/types'
import { getSchool } from './school'

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

/** Student IDs look like S-2026-0007 — readable, sortable, printable. */
export function nextStudentCode(): string {
  const year = new Date().getFullYear()
  const row = getDb()
    .prepare(`SELECT student_code FROM students WHERE student_code LIKE ? ORDER BY student_code DESC LIMIT 1`)
    .get(`S-${year}-%`) as { student_code: string } | undefined
  const n = row ? Number(row.student_code.split('-')[2]) + 1 : 1
  return `S-${year}-${String(n).padStart(4, '0')}`
}

const LIST_SELECT = `
  SELECT st.*, c.name AS class_name, c.name_ar AS class_name_ar,
         s.name AS section_name, s.name_ar AS section_name_ar
    FROM students st
    LEFT JOIN sections s ON s.id = st.section_id
    LEFT JOIN classes c ON c.id = s.class_id`

export interface StudentFilter {
  search?: string
  section_id?: number | null
  class_id?: number | null
  status?: string | null
}

export function listStudents(filter: StudentFilter = {}): Student[] {
  const clauses = ['st.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.search?.trim()) {
    // Arabic names live in full_name too, so a single LIKE across both name
    // columns plus the code is enough for the one top search box.
    clauses.push(`(st.full_name LIKE @q OR st.full_name_ar LIKE @q OR st.student_code LIKE @q OR st.guardian_name LIKE @q OR st.guardian_phone LIKE @q)`)
    params.q = `%${filter.search.trim()}%`
  }
  if (filter.section_id) { clauses.push('st.section_id = @section_id'); params.section_id = filter.section_id }
  if (filter.class_id) { clauses.push('s.class_id = @class_id'); params.class_id = filter.class_id }
  if (filter.status) { clauses.push('st.status = @status'); params.status = filter.status }
  return getDb()
    .prepare(`${LIST_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY c.grade_level, s.name, st.full_name`)
    .all(params) as Student[]
}

export function getStudent(id: number): Student | null {
  return (getDb().prepare(`${LIST_SELECT} WHERE st.id = ?`).get(id) as Student) ?? null
}

export type StudentInput = Partial<Omit<Student, 'id' | 'school_id' | 'created_at'>> & { id?: number; full_name: string }

export function saveStudent(input: StudentInput): Student {
  const d = getDb()
  // Every way a student arrives — the form, a spreadsheet import, a build
  // that ships with the school's data — comes through here, so this is where
  // the rules are applied.
  const fields = {
    section_id: optionalId(input.section_id, 'The class'),
    full_name: text(input.full_name, "The student's name"),
    full_name_ar: optionalText(input.full_name_ar, 'The Arabic name', 200),
    photo_path: input.photo_path ?? null,
    dob: lenientDate(input.dob),
    gender: gender(input.gender),
    guardian_name: optionalText(input.guardian_name, "The guardian's name", 200),
    guardian_phone: optionalText(input.guardian_phone, "The guardian's phone", 40),
    guardian_address: optionalText(input.guardian_address, 'The address'),
    emergency_contact: optionalText(input.emergency_contact, 'The emergency contact'),
    enrollment_date: lenientDate(input.enrollment_date) ?? today(),
    previous_school: optionalText(input.previous_school, 'The previous school', 200),
    medical_notes: optionalText(input.medical_notes, 'The medical notes', 2000),
    status: input.status ? oneOf(input.status, STUDENT_STATUS, "The student's status") : 'active',
  }
  if (input.id) {
    d.prepare(
      `UPDATE students SET section_id = @section_id, full_name = @full_name, full_name_ar = @full_name_ar,
        photo_path = @photo_path, dob = @dob, gender = @gender, guardian_name = @guardian_name,
        guardian_phone = @guardian_phone, guardian_address = @guardian_address,
        emergency_contact = @emergency_contact, enrollment_date = @enrollment_date,
        previous_school = @previous_school, medical_notes = @medical_notes, status = @status,
        updated_at = datetime('now')
       WHERE id = @id`
    ).run({ ...fields, id: input.id })
    return getStudent(input.id)!
  }
  const info = d
    .prepare(
      `INSERT INTO students (school_id, student_code, section_id, full_name, full_name_ar, photo_path,
        dob, gender, guardian_name, guardian_phone, guardian_address, emergency_contact,
        enrollment_date, previous_school, medical_notes, status)
       VALUES (@school_id, @student_code, @section_id, @full_name, @full_name_ar, @photo_path,
        @dob, @gender, @guardian_name, @guardian_phone, @guardian_address, @emergency_contact,
        @enrollment_date, @previous_school, @medical_notes, @status)`
    )
    .run({ ...fields, school_id: schoolId(), student_code: nextStudentCode() })
  return getStudent(Number(info.lastInsertRowid))!
}

export function deleteStudent(id: number, userId: number | null): void {
  const s = getStudent(id)
  softDelete('students', id, s ? `${s.full_name} (student)` : `Student #${id}`, userId)
}

export function setStudentStatus(id: number, status: Student['status']): Student {
  getDb().prepare(`UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
  return getStudent(id)!
}

/** Move a group of students to another section in one action. */
export function moveStudents(ids: number[], sectionId: number): number {
  const d = getDb()
  const stmt = d.prepare(`UPDATE students SET section_id = ?, updated_at = datetime('now') WHERE id = ?`)
  const tx = d.transaction((list: number[]) => { for (const id of list) stmt.run(sectionId, id) })
  tx(ids)
  return ids.length
}

/* ---------- Profile ---------- */

export function getStudentProfile(id: number): StudentProfile {
  const d = getDb()
  const student = getStudent(id)
  if (!student) throw new Error('That student could not be found.')

  const att = d
    .prepare(
      `SELECT
         SUM(status = 'present') AS present, SUM(status = 'absent') AS absent,
         SUM(status = 'late') AS late, SUM(status = 'excused') AS excused, COUNT(*) AS total
       FROM attendance WHERE student_id = ? AND deleted_at IS NULL`
    )
    .get(id) as { present: number; absent: number; late: number; excused: number; total: number }
  const counted = att.total || 0
  const attendance = {
    present: att.present || 0,
    absent: att.absent || 0,
    late: att.late || 0,
    excused: att.excused || 0,
    total: counted,
    percent: counted ? Math.round((((att.present || 0) + (att.late || 0)) / counted) * 100) : 0,
  }

  const gradeTrend = d
    .prepare(
      `SELECT t.name AS term, t.name_ar AS term_ar,
              ROUND(AVG(g.score * 100.0 / NULLIF(g.max_score, 0)), 1) AS average
         FROM grades g JOIN exam_terms t ON t.id = g.exam_term_id
        WHERE g.student_id = ? AND g.deleted_at IS NULL AND g.score IS NOT NULL
        GROUP BY t.id ORDER BY COALESCE(t.start_date, '9999'), t.id`
    )
    .all(id) as { term: string; term_ar: string | null; average: number }[]

  const billed = d
    .prepare(
      `SELECT COALESCE(SUM(f.amount), 0) AS total FROM fee_structures f
        WHERE f.deleted_at IS NULL
          AND (f.class_id IS NULL OR f.class_id = (SELECT class_id FROM sections WHERE id = ?))`
    )
    .get(student.section_id) as { total: number }
  const paid = d
    .prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM fee_payments WHERE student_id = ? AND deleted_at IS NULL`)
    .get(id) as { total: number }

  const notes = d
    .prepare(
      `SELECT n.id, n.body, n.created_at, u.name AS author_name
         FROM student_notes n LEFT JOIN users u ON u.id = n.created_by
        WHERE n.student_id = ? AND n.deleted_at IS NULL ORDER BY n.created_at DESC`
    )
    .all(id) as StudentProfile['notes']

  const documents = d
    .prepare(`SELECT id, title, file_path, uploaded_at FROM student_documents WHERE student_id = ? AND deleted_at IS NULL ORDER BY uploaded_at DESC`)
    .all(id) as StudentProfile['documents']

  return {
    student,
    attendance,
    gradeTrend,
    fees: { billed: billed.total, paid: paid.total, balance: billed.total - paid.total },
    notes,
    documents,
  }
}

export function addStudentNote(studentId: number, body: string, userId: number | null): void {
  if (!body.trim()) throw new Error('Please type the note first.')
  getDb().prepare(`INSERT INTO student_notes (student_id, body, created_by) VALUES (?, ?, ?)`).run(studentId, body.trim(), userId)
}

export function deleteStudentNote(id: number, userId: number | null): void {
  softDelete('student_notes', id, `Note #${id}`, userId)
}

/* ---------- Photos & documents ---------- */

/** Copy an image into the app's own folder so the record survives if the
 *  original file is moved or the USB stick is unplugged. */
export function saveStudentPhoto(sourcePath: string, studentCode: string): string {
  const ext = path.extname(sourcePath) || '.jpg'
  const dir = path.join(filesDir(), 'photos')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${studentCode}${ext}`)
  fs.copyFileSync(sourcePath, dest)
  return dest
}

export function addStudentDocument(studentId: number, title: string, sourcePath: string): void {
  const dir = path.join(filesDir(), 'documents', String(studentId))
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, path.basename(sourcePath))
  fs.copyFileSync(sourcePath, dest)
  getDb().prepare(`INSERT INTO student_documents (student_id, title, file_path) VALUES (?, ?, ?)`).run(
    studentId, title || path.basename(sourcePath), dest
  )
}

export function deleteStudentDocument(id: number, userId: number | null): void {
  softDelete('student_documents', id, `Document #${id}`, userId)
}

/* ---------- Bulk import ---------- */

export interface ImportMapping { [column: string]: string }

export interface ImportResult { added: number; skipped: number; errors: string[] }

/**
 * Import rows the user matched to fields in the "match your columns" wizard
 * step. Anything that fails is reported by row number rather than aborting the
 * whole import, so one bad row never costs the clerk the other 200.
 */
export function importStudents(rows: Record<string, string>[], mapping: ImportMapping, defaultSectionId: number | null): ImportResult {
  const result: ImportResult = { added: 0, skipped: 0, errors: [] }
  const d = getDb()
  const run = d.transaction(() => {
    rows.forEach((row, i) => {
      const get = (field: string): string | undefined => {
        const col = Object.keys(mapping).find((k) => mapping[k] === field)
        return col ? row[col]?.trim() : undefined
      }
      const name = get('full_name')
      if (!name) { result.skipped++; result.errors.push(`Row ${i + 2}: no student name`); return }
      try {
        saveStudent({
          full_name: name,
          full_name_ar: get('full_name_ar') ?? null,
          dob: get('dob') ?? null,
          gender: (get('gender') as Student['gender']) ?? null,
          guardian_name: get('guardian_name') ?? null,
          guardian_phone: get('guardian_phone') ?? null,
          guardian_address: get('guardian_address') ?? null,
          section_id: defaultSectionId,
          status: 'active',
        })
        result.added++
      } catch (e) {
        result.skipped++
        result.errors.push(`Row ${i + 2}: ${(e as Error).message}`)
      }
    })
  })
  run()
  return result
}
