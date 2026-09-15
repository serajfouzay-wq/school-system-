import { getDb } from './index'
import { saveSchool, getSchool } from '../services/school'
import { createUser, countUsers } from '../services/users'
import { saveClass, saveSection, saveSubject, saveExamTerm, saveAssignment } from '../services/academics'
import { saveStudent } from '../services/students'
import { saveStaff } from '../services/staff'
import { saveAttendance } from '../services/attendance'
import { saveGrades, saveTeacherRemarks } from '../services/grades'
import { saveFeeStructure, recordPayment } from '../services/fees'
import { saveTimetableEntry, defaultPeriods } from '../services/timetable'
import { saveAnnouncement, saveEvent } from '../services/communication'

/** Names are given in both scripts so every screen can be checked in Arabic. */
const FIRST = [
  ['Maria', 'ماريا'], ['Ahmed', 'أحمد'], ['Fatima', 'فاطمة'], ['Omar', 'عمر'],
  ['Layla', 'ليلى'], ['Youssef', 'يوسف'], ['Aisha', 'عائشة'], ['Khaled', 'خالد'],
  ['Noor', 'نور'], ['Hassan', 'حسن'], ['Salma', 'سلمى'], ['Tariq', 'طارق'],
  ['Huda', 'هدى'], ['Bilal', 'بلال'], ['Rania', 'رانيا'], ['Idris', 'إدريس'],
  ['Zahra', 'زهراء'], ['Mustafa', 'مصطفى'], ['Amina', 'أمينة'], ['Sami', 'سامي'],
]
const LAST = [
  ['Santos', 'سانتوس'], ['Al-Mansouri', 'المنصوري'], ['Benali', 'بن علي'], ['Ibrahim', 'إبراهيم'],
  ['Al-Zawawi', 'الزواوي'], ['Gaddour', 'غدور'], ['Al-Fitouri', 'الفيتوري'], ['Shalabi', 'شلبي'],
  ['Abunawara', 'أبو نوارة', ], ['Elmahdi', 'المهدي'],
]

function rand(n: number): number { return Math.floor(Math.random() * n) }
function pick<T>(list: T[]): T { return list[rand(list.length)] }
function iso(d: Date): string { return d.toISOString().slice(0, 10) }

