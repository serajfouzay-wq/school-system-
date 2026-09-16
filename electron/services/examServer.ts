import http from 'node:http'
import os from 'node:os'
import { getDb } from '../db/index'
import { getSchool } from './school'
import { sessionByCode, listQuestions, getExam, markAttempt } from './exams'
import { studentPage } from './examStudentPage'
import { libraryPage } from './libraryPage'
import { listBooks, getBook } from './library'
import fs from 'node:fs'
import path from 'node:path'
import { getSetting } from '../db/index'

/**
 * A small web server on the school's own network. Students open it on their
 * phones; nothing leaves the building and no internet connection is involved.
 *
 * The server is deliberately narrow: it only ever answers the handful of
 * requests an exam needs, it never touches the filesystem, and it never sends
 * a correct answer to a phone.
 */

let server: http.Server | null = null
let port = 8080

export interface ServerStatus {
  running: boolean
  port: number
  addresses: string[]
  url: string | null
}

/** The LAN addresses a phone could actually reach this computer on. */
export function localAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  // A 192.168.x / 10.x address is the one a school router hands out, so put
  // those first — it is what the teacher should read out.
  return out.sort((a, b) => Number(b.startsWith('192.168') || b.startsWith('10.')) - Number(a.startsWith('192.168') || a.startsWith('10.')))
}

export function status(): ServerStatus {
  const addresses = localAddresses()
  return {
    running: !!server?.listening,
    port,
    addresses,
    url: server?.listening && addresses.length ? `http://${addresses[0]}:${port}` : null,
  }
}

function send(res: http.ServerResponse, code: number, body: unknown, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : String(body)
  res.writeHead(code, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(payload)
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      // Nothing an exam sends is large; refuse anything that looks wrong.
      if (data.length > 100_000) { reject(new Error('Request too large')); req.destroy() }
    })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { reject(new Error('Bad request')) }
    })
    req.on('error', reject)
  })
}

/* ---------------- Route handlers ---------------- */

/** Who is sitting this exam — so a student can pick their own name. */
function handleStudents(code: string) {
  const session = sessionByCode(code)
  if (!session) throw new Error('That code is not open. Check with your teacher.')
  const exam = getExam(session.exam_id)
  if (!exam?.section_id) throw new Error('That exam has no class attached.')
  const school = getSchool()

  const students = getDb()
    .prepare(
      `SELECT st.id, st.full_name, st.full_name_ar, st.student_code
         FROM students st
        WHERE st.section_id = ? AND st.deleted_at IS NULL AND st.status = 'active'
        ORDER BY st.full_name`
    )
    .all(exam.section_id) as { id: number; full_name: string; full_name_ar: string | null; student_code: string }[]

  const taken = getDb()
    .prepare(`SELECT student_id FROM exam_attempts WHERE session_id = ? AND submitted_at IS NOT NULL`)
    .all(session.id) as { student_id: number }[]
  const done = new Set(taken.map((t) => t.student_id))

  return {
    exam: { title: exam.title, title_ar: exam.title_ar, duration_minutes: exam.duration_minutes, instructions: exam.instructions },
    school: { name: school?.name ?? '', name_ar: school?.name_ar ?? null },
    students: students.map((s) => ({ ...s, done: done.has(s.id) })),
  }
}

/** Start (or resume) an attempt and hand back the paper — answers stripped. */
function handleJoin(code: string, studentId: number) {
  const d = getDb()
  const session = sessionByCode(code)
  if (!session) throw new Error('That code is not open. Check with your teacher.')
  const exam = getExam(session.exam_id)!

  const belongs = d
    .prepare(`SELECT 1 FROM students WHERE id = ? AND section_id = ? AND deleted_at IS NULL`)
    .get(studentId, exam.section_id)
  if (!belongs) throw new Error('That student is not in this class.')

  const existing = d
    .prepare(`SELECT * FROM exam_attempts WHERE session_id = ? AND student_id = ?`)
    .get(session.id, studentId) as { id: number; submitted_at: string | null; started_at: string } | undefined
  if (existing?.submitted_at) throw new Error('You have already finished this exam.')

  let attemptId: number
  let startedAt: string
  if (existing) {
    attemptId = existing.id
    startedAt = existing.started_at
  } else {
    const info = d.prepare(`INSERT INTO exam_attempts (session_id, student_id) VALUES (?, ?)`).run(session.id, studentId)
    attemptId = Number(info.lastInsertRowid)
    startedAt = (d.prepare(`SELECT started_at FROM exam_attempts WHERE id = ?`).get(attemptId) as { started_at: string }).started_at
  }

  let questions = listQuestions(session.exam_id).map((q) => ({
    id: q.id,
    kind: q.kind,
    text: q.text,
    marks: q.marks,
    options: q.options,
    // `correct` is deliberately absent. The phone never learns the answers.
  }))
  if (exam.shuffle) questions = questions.sort(() => Math.random() - 0.5)

  const saved = d.prepare(`SELECT question_id, answer FROM exam_answers WHERE attempt_id = ?`).all(attemptId) as
    { question_id: number; answer: string | null }[]

  return {
    attemptId,
    startedAt,
    durationMinutes: exam.duration_minutes,
    title: exam.title,
    titleAr: exam.title_ar,
    instructions: exam.instructions,
    questions,
    answers: Object.fromEntries(saved.map((s) => [s.question_id, s.answer])),
  }
}

