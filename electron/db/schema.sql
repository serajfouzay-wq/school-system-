-- School Management System — core schema.
-- Every user-facing table carries `deleted_at` so a delete is always recoverable
-- from the Recycle Bin ("nothing is ever truly lost").

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schools (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  name_ar             TEXT,
  logo_path           TEXT,
  /* Overrides the colour this build was branded with, so changing it
     never needs a new installer. NULL means "use the build's own". */
  brand_color         TEXT,
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  academic_year_start TEXT,
  academic_year_end   TEXT,
  currency            TEXT NOT NULL DEFAULT 'LYD',
  language            TEXT NOT NULL DEFAULT 'en',
  grading_scale       TEXT NOT NULL DEFAULT 'percentage', -- percentage | letter | gpa
  calendar_type       TEXT NOT NULL DEFAULT 'gregorian',  -- gregorian | hijri
  numeral_system      TEXT NOT NULL DEFAULT 'western',    -- western | arabic_indic
  setup_complete      INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  username          TEXT NOT NULL UNIQUE,
  pin_hash          TEXT NOT NULL,
  pin_salt          TEXT NOT NULL,
  role              TEXT NOT NULL, -- admin | registrar | teacher | accountant | viewer
  staff_id          INTEGER REFERENCES staff(id),
  security_question TEXT,
  security_answer_hash TEXT,
  security_answer_salt TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id),
  name        TEXT NOT NULL,
  name_ar     TEXT,
  grade_level INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id          INTEGER NOT NULL REFERENCES classes(id),
  name              TEXT NOT NULL,
  name_ar           TEXT,
  homeroom_staff_id INTEGER REFERENCES staff(id),
  capacity          INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  name       TEXT NOT NULL,
  name_ar    TEXT,
  code       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id         INTEGER NOT NULL REFERENCES schools(id),
  section_id        INTEGER REFERENCES sections(id),
  student_code      TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  full_name_ar      TEXT,
  photo_path        TEXT,
  dob               TEXT,
  gender            TEXT, -- male | female
  guardian_name     TEXT,
  guardian_phone    TEXT,
  guardian_address  TEXT,
  emergency_contact TEXT,
  enrollment_date   TEXT,
  previous_school   TEXT,
  medical_notes     TEXT,
  status            TEXT NOT NULL DEFAULT 'active', -- active | inactive | graduated | transferred
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE TABLE IF NOT EXISTS student_documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  title        TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS student_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  body       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id),
  staff_code  TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  full_name_ar TEXT,
  photo_path  TEXT,
  role        TEXT NOT NULL DEFAULT 'teacher', -- teacher | admin | accountant | registrar | other
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  hire_date   TEXT,
  salary      REAL,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  section_id INTEGER NOT NULL REFERENCES sections(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  date       TEXT NOT NULL,
  status     TEXT NOT NULL, -- present | absent | late | excused
  note       TEXT,
  marked_by  INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  UNIQUE(student_id, date)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER NOT NULL REFERENCES staff(id),
  date       TEXT NOT NULL,
  status     TEXT NOT NULL, -- present | absent | late | leave
  note       TEXT,
  marked_by  INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  UNIQUE(staff_id, date)
);

CREATE TABLE IF NOT EXISTS exam_terms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  name       TEXT NOT NULL,
  name_ar    TEXT,
  start_date TEXT,
  end_date   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS grades (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  subject_id   INTEGER NOT NULL REFERENCES subjects(id),
  exam_term_id INTEGER NOT NULL REFERENCES exam_terms(id),
  score        REAL,
  max_score    REAL NOT NULL DEFAULT 100,
  remarks      TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT,
  UNIQUE(student_id, subject_id, exam_term_id)
);

