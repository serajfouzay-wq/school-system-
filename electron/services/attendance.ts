import { getDb } from '../db/index'
import type { AttendanceStatus, StaffAttendanceStatus } from '../../shared/types'

export interface AttendanceRow {
  student_id: number
  student_code: string
  full_name: string
  full_name_ar: string | null
  photo_path: string | null
  status: AttendanceStatus | null
  note: string | null
}

/** The daily sheet: every student in the section, with whatever was already marked. */
export function getSectionAttendance(sectionId: number, date: string): AttendanceRow[] {
  return getDb()
    .prepare(
      `SELECT st.id AS student_id, st.student_code, st.full_name, st.full_name_ar, st.photo_path,
              a.status, a.note
         FROM students st
         LEFT JOIN attendance a ON a.student_id = st.id AND a.date = @date AND a.deleted_at IS NULL
        WHERE st.section_id = @sectionId AND st.deleted_at IS NULL AND st.status = 'active'
        ORDER BY st.full_name`
    )
    .all({ sectionId, date }) as AttendanceRow[]
}

export interface AttendanceMark { student_id: number; status: AttendanceStatus; note?: string | null }

export function saveAttendance(date: string, marks: AttendanceMark[], userId: number | null): number {
  const d = getDb()
  const stmt = d.prepare(
    `INSERT INTO attendance (student_id, date, status, note, marked_by)
     VALUES (@student_id, @date, @status, @note, @marked_by)
     ON CONFLICT(student_id, date) DO UPDATE SET
       status = excluded.status, note = excluded.note, marked_by = excluded.marked_by, deleted_at = NULL`
  )
  const tx = d.transaction((list: AttendanceMark[]) => {
    for (const m of list) {
      stmt.run({ student_id: m.student_id, date, status: m.status, note: m.note ?? null, marked_by: userId })
    }
  })
  tx(marks)
  return marks.length
}

/** Month view for the colour-coded calendar on a student's profile. */
export function getStudentAttendanceMonth(studentId: number, month: string): { date: string; status: AttendanceStatus }[] {
  return getDb()
    .prepare(
      `SELECT date, status FROM attendance
        WHERE student_id = ? AND deleted_at IS NULL AND date LIKE ? ORDER BY date`
    )
    .all(studentId, `${month}%`) as { date: string; status: AttendanceStatus }[]
}

export function getSectionAttendanceMonth(sectionId: number, month: string) {
  return getDb()
    .prepare(
      `SELECT a.date,
              SUM(a.status = 'present') AS present,
              SUM(a.status = 'absent') AS absent,
              SUM(a.status = 'late') AS late,
              SUM(a.status = 'excused') AS excused
         FROM attendance a
         JOIN students st ON st.id = a.student_id
        WHERE st.section_id = ? AND a.deleted_at IS NULL AND a.date LIKE ?
        GROUP BY a.date ORDER BY a.date`
    )
    .all(sectionId, `${month}%`) as { date: string; present: number; absent: number; late: number; excused: number }[]
}

export interface AttendanceReportRow {
  student_id: number
  student_code: string
  full_name: string
  full_name_ar: string | null
  class_label: string
  class_label_ar: string
  present: number
  absent: number
  late: number
  excused: number
  total: number
  percent: number
}

export function attendanceReport(opts: { from: string; to: string; sectionId?: number | null; classId?: number | null }): AttendanceReportRow[] {
  const clauses = ['st.deleted_at IS NULL', "st.status = 'active'"]
  if (opts.sectionId) clauses.push('st.section_id = @sectionId')
  if (opts.classId) clauses.push('sec.class_id = @classId')
  const rows = getDb()
    .prepare(
      `SELECT st.id AS student_id, st.student_code, st.full_name, st.full_name_ar,
              COALESCE(c.name || ' - ' || sec.name, '') AS class_label,
              COALESCE(COALESCE(c.name_ar, c.name) || ' - ' || COALESCE(sec.name_ar, sec.name), '') AS class_label_ar,
              COALESCE(SUM(a.status = 'present'), 0) AS present,
              COALESCE(SUM(a.status = 'absent'), 0) AS absent,
              COALESCE(SUM(a.status = 'late'), 0) AS late,
              COALESCE(SUM(a.status = 'excused'), 0) AS excused,
              COUNT(a.id) AS total
         FROM students st
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
         LEFT JOIN attendance a ON a.student_id = st.id AND a.deleted_at IS NULL
              AND a.date BETWEEN @from AND @to
        WHERE ${clauses.join(' AND ')}
        GROUP BY st.id
        ORDER BY c.grade_level, sec.name, st.full_name`
    )
    .all({ from: opts.from, to: opts.to, sectionId: opts.sectionId ?? null, classId: opts.classId ?? null }) as Omit<AttendanceReportRow, 'percent'>[]
  return rows.map((r) => ({ ...r, percent: r.total ? Math.round(((r.present + r.late) / r.total) * 100) : 0 }))
}

/* ---------- Staff attendance ---------- */

export function getStaffAttendance(date: string) {
  return getDb()
    .prepare(
      `SELECT s.id AS staff_id, s.staff_code, s.full_name, s.full_name_ar, s.role, a.status, a.note
         FROM staff s
         LEFT JOIN staff_attendance a ON a.staff_id = s.id AND a.date = @date AND a.deleted_at IS NULL
        WHERE s.deleted_at IS NULL AND s.status = 'active'
        ORDER BY s.full_name`
    )
    .all({ date }) as {
      staff_id: number; staff_code: string; full_name: string; full_name_ar: string | null
      role: string; status: StaffAttendanceStatus | null; note: string | null
    }[]
}

export function saveStaffAttendance(
  date: string,
  marks: { staff_id: number; status: StaffAttendanceStatus; note?: string | null }[],
  userId: number | null
): number {
  const d = getDb()
  const stmt = d.prepare(
    `INSERT INTO staff_attendance (staff_id, date, status, note, marked_by)
     VALUES (@staff_id, @date, @status, @note, @marked_by)
     ON CONFLICT(staff_id, date) DO UPDATE SET
       status = excluded.status, note = excluded.note, marked_by = excluded.marked_by, deleted_at = NULL`
  )
  const tx = d.transaction((list: typeof marks) => {
    for (const m of list) stmt.run({ staff_id: m.staff_id, date, status: m.status, note: m.note ?? null, marked_by: userId })
  })
  tx(marks)
  return marks.length
}
