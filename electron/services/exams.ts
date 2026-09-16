import { getDb, softDelete } from '../db/index'
import { getSchool } from './school'

export type QuestionKind = 'mcq' | 'truefalse' | 'short'

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

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

const EXAM_SELECT = `
  SELECT e.*,
         (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id AND q.deleted_at IS NULL) AS question_count,
         (SELECT COALESCE(SUM(q.marks), 0) FROM exam_questions q WHERE q.exam_id = e.id AND q.deleted_at IS NULL) AS total_marks,
         sub.name AS subject_name,
         c.name || ' - ' || s.name AS section_label,
         t.name AS term_name
    FROM exams e
    LEFT JOIN subjects sub ON sub.id = e.subject_id
    LEFT JOIN sections s ON s.id = e.section_id
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN exam_terms t ON t.id = e.exam_term_id`

export function listExams(): Exam[] {
  return getDb().prepare(`${EXAM_SELECT} WHERE e.deleted_at IS NULL ORDER BY e.created_at DESC`).all() as Exam[]
}

export function getExam(id: number): Exam | null {
  return (getDb().prepare(`${EXAM_SELECT} WHERE e.id = ?`).get(id) as Exam) ?? null
}

export function saveExam(input: Partial<Exam> & { title: string }, userId: number | null): Exam {
  const d = getDb()
  if (!input.title?.trim()) throw new Error('Please give the exam a name.')
  const fields = {
    title: input.title.trim(),
    title_ar: input.title_ar?.trim() || null,
    subject_id: input.subject_id ?? null,
    section_id: input.section_id ?? null,
    exam_term_id: input.exam_term_id ?? null,
    duration_minutes: input.duration_minutes ?? 30,
    shuffle: input.shuffle ?? 1,
    instructions: input.instructions ?? null,
    status: input.status ?? 'draft',
  }
  if (input.id) {
    d.prepare(
      `UPDATE exams SET title=@title, title_ar=@title_ar, subject_id=@subject_id, section_id=@section_id,
        exam_term_id=@exam_term_id, duration_minutes=@duration_minutes, shuffle=@shuffle,
        instructions=@instructions, status=@status WHERE id=@id`
    ).run({ ...fields, id: input.id })
    return getExam(input.id)!
  }
  const info = d
    .prepare(
      `INSERT INTO exams (school_id, title, title_ar, subject_id, section_id, exam_term_id,
         duration_minutes, shuffle, instructions, status, created_by)
       VALUES (@school_id, @title, @title_ar, @subject_id, @section_id, @exam_term_id,
         @duration_minutes, @shuffle, @instructions, @status, @created_by)`
    )
    .run({ ...fields, school_id: schoolId(), created_by: userId })
  return getExam(Number(info.lastInsertRowid))!
}

export function deleteExam(id: number, userId: number | null): void {
  const e = getExam(id)
  softDelete('exams', id, e ? `${e.title} (exam)` : `Exam #${id}`, userId)
}

/* ---------------- Questions ---------------- */

function rowToQuestion(r: Record<string, unknown>): ExamQuestion {
  return {
    id: r.id as number,
    exam_id: r.exam_id as number,
    kind: r.kind as QuestionKind,
    text: r.text as string,
    marks: r.marks as number,
    options: r.options_json ? (JSON.parse(r.options_json as string) as string[]) : [],
    correct: (r.correct as string) ?? null,
    order_index: r.order_index as number,
  }
}

export function listQuestions(examId: number): ExamQuestion[] {
  const rows = getDb()
    .prepare(`SELECT * FROM exam_questions WHERE exam_id = ? AND deleted_at IS NULL ORDER BY order_index, id`)
    .all(examId) as Record<string, unknown>[]
  return rows.map(rowToQuestion)
}

