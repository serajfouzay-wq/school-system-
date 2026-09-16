import type {
  School, User, Klass, Section, Subject, Student, Staff, ExamTerm, Grade,
  FeeStructure, FeePayment, TimetableEntry, Announcement, CalendarEvent,
  DashboardSummary, StudentProfile, ReportCardData, ReceiptData,
  StudentFeeSummary, SearchHit, RecycleBinEntry, BackupLogEntry,
  TeacherAssignment, AttendanceStatus, StaffAttendanceStatus,
  Exam, ExamQuestion, ExamAttempt, AttemptDetail, ServerStatus,
  Recipient, PreparedMessage, MessagePurpose,
} from '@shared/types'

declare global {
  interface Window {
    api: {
      call: (method: string, payload?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>
      platform: string
    }
  }
}

/** Thrown for anything the main process reports; the message is always
 *  written in plain language, ready to show the user as-is. */
export class ApiError extends Error {}

async function call<T>(method: string, payload?: unknown): Promise<T> {
  if (!window.api) throw new ApiError('The program is still starting. Please wait a moment.')
  const res = await window.api.call(method, payload)
  if (!res.ok) throw new ApiError(res.error ?? 'Something went wrong')
  return res.data as T
}

export const api = {
  raw: call,

  session: {
    current: () => call<User | null>('session.currentUser'),
    setUser: (userId: number | null) => call<boolean>('session.setUser', { userId }),
  },

  school: {
    get: () => call<School | null>('school.get'),
    save: (patch: Partial<School>) => call<School>('school.save', patch),
    isSetupComplete: () => call<boolean>('school.isSetupComplete'),
    preferences: () => call<Record<string, string>>('school.preferences'),
    setPreference: (key: string, value: string) => call<boolean>('school.setPreference', { key, value }),
  },

  auth: {
    login: (username: string, pin: string) => call<User>('auth.login', { username, pin }),
    logout: () => call<boolean>('auth.logout'),
    securityQuestion: (username: string) => call<string | null>('auth.securityQuestion', { username }),
    resetPin: (username: string, answer: string, newPin: string) =>
      call<User>('auth.resetPin', { username, answer, newPin }),
  },

  users: {
    list: (includeInactive = true) => call<User[]>('users.list', { includeInactive }),
    count: () => call<number>('users.count'),
    create: (input: Record<string, unknown>) => call<User>('users.create', input),
    update: (id: number, patch: Record<string, unknown>) => call<User>('users.update', { id, ...patch }),
    remove: (id: number) => call<boolean>('users.delete', { id }),
  },

  classes: {
    list: () => call<Klass[]>('classes.list'),
    save: (input: Record<string, unknown>) => call<Klass>('classes.save', input),
    remove: (id: number) => call<boolean>('classes.delete', { id }),
  },
  sections: {
    list: (classId?: number) => call<Section[]>('sections.list', { classId }),
    save: (input: Record<string, unknown>) => call<Section>('sections.save', input),
    remove: (id: number) => call<boolean>('sections.delete', { id }),
  },
  subjects: {
    list: () => call<Subject[]>('subjects.list'),
    save: (input: Record<string, unknown>) => call<Subject>('subjects.save', input),
    remove: (id: number) => call<boolean>('subjects.delete', { id }),
  },
  terms: {
    list: () => call<ExamTerm[]>('terms.list'),
    save: (input: Record<string, unknown>) => call<ExamTerm>('terms.save', input),
    remove: (id: number) => call<boolean>('terms.delete', { id }),
  },
  assignments: {
    list: (filter?: { staff_id?: number; section_id?: number }) => call<TeacherAssignment[]>('assignments.list', filter),
    save: (input: { staff_id: number; section_id: number; subject_id: number }) => call<boolean>('assignments.save', input),
    remove: (id: number) => call<boolean>('assignments.delete', { id }),
  },

  students: {
    list: (filter?: Record<string, unknown>) => call<Student[]>('students.list', filter),
    get: (id: number) => call<Student | null>('students.get', { id }),
    save: (input: Record<string, unknown>) => call<Student>('students.save', input),
    remove: (id: number) => call<boolean>('students.delete', { id }),
    setStatus: (id: number, status: string) => call<Student>('students.setStatus', { id, status }),
    move: (ids: number[], sectionId: number) => call<number>('students.move', { ids, sectionId }),
    profile: (id: number) => call<StudentProfile>('students.profile', { id }),
    nextCode: () => call<string>('students.nextCode'),
    addNote: (studentId: number, body: string) => call<boolean>('students.addNote', { studentId, body }),
    removeNote: (id: number) => call<boolean>('students.deleteNote', { id }),
    addDocument: (studentId: number, title: string, sourcePath: string) =>
      call<boolean>('students.addDocument', { studentId, title, sourcePath }),
    removeDocument: (id: number) => call<boolean>('students.deleteDocument', { id }),
    import: (rows: Record<string, string>[], mapping: Record<string, string>, sectionId: number | null) =>
      call<{ added: number; skipped: number; errors: string[] }>('students.import', { rows, mapping, sectionId }),
  },

  staff: {
    list: (filter?: Record<string, unknown>) => call<Staff[]>('staff.list', filter),
    get: (id: number) => call<Staff | null>('staff.get', { id }),
    save: (input: Record<string, unknown>) => call<Staff>('staff.save', input),
    remove: (id: number) => call<boolean>('staff.delete', { id }),
  },

  attendance: {
    section: (sectionId: number, date: string) =>
      call<{
        student_id: number; student_code: string; full_name: string; full_name_ar: string | null
        photo_path: string | null; status: AttendanceStatus | null; note: string | null
      }[]>('attendance.section', { sectionId, date }),
    save: (date: string, marks: { student_id: number; status: AttendanceStatus; note?: string | null }[]) =>
      call<number>('attendance.save', { date, marks }),
    studentMonth: (studentId: number, month: string) =>
      call<{ date: string; status: AttendanceStatus }[]>('attendance.studentMonth', { studentId, month }),
    sectionMonth: (sectionId: number, month: string) =>
      call<{ date: string; present: number; absent: number; late: number; excused: number }[]>(
        'attendance.sectionMonth', { sectionId, month }),
    report: (opts: { from: string; to: string; sectionId?: number | null; classId?: number | null }) =>
      call<{
        student_id: number; student_code: string; full_name: string; full_name_ar: string | null
        class_label: string; present: number; absent: number; late: number; excused: number
        total: number; percent: number
      }[]>('attendance.report', opts),
    staffDay: (date: string) =>
      call<{
        staff_id: number; staff_code: string; full_name: string; full_name_ar: string | null
        role: string; status: StaffAttendanceStatus | null; note: string | null
      }[]>('attendance.staffDay', { date }),
    saveStaff: (date: string, marks: { staff_id: number; status: StaffAttendanceStatus; note?: string | null }[]) =>
      call<number>('attendance.saveStaff', { date, marks }),
  },

  grades: {
    grid: (sectionId: number, termId: number) =>
      call<{
        student_id: number; student_code: string; full_name: string; full_name_ar: string | null
        scores: Record<number, { score: number | null; max_score: number }>
        total: number; maxTotal: number; percent: number; rank: number
      }[]>('grades.grid', { sectionId, termId }),
    save: (termId: number, entries: Partial<Grade>[]) => call<number>('grades.save', { termId, entries }),
    subjectsForSection: (sectionId: number) =>
      call<{ id: number; name: string; name_ar: string | null }[]>('grades.subjectsForSection', { sectionId }),
    reportCard: (studentId: number, termId: number) => call<ReportCardData>('grades.reportCard', { studentId, termId }),
    saveRemarks: (studentId: number, termId: number, remarks: string) =>
      call<boolean>('grades.saveRemarks', { studentId, termId, remarks }),
  },

  fees: {
    structures: (classId?: number | null) => call<FeeStructure[]>('fees.structures', { classId }),
    saveStructure: (input: Record<string, unknown>) => call<boolean>('fees.saveStructure', input),
    removeStructure: (id: number) => call<boolean>('fees.deleteStructure', { id }),
    payments: (filter?: Record<string, unknown>) => call<FeePayment[]>('fees.payments', filter),
    recordPayment: (input: Record<string, unknown>) => call<FeePayment>('fees.recordPayment', input),
    removePayment: (id: number) => call<boolean>('fees.deletePayment', { id }),
    balances: (filter?: Record<string, unknown>) => call<StudentFeeSummary[]>('fees.balances', filter),
    studentSummary: (studentId: number) => call<StudentFeeSummary>('fees.studentSummary', { studentId }),
    receipt: (paymentId: number) => call<ReceiptData>('fees.receipt', { paymentId }),
    summary: () => call<{
      collectedThisMonth: number; collectedThisYear: number; expectedTotal: number; outstandingTotal: number
      byMonth: { month: string; amount: number }[]
      byClass: { class_name: string; billed: number; paid: number; balance: number }[]
      byMethod: { method: string; amount: number }[]
    }>('fees.summary'),
  },

  timetable: {
    list: (filter?: { section_id?: number; staff_id?: number }) => call<TimetableEntry[]>('timetable.list', filter),
    save: (input: Record<string, unknown>) =>
      call<{ entry: TimetableEntry; conflicts: { kind: string; message: string }[] }>('timetable.save', input),
    remove: (id: number) => call<boolean>('timetable.delete', { id }),
    periods: () => call<{ start_time: string; end_time: string }[]>('timetable.periods'),
  },

  announcements: {
    list: (limit?: number) => call<Announcement[]>('announcements.list', { limit }),
    save: (input: Record<string, unknown>) => call<boolean>('announcements.save', input),
    remove: (id: number) => call<boolean>('announcements.delete', { id }),
  },
  events: {
    list: (filter?: { from?: string; to?: string }) => call<CalendarEvent[]>('events.list', filter),
    save: (input: Record<string, unknown>) => call<boolean>('events.save', input),
    remove: (id: number) => call<boolean>('events.delete', { id }),
  },

  exams: {
    list: () => call<Exam[]>('exams.list'),
    get: (id: number) => call<Exam | null>('exams.get', { id }),
    save: (input: Record<string, unknown>) => call<Exam>('exams.save', input),
    remove: (id: number) => call<boolean>('exams.delete', { id }),
    questions: (examId: number) => call<ExamQuestion[]>('exams.questions', { examId }),
    saveQuestion: (input: Record<string, unknown>) => call<ExamQuestion>('exams.saveQuestion', input),
    removeQuestion: (id: number) => call<boolean>('exams.deleteQuestion', { id }),
    reorderQuestions: (examId: number, ids: number[]) => call<boolean>('exams.reorderQuestions', { examId, ids }),
    openSession: (examId: number) =>
      call<{ session: { id: number; join_code: string }; server: ServerStatus }>('exams.openSession', { examId }),
    closeSession: (sessionId: number) => call<boolean>('exams.closeSession', { sessionId }),
    activeSession: (examId: number) =>
      call<{ id: number; join_code: string; started_at: string } | null>('exams.activeSession', { examId }),
    attempts: (sessionId: number) => call<ExamAttempt[]>('exams.attempts', { sessionId }),
    attemptDetail: (attemptId: number) => call<AttemptDetail>('exams.attemptDetail', { attemptId }),
    overrideAnswer: (answerId: number, correct: boolean) => call<boolean>('exams.overrideAnswer', { answerId, correct }),
    remark: (attemptId: number) => call<{ score: number; maxScore: number; needsReview: boolean }>('exams.remark', { attemptId }),
    pushToGrades: (sessionId: number) => call<{ pushed: number; skipped: number }>('exams.pushToGrades', { sessionId }),
  },

  examServer: {
    status: () => call<ServerStatus>('examServer.status'),
    start: (port?: number) => call<ServerStatus>('examServer.start', { port }),
    stop: () => call<ServerStatus>('examServer.stop'),
  },

  whatsapp: {
    feeDebtors: (classId?: number | null) => call<Recipient[]>('whatsapp.feeDebtors', { classId }),
    absentToday: (date: string, sectionId?: number | null) => call<Recipient[]>('whatsapp.absentToday', { date, sectionId }),
    oneStudent: (studentId: number) => call<Recipient>('whatsapp.oneStudent', { studentId }),
    prepare: (recipients: Recipient[], purpose: MessagePurpose, lang: 'en' | 'ar', extra?: Record<string, string>) =>
      call<PreparedMessage[]>('whatsapp.prepare', { recipients, purpose, lang, extra }),
    send: (message: PreparedMessage, purpose: MessagePurpose) => call<boolean>('whatsapp.send', { message, purpose }),
    contactedToday: (purpose: MessagePurpose) => call<number[]>('whatsapp.contactedToday', { purpose }),
    history: (studentId: number) =>
      call<{ id: number; purpose: string; phone: string; body: string; sent_at: string }[]>('whatsapp.history', { studentId }),
    countryCode: () => call<string>('whatsapp.countryCode'),
  },

  dashboard: { summary: () => call<DashboardSummary>('dashboard.summary') },
  search: { global: (query: string) => call<SearchHit[]>('search.global', { query }) },

  recycle: {
    list: () => call<RecycleBinEntry[]>('recycle.list'),
    restore: (id: number) => call<boolean>('recycle.restore', { id }),
  },

  backup: {
    create: () => call<BackupLogEntry>('backup.create', { triggeredBy: 'manual' }),
    list: () => call<BackupLogEntry[]>('backup.list'),
    status: () => call<{ lastBackupAt: string | null; autoEnabled: boolean; folder: string }>('backup.status'),
    setAuto: (enabled: boolean) => call<boolean>('backup.setAuto', { enabled }),
    restore: (file: string) => call<{ safetyCopy: string }>('backup.restore', { file }),
    chooseAndCopy: () => call<string | null>('backup.chooseAndCopy'),
    chooseAndRestore: () => call<{ safetyCopy: string } | null>('backup.chooseAndRestore'),
  },

  demo: {
    isSeeded: () => call<boolean>('demo.isSeeded'),
    seed: () => call<boolean>('demo.seed'),
  },

  files: {
    pickImage: () => call<string | null>('files.pickImage'),
    pickAny: () => call<string | null>('files.pickAny'),
    pickCsv: () => call<{ path: string; rows: Record<string, string>[] } | null>('files.pickCsv'),
    saveStudentPhoto: (sourcePath: string, studentCode: string) =>
      call<string>('files.saveStudentPhoto', { sourcePath, studentCode }),
    saveStaffPhoto: (sourcePath: string, staffCode: string) =>
      call<string>('files.saveStaffPhoto', { sourcePath, staffCode }),
    saveLogo: (sourcePath: string) => call<string>('files.saveLogo', { sourcePath }),
    readImage: (filePath: string | null) => call<string | null>('files.readImage', { filePath }),
    openFolder: (folder: string) => call<boolean>('files.openFolder', { folder }),
    showItem: (filePath: string) => call<boolean>('files.showItem', { filePath }),
  },

  output: {
    csv: (suggestedName: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) =>
      call<string | null>('export.csv', { suggestedName, columns, rows }),
    print: (html: string) => call<{ success: boolean; reason?: string }>('print.html', { html }),
    pdf: (html: string, suggestedName: string) => call<string | null>('print.pdf', { html, suggestedName }),
  },

  app: {
    version: () => call<string>('app.version'),
    dataFolder: () => call<string>('app.dataFolder'),
  },
}
