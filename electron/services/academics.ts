import { getDb, softDelete } from '../db/index'
import type { Klass, Section, Subject, ExamTerm, TeacherAssignment } from '../../shared/types'
import { getSchool } from './school'

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

/* ---------- Classes ---------- */

export function listClasses(): Klass[] {
  return getDb()
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM sections s WHERE s.class_id = c.id AND s.deleted_at IS NULL) AS section_count,
         (SELECT COUNT(*) FROM students st
            JOIN sections s2 ON s2.id = st.section_id
           WHERE s2.class_id = c.id AND st.deleted_at IS NULL AND st.status = 'active') AS student_count
       FROM classes c
       WHERE c.deleted_at IS NULL
       ORDER BY c.grade_level, c.name`
    )
    .all() as Klass[]
}

export function saveClass(input: { id?: number; name: string; name_ar?: string | null; grade_level?: number }): Klass {
  const d = getDb()
  if (!input.name?.trim()) throw new Error('Please type a name for the class.')
  if (input.id) {
    d.prepare(`UPDATE classes SET name = ?, name_ar = ?, grade_level = ? WHERE id = ?`).run(
      input.name.trim(), input.name_ar ?? null, input.grade_level ?? 0, input.id
    )
    return listClasses().find((c) => c.id === input.id)!
  }
  const info = d
    .prepare(`INSERT INTO classes (school_id, name, name_ar, grade_level) VALUES (?, ?, ?, ?)`)
    .run(schoolId(), input.name.trim(), input.name_ar ?? null, input.grade_level ?? 0)
  return listClasses().find((c) => c.id === Number(info.lastInsertRowid))!
}

export function deleteClass(id: number, userId: number | null): void {
  const students = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM students st JOIN sections s ON s.id = st.section_id
        WHERE s.class_id = ? AND st.deleted_at IS NULL`
    )
    .get(id) as { n: number }
  if (students.n > 0) {
    throw new Error(`This class still has ${students.n} student(s). Move them to another class first.`)
  }
  const row = getDb().prepare(`SELECT name FROM classes WHERE id = ?`).get(id) as { name: string } | undefined
  softDelete('classes', id, row ? `${row.name} (class)` : `Class #${id}`, userId)
}

/* ---------- Sections ---------- */

export function listSections(classId?: number): Section[] {
  const where = classId ? 'AND s.class_id = @classId' : ''
  return getDb()
    .prepare(
      `SELECT s.*, c.name AS class_name, c.name_ar AS class_name_ar,
         st.full_name AS homeroom_name,
         (SELECT COUNT(*) FROM students x WHERE x.section_id = s.id AND x.deleted_at IS NULL AND x.status = 'active') AS student_count
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN staff st ON st.id = s.homeroom_staff_id
       WHERE s.deleted_at IS NULL AND c.deleted_at IS NULL ${where}
       ORDER BY c.grade_level, c.name, s.name`
    )
    .all({ classId: classId ?? null }) as Section[]
}

export function saveSection(input: {
  id?: number; class_id: number; name: string; name_ar?: string | null
  homeroom_staff_id?: number | null; capacity?: number | null
}): Section {
  const d = getDb()
  if (!input.name?.trim()) throw new Error('Please type a name for the section.')
  if (input.id) {
    d.prepare(
      `UPDATE sections SET class_id = ?, name = ?, name_ar = ?, homeroom_staff_id = ?, capacity = ? WHERE id = ?`
    ).run(input.class_id, input.name.trim(), input.name_ar ?? null, input.homeroom_staff_id ?? null, input.capacity ?? null, input.id)
    return listSections().find((s) => s.id === input.id)!
  }
  const info = d
    .prepare(`INSERT INTO sections (class_id, name, name_ar, homeroom_staff_id, capacity) VALUES (?, ?, ?, ?, ?)`)
    .run(input.class_id, input.name.trim(), input.name_ar ?? null, input.homeroom_staff_id ?? null, input.capacity ?? null)
  return listSections().find((s) => s.id === Number(info.lastInsertRowid))!
}

export function deleteSection(id: number, userId: number | null): void {
  const students = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM students WHERE section_id = ? AND deleted_at IS NULL`)
    .get(id) as { n: number }
  if (students.n > 0) throw new Error(`This section still has ${students.n} student(s). Move them first.`)
  const row = getDb()
    .prepare(`SELECT c.name AS c, s.name AS s FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`)
    .get(id) as { c: string; s: string } | undefined
  softDelete('sections', id, row ? `${row.c} - ${row.s} (section)` : `Section #${id}`, userId)
}

/* ---------- Subjects ---------- */

