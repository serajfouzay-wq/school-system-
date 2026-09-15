import { getDb, softDelete } from '../db/index'
import type { TimetableEntry } from '../../shared/types'

const SELECT = `
  SELECT t.*, sub.name AS subject_name, sub.name_ar AS subject_name_ar,
         st.full_name AS staff_name, c.name || ' - ' || s.name AS section_label
    FROM timetable_entries t
    JOIN subjects sub ON sub.id = t.subject_id
    LEFT JOIN staff st ON st.id = t.staff_id
    JOIN sections s ON s.id = t.section_id
    JOIN classes c ON c.id = s.class_id`

export function listTimetable(filter: { section_id?: number; staff_id?: number } = {}): TimetableEntry[] {
  const clauses = ['t.deleted_at IS NULL']
  if (filter.section_id) clauses.push('t.section_id = @section_id')
  if (filter.staff_id) clauses.push('t.staff_id = @staff_id')
  return getDb()
    .prepare(`${SELECT} WHERE ${clauses.join(' AND ')} ORDER BY t.day_of_week, t.start_time`)
    .all({ section_id: filter.section_id ?? null, staff_id: filter.staff_id ?? null }) as TimetableEntry[]
}

export interface Conflict { kind: 'teacher' | 'section'; message: string; entry: TimetableEntry }

/**
 * A teacher cannot be in two rooms at once, and a section cannot have two
 * lessons at once. We warn rather than block, so the user stays in control.
 */
export function findConflicts(input: {
  id?: number; section_id: number; staff_id: number | null
  day_of_week: number; start_time: string; end_time: string
}): Conflict[] {
  const overlaps = (a: TimetableEntry) =>
    a.day_of_week === input.day_of_week &&
    a.start_time < input.end_time &&
    input.start_time < a.end_time &&
    a.id !== input.id

  const conflicts: Conflict[] = []
  if (input.staff_id) {
    for (const e of listTimetable({ staff_id: input.staff_id })) {
      if (overlaps(e)) {
        conflicts.push({ kind: 'teacher', message: `${e.staff_name} already teaches ${e.subject_name} to ${e.section_label} at this time.`, entry: e })
      }
    }
  }
  for (const e of listTimetable({ section_id: input.section_id })) {
    if (overlaps(e)) {
      conflicts.push({ kind: 'section', message: `${e.section_label} already has ${e.subject_name} at this time.`, entry: e })
    }
  }
  return conflicts
}

export function saveTimetableEntry(input: {
  id?: number; section_id: number; subject_id: number; staff_id: number | null
  day_of_week: number; start_time: string; end_time: string; room?: string | null
}): { entry: TimetableEntry; conflicts: Conflict[] } {
  if (input.start_time >= input.end_time) throw new Error('The end time must be after the start time.')
  const conflicts = findConflicts(input)
  const d = getDb()
  let id = input.id
  if (id) {
    d.prepare(
      `UPDATE timetable_entries SET section_id = ?, subject_id = ?, staff_id = ?, day_of_week = ?,
        start_time = ?, end_time = ?, room = ? WHERE id = ?`
    ).run(input.section_id, input.subject_id, input.staff_id, input.day_of_week, input.start_time, input.end_time, input.room ?? null, id)
  } else {
    const info = d
      .prepare(
        `INSERT INTO timetable_entries (section_id, subject_id, staff_id, day_of_week, start_time, end_time, room)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.section_id, input.subject_id, input.staff_id, input.day_of_week, input.start_time, input.end_time, input.room ?? null)
    id = Number(info.lastInsertRowid)
  }
  const entry = listTimetable({ section_id: input.section_id }).find((e) => e.id === id)!
  return { entry, conflicts }
}

export function deleteTimetableEntry(id: number, userId: number | null): void {
  softDelete('timetable_entries', id, `Timetable lesson #${id}`, userId)
}

/** Default period grid offered by the builder so the user never starts blank. */
export function defaultPeriods(): { start_time: string; end_time: string }[] {
  return [
    { start_time: '08:00', end_time: '08:45' },
    { start_time: '08:50', end_time: '09:35' },
    { start_time: '09:40', end_time: '10:25' },
    { start_time: '10:45', end_time: '11:30' },
    { start_time: '11:35', end_time: '12:20' },
    { start_time: '12:25', end_time: '13:10' },
  ]
}