CREATE TABLE IF NOT EXISTS report_card_remarks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  exam_term_id INTEGER NOT NULL REFERENCES exam_terms(id),
  remarks      TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT,
  UNIQUE(student_id, exam_term_id)
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  class_id   INTEGER REFERENCES classes(id),
  term       TEXT,
  item_name  TEXT NOT NULL,
  item_name_ar TEXT,
  amount     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES students(id),
  fee_structure_id INTEGER REFERENCES fee_structures(id),
  amount_paid      REAL NOT NULL,
  date             TEXT NOT NULL,
  method           TEXT NOT NULL DEFAULT 'cash', -- cash | bank | card | other
  receipt_no       TEXT NOT NULL UNIQUE,
  note             TEXT,
  recorded_by      INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id   INTEGER NOT NULL REFERENCES sections(id),
  subject_id   INTEGER NOT NULL REFERENCES subjects(id),
  staff_id     INTEGER REFERENCES staff(id),
  day_of_week  INTEGER NOT NULL, -- 0 = Sunday
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  room         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  title      TEXT NOT NULL,
  body       TEXT,
  date       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  end_date   TEXT,
  type       TEXT NOT NULL DEFAULT 'event', -- holiday | exam | event | reminder
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS backups_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp    TEXT NOT NULL DEFAULT (datetime('now')),
  file_path    TEXT NOT NULL,
  size_bytes   INTEGER,
  triggered_by TEXT NOT NULL DEFAULT 'manual' -- auto | manual
);