export function saveQuestion(input: {
  id?: number
  exam_id: number
  kind: QuestionKind
  text: string
  marks?: number
  options?: string[]
  correct?: string | null
  order_index?: number
}): ExamQuestion {
  const d = getDb()
  if (!input.text?.trim()) throw new Error('Please type the question.')
  if (input.kind === 'mcq') {
    const opts = (input.options ?? []).filter((o) => o.trim())
    if (opts.length < 2) throw new Error('A multiple-choice question needs at least two answers to choose from.')
    if (input.correct === null || input.correct === undefined || input.correct === '') {
      throw new Error('Please mark which answer is the correct one.')
    }
  }
  if (input.kind === 'short' && !input.correct?.trim()) {
    throw new Error('Please type the accepted answer, so the exam can mark itself.')
  }

  const fields = {
    kind: input.kind,
    text: input.text.trim(),
    marks: input.marks ?? 1,
    options_json: input.kind === 'mcq' ? JSON.stringify((input.options ?? []).filter((o) => o.trim())) : null,
    correct: input.correct ?? null,
    order_index: input.order_index ?? 0,
  }

  if (input.id) {
    d.prepare(
      `UPDATE exam_questions SET kind=@kind, text=@text, marks=@marks, options_json=@options_json,
        correct=@correct, order_index=@order_index WHERE id=@id`
    ).run({ ...fields, id: input.id })
    return listQuestions(input.exam_id).find((q) => q.id === input.id)!
  }
  const next = (d.prepare(`SELECT COALESCE(MAX(order_index), 0) + 1 AS n FROM exam_questions WHERE exam_id = ?`)
    .get(input.exam_id) as { n: number }).n
  const info = d
    .prepare(
      `INSERT INTO exam_questions (exam_id, kind, text, marks, options_json, correct, order_index)
       VALUES (@exam_id, @kind, @text, @marks, @options_json, @correct, @order_index)`
    )
    .run({ ...fields, exam_id: input.exam_id, order_index: input.order_index ?? next })
  return listQuestions(input.exam_id).find((q) => q.id === Number(info.lastInsertRowid))!
}

export function deleteQuestion(id: number, userId: number | null): void {
  softDelete('exam_questions', id, `Exam question #${id}`, userId)
}

export function reorderQuestions(examId: number, orderedIds: number[]): void {
  const d = getDb()
  const stmt = d.prepare(`UPDATE exam_questions SET order_index = ? WHERE id = ? AND exam_id = ?`)
  const tx = d.transaction(() => orderedIds.forEach((id, i) => stmt.run(i + 1, id, examId)))
  tx()
}

/* ---------------- Marking ---------------- */

/** Normalises a typed answer so trivial differences do not cost a mark. */
function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Arabic: strip diacritics/tatweel and unify alef and ta-marbuta forms, so
    // "مدرسة" and "مدرسه" both count.
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي/g, 'ى')
    .replace(/\s+/g, ' ')
}

/**
 * Marks one answer. Multiple choice and true/false are always decidable.
 * A typed answer is accepted when it matches one of the answers the teacher
 * listed; anything else is left for a human rather than guessed at.
 */
export function markAnswer(question: ExamQuestion, answer: string | null): { correct: boolean | null; marks: number } {
  const given = (answer ?? '').trim()
  if (!given) return { correct: false, marks: 0 }

  if (question.kind === 'mcq' || question.kind === 'truefalse') {
    const correct = given === (question.correct ?? '')
    return { correct, marks: correct ? question.marks : 0 }
  }

  const accepted = (question.correct ?? '').split('|').map(normalise).filter(Boolean)
  if (!accepted.length) return { correct: null, marks: 0 }
  const correct = accepted.includes(normalise(given))
  // A wrong-looking typed answer is flagged, not failed outright: spelling and
  // phrasing vary, and a teacher should get the final say.
  return correct ? { correct: true, marks: question.marks } : { correct: null, marks: 0 }
}

