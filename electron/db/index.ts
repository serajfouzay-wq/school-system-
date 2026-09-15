import Database from 'better-sqlite3'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
// The schema is inlined at build time, so there is no file to find at runtime
// in dev or inside a packaged app.
import schemaSql from './schema.sql?raw'

let db: Database.Database | null = null

/**
 * The whole school lives in one file. Keeping it in userData means a
 * non-technical user can back the school up by copying a single file.
 */
export function dbPath(): string {
  return path.join(app.getPath('userData'), 'school_data.db')
}

export function filesDir(): string {
  const dir = path.join(app.getPath('userData'), 'files')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function backupsDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getDb(): Database.Database {
  if (db) return db
  const file = dbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(schemaSql)
  return db
}

/** Close the handle so the file can be copied/replaced safely. */
export function closeDb(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* best effort */
    }
    db.close()
    db = null
  }
}

/* ---------- PIN hashing (offline, no network) ---------- */

export function hashSecret(secret: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex')
  return { hash, salt }
}

export function verifySecret(secret: string, hash: string, salt: string): boolean {
  const candidate = crypto.scryptSync(secret, salt, 64)
  const known = Buffer.from(hash, 'hex')
  if (candidate.length !== known.length) return false
  return crypto.timingSafeEqual(candidate, known)
}

/* ---------- Soft delete helpers ---------- */

const SOFT_DELETE_TABLES = new Set([
  'students', 'staff', 'classes', 'sections', 'subjects', 'users',
  'attendance', 'staff_attendance', 'exam_terms', 'grades',
  'fee_structures', 'fee_payments', 'timetable_entries',
  'announcements', 'calendar_events', 'student_notes',
  'student_documents', 'teacher_assignments',
])

/**
 * Soft-delete a row and record it in the Recycle Bin, so every delete in the
 * app is recoverable. `label` is what the user will see in the bin.
 */
export function softDelete(table: string, id: number, label: string, userId: number | null): void {
  if (!SOFT_DELETE_TABLES.has(table)) throw new Error(`Table "${table}" does not support delete`)
  const d = getDb()
  const tx = d.transaction(() => {
    d.prepare(`UPDATE ${table} SET deleted_at = datetime('now') WHERE id = ?`).run(id)
    d.prepare(
      `INSERT INTO recycle_bin (table_name, record_id, label, deleted_by) VALUES (?, ?, ?, ?)`
    ).run(table, id, label, userId)
  })
  tx()
}

export function restoreFromBin(binId: number): void {
  const d = getDb()
  const entry = d.prepare(`SELECT * FROM recycle_bin WHERE id = ? AND restored_at IS NULL`).get(binId) as
    | { id: number; table_name: string; record_id: number }
    | undefined
  if (!entry) throw new Error('This item is not in the Recycle Bin any more.')
  if (!SOFT_DELETE_TABLES.has(entry.table_name)) throw new Error('Unknown item type')
  const tx = d.transaction(() => {
    d.prepare(`UPDATE ${entry.table_name} SET deleted_at = NULL WHERE id = ?`).run(entry.record_id)
    d.prepare(`UPDATE recycle_bin SET restored_at = datetime('now') WHERE id = ?`).run(entry.id)
  })
  tx()
}

/**
 * Items stay recoverable for at least 30 days (acceptance checklist), then the
 * bin entry is dropped. The underlying row is left soft-deleted rather than
 * hard-deleted so foreign keys in historical records never break.
 */
export function purgeExpiredBinEntries(days = 30): number {
  const d = getDb()
  const res = d
    .prepare(`DELETE FROM recycle_bin WHERE restored_at IS NULL AND deleted_at < datetime('now', ?)`)
    .run(`-${days} days`)
  return res.changes
}

/* ---------- Small helpers used across services ---------- */

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value)
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
