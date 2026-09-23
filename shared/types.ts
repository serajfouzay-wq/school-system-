/** Types shared between the Electron main process and the React renderer. */

export type { Role, Capability } from './permissions'
import type { Role } from './permissions'
export type Language = 'en' | 'ar'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'leave'
export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred'
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'other'
export type GradingScale = 'percentage' | 'letter' | 'gpa'
export type EventType = 'holiday' | 'exam' | 'event' | 'reminder'

export interface School {
  id: number
  name: string
  name_ar: string | null
  logo_path: string | null
  address: string | null
  phone: string | null
  email: string | null
  academic_year_start: string | null
  academic_year_end: string | null
  currency: string
  language: Language
  brand_color: string | null
  grading_scale: GradingScale
  calendar_type: 'gregorian' | 'hijri'
  numeral_system: 'western' | 'arabic_indic'
  setup_complete: 0 | 1
}

export interface User {
  id: number
  name: string
  username: string
  role: Role
  staff_id: number | null
  security_question: string | null
  is_active: 0 | 1
  created_at: string
}

export interface Klass {
  id: number
  school_id: number
  name: string
  name_ar: string | null
  grade_level: number
  section_count?: number
  student_count?: number
}

export interface Section {
  id: number
  class_id: number
  name: string
  name_ar: string | null
  homeroom_staff_id: number | null
  capacity: number | null
  class_name?: string
  class_name_ar?: string | null
  homeroom_name?: string | null
  student_count?: number
}

export interface Subject {
  id: number
  school_id: number
  name: string
  name_ar: string | null
  code: string | null
}

export interface Student {
  id: number
  school_id: number
  section_id: number | null
  student_code: string
  full_name: string
  full_name_ar: string | null
  photo_path: string | null
  dob: string | null
  gender: 'male' | 'female' | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_address: string | null
  emergency_contact: string | null
  enrollment_date: string | null
  previous_school: string | null
  medical_notes: string | null
  status: StudentStatus
  created_at: string
  /** Joined for list views. */
  class_name?: string
  class_name_ar?: string | null
  section_name?: string
  section_name_ar?: string | null
}

export interface Staff {
  id: number
  school_id: number
  staff_code: string
  full_name: string
  full_name_ar: string | null
  photo_path: string | null
  role: string
  phone: string | null
  email: string | null
  address: string | null
  hire_date: string | null
  salary: number | null
  status: string
}

export interface TeacherAssignment {
  id: number
  staff_id: number
  section_id: number
  subject_id: number
  staff_name?: string
  subject_name?: string
  subject_name_ar?: string | null
  section_label?: string
}

export interface AttendanceRecord {
  id: number
  student_id: number
  date: string
  status: AttendanceStatus
  note: string | null
  marked_by: number | null
}

export interface StaffAttendanceRecord {
  id: number
  staff_id: number
  date: string
  status: StaffAttendanceStatus
  note: string | null
}

export interface ExamTerm {
  id: number
  school_id: number
  name: string
  name_ar: string | null
  start_date: string | null
  end_date: string | null
}

export interface Grade {
  id: number
  student_id: number
  subject_id: number
  exam_term_id: number
  score: number | null
  max_score: number
  remarks: string | null
}

export interface FeeStructure {
  id: number
  school_id: number
  class_id: number | null
  term: string | null
  item_name: string
  item_name_ar: string | null
  amount: number
  class_name?: string
}

export interface FeePayment {
  id: number
  student_id: number
  fee_structure_id: number | null
  amount_paid: number
  date: string
  method: PaymentMethod
  receipt_no: string
  note: string | null
  student_name?: string
  student_code?: string
  item_name?: string
}

export interface TimetableEntry {
  id: number
  section_id: number
  subject_id: number
  staff_id: number | null
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  subject_name?: string
  subject_name_ar?: string | null
  staff_name?: string
  section_label?: string
}

export interface Announcement {
  id: number
  school_id: number
  title: string
  body: string | null
  date: string
  created_by: number | null
  author_name?: string
}

export interface CalendarEvent {
  id: number
  school_id: number
  title: string
  date: string
  end_date: string | null
  type: EventType
  note: string | null
}

export interface RecycleBinEntry {
  id: number
  table_name: string
  record_id: number
  label: string
  deleted_at: string
  deleted_by: number | null
}

export interface BackupLogEntry {
  id: number
  timestamp: string
  file_path: string
  size_bytes: number | null
  triggered_by: 'auto' | 'manual'
}

/* ---------- Composite view models ---------- */

export interface DashboardSummary {
  totalStudents: number
  totalStaff: number
  totalClasses: number
  attendanceToday: { present: number; absent: number; late: number; excused: number; unmarked: number; percent: number }
  feesThisMonth: { collected: number; expectedTotal: number; outstanding: number }
  upcomingEvents: CalendarEvent[]
  recentAnnouncements: Announcement[]
  attendanceTrend: { date: string; percent: number }[]
  enrollmentByClass: { name: string; name_ar: string | null; count: number }[]
}

export interface StudentProfile {
  student: Student
  attendance: { present: number; absent: number; late: number; excused: number; total: number; percent: number }
  gradeTrend: { term: string; term_ar: string | null; average: number }[]
  fees: { billed: number; paid: number; balance: number }
  notes: { id: number; body: string; created_at: string; author_name: string | null }[]
  documents: { id: number; title: string; file_path: string; uploaded_at: string }[]
}