export function isSeeded(): boolean {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM students`).get() as { n: number }
  return row.n > 0
}

/**
 * A fictional demo school so every screen has something to show during
 * development and during a sales demo. Never runs over real data.
 */
export function seedDemoData(): void {
  if (isSeeded()) return
  const db = getDb()

  const now = new Date()
  const yearStart = `${now.getFullYear()}-09-01`
  const yearEnd = `${now.getFullYear() + 1}-06-30`

  if (!getSchool()) {
    saveSchool({
      name: 'Al Noor International School',
      name_ar: 'مدرسة النور الدولية',
      address: 'Tripoli, Libya',
      phone: '+218 91 234 5678',
      email: 'office@alnoor.example',
      academic_year_start: yearStart,
      academic_year_end: yearEnd,
      currency: 'LYD',
      language: 'en',
      grading_scale: 'percentage',
      setup_complete: 1,
    })
  }

  if (countUsers() === 0) {
    createUser({
      name: 'School Administrator', username: 'admin', pin: '1234', role: 'admin',
      security_question: 'What is the name of your first school?', security_answer: 'alnoor',
    })
    createUser({ name: 'Office Clerk', username: 'clerk', pin: '1111', role: 'registrar' })
    createUser({ name: 'Head Accountant', username: 'accounts', pin: '2222', role: 'accountant' })
  }

  const subjectNames: [string, string][] = [
    ['Arabic', 'اللغة العربية'], ['Mathematics', 'الرياضيات'], ['English', 'اللغة الإنجليزية'],
    ['Science', 'العلوم'], ['Islamic Studies', 'التربية الإسلامية'], ['Social Studies', 'الدراسات الاجتماعية'],
  ]
  const subjects = subjectNames.map(([name, name_ar]) => saveSubject({ name, name_ar }))

  const teacherNames: [string, string, string][] = [
    ['Nadia Hamad', 'نادية حمد', 'teacher'],
    ['Ali Barghathi', 'علي البرغثي', 'teacher'],
    ['Sarah Mahmoud', 'سارة محمود', 'teacher'],
    ['Mohamed Trabelsi', 'محمد الطرابلسي', 'teacher'],
    ['Fatima Zidan', 'فاطمة زيدان', 'teacher'],
    ['Yasin Kabir', 'ياسين كبير', 'teacher'],
    ['Huda Sadiq', 'هدى صادق', 'accountant'],
  ]
  const staffList = teacherNames.map(([full_name, full_name_ar, role]) =>
    saveStaff({
      full_name, full_name_ar, role,
      phone: `+218 9${rand(2) + 1} ${100 + rand(899)} ${1000 + rand(8999)}`,
      hire_date: iso(new Date(now.getFullYear() - rand(6) - 1, rand(12), rand(28) + 1)),
      salary: 1200 + rand(9) * 100,
      status: 'active',
    })
  )
  const teachers = staffList.filter((s) => s.role === 'teacher')

  const classSpecs: [string, string, number][] = [
    ['Grade 1', 'الصف الأول', 1], ['Grade 2', 'الصف الثاني', 2], ['Grade 3', 'الصف الثالث', 3],
    ['Grade 4', 'الصف الرابع', 4], ['Grade 5', 'الصف الخامس', 5],
  ]
  const sections: { id: number; class_id: number }[] = []
  for (const [name, name_ar, grade_level] of classSpecs) {
    const klass = saveClass({ name, name_ar, grade_level })
    for (const [sec, secAr] of [['A', 'أ'], ['B', 'ب']] as [string, string][]) {
      const section = saveSection({
        class_id: klass.id, name: sec, name_ar: secAr,
        homeroom_staff_id: pick(teachers).id, capacity: 30,
      })
      sections.push({ id: section.id, class_id: klass.id })
      for (const subject of subjects) {
        saveAssignment({ staff_id: pick(teachers).id, section_id: section.id, subject_id: subject.id })
      }
    }
  }

  // Students
  const students: { id: number; section_id: number }[] = []
  const gradeOfClass = new Map(classSpecs.map((c, i) => [i, c[2]]))
  const classIdOrder = [...new Set(sections.map((s) => s.class_id))]
  for (const section of sections) {
    // Age follows the grade, so the demo data reads as a real school would.
    const gradeLevel = gradeOfClass.get(classIdOrder.indexOf(section.class_id)) ?? 1
    const count = 14 + rand(8)
    for (let i = 0; i < count; i++) {
      const [fn, fnAr] = pick(FIRST)
      const [ln, lnAr] = pick(LAST)
      const s = saveStudent({
        full_name: `${fn} ${ln}`,
        full_name_ar: `${fnAr} ${lnAr}`,
        section_id: section.id,
        dob: iso(new Date(now.getFullYear() - (5 + gradeLevel) - rand(2), rand(12), rand(28) + 1)),
        gender: rand(2) ? 'male' : 'female',
        guardian_name: `${pick(FIRST)[0]} ${ln}`,
        guardian_phone: `+218 9${rand(2) + 1} ${100 + rand(899)} ${1000 + rand(8999)}`,
        guardian_address: 'Tripoli, Libya',
        enrollment_date: yearStart,
        status: 'active',
      })
      students.push({ id: s.id, section_id: section.id })
    }
  }

  // Attendance for the last 20 school days
  const marks: { date: string; entries: { student_id: number; status: 'present' | 'absent' | 'late' | 'excused' }[] }[] = []
  // Includes today, so the demo dashboard shows a real attendance figure
  // rather than the "not taken yet" prompt.
  for (let back = 20; back >= 0; back--) {
    const d = new Date(now)
    d.setDate(d.getDate() - back)
    if (d.getDay() === 5 || d.getDay() === 6) continue // Fri/Sat weekend
    marks.push({
      date: iso(d),
      entries: students.map((s) => {
        const r = Math.random()
        const status = r > 0.93 ? 'absent' : r > 0.88 ? 'late' : r > 0.86 ? 'excused' : 'present'
        return { student_id: s.id, status: status as 'present' }
      }),
    })
  }
  const attTx = db.transaction(() => { for (const m of marks) saveAttendance(m.date, m.entries, 1) })
  attTx()

  // Staff attendance for today
  db.prepare(
    `INSERT OR IGNORE INTO staff_attendance (staff_id, date, status, marked_by)
     SELECT id, date('now'), 'present', 1 FROM staff WHERE deleted_at IS NULL`
  ).run()

  // Exam terms and grades
  const midterm = saveExamTerm({
    name: 'Midterm', name_ar: 'نصف الفصل',
    start_date: `${now.getFullYear()}-11-01`, end_date: `${now.getFullYear()}-11-15`,
  })
  const final = saveExamTerm({
    name: 'Final', name_ar: 'نهاية الفصل',
    start_date: `${now.getFullYear() + 1}-05-15`, end_date: `${now.getFullYear() + 1}-06-01`,
  })
  const gradeTx = db.transaction(() => {
    for (const s of students) {
      const base = 55 + rand(40)
      saveGrades(midterm.id, subjects.map((sub) => ({
        student_id: s.id, subject_id: sub.id,
        score: Math.max(20, Math.min(100, base + rand(21) - 10)), max_score: 100,
      })))
      if (rand(3) === 0) saveTeacherRemarks(s.id, midterm.id, 'A pleasure to teach. Keep up the steady work.')
    }
  })
  gradeTx()
  void final

  // Fees
  const classIds = [...new Set(sections.map((s) => s.class_id))]
  for (const classId of classIds) {
    saveFeeStructure({ class_id: classId, term: 'Term 1', item_name: 'Tuition', item_name_ar: 'الرسوم الدراسية', amount: 900 })
    saveFeeStructure({ class_id: classId, term: 'Term 1', item_name: 'Books', item_name_ar: 'الكتب', amount: 120 })
  }
  saveFeeStructure({ class_id: null, term: 'Term 1', item_name: 'Registration', item_name_ar: 'رسوم التسجيل', amount: 75 })

  const payTx = db.transaction(() => {
    for (const s of students) {
      if (rand(10) < 2) continue // some families have not paid yet
      const d = new Date(now)
      d.setDate(d.getDate() - rand(60))
      recordPayment({
        student_id: s.id, amount_paid: [300, 500, 900, 1095][rand(4)],
        date: iso(d), method: (['cash', 'bank', 'card'] as const)[rand(3)],
      }, 1)
    }
  })
  payTx()

  // Timetable for the first four sections
  const periods = defaultPeriods()
  const ttTx = db.transaction(() => {
    for (const section of sections.slice(0, 4)) {
      for (let day = 0; day <= 4; day++) {
        periods.slice(0, 5).forEach((p, i) => {
          const subject = subjects[(day + i) % subjects.length]
          saveTimetableEntry({
            section_id: section.id, subject_id: subject.id,
            staff_id: teachers[(day + i) % teachers.length].id,
            day_of_week: day, start_time: p.start_time, end_time: p.end_time,
            room: `Room ${100 + ((day + i) % 12)}`,
          })
        })
      }
    }
  })
  ttTx()

  // Announcements and calendar
  saveAnnouncement({ title: 'Parent–teacher meeting on Thursday', body: 'All guardians are invited from 4pm to 6pm in the main hall.' }, 1)
  saveAnnouncement({ title: 'Midterm exams begin next month', body: 'The timetable will be sent home with every student.' }, 1)
  const soon = (days: number) => { const d = new Date(now); d.setDate(d.getDate() + days); return iso(d) }
  saveEvent({ title: 'Midterm exams', date: soon(21), end_date: soon(26), type: 'exam' })
  saveEvent({ title: 'National holiday', date: soon(9), type: 'holiday' })
  saveEvent({ title: 'Report cards due', date: soon(3), type: 'reminder' })
  saveEvent({ title: 'Sports day', date: soon(14), type: 'event' })
}
