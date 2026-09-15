import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getDb, closeDb, dbPath, backupsDir, getSetting, setSetting } from '../db/index'
import type { BackupLogEntry } from '../../shared/types'

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

/**
 * better-sqlite3's online backup copies a consistent snapshot even while the
 * app is running, so "Backup Now" never needs the user to close anything.
 */
export async function createBackup(triggeredBy: 'auto' | 'manual', destDir?: string): Promise<BackupLogEntry> {
  const d = getDb()
  const dir = destDir ?? backupsDir()
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `school-backup-${stamp()}.db`)
  await d.backup(file)
  const size = fs.statSync(file).size
  const info = getDb()
    .prepare(`INSERT INTO backups_log (file_path, size_bytes, triggered_by) VALUES (?, ?, ?)`)
    .run(file, size, triggeredBy)
  setSetting('last_backup_at', new Date().toISOString())
  pruneOldBackups(dir)
  return getDb().prepare(`SELECT * FROM backups_log WHERE id = ?`).get(Number(info.lastInsertRowid)) as BackupLogEntry
}

/** Keep the most recent 20 automatic backups so the disk never fills up. */
function pruneOldBackups(dir: string, keep = 20): void {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('school-backup-') && f.endsWith('.db'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of files.slice(keep)) fs.unlinkSync(path.join(dir, old.f))
  } catch {
    /* pruning is best-effort; never block a backup */
  }
}

export function listBackups(): BackupLogEntry[] {
  const rows = getDb().prepare(`SELECT * FROM backups_log ORDER BY timestamp DESC LIMIT 50`).all() as BackupLogEntry[]
  return rows.filter((r) => fs.existsSync(r.file_path))
}

/**
 * Restore replaces the live database. The current data is copied aside first,
 * so even a restore is undoable — "nothing is ever truly lost".
 */
export function restoreBackup(sourceFile: string): { safetyCopy: string } {
  if (!fs.existsSync(sourceFile)) throw new Error('That backup file could not be found.')
  // Validate before touching anything live.
  const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3')
  const probe = new BetterSqlite3(sourceFile, { readonly: true })
  try {
    const t = probe.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'students'`).get()
    if (!t) throw new Error('That file is not a School System backup.')
  } finally {
    probe.close()
  }

  const live = dbPath()
  const safetyCopy = path.join(backupsDir(), `before-restore-${stamp()}.db`)
  closeDb()
  if (fs.existsSync(live)) fs.copyFileSync(live, safetyCopy)
  for (const suffix of ['-wal', '-shm']) {
    const f = live + suffix
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  fs.copyFileSync(sourceFile, live)
  getDb() // reopen and run migrations against the restored file
  return { safetyCopy }
}

/* ---------- Automatic daily backup ---------- */

let autoTimer: NodeJS.Timeout | null = null

export function lastBackupAt(): string | null {
  return getSetting('last_backup_at')
}

export function isAutoBackupEnabled(): boolean {
  return (getSetting('auto_backup') ?? 'on') === 'on'
}

export function setAutoBackup(enabled: boolean): void {
  setSetting('auto_backup', enabled ? 'on' : 'off')
  scheduleAutoBackup()
}

/** Checks hourly and backs up once a day; cheap enough for a low-spec PC. */
export function scheduleAutoBackup(): void {
  if (autoTimer) clearInterval(autoTimer)
  if (!isAutoBackupEnabled()) return
  const tick = async () => {
    try {
      const last = lastBackupAt()
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000
      if (!last || new Date(last).getTime() < dayAgo) await createBackup('auto')
    } catch (e) {
      console.error('Automatic backup failed:', e)
    }
  }
  autoTimer = setInterval(tick, 60 * 60 * 1000)
  setTimeout(tick, 30_000)
}

export function stopAutoBackup(): void {
  if (autoTimer) clearInterval(autoTimer)
  autoTimer = null
}

export function dataFolder(): string {
  return app.getPath('userData')
}