export interface ReportCardData {
  school: School
  student: Student
  term: ExamTerm
  rows: { subject: string; subject_ar: string | null; score: number | null; max_score: number; remarks: string | null }[]
  total: number
  maxTotal: number
  percentage: number
  gradeLabel: string
  rank: number
  classSize: number
  attendancePercent: number
  teacherRemarks: string | null
}

export interface ReceiptData {
  school: School
  payment: FeePayment
  student: Student
  balanceAfter: number
}

export interface StudentFeeSummary {
  student: Student
  billed: number
  paid: number
  balance: number
}

export interface SearchHit {
  type: 'student' | 'staff' | 'payment' | 'class'
  id: number
  title: string
  subtitle: string
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}

/* ---------- Online exams ---------- */

export type QuestionKind = 'mcq' | 'truefalse' | 'short'

export interface Exam {
  id: number
  title: string
  title_ar: string | null
  subject_id: number | null
  section_id: number | null
  exam_term_id: number | null
  duration_minutes: number
  shuffle: 0 | 1
  instructions: string | null
  status: 'draft' | 'ready' | 'closed'
  question_count?: number
  total_marks?: number
  subject_name?: string | null
  section_label?: string | null
  term_name?: string | null
}

export interface ExamQuestion {
  id: number
  exam_id: number
  kind: QuestionKind
  text: string
  marks: number
  options: string[]
  correct: string | null
  order_index: number
}

export interface ExamAttempt {
  id: number
  student_id: number
  full_name: string
  full_name_ar: string | null
  student_code: string
  started_at: string
  submitted_at: string | null
  score: number | null
  max_score: number | null
  needs_review: 0 | 1
  pushed_to_grades: 0 | 1
}

export interface AttemptAnswer {
  id: number
  question_id: number
  text: string
  kind: QuestionKind
  marks: number
  options: string[]
  correct: string | null
  answer: string | null
  is_correct: boolean | null
  awarded_marks: number
}

export interface AttemptDetail {
  attempt: Record<string, unknown>
  answers: AttemptAnswer[]
}

/** The little web server students' phones connect to over the school Wi-Fi. */
export interface ServerStatus {
  running: boolean
  port: number
  addresses: string[]
  url: string | null
}

/* ---------- WhatsApp ---------- */

export type MessagePurpose = 'fees' | 'absence' | 'reportCard' | 'custom'

export interface Recipient {
  student_id: number
  student_name: string
  /** Kept separately so an English message does not carry an Arabic name. */
  student_name_ar?: string | null
  student_code: string
  guardian_name: string | null
  phone: string | null
  amount?: number
  class_label?: string
  class_label_ar?: string
}

export interface PreparedMessage {
  student_id: number
  student_name: string
  phone: string | null
  body: string
  link: string | null
  problem: string | null
}

/* ---------- Library ---------- */

export interface Book {
  id: number
  title: string
  title_ar: string | null
  author: string | null
  category: string | null
  isbn: string | null
  shelf: string | null
  description: string | null
  cover_path: string | null
  file_path: string | null
  file_name: string | null
  copies_total: number
  copies_out?: number
  copies_available?: number
  is_digital?: boolean
}

export interface Loan {
  id: number
  book_id: number
  student_id: number | null
  staff_id: number | null
  borrowed_at: string
  due_at: string
  returned_at: string | null
  fine_amount: number
  fine_paid: 0 | 1
  note: string | null
  book_title?: string
  book_title_ar?: string | null
  borrower_name?: string
  borrower_name_ar?: string | null
  student_code?: string
  days_overdue?: number
}

export interface LibrarySummary {
  titles: number
  copies: number
  onLoan: number
  overdue: number
  digital: number
  unpaidFines: number
}

/* ---------- Transport ---------- */

export interface Route {
  id: number
  name: string
  name_ar: string | null
  driver_name: string | null
  driver_name_ar: string | null
  driver_phone: string | null
  assistant_name: string | null
  vehicle_number: string | null
  capacity: number | null
  morning_time: string | null
  afternoon_time: string | null
  stops: string | null
  fee_per_term: number
  notes: string | null
  status: string
  rider_count?: number
  seats_left?: number | null
  collected?: number
  expected?: number
  outstanding?: number
}

export interface Rider {
  id: number
  route_id: number
  student_id: number
  pickup_point: string | null
  direction: 'morning' | 'afternoon' | 'both'
  term: string | null
  started_at: string
  ended_at: string | null
  student_name?: string
  student_name_ar?: string | null
  student_code?: string
  class_label?: string
  class_label_ar?: string
  guardian_phone?: string | null
  route_name?: string
  route_name_ar?: string | null
  fee_per_term?: number
  paid?: number
  balance?: number
}

export interface TransportSummary {
  routes: number
  riders: number
  seatsLeft: number | null
  expected: number
  collected: number
  outstanding: number
  unpaidRiders: number
}

/* ---------- Licence ---------- */

export type LicenseProblem =
  /** No licence anywhere. A fresh install, waiting to be activated. */
  | 'missing'
  /** A genuine licence, but for other computers: this copy was moved. */
  | 'otherComputer'
  /** A genuine licence for a different school's build. */
  | 'otherSchool'
  /** Not signed by the workshop, or damaged on the way. */
  | 'invalid'
  /** This computer would not say what it is, so no licence can match it. */
  | 'noComputerCode'

export interface LicenseStatus {
  required: boolean
  licensed: boolean
  machineCode: string | null
  /** Whose copy it is, once licensed. */
  school: string | null
  issued: string | null
  problem: LicenseProblem | null
}
