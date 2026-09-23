/**
 * Times the hot paths against a school the size a real one reaches, rather
 * than the 180-student demo. Numbers from the demo hide everything that only
 * goes wrong at scale.
 *
 *   npx electron dist-electron/bench-cli.js [students]
 */
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getDb, closeDb } from './db/index'
import { saveSchool } from './services/school'
import { createUser } from './services/users'
import { dashboardSummary, globalSearch } from './services/dashboard'
import { feeBalances, financialSummary, listPayments, recordPayment, nextReceiptNo } from './services/fees'
import { getSectionAttendance, attendanceReport, getSectionAttendanceMonth, saveAttendance } from './services/attendance'
import { getGradeGrid, getReportCard } from './services/grades'
import { listStudents, getStudentProfile, saveStudent } from './services/students'
import * as whatsapp from './services/whatsapp'

const N = Number(process.argv.find((a) => /^\d+$/.test(a))) || 2000
const DAYS = 180
const SUBJECTS = 10
const TERMS = 3

function time<T>(label: string, fn: () => T, runs = 5): T {
  fn() // warm
  const samples: number[] = []
  let out!: T
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint()
    out = fn()
    samples.push(Number(process.hrtime.bigint() - t) / 1e6)
  }
  samples.sort((a, b) => a - b)
  const med = samples[Math.floor(samples.length / 2)]
  const flag = med > 100 ? '  <<< SLOW' : med > 30 ? '  < noticeable' : ''
  console.log(`  ${label.padEnd(46)} ${med.toFixed(1).padStart(8)} ms${flag}`)
  return out
}