export function listSubjects(): Subject[] {
  return getDb()
    .prepare(`SELECT * FROM subjects WHERE deleted_at IS NULL ORDER BY name`)
    .all() as Subject[]
}

export function saveSubject(input: { id?: number; name: string; name_ar?: string | null; code?: string | null }): Subject {
  const d = getDb()
  if (!input.name?.trim()) throw new Error('Please type a name for the subject.')
  if (input.id) {
    d.prepare(`UPDATE subjects SET name = ?, name_ar = ?, code = ? WHERE id = ?`).run(
      input.name.trim(), input.name_ar ?? null, input.code ?? null, input.id
    )
    return listSubjects().find((s) => s.id === input.id)!
  }
  const info = d
    .prepare(`INSERT INTO subjects (school_id, name, name_ar, code) VALUES (?, ?, ?, ?)`)
    .run(schoolId(), input.name.trim(), input.name_ar ?? null, input.code ?? null)
  return listSubjects().find((s) => s.id === Number(info.lastInsertRowid))!
}

export function deleteSubject(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT name FROM subjects WHERE id = ?`).get(id) as { name: string } | undefined
  softDelete('subjects', id, row ? `${row.name} (subject)` : `Subject #${id}`, userId)
}

/* ---------- Exam terms ---------- */

export function listExamTerms(): ExamTerm[] {
  return getDb()
    .prepare(`SELECT * FROM exam_terms WHERE deleted_at IS NULL ORDER BY COALESCE(start_date, '9999'), id`)
    .all() as ExamTerm[]
}

export function saveExamTerm(input: {
  id?: number; name: string; name_ar?: string | null; start_date?: string | null; end_date?: string | null
}): ExamTerm {
  const d = getDb()
  if (!input.name?.trim()) throw new Error('Please type a name for the exam period.')
  if (input.id) {
    d.prepare(`UPDATE exam_terms SET name = ?, name_ar = ?, start_date = ?, end_date = ? WHERE id = ?`).run(
      input.name.trim(), input.name_ar ?? null, input.start_date ?? null, input.end_date ?? null, input.id
    )
    return listExamTerms().find((t) => t.id === input.id)!
  }
  const info = d
    .prepare(`INSERT INTO exam_terms (school_id, name, name_ar, start_date, end_date) VALUES (?, ?, ?, ?, ?)`)
    .run(schoolId(), input.name.trim(), input.name_ar ?? null, input.start_date ?? null, input.end_date ?? null)
  return listExamTerms().find((t) => t.id === Number(info.lastInsertRowid))!
}

export function deleteExamTerm(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT name FROM exam_terms WHERE id = ?`).get(id) as { name: string } | undefined
  softDelete('exam_terms', id, row ? `${row.name} (exam period)` : `Exam period #${id}`, userId)
}

/* ---------- Teacher assignments ---------- */

export function listAssignments(filter?: { staff_id?: number; section_id?: number }): TeacherAssignment[] {
  const clauses: string[] = ['ta.deleted_at IS NULL']
  if (filter?.staff_id) clauses.push('ta.staff_id = @staff_id')
  if (filter?.section_id) clauses.push('ta.section_id = @section_id')
  return getDb()
    .prepare(
      `SELECT ta.*, st.full_name AS staff_name, sub.name AS subject_name, sub.name_ar AS subject_name_ar,
              c.name || ' - ' || s.name AS section_label
         FROM teacher_assignments ta
         JOIN staff st ON st.id = ta.staff_id
         JOIN subjects sub ON sub.id = ta.subject_id
         JOIN sections s ON s.id = ta.section_id
         JOIN classes c ON c.id = s.class_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY c.grade_level, c.name, s.name, sub.name`
    )
    .all({ staff_id: filter?.staff_id ?? null, section_id: filter?.section_id ?? null }) as TeacherAssignment[]
}

export function saveAssignment(input: { staff_id: number; section_id: number; subject_id: number }): void {
  const d = getDb()
  const dup = d
    .prepare(
      `SELECT id FROM teacher_assignments
        WHERE section_id = ? AND subject_id = ? AND deleted_at IS NULL`
    )
    .get(input.section_id, input.subject_id) as { id: number } | undefined
  if (dup) {
    d.prepare(`UPDATE teacher_assignments SET staff_id = ? WHERE id = ?`).run(input.staff_id, dup.id)
    return
  }
  d.prepare(`INSERT INTO teacher_assignments (staff_id, section_id, subject_id) VALUES (?, ?, ?)`).run(
    input.staff_id, input.section_id, input.subject_id
  )
}

export function deleteAssignment(id: number, userId: number | null): void {
  softDelete('teacher_assignments', id, `Teaching assignment #${id}`, userId)
}