export function markAttempt(attemptId: number): { score: number; maxScore: number; needsReview: boolean } {
  const d = getDb()
  const attempt = d.prepare(`SELECT * FROM exam_attempts WHERE id = ?`).get(attemptId) as
    | { id: number; session_id: number }
    | undefined
  if (!attempt) throw new Error('That attempt could not be found.')
  const session = d.prepare(`SELECT exam_id FROM exam_sessions WHERE id = ?`).get(attempt.session_id) as { exam_id: number }
  const questions = listQuestions(session.exam_id)
  const answers = d.prepare(`SELECT * FROM exam_answers WHERE attempt_id = ?`).all(attemptId) as
    { id: number; question_id: number; answer: string | null }[]

  let score = 0
  let needsReview = false
  const maxScore = questions.reduce((s, q) => s + q.marks, 0)
  const update = d.prepare(`UPDATE exam_answers SET is_correct = ?, awarded_marks = ? WHERE id = ?`)

  const tx = d.transaction(() => {
    for (const q of questions) {
      const a = answers.find((x) => x.question_id === q.id)
      if (!a) continue
      const result = markAnswer(q, a.answer)
      if (result.correct === null) needsReview = true
      score += result.marks
      update.run(result.correct === null ? null : result.correct ? 1 : 0, result.marks, a.id)
    }
    d.prepare(`UPDATE exam_attempts SET score = ?, max_score = ?, needs_review = ? WHERE id = ?`)
      .run(score, maxScore, needsReview ? 1 : 0, attemptId)
  })
  tx()
  return { score, maxScore, needsReview }
}

/** A teacher overriding one typed answer; the attempt total is recalculated. */
export function overrideAnswer(answerId: number, correct: boolean): void {
  const d = getDb()
  const row = d
    .prepare(
      `SELECT a.id, a.attempt_id, q.marks FROM exam_answers a
        JOIN exam_questions q ON q.id = a.question_id WHERE a.id = ?`
    )
    .get(answerId) as { id: number; attempt_id: number; marks: number } | undefined
  if (!row) throw new Error('That answer could not be found.')

  const tx = d.transaction(() => {
    d.prepare(`UPDATE exam_answers SET is_correct = ?, awarded_marks = ? WHERE id = ?`)
      .run(correct ? 1 : 0, correct ? row.marks : 0, answerId)
    const totals = d
      .prepare(`SELECT COALESCE(SUM(awarded_marks), 0) AS score, SUM(is_correct IS NULL) AS pending
                  FROM exam_answers WHERE attempt_id = ?`)
      .get(row.attempt_id) as { score: number; pending: number }
    d.prepare(`UPDATE exam_attempts SET score = ?, needs_review = ? WHERE id = ?`)
      .run(totals.score, totals.pending > 0 ? 1 : 0, row.attempt_id)
  })
  tx()
}

/* ---------------- Sessions ---------------- */

