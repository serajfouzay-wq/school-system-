-- School Management System — core schema.
-- Every user-facing table carries `deleted_at` so a delete is always recoverable
-- from the Recycle Bin ("nothing is ever truly lost").

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schools (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  name_ar             TEXT,
  logo_path           TEXT,
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
CREATE INDEX IF NOT EXISTS idx_timetable_section  ON timetable_entries(section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_recycle_open       ON recycle_bin(restored_at, deleted_at);
