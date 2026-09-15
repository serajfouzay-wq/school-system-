import { getDb } from '../db/index'
import type { GradingScale, ReportCardData, School } from '../../shared/types'
import { getSchool } from './school'

export interface GradeGridRow {
  student_id: number
  student_code: string
  full_name: string
  full_name_ar: string | null
  scores: Record<number, { score: number | null; max_score: number }>
  total: number
  maxTotal: number
  percent: number
  rank: number
}

/** The spreadsheet-like grid: one row per student, one column per subject. */
export function getGradeGrid(sectionId: number, termId: number): GradeGridRow[] {
  const d = getDb()
  const students = d
    .prepare(
      `SELECT id AS student_id, student_code, full_name, full_name_ar FROM students
        WHERE section_id = ? AND deleted_at IS NULL AND status = 'active' ORDER BY full_name`
    )
    .all(sectionId) as { student_id: number; student_code: string; full_name: string; full_name_ar: string | null }[]

  const grades = d
    .prepare(
      `SELECT g.student_id, g.subject_id, g.score, g.max_score
         FROM grades g JOIN students st ON st.id = g.student_id
        WHERE st.section_id = ? AND g.exam_term_id = ? AND g.deleted_at IS NULL`
    )
    .all(sectionId, termId) as { student_id: number; subject_id: number; score: number | null; max_score: number }[]

  const rows: GradeGridRow[] = students.map((s) => {
    const scores: GradeGridRow['scores'] = {}
    let total = 0
    let maxTotal = 0
    for (const g of grades.filter((x) => x.student_id === s.student_id)) {
      scores[g.subject_id] = { score: g.score, max_score: g.max_score }
      if (g.score !== null) { total += g.score; maxTotal += g.max_score }
    }
    return { ...s, scores, total, maxTotal, percent: maxTotal ? (total / maxTotal) * 100 : 0, rank: 0 }
  })

  // Rank within the class; equal percentages share a position.
  const sorted = [...rows].sort((a, b) => b.percent - a.percent)
  let lastPercent = Number.NaN
  let lastRank = 0
  sorted.forEach((r, i) => {
    if (r.percent !== lastPercent) { lastRank = i + 1; lastPercent = r.percent }
    r.rank = r.maxTotal ? lastRank : 0
  })
  return rows
}

export function saveGrades(
  termId: number,
  entries: { student_id: number; subject_id: number; score: number | null; max_score?: number }[]
): number {
  const d = getDb()
  const stmt = d.prepare(
    `INSERT INTO grades (student_id, subject_id, exam_term_id, score, max_score, updated_at)
     VALUES (@student_id, @subject_id, @exam_term_id, @score, @max_score, datetime('now'))
     ON CONFLICT(student_id, subject_id, exam_term_id) DO UPDATE SET
       score = excluded.score, max_score = excluded.max_score,
       updated_at = datetime('now'), deleted_at = NULL`
  )
  const tx = d.transaction((list: typeof entries) => {
    for (const e of list) {
      if (e.score !== null && (e.score < 0 || e.score > (e.max_score ?? 100))) {
        throw new Error(`A score must be between 0 and ${e.max_score ?? 100}.`)
      }
      stmt.run({
        student_id: e.student_id, subject_id: e.subject_id, exam_term_id: termId,
        score: e.score, max_score: e.max_score ?? 100,
      })
    }
  })
  tx(entries)
  return entries.length
}

/** Which subjects a section is actually taught, falling back to all subjects. */
export function subjectsForSection(sectionId: number) {
  const d = getDb()
  const assigned = d
    .prepare(
      `SELECT sub.id, sub.name, sub.name_ar FROM teacher_assignments ta
         JOIN subjects sub ON sub.id = ta.subject_id
        WHERE ta.section_id = ? AND ta.deleted_at IS NULL AND sub.deleted_at IS NULL
        ORDER BY sub.name`
    )
    .all(sectionId) as { id: number; name: string; name_ar: string | null }[]
  if (assigned.length) return assigned
  return d.prepare(`SELECT id, name, name_ar FROM subjects WHERE deleted_at IS NULL ORDER BY name`).all() as typeof assigned
}