-- Recycle bin: every soft-delete is recorded here so a non-technical user can
-- see a plain list of "things I deleted" and restore with one click.
CREATE TABLE IF NOT EXISTS recycle_bin (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  record_id   INTEGER NOT NULL,
  label       TEXT NOT NULL,
  deleted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_by  INTEGER REFERENCES users(id),
  restored_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_section   ON students(section_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_name      ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_grades_lookup      ON grades(exam_term_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student   ON fee_payments(student_id);
-- "Collected this month" on the dashboard is a date range over every payment.
CREATE INDEX IF NOT EXISTS idx_payments_date      ON fee_payments(date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timetable_section  ON timetable_entries(section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_recycle_open       ON recycle_bin(restored_at, deleted_at);

/* ---------------------------------------------------------------
   Online exams taken on the school's own Wi-Fi.
   The office computer hosts; students answer on their own phones.
   --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS exams (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id        INTEGER NOT NULL REFERENCES schools(id),
  title            TEXT NOT NULL,
  title_ar         TEXT,
  subject_id       INTEGER REFERENCES subjects(id),
  section_id       INTEGER REFERENCES sections(id),
  exam_term_id     INTEGER REFERENCES exam_terms(id),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  shuffle          INTEGER NOT NULL DEFAULT 1,
  instructions     TEXT,
  status           TEXT NOT NULL DEFAULT 'draft', -- draft | ready | closed
  created_by       INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id      INTEGER NOT NULL REFERENCES exams(id),
  kind         TEXT NOT NULL DEFAULT 'mcq', -- mcq | truefalse | short
  text         TEXT NOT NULL,
  marks        REAL NOT NULL DEFAULT 1,
  -- JSON array of choice strings, for mcq
  options_json TEXT,
  -- mcq: index of the right choice. truefalse: 'true'/'false'. short: the
  -- accepted answer(s), separated by |
  correct      TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT
);

/* One sitting of an exam. The join code is what students type on their phone. */
CREATE TABLE IF NOT EXISTS exam_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id     INTEGER NOT NULL REFERENCES exams(id),
  join_code   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open', -- open | closed
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT,
  opened_by   INTEGER REFERENCES users(id),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES exam_sessions(id),
  student_id    INTEGER NOT NULL REFERENCES students(id),
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at  TEXT,
  score         REAL,
  max_score     REAL,
  needs_review  INTEGER NOT NULL DEFAULT 0,
  pushed_to_grades INTEGER NOT NULL DEFAULT 0,
  /* The only thing that lets a phone write to this attempt. Attempt ids are
     sequential, so on their own they let any student on the Wi-Fi rewrite or
     submit a classmate's exam by guessing a neighbouring number. Replaced on
     every join, so taking an attempt over locks the previous phone out. */
  access_token  TEXT,
  deleted_at    TEXT,
  UNIQUE(session_id, student_id)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id    INTEGER NOT NULL REFERENCES exam_attempts(id),
  question_id   INTEGER NOT NULL REFERENCES exam_questions(id),
  answer        TEXT,
  is_correct    INTEGER,          -- NULL until marked
  awarded_marks REAL NOT NULL DEFAULT 0,
  UNIQUE(attempt_id, question_id)
);

/* A record of every WhatsApp message prepared, so the office can see who has
   already been contacted and nobody gets messaged twice. */
CREATE TABLE IF NOT EXISTS message_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  channel    TEXT NOT NULL DEFAULT 'whatsapp',
  purpose    TEXT NOT NULL,           -- fees | absence | reportCard | custom
  phone      TEXT NOT NULL,
  body       TEXT NOT NULL,
  sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
  sent_by    INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_exam_questions   ON exam_questions(exam_id, order_index);
CREATE INDEX IF NOT EXISTS idx_exam_attempts    ON exam_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers     ON exam_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_message_log      ON message_log(student_id, sent_at);

/* ---------------------------------------------------------------
   Library — physical copies to lend, and digital books that
   students can read on their phones over the school Wi-Fi.
   --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS library_books (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id      INTEGER NOT NULL REFERENCES schools(id),
  title          TEXT NOT NULL,
  title_ar       TEXT,
  author         TEXT,
  category       TEXT,
  isbn           TEXT,
  shelf          TEXT,
  description    TEXT,
  cover_path     TEXT,
  /* A PDF or ebook kept with the school's data. When set, the book can be
     read on a phone from the library page; copies_total may be 0. */
  file_path      TEXT,
  file_name      TEXT,
  copies_total   INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);

CREATE TABLE IF NOT EXISTS library_loans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id      INTEGER NOT NULL REFERENCES library_books(id),
  student_id   INTEGER REFERENCES students(id),
  staff_id     INTEGER REFERENCES staff(id),
  borrowed_at  TEXT NOT NULL DEFAULT (date('now')),
  due_at       TEXT NOT NULL,
  returned_at  TEXT,
  fine_amount  REAL NOT NULL DEFAULT 0,
  fine_paid    INTEGER NOT NULL DEFAULT 0,
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  deleted_at   TEXT
);

/* ---------------------------------------------------------------
   Transport — buses, drivers, who rides which bus, and whether
   the family has paid for it.
   --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS transport_routes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id      INTEGER NOT NULL REFERENCES schools(id),
  name           TEXT NOT NULL,
  name_ar        TEXT,
  driver_name    TEXT,
  driver_name_ar TEXT,
  driver_phone   TEXT,
  assistant_name TEXT,
  vehicle_number TEXT,
  capacity       INTEGER,
  /* The times the bus leaves, so the office can answer a parent's question
     without phoning the driver. */
  morning_time   TEXT,
  afternoon_time TEXT,
  stops          TEXT,
  fee_per_term   REAL NOT NULL DEFAULT 0,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);

CREATE TABLE IF NOT EXISTS transport_riders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id     INTEGER NOT NULL REFERENCES transport_routes(id),
  student_id   INTEGER NOT NULL REFERENCES students(id),
  pickup_point TEXT,
  direction    TEXT NOT NULL DEFAULT 'both', -- morning | afternoon | both
  term         TEXT,
  started_at   TEXT NOT NULL DEFAULT (date('now')),
  ended_at     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

/* Transport money is kept separate from school fees so the two never get
   confused in a report, but it works the same way: charge, then payments. */
CREATE TABLE IF NOT EXISTS transport_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id    INTEGER NOT NULL REFERENCES transport_riders(id),
  amount_paid REAL NOT NULL,
  date        TEXT NOT NULL DEFAULT (date('now')),
  method      TEXT NOT NULL DEFAULT 'cash',
  receipt_no  TEXT NOT NULL UNIQUE,
  note        TEXT,
  recorded_by INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_library_loans_open ON library_loans(returned_at, due_at);
CREATE INDEX IF NOT EXISTS idx_library_loans_book ON library_loans(book_id);
CREATE INDEX IF NOT EXISTS idx_riders_route       ON transport_riders(route_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_riders_student     ON transport_riders(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_payments ON transport_payments(rider_id);

/* ---------------------------------------------------------------------------
   Integrity backstops.

   The services validate everything before writing (electron/validate.ts), so
   none of these should ever fire. They exist for the day a future code path
   forgets: the columns below feed every attendance percentage and every money
   total in the school, and one bad row silently corrupts all of them.

   Triggers rather than CHECK constraints because SQLite cannot add a CHECK to
   a table that already exists. A school that has used the program for a year
   would never receive one; it does receive these, on the next start.

   Scoped with UPDATE OF <column>, so a soft delete or a restore — which only
   touch deleted_at — is never blocked by an old row that predates the rules.
   --------------------------------------------------------------------------- */

CREATE TRIGGER IF NOT EXISTS attendance_status_ins BEFORE INSERT ON attendance
WHEN NEW.status NOT IN ('present', 'absent', 'late', 'excused')
BEGIN SELECT RAISE(ABORT, 'attendance status must be present, absent, late or excused'); END;

CREATE TRIGGER IF NOT EXISTS attendance_status_upd BEFORE UPDATE OF status ON attendance
WHEN NEW.status NOT IN ('present', 'absent', 'late', 'excused')
BEGIN SELECT RAISE(ABORT, 'attendance status must be present, absent, late or excused'); END;

CREATE TRIGGER IF NOT EXISTS attendance_date_ins BEFORE INSERT ON attendance
WHEN NEW.date NOT GLOB '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'attendance date must be YYYY-MM-DD'); END;

CREATE TRIGGER IF NOT EXISTS staff_attendance_status_ins BEFORE INSERT ON staff_attendance
WHEN NEW.status NOT IN ('present', 'absent', 'late', 'leave')
BEGIN SELECT RAISE(ABORT, 'staff attendance status must be present, absent, late or leave'); END;

CREATE TRIGGER IF NOT EXISTS staff_attendance_status_upd BEFORE UPDATE OF status ON staff_attendance
WHEN NEW.status NOT IN ('present', 'absent', 'late', 'leave')
BEGIN SELECT RAISE(ABORT, 'staff attendance status must be present, absent, late or leave'); END;

/* Money: positive, finite, and below a bound no school payment reaches. The
   upper bound is what catches Infinity, which is greater than any number. */
CREATE TRIGGER IF NOT EXISTS fee_payment_amount_ins BEFORE INSERT ON fee_payments
WHEN NOT (NEW.amount_paid > 0 AND NEW.amount_paid <= 10000000)
BEGIN SELECT RAISE(ABORT, 'payment amount must be above 0 and at most 10,000,000'); END;

CREATE TRIGGER IF NOT EXISTS fee_payment_amount_upd BEFORE UPDATE OF amount_paid ON fee_payments
WHEN NOT (NEW.amount_paid > 0 AND NEW.amount_paid <= 10000000)
BEGIN SELECT RAISE(ABORT, 'payment amount must be above 0 and at most 10,000,000'); END;

CREATE TRIGGER IF NOT EXISTS fee_payment_method_ins BEFORE INSERT ON fee_payments
WHEN NEW.method NOT IN ('cash', 'bank', 'card', 'other')
BEGIN SELECT RAISE(ABORT, 'payment method must be cash, bank, card or other'); END;

CREATE TRIGGER IF NOT EXISTS fee_payment_date_ins BEFORE INSERT ON fee_payments
WHEN NEW.date NOT GLOB '[12][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'
BEGIN SELECT RAISE(ABORT, 'payment date must be YYYY-MM-DD'); END;

CREATE TRIGGER IF NOT EXISTS transport_payment_amount_ins BEFORE INSERT ON transport_payments
WHEN NOT (NEW.amount_paid > 0 AND NEW.amount_paid <= 10000000)
BEGIN SELECT RAISE(ABORT, 'payment amount must be above 0 and at most 10,000,000'); END;

CREATE TRIGGER IF NOT EXISTS transport_payment_method_ins BEFORE INSERT ON transport_payments
WHEN NEW.method NOT IN ('cash', 'bank', 'card', 'other')
BEGIN SELECT RAISE(ABORT, 'payment method must be cash, bank, card or other'); END;

CREATE TRIGGER IF NOT EXISTS student_gender_ins BEFORE INSERT ON students
WHEN NEW.gender IS NOT NULL AND NEW.gender NOT IN ('male', 'female')
BEGIN SELECT RAISE(ABORT, 'student gender must be male, female or empty'); END;

CREATE TRIGGER IF NOT EXISTS student_gender_upd BEFORE UPDATE OF gender ON students
WHEN NEW.gender IS NOT NULL AND NEW.gender NOT IN ('male', 'female')
BEGIN SELECT RAISE(ABORT, 'student gender must be male, female or empty'); END;