export interface AttemptRow {
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

/** Six characters, no 0/O/1/I — these get read aloud and typed on a phone. */
function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export function openSession(examId: number, userId: number | null): { id: number; join_code: string } {
  const d = getDb()
  const exam = getExam(examId)
  if (!exam) throw new Error('That exam could not be found.')
  if (!exam.question_count) throw new Error('Add at least one question before starting the exam.')
  if (!exam.section_id) throw new Error('Choose which class is sitting this exam first.')

  const existing = d
    .prepare(`SELECT id, join_code FROM exam_sessions WHERE exam_id = ? AND status = 'open' AND deleted_at IS NULL`)
    .get(examId) as { id: number; join_code: string } | undefined
  if (existing) return existing

  let code = makeJoinCode()
  while (d.prepare(`SELECT 1 FROM exam_sessions WHERE join_code = ? AND status = 'open'`).get(code)) {
    code = makeJoinCode()
  }
  const info = d
    .prepare(`INSERT INTO exam_sessions (exam_id, join_code, opened_by) VALUES (?, ?, ?)`)
    .run(examId, code, userId)
  return { id: Number(info.lastInsertRowid), join_code: code }
}

export function closeSession(sessionId: number): void {
  const d = getDb()
  const tx = d.transaction(() => {
    // Anyone still writing when time is called gets marked on what they have.
    const open = d
      .prepare(`SELECT id FROM exam_attempts WHERE session_id = ? AND submitted_at IS NULL`)
      .all(sessionId) as { id: number }[]
    for (const a of open) {
      d.prepare(`UPDATE exam_attempts SET submitted_at = datetime('now') WHERE id = ?`).run(a.id)
    }
    d.prepare(`UPDATE exam_sessions SET status = 'closed', ended_at = datetime('now') WHERE id = ?`).run(sessionId)
    for (const a of open) markAttempt(a.id)
  })
  tx()
}

export function activeSession(examId: number): { id: number; join_code: string; started_at: string } | null {
  return (
    (getDb()
      .prepare(`SELECT id, join_code, started_at FROM exam_sessions
                 WHERE exam_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`)
      .get(examId) as { id: number; join_code: string; started_at: string }) ?? null
  )
}

export function sessionByCode(code: string): { id: number; exam_id: number } | null {
  return (
    (getDb()
      .prepare(`SELECT id, exam_id FROM exam_sessions WHERE join_code = ? AND status = 'open' AND deleted_at IS NULL`)
      .get(code.trim().toUpperCase()) as { id: number; exam_id: number }) ?? null
  )
}

export function listAttempts(sessionId: number): AttemptRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.student_id, st.full_name, st.full_name_ar, st.student_code,
              a.started_at, a.submitted_at, a.score, a.max_score, a.needs_review, a.pushed_to_grades
         FROM exam_attempts a JOIN students st ON st.id = a.student_id
        WHERE a.session_id = ? AND a.deleted_at IS NULL
        ORDER BY a.submitted_at IS NULL DESC, st.full_name`
    )
    .all(sessionId) as AttemptRow[]
}

export function attemptDetail(attemptId: number) {
  const d = getDb()
  const attempt = d
    .prepare(
      `SELECT a.*, st.full_name, st.full_name_ar, st.student_code, s.exam_id
         FROM exam_attempts a
         JOIN students st ON st.id = a.student_id
         JOIN exam_sessions s ON s.id = a.session_id
        WHERE a.id = ?`
    )
    .get(attemptId) as Record<string, unknown> | undefined
  if (!attempt) throw new Error('That attempt could not be found.')
  const answers = d
    .prepare(
      `SELECT ans.id, ans.question_id, ans.answer, ans.is_correct, ans.awarded_marks,
              q.text, q.kind, q.marks, q.options_json, q.correct
         FROM exam_answers ans JOIN exam_questions q ON q.id = ans.question_id
        WHERE ans.attempt_id = ? ORDER BY q.order_index, q.id`
    )
    .all(attemptId) as Record<string, unknown>[]
  return {
    attempt,
    answers: answers.map((a) => ({
      id: a.id as number,
      question_id: a.question_id as number,
      text: a.text as string,
      kind: a.kind as QuestionKind,
      marks: a.marks as number,
      options: a.options_json ? (JSON.parse(a.options_json as string) as string[]) : [],
      correct: (a.correct as string) ?? null,
      answer: (a.answer as string) ?? null,
      is_correct: a.is_correct === null ? null : a.is_correct === 1,
      awarded_marks: a.awarded_marks as number,
    })),
  }
}

/**
 * Sends finished results into the normal Grades table, so an online exam feeds
 * the report card exactly like a paper one.
 */
export function pushToGrades(sessionId: number): { pushed: number; skipped: number } {
  const d = getDb()
  const session = d.prepare(`SELECT exam_id FROM exam_sessions WHERE id = ?`).get(sessionId) as { exam_id: number }
  const exam = getExam(session.exam_id)
  if (!exam) throw new Error('That exam could not be found.')
  if (!exam.subject_id || !exam.exam_term_id) {
    throw new Error('Choose a subject and an exam period on the exam before sending results to the report cards.')
  }

  const attempts = listAttempts(sessionId).filter((a) => a.submitted_at && a.score !== null)
  let pushed = 0
  let skipped = 0
  const stmt = d.prepare(
    `INSERT INTO grades (student_id, subject_id, exam_term_id, score, max_score, remarks, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(student_id, subject_id, exam_term_id) DO UPDATE SET
       score = excluded.score, max_score = excluded.max_score,
       updated_at = datetime('now'), deleted_at = NULL`
  )
  const tx = d.transaction(() => {
    for (const a of attempts) {
      if (a.needs_review) { skipped++; continue }
      stmt.run(a.student_id, exam.subject_id, exam.exam_term_id, a.score, a.max_score ?? 0, exam.title)
      d.prepare(`UPDATE exam_attempts SET pushed_to_grades = 1 WHERE id = ?`).run(a.id)
      pushed++
    }
  })
  tx()
  return { pushed, skipped }
}