export function gradeLabel(percent: number, scale: GradingScale): string {
  if (scale === 'letter') {
    if (percent >= 90) return 'A'
    if (percent >= 80) return 'B'
    if (percent >= 70) return 'C'
    if (percent >= 60) return 'D'
    return 'F'
  }
  if (scale === 'gpa') {
    if (percent >= 90) return '4.0'
    if (percent >= 80) return '3.0'
    if (percent >= 70) return '2.0'
    if (percent >= 60) return '1.0'
    return '0.0'
  }
  return `${percent.toFixed(1)}%`
}

export function saveTeacherRemarks(studentId: number, termId: number, remarks: string): void {
  getDb()
    .prepare(
      `INSERT INTO report_card_remarks (student_id, exam_term_id, remarks, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, exam_term_id) DO UPDATE SET remarks = excluded.remarks, updated_at = datetime('now')`
    )
    .run(studentId, termId, remarks)
}

export function getReportCard(studentId: number, termId: number): ReportCardData {
  const d = getDb()
  const school = getSchool()
  if (!school) throw new Error('Please finish the setup wizard first.')

  const student = d
    .prepare(
      `SELECT st.*, c.name AS class_name, c.name_ar AS class_name_ar, s.name AS section_name, s.name_ar AS section_name_ar
         FROM students st
         LEFT JOIN sections s ON s.id = st.section_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE st.id = ?`
    )
    .get(studentId) as ReportCardData['student'] | undefined
  if (!student) throw new Error('That student could not be found.')

  const term = d.prepare(`SELECT * FROM exam_terms WHERE id = ?`).get(termId) as ReportCardData['term'] | undefined
  if (!term) throw new Error('That exam period could not be found.')

  const rows = d
    .prepare(
      `SELECT sub.name AS subject, sub.name_ar AS subject_ar, g.score, g.max_score, g.remarks
         FROM grades g JOIN subjects sub ON sub.id = g.subject_id
        WHERE g.student_id = ? AND g.exam_term_id = ? AND g.deleted_at IS NULL
        ORDER BY sub.name`
    )
    .all(studentId, termId) as ReportCardData['rows']

  const total = rows.reduce((sum, r) => sum + (r.score ?? 0), 0)
  const maxTotal = rows.reduce((sum, r) => sum + (r.score !== null ? r.max_score : 0), 0)
  const percentage = maxTotal ? (total / maxTotal) * 100 : 0

  let rank = 0
  let classSize = 0
  if (student.section_id) {
    const grid = getGradeGrid(student.section_id, termId)
    classSize = grid.length
    rank = grid.find((g) => g.student_id === studentId)?.rank ?? 0
  }

  const att = d
    .prepare(
      `SELECT COUNT(*) AS total, SUM(status IN ('present','late')) AS here
         FROM attendance
        WHERE student_id = @studentId AND deleted_at IS NULL
          AND (@start IS NULL OR date >= @start) AND (@end IS NULL OR date <= @end)`
    )
    .get({ studentId, start: term.start_date, end: term.end_date }) as { total: number; here: number } | undefined

  const remarkRow = d
    .prepare(`SELECT remarks FROM report_card_remarks WHERE student_id = ? AND exam_term_id = ? AND deleted_at IS NULL`)
    .get(studentId, termId) as { remarks: string | null } | undefined

  return {
    school: school as School,
    student,
    term,
    rows,
    total,
    maxTotal,
    percentage,
    gradeLabel: gradeLabel(percentage, school.grading_scale),
    rank,
    classSize,
    attendancePercent: att?.total ? Math.round(((att.here || 0) / att.total) * 100) : 0,
    teacherRemarks: remarkRow?.remarks ?? null,
  }
}