app.whenReady().then(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'school-bench-'))
  app.setPath('userData', dir)
  const db = getDb()

  const t0 = Date.now()
  const year = new Date().getFullYear()
  saveSchool({ name: 'Bench School', setup_complete: 1, academic_year_start: `${year}-09-01`, academic_year_end: `${year + 1}-06-30` })
  createUser({ name: 'Owner', username: 'owner', pin: '0000', role: 'owner' })

  // Structure: 12 grades x 4 sections, 10 subjects, 3 terms.
  const sectionIds: number[] = []
  db.transaction(() => {
    const cls = db.prepare(`INSERT INTO classes (school_id, name, grade_level) VALUES (1, ?, ?)`)
    const sec = db.prepare(`INSERT INTO sections (class_id, name) VALUES (?, ?)`)
    for (let g = 1; g <= 12; g++) {
      const c = Number(cls.run(`Grade ${g}`, g).lastInsertRowid)
      for (const s of ['A', 'B', 'C', 'D']) sectionIds.push(Number(sec.run(c, s).lastInsertRowid))
    }
    const subj = db.prepare(`INSERT INTO subjects (school_id, name) VALUES (1, ?)`)
    for (let i = 1; i <= SUBJECTS; i++) subj.run(`Subject ${i}`)
    const term = db.prepare(`INSERT INTO exam_terms (school_id, name) VALUES (1, ?)`)
    for (let i = 1; i <= TERMS; i++) term.run(`Term ${i}`)
    // One tuition line per class, inserted in class order so its id matches the class id.
    db.prepare(`INSERT INTO fee_structures (school_id, class_id, item_name, amount) SELECT 1, id, 'Tuition', 3000 FROM classes ORDER BY id`).run()
  })()

  // Students through the real service, so codes and rules are genuine.
  const studentIds: number[] = []
  db.transaction(() => {
    for (let i = 0; i < N; i++) {
      const s = saveStudent({
        full_name: `Student ${i} Name${i % 97}`, full_name_ar: `طالب ${i}`,
        section_id: sectionIds[i % sectionIds.length], status: 'active',
        guardian_name: `Guardian ${i}`, guardian_phone: `09${String(10000000 + i)}`,
      })
      studentIds.push(s.id)
    }
  })()

  // A school year of attendance, bulk-inserted: N x DAYS rows.
  const start = new Date(`${year}-09-01`)
  const days: string[] = []
  for (let d = 0; days.length < DAYS; d++) {
    const dt = new Date(start); dt.setDate(dt.getDate() + d)
    if (dt.getDay() === 5 || dt.getDay() === 6) continue // Libyan weekend
    days.push(dt.toISOString().slice(0, 10))
  }
  db.transaction(() => {
    const ins = db.prepare(`INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)`)
    for (const day of days) for (const id of studentIds) ins.run(id, day, Math.random() < 0.93 ? 'present' : 'absent')
  })()

  db.transaction(() => {
    const ins = db.prepare(`INSERT INTO grades (student_id, subject_id, exam_term_id, score, max_score) VALUES (?, ?, ?, ?, 100)`)
    for (const id of studentIds) for (let s = 1; s <= SUBJECTS; s++) for (let t = 1; t <= TERMS; t++) ins.run(id, s, t, 40 + Math.floor(Math.random() * 60))
  })()

  db.transaction(() => {
    const ins = db.prepare(`INSERT INTO fee_payments (student_id, fee_structure_id, amount_paid, date, method, receipt_no) VALUES (?, ?, ?, ?, 'cash', ?)`)
    let r = 1
    studentIds.forEach((id, i) => {
      const cls = Math.floor((i % sectionIds.length) / 4) + 1
      for (let k = 0; k < 3; k++) if (Math.random() < 0.8) ins.run(id, cls, 800, days[k * 40], `R-${year}-${String(r++).padStart(6, '0')}`)
    })
  })()

  const count = (t: string) => (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n
  console.log(`\n  school: ${count('students')} students, ${count('attendance').toLocaleString()} attendance rows, ` +
    `${count('grades').toLocaleString()} grades, ${count('fee_payments').toLocaleString()} payments  (built in ${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  console.log(`  db size: ${(fs.statSync(path.join(dir, 'school_data.db')).size / 1048576).toFixed(1)} MB\n`)

  const section = sectionIds[5]
  const today = days[days.length - 1]
  const sid = studentIds[1234 % studentIds.length]

  console.log('  --- what opens every time the app starts ---')
  time('dashboard.summary', () => dashboardSummary())
  console.log('  --- daily clerk work ---')
  time('students.list (all)', () => listStudents({}))
  time('students.list (search "Name4")', () => listStudents({ search: 'Name4' }))
  time('search.global "Student 12"', () => globalSearch('Student 12'))
  time('attendance.section (one class, one day)', () => getSectionAttendance(section, today))
  time('attendance.sectionMonth', () => getSectionAttendanceMonth(section, today.slice(0, 7)))
  time('students.profile (one student)', () => getStudentProfile(sid))
  console.log('  --- teacher work ---')
  time('grades.grid (one class, one term)', () => getGradeGrid(section, 1))
  time('grades.reportCard (one student)', () => getReportCard(sid, 1))
  console.log('  --- office / accountant ---')
  time('fees.balances (whole school)', () => feeBalances({}))
  time('fees.financialSummary', () => financialSummary())
  time('fees.payments (list)', () => listPayments({}))
  time('whatsapp.feeDebtors (whole school)', () => whatsapp.feeDebtors(null))
  console.log('  --- reports ---')
  time('attendance.report (whole school, whole year)', () => attendanceReport({ from: days[0], to: today }), 3)
  console.log('  --- writes ---')
  time('attendance.save (a class of ~42)', () => saveAttendance(today, studentIds.filter((_, i) => i % sectionIds.length === 5).map((id) => ({ student_id: id, status: 'present' as const })), 1))
  time('nextReceiptNo', () => nextReceiptNo())
  time('fees.recordPayment', () => recordPayment({ student_id: sid, amount_paid: 1, date: today, method: 'cash' }, 1), 3)

  closeDb()
  // KEEP=<path> leaves the database behind for EXPLAIN QUERY PLAN work.
  if (process.env.KEEP) fs.copyFileSync(path.join(dir, 'school_data.db'), process.env.KEEP)
  fs.rmSync(dir, { recursive: true, force: true })
  app.exit(0)
})
