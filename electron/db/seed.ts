import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
import { saveExam, saveQuestion } from '../services/exams'
import { saveBook, borrow, returnBook, attachFile } from '../services/library'
import { saveRoute, addRider, recordPayment as recordBusPayment } from '../services/transport'

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

/**
 * A real, readable PDF so the demo's "read it on a phone" shelf is not empty.
 * Written by hand rather than generated, because seeding must not need a
 * browser window — it is one page of Helvetica, which every reader has.
 */
function demoBookPdf(title: string, lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/([\\\\()])/g, '\\$1')
  const text =
    `BT /F1 20 Tf 62 760 Td (${esc(title)}) Tj ET\n` +
    lines
      .map((line, i) => `BT /F1 12 Tf 62 ${716 - i * 20} Td (${esc(line)}) Tj ET`)
      .join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

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
    // The owner is the school's own account and outranks everyone. It is
    // created first, then stands as the author of the rest — nobody is signed
    // in during seeding, and the rank check refuses an anonymous creator.
    const owner = createUser({
      name: 'School Owner', username: 'owner', pin: '0000', role: 'owner',
      security_question: 'What is the name of your first school?', security_answer: 'alnoor',
    })
    createUser({
      name: 'School Administrator', username: 'admin', pin: '1234', role: 'admin',
      security_question: 'What is the name of your first school?', security_answer: 'alnoor',
    }, owner.id)
    createUser({ name: 'Office Clerk', username: 'clerk', pin: '1111', role: 'registrar' }, owner.id)
    createUser({ name: 'Head Accountant', username: 'accounts', pin: '2222', role: 'accountant' }, owner.id)
    createUser({ name: 'Nadia Hamad', username: 'nadia', pin: '3333', role: 'teacher' }, owner.id)
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

  // A ready-made online exam so the module has something to show.
  const mathsSubject = subjects.find((s) => s.name === 'Mathematics') ?? subjects[0]
  const demoExam = saveExam(
    {
      title: 'Maths quiz - numbers to 100',
      title_ar: 'اختبار الرياضيات - الأعداد حتى 100',
      subject_id: mathsSubject.id,
      section_id: sections[0].id,
      exam_term_id: midterm.id,
      duration_minutes: 20,
      shuffle: 1,
      instructions: 'Answer every question. You may go back and change an answer before you hand in.',
      status: 'ready',
    },
    1
  )
  const demoQuestions: Parameters<typeof saveQuestion>[0][] = [
    { exam_id: demoExam.id, kind: 'mcq', text: 'What is 7 + 8?', marks: 2, options: ['13', '14', '15', '16'], correct: '2' },
    { exam_id: demoExam.id, kind: 'mcq', text: 'Which number is the largest?', marks: 2, options: ['45', '54', '39', '51'], correct: '1' },
    { exam_id: demoExam.id, kind: 'truefalse', text: '20 is an even number.', marks: 1, correct: 'true' },
    { exam_id: demoExam.id, kind: 'truefalse', text: '9 x 3 equals 28.', marks: 1, correct: 'false' },
    { exam_id: demoExam.id, kind: 'short', text: 'What is 100 minus 35?', marks: 2, correct: '65|sixty five|sixty-five' },
  ]
  const examTx = db.transaction(() => { for (const q of demoQuestions) saveQuestion(q) })
  examTx()

  // ---- Library ----------------------------------------------------------
  const demoBooks: { title: string; title_ar: string; author: string; category: string; copies: number; shelf: string }[] = [
    { title: 'The Arabian Nights', title_ar: 'ألف ليلة وليلة', author: 'Traditional', category: 'Stories', copies: 4, shelf: 'A1' },
    { title: 'Kalila and Dimna', title_ar: 'كليلة ودمنة', author: 'Ibn al-Muqaffa', category: 'Stories', copies: 3, shelf: 'A1' },
    { title: 'My First Atlas', title_ar: 'أطلسي الأول', author: 'H. Ward', category: 'Geography', copies: 2, shelf: 'B2' },
    { title: 'Science All Around Us', title_ar: 'العلوم من حولنا', author: 'S. Nasser', category: 'Science', copies: 5, shelf: 'B1' },
    { title: 'Arabic Grammar Made Simple', title_ar: 'قواعد العربية ببساطة', author: 'A. Hamdi', category: 'Language', copies: 6, shelf: 'C1' },
    { title: 'Times Tables Practice', title_ar: 'تدريبات جدول الضرب', author: 'M. Salem', category: 'Mathematics', copies: 8, shelf: 'C2' },
    { title: 'Stories of the Prophets', title_ar: 'قصص الأنبياء', author: 'Traditional', category: 'Religion', copies: 4, shelf: 'A2' },
    { title: 'The Little Gardener', title_ar: 'البستاني الصغير', author: 'L. Fathi', category: 'Stories', copies: 3, shelf: 'A3' },
    { title: 'Libya: Land and People', title_ar: 'ليبيا: الأرض والناس', author: 'K. Bashir', category: 'Geography', copies: 2, shelf: 'B2' },
    { title: 'English Reading Step 1', title_ar: 'القراءة الإنجليزية - الخطوة الأولى', author: 'J. Allen', category: 'Language', copies: 6, shelf: 'C1' },
  ]
  const booksTx = db.transaction(() => {
    const saved = demoBooks.map((b) =>
      saveBook({ title: b.title, title_ar: b.title_ar, author: b.author, category: b.category, shelf: b.shelf, copies_total: b.copies })
    )

    // Two of them also exist as a file, so "share the library on the school
    // Wi-Fi" has something on the shelf the first time anyone tries it.
    for (const [index, lines] of [
      [3, ['Water, air and light', '', 'Plants need three things to grow: water from the', 'soil, air around their leaves, and light from the sun.', '', 'Try it yourself: put one plant on a sunny windowsill', 'and another inside a dark cupboard. Give both the', 'same water. After one week, look at the leaves.']],
      [5, ['The three root letters', '', 'Almost every Arabic word is built from three letters.', 'From k-t-b come kitab (a book), katib (a writer),', 'maktab (a desk) and maktaba (a library).', '', 'Once you can hear the three letters inside a word,', 'you can often guess what a new word means.']],
    ] as [number, string[]][]) {
      const book = saved[index]
      // Named after the book, because the file name is what a student sees.
      const tmp = path.join(os.tmpdir(), `${book.title.replace(/[^\w ]+/g, '').trim()}.pdf`)
      fs.writeFileSync(tmp, demoBookPdf(book.title, lines))
      attachFile(book.id, tmp)
      fs.rmSync(tmp, { force: true })
    }
    // A handful of loans: some out, some overdue, some already back.
    for (let i = 0; i < 14; i++) {
      const book = saved[rand(saved.length)]
      const student = students[rand(students.length)]
      try {
        const loan = borrow({ book_id: book.id, student_id: student.id, days: rand(3) === 0 ? -4 - rand(6) : 7 + rand(14) }, 1)
        if (rand(3) === 0) returnBook(loan.id)
      } catch {
        // Already holding that title — skip and try another.
      }
    }
  })
  booksTx()

  // ---- Transport --------------------------------------------------------
  const routeSpecs: {
    name: string; name_ar: string; driver: string; driver_ar: string; phone: string
    assistant: string; vehicle: string; capacity: number; am: string; pm: string; stops: string; fee: number
  }[] = [
    {
      name: 'Route 1 - Hay al-Andalus', name_ar: 'الخط 1 - حي الأندلس',
      driver: 'Mahmoud Al-Ferjani', driver_ar: 'محمود الفرجاني', phone: '+218 91 234 5671',
      assistant: 'Fatima Ali', vehicle: 'BUS-101', capacity: 28, am: '06:45', pm: '13:45',
      stops: 'Al-Andalus roundabout, Green Mosque, Souq al-Juma', fee: 300,
    },
    {
      name: 'Route 2 - Gargaresh', name_ar: 'الخط 2 - قرقارش',
      driver: 'Ali Ben Saud', driver_ar: 'علي بن سعود', phone: '+218 92 345 6712',
      assistant: 'Nadia Omar', vehicle: 'BUS-102', capacity: 24, am: '06:30', pm: '13:45',
      stops: 'Gargaresh main road, Sea View, Al-Nasr Street', fee: 320,
    },
    {
      name: 'Route 3 - Ain Zara', name_ar: 'الخط 3 - عين زارة',
      driver: 'Khaled Ramadan', driver_ar: 'خالد رمضان', phone: '+218 94 456 7123',
      assistant: 'Huda Salem', vehicle: 'BUS-103', capacity: 30, am: '06:20', pm: '14:00',
      stops: 'Ain Zara bridge, Al-Salam School, Market street', fee: 350,
    },
    {
      name: 'Route 4 - Janzour', name_ar: 'الخط 4 - جنزور',
      driver: 'Youssef Miloud', driver_ar: 'يوسف ميلود', phone: '+218 91 567 8234',
      assistant: '', vehicle: 'BUS-104', capacity: 20, am: '06:40', pm: '13:50',
      stops: 'Janzour centre, Palm Street, Coast road', fee: 330,
    },
  ]
  const transportTx = db.transaction(() => {
    const routes = routeSpecs.map((r) =>
      saveRoute({
        name: r.name, name_ar: r.name_ar,
        driver_name: r.driver, driver_name_ar: r.driver_ar, driver_phone: r.phone,
        assistant_name: r.assistant || null, vehicle_number: r.vehicle,
        capacity: r.capacity, morning_time: r.am, afternoon_time: r.pm,
        stops: r.stops, fee_per_term: r.fee, status: 'active',
      })
    )
    const pool = [...students].sort(() => Math.random() - 0.5).slice(0, 70)
    let i = 0
    for (const route of routes) {
      const seats = Math.min(route.capacity ?? 20, 12 + rand(6))
      for (let n = 0; n < seats && i < pool.length; n++, i++) {
        const stop = (route.stops ?? '').split(',')[rand(3)]?.trim() || null
        let rider
        try {
          rider = addRider({
            route_id: route.id,
            student_id: pool[i].id,
            pickup_point: stop,
            direction: rand(6) === 0 ? (rand(2) ? 'morning' : 'afternoon') : 'both',
            term: midterm.name,
          })
        } catch {
          continue
        }
        // Most families have paid in full, some paid part, a few not at all —
        // so the "who has not paid" list has something real in it.
        const roll = rand(10)
        if (roll < 6) recordBusPayment({ rider_id: rider.id, amount_paid: route.fee_per_term }, 1)
        else if (roll < 8) recordBusPayment({ rider_id: rider.id, amount_paid: Math.round(route.fee_per_term / 2) }, 1)
      }
    }
  })
  transportTx()

  // Announcements and calendar
  saveAnnouncement({ title: 'Parent–teacher meeting on Thursday', body: 'All guardians are invited from 4pm to 6pm in the main hall.' }, 1)
  saveAnnouncement({ title: 'Midterm exams begin next month', body: 'The timetable will be sent home with every student.' }, 1)
  const soon = (days: number) => { const d = new Date(now); d.setDate(d.getDate() + days); return iso(d) }
  saveEvent({ title: 'Midterm exams', date: soon(21), end_date: soon(26), type: 'exam' })
  saveEvent({ title: 'National holiday', date: soon(9), type: 'holiday' })
  saveEvent({ title: 'Report cards due', date: soon(3), type: 'reminder' })
  saveEvent({ title: 'Sports day', date: soon(14), type: 'event' })
}
