import { getDb, restoreFromBin, purgeExpiredBinEntries } from '../db/index'
import type { RecycleBinEntry } from '../../shared/types'

export function listRecycleBin(): RecycleBinEntry[] {
  return getDb()
    .prepare(
      `SELECT * FROM recycle_bin WHERE restored_at IS NULL ORDER BY deleted_at DESC`
    )
    .all() as RecycleBinEntry[]
}

export function restore(binId: number): void {
  restoreFromBin(binId)
}

export function purgeExpired(): number {
  return purgeExpiredBinEntries(30)
}

/** Plain-language names so the bin never shows a table name to the user. */
export const FRIENDLY_TABLE_KEYS: Record<string, string> = {
  students: 'student',
  staff: 'staff',
  classes: 'class',
  sections: 'section',
  subjects: 'subject',
  users: 'user',
  attendance: 'attendance',
  staff_attendance: 'attendance',
  exam_terms: 'examTerm',
  grades: 'grade',
  fee_structures: 'fee',
  fee_payments: 'payment',
  timetable_entries: 'lesson',
  announcements: 'announcement',
  calendar_events: 'event',
  student_notes: 'note',
  student_documents: 'document',
  teacher_assignments: 'assignment',
}