/** Saves as the student types, so a flat battery costs nothing. */
function handleAnswer(attemptId: number, questionId: number, answer: string) {
  const d = getDb()
  const open = d
    .prepare(`SELECT 1 FROM exam_attempts a JOIN exam_sessions s ON s.id = a.session_id
               WHERE a.id = ? AND a.submitted_at IS NULL AND s.status = 'open'`)
    .get(attemptId)
  if (!open) throw new Error('This exam is finished.')

  d.prepare(
    `INSERT INTO exam_answers (attempt_id, question_id, answer) VALUES (?, ?, ?)
     ON CONFLICT(attempt_id, question_id) DO UPDATE SET answer = excluded.answer`
  ).run(attemptId, questionId, answer)
  return { ok: true }
}

function handleSubmit(attemptId: number) {
  const d = getDb()
  const attempt = d.prepare(`SELECT submitted_at FROM exam_attempts WHERE id = ?`).get(attemptId) as
    { submitted_at: string | null } | undefined
  if (!attempt) throw new Error('That attempt could not be found.')
  if (attempt.submitted_at) throw new Error('You have already finished this exam.')

  d.prepare(`UPDATE exam_attempts SET submitted_at = datetime('now') WHERE id = ?`).run(attemptId)
  const result = markAttempt(attemptId)
  return {
    score: result.score,
    maxScore: result.maxScore,
    // A pending review is not shown as a mark, to avoid a misleading number.
    provisional: result.needsReview,
  }
}

/* ---------------- Server ---------------- */

export function start(desiredPort = 8080): Promise<ServerStatus> {
  if (server?.listening) return Promise.resolve(status())
  port = desiredPort

  server = http.createServer(async (req, res) => {
    // Phones are on the same network, not the same origin.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return send(res, 204, '')

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return send(res, 200, studentPage(), 'text/html')
      }
      if (req.method === 'GET' && url.pathname === '/api/ping') {
        return send(res, 200, { ok: true })
      }

      /* ---- Digital library, on the same network as the exams ---- */
      if (url.pathname.startsWith('/library')) {
        // The library is only reachable when the school has switched it on.
        if ((getSetting('library_share') ?? 'off') !== 'on') {
          return send(res, 403, { ok: false, error: 'The library is not being shared right now.' })
        }

        if (req.method === 'GET' && url.pathname === '/library') {
          return send(res, 200, libraryPage(), 'text/html')
        }
        if (req.method === 'GET' && url.pathname === '/library/api/books') {
          const school = getSchool()
          const books = listBooks({ search: url.searchParams.get('q') ?? undefined, onlyDigital: true })
          return send(res, 200, {
            ok: true,
            data: {
              school: { name: school?.name ?? '', name_ar: school?.name_ar ?? null },
              // The school's own language wins over the phone's, the same way
              // it does on every screen inside the building.
              language: school?.language ?? 'en',
              books: books.map((b) => ({
                id: b.id, title: b.title, title_ar: b.title_ar,
                author: b.author, category: b.category, description: b.description,
                file_name: b.file_name,
              })),
            },
          })
        }
        if (req.method === 'GET' && url.pathname.startsWith('/library/file/')) {
          const id = Number(url.pathname.split('/').pop())
          const book = getBook(id)
          if (!book?.file_path || !fs.existsSync(book.file_path)) {
            return send(res, 404, { ok: false, error: 'That book is not available.' })
          }
          const ext = path.extname(book.file_path).toLowerCase()
          const types: Record<string, string> = {
            '.pdf': 'application/pdf', '.epub': 'application/epub+zip',
            '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          }
          const stat = fs.statSync(book.file_path)
          res.writeHead(200, {
            'Content-Type': types[ext] ?? 'application/octet-stream',
            'Content-Length': stat.size,
            // `inline` lets a phone open a PDF in the browser instead of
            // forcing a download the student then cannot find.
            'Content-Disposition': `inline; filename="${encodeURIComponent(book.file_name ?? 'book')}"`,
            'Cache-Control': 'no-store',
          })
          return fs.createReadStream(book.file_path).pipe(res)
        }
        return send(res, 404, { ok: false, error: 'Not found' })
      }
      if (req.method === 'GET' && url.pathname === '/api/students') {
        return send(res, 200, { ok: true, data: handleStudents(url.searchParams.get('code') ?? '') })
      }
      if (req.method === 'POST' && url.pathname === '/api/join') {
        const body = await readJson(req)
        return send(res, 200, { ok: true, data: handleJoin(String(body.code ?? ''), Number(body.studentId)) })
      }
      if (req.method === 'POST' && url.pathname === '/api/answer') {
        const body = await readJson(req)
        return send(res, 200, {
          ok: true,
          data: handleAnswer(Number(body.attemptId), Number(body.questionId), String(body.answer ?? '')),
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/submit') {
        const body = await readJson(req)
        return send(res, 200, { ok: true, data: handleSubmit(Number(body.attemptId)) })
      }
      return send(res, 404, { ok: false, error: 'Not found' })
    } catch (e) {
      // Messages here are read by students, so they stay plain and blameless.
      return send(res, 400, { ok: false, error: e instanceof Error ? e.message : 'Something went wrong' })
    }
  })

  // `listen` is asynchronous, so the status has to wait for it. Reporting too
  // early told the teacher the exam was not running when it already was.
  return new Promise<ServerStatus>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      console.error('[exam server]', err)
      server = null
      reject(
        err.code === 'EADDRINUSE'
          ? new Error(`Another program is already using port ${port}. Choose a different port in Settings.`)
          : err
      )
    }
    server!.once('error', onError)
    server!.listen(port, '0.0.0.0', () => {
      server!.off('error', onError)
      // From here on, a late failure should not crash the app.
      server!.on('error', (e) => console.error('[exam server]', e))
      resolve(status())
    })
  })
}

export function stop(): ServerStatus {
  if (server) {
    server.close()
    server = null
  }
  return status()
}
