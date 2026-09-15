import { getDb, softDelete, today } from '../db/index'
import type { Announcement, CalendarEvent, EventType } from '../../shared/types'
import { getSchool } from './school'

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

export function listAnnouncements(limit = 50): Announcement[] {
  return getDb()
    .prepare(
      `SELECT a.*, u.name AS author_name FROM announcements a
        LEFT JOIN users u ON u.id = a.created_by
       WHERE a.deleted_at IS NULL ORDER BY a.date DESC, a.id DESC LIMIT ?`
    )
    .all(limit) as Announcement[]
}

export function saveAnnouncement(input: { id?: number; title: string; body?: string | null; date?: string }, userId: number | null): void {
  if (!input.title?.trim()) throw new Error('Please type a title for the announcement.')
  const d = getDb()
  if (input.id) {
    d.prepare(`UPDATE announcements SET title = ?, body = ?, date = ? WHERE id = ?`)
      .run(input.title.trim(), input.body ?? null, input.date ?? today(), input.id)
    return
  }
  d.prepare(`INSERT INTO announcements (school_id, title, body, date, created_by) VALUES (?, ?, ?, ?, ?)`)
    .run(schoolId(), input.title.trim(), input.body ?? null, input.date ?? today(), userId)
}

export function deleteAnnouncement(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT title FROM announcements WHERE id = ?`).get(id) as { title: string } | undefined
  softDelete('announcements', id, row ? `${row.title} (announcement)` : `Announcement #${id}`, userId)
}

export function listEvents(filter: { from?: string; to?: string } = {}): CalendarEvent[] {
  const clauses = ['deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.from) { clauses.push('COALESCE(end_date, date) >= @from'); params.from = filter.from }
  if (filter.to) { clauses.push('date <= @to'); params.to = filter.to }
  return getDb().prepare(`SELECT * FROM calendar_events WHERE ${clauses.join(' AND ')} ORDER BY date`).all(params) as CalendarEvent[]
}

export function saveEvent(input: {
  id?: number; title: string; date: string; end_date?: string | null; type?: EventType; note?: string | null
}): void {
  if (!input.title?.trim()) throw new Error('Please type a name for the event.')
  if (!input.date) throw new Error('Please choose a date.')
  const d = getDb()
  if (input.id) {
    d.prepare(`UPDATE calendar_events SET title = ?, date = ?, end_date = ?, type = ?, note = ? WHERE id = ?`)
      .run(input.title.trim(), input.date, input.end_date ?? null, input.type ?? 'event', input.note ?? null, input.id)
    return
  }
  d.prepare(`INSERT INTO calendar_events (school_id, title, date, end_date, type, note) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(schoolId(), input.title.trim(), input.date, input.end_date ?? null, input.type ?? 'event', input.note ?? null)
}

export function deleteEvent(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT title FROM calendar_events WHERE id = ?`).get(id) as { title: string } | undefined
  softDelete('calendar_events', id, row ? `${row.title} (event)` : `Event #${id}`, userId)
}
