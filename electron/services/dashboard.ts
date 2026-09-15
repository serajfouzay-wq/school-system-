import { getDb, today } from '../db/index'
import type { DashboardSummary, SearchHit } from '../../shared/types'
import { listAnnouncements, listEvents } from './communication'
import { financialSummary } from './fees'

export function dashboardSummary(): DashboardSummary {
  const d = getDb()
  const date = today()

  const totals = d
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM students WHERE deleted_at IS NULL AND status = 'active') AS students,
        (SELECT COUNT(*) FROM staff WHERE deleted_at IS NULL AND status = 'active') AS staff,
        (SELECT COUNT(*) FROM classes WHERE deleted_at IS NULL) AS classes`
    )
    .get() as { students: number; staff: number; classes: number }

  const att = d
    .prepare(
      // Every column is qualified: `status` exists on both attendance and
      // students, so an unqualified reference is ambiguous.
      `SELECT SUM(a.status = 'present') AS present, SUM(a.status = 'absent') AS absent,
              SUM(a.status = 'late') AS late, SUM(a.status = 'excused') AS excused, COUNT(*) AS marked
         FROM attendance a JOIN students st ON st.id = a.student_id
        WHERE a.date = ? AND a.deleted_at IS NULL AND st.deleted_at IS NULL
          AND st.status = 'active'`
    )
    .get(date) as { present: number; absent: number; late: number; excused: number; marked: number }

  const present = att.present || 0
  const late = att.late || 0
  const marked = att.marked || 0

  const trend = d
    .prepare(
      `SELECT date,
              ROUND(SUM(status IN ('present','late')) * 100.0 / COUNT(*), 0) AS percent
         FROM attendance WHERE deleted_at IS NULL
        GROUP BY date ORDER BY date DESC LIMIT 14`
    )
    .all() as { date: string; percent: number }[]

  const enrollment = d
    .prepare(
      `SELECT c.name, c.name_ar, COUNT(st.id) AS count
         FROM classes c
         LEFT JOIN sections s ON s.class_id = c.id AND s.deleted_at IS NULL
         LEFT JOIN students st ON st.section_id = s.id AND st.deleted_at IS NULL AND st.status = 'active'
        WHERE c.deleted_at IS NULL
        GROUP BY c.id ORDER BY c.grade_level, c.name`
    )
    .all() as { name: string; name_ar: string | null; count: number }[]

  const fin = financialSummary()

  return {
    totalStudents: totals.students,
    totalStaff: totals.staff,
    totalClasses: totals.classes,
    attendanceToday: {
      present,
      absent: att.absent || 0,
      late,
      excused: att.excused || 0,
      unmarked: Math.max(0, totals.students - marked),
      percent: marked ? Math.round(((present + late) / marked) * 100) : 0,
    },
    feesThisMonth: {
      collected: fin.collectedThisMonth,
      expectedTotal: fin.expectedTotal,
      outstanding: fin.outstandingTotal,
    },
    upcomingEvents: listEvents({ from: date }).slice(0, 6),
    recentAnnouncements: listAnnouncements(4),
    attendanceTrend: trend.reverse(),
    enrollmentByClass: enrollment,
  }
}

/** One search box for the whole app: students, staff, receipts and classes. */
export function globalSearch(query: string, limit = 20): SearchHit[] {
  const q = query.trim()
  if (q.length < 1) return []
  const like = `%${q}%`
  const d = getDb()
  const hits: SearchHit[] = []

  const students = d
    .prepare(
      `SELECT st.id, st.full_name, st.full_name_ar, st.student_code,
              COALESCE(c.name || ' - ' || s.name, '') AS label
         FROM students st
         LEFT JOIN sections s ON s.id = st.section_id
         LEFT JOIN classes c ON c.id = s.class_id
        WHERE st.deleted_at IS NULL
          AND (st.full_name LIKE ? OR st.full_name_ar LIKE ? OR st.student_code LIKE ? OR st.guardian_name LIKE ?)
        LIMIT ?`
    )
    .all(like, like, like, like, limit) as { id: number; full_name: string; full_name_ar: string | null; student_code: string; label: string }[]
  for (const s of students) {
    hits.push({ type: 'student', id: s.id, title: s.full_name_ar || s.full_name, subtitle: `${s.student_code} · ${s.label}` })
  }

  const staff = d
    .prepare(
      `SELECT id, full_name, full_name_ar, staff_code, role FROM staff
        WHERE deleted_at IS NULL AND (full_name LIKE ? OR full_name_ar LIKE ? OR staff_code LIKE ?) LIMIT ?`
    )
    .all(like, like, like, limit) as { id: number; full_name: string; full_name_ar: string | null; staff_code: string; role: string }[]
  for (const s of staff) {
    hits.push({ type: 'staff', id: s.id, title: s.full_name_ar || s.full_name, subtitle: `${s.staff_code} · ${s.role}` })
  }

  const payments = d
    .prepare(
      `SELECT p.id, p.receipt_no, p.amount_paid, p.date, st.full_name
         FROM fee_payments p JOIN students st ON st.id = p.student_id
        WHERE p.deleted_at IS NULL AND p.receipt_no LIKE ? LIMIT ?`
    )
    .all(like, limit) as { id: number; receipt_no: string; amount_paid: number; date: string; full_name: string }[]
  for (const p of payments) {
    hits.push({ type: 'payment', id: p.id, title: p.receipt_no, subtitle: `${p.full_name} · ${p.date}` })
  }

  const classes = d
    .prepare(`SELECT id, name, name_ar FROM classes WHERE deleted_at IS NULL AND (name LIKE ? OR name_ar LIKE ?) LIMIT ?`)
    .all(like, like, limit) as { id: number; name: string; name_ar: string | null }[]
  for (const c of classes) {
    hits.push({ type: 'class', id: c.id, title: c.name_ar || c.name, subtitle: 'Class' })
  }

  return hits.slice(0, limit)
}
