import { amount, id, isoDate, optionalText, paymentMethod } from '../validate'
import { getDb, softDelete, today } from '../db/index'
import { getSchool } from './school'

/**
 * School buses: the route, who drives it and when it runs, which children ride
 * it, and whether the family has paid. Transport money is kept apart from
 * school fees so neither report can quietly swallow the other.
 */

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

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

/* ---------------- Routes ---------------- */

const ROUTE_SELECT = `
  SELECT r.*,
         (SELECT COUNT(*) FROM transport_riders rd
           WHERE rd.route_id = r.id AND rd.deleted_at IS NULL AND rd.ended_at IS NULL) AS rider_count
    FROM transport_routes r`

export function listRoutes(): Route[] {
  const d = getDb()
  const rows = d.prepare(`${ROUTE_SELECT} WHERE r.deleted_at IS NULL ORDER BY r.name`).all() as Route[]

  // Money per route, so the office can see which bus is not paying its way.
  return rows.map((r) => {
    const paid = (d
      .prepare(
        `SELECT COALESCE(SUM(p.amount_paid), 0) AS t
           FROM transport_payments p
           JOIN transport_riders rd ON rd.id = p.rider_id
          WHERE rd.route_id = ? AND p.deleted_at IS NULL AND rd.deleted_at IS NULL`
      )
      .get(r.id) as { t: number }).t
    const expected = (r.rider_count ?? 0) * r.fee_per_term
    return {
      ...r,
      seats_left: r.capacity === null ? null : Math.max(0, r.capacity - (r.rider_count ?? 0)),
      collected: paid,
      expected,
      outstanding: Math.max(0, expected - paid),
    }
  })
}

export function getRoute(id: number): Route | null {
  return listRoutes().find((r) => r.id === id) ?? null
}

export function saveRoute(input: Partial<Route> & { name: string }): Route {
  const d = getDb()
  if (!input.name?.trim()) throw new Error('Please give the bus route a name.')
  const fields = {
    name: input.name.trim(),
    name_ar: input.name_ar?.trim() || null,
    driver_name: input.driver_name?.trim() || null,
    driver_name_ar: input.driver_name_ar?.trim() || null,
    driver_phone: input.driver_phone?.trim() || null,
    assistant_name: input.assistant_name?.trim() || null,
    vehicle_number: input.vehicle_number?.trim() || null,
    capacity: input.capacity ?? null,
    morning_time: input.morning_time || null,
    afternoon_time: input.afternoon_time || null,
    stops: input.stops ?? null,
    fee_per_term: input.fee_per_term ?? 0,
    notes: input.notes ?? null,
    status: input.status ?? 'active',
  }
  if (input.id) {
    d.prepare(
      `UPDATE transport_routes SET name=@name, name_ar=@name_ar, driver_name=@driver_name,
        driver_name_ar=@driver_name_ar, driver_phone=@driver_phone, assistant_name=@assistant_name, vehicle_number=@vehicle_number,
        capacity=@capacity, morning_time=@morning_time, afternoon_time=@afternoon_time,
        stops=@stops, fee_per_term=@fee_per_term, notes=@notes, status=@status WHERE id=@id`
    ).run({ ...fields, id: input.id })
    return getRoute(input.id)!
  }
  const info = d
    .prepare(
      `INSERT INTO transport_routes (school_id, name, name_ar, driver_name, driver_name_ar,
         driver_phone, assistant_name, vehicle_number, capacity, morning_time, afternoon_time,
         stops, fee_per_term, notes, status)
       VALUES (@school_id, @name, @name_ar, @driver_name, @driver_name_ar, @driver_phone,
         @assistant_name, @vehicle_number, @capacity, @morning_time, @afternoon_time, @stops,
         @fee_per_term, @notes, @status)`
    )
    .run({ ...fields, school_id: schoolId() })
  return getRoute(Number(info.lastInsertRowid))!
}

export function deleteRoute(id: number, userId: number | null): void {
  const riders = (getDb()
    .prepare(`SELECT COUNT(*) AS n FROM transport_riders WHERE route_id = ? AND deleted_at IS NULL AND ended_at IS NULL`)
    .get(id) as { n: number }).n
  if (riders > 0) throw new Error(`${riders} student(s) still ride this bus. Move them to another route first.`)
  const r = getRoute(id)
  softDelete('transport_routes', id, r ? `${r.name} (bus route)` : `Route #${id}`, userId)
}

/* ---------------- Riders ---------------- */

const RIDER_SELECT = `
  SELECT rd.*, st.full_name AS student_name, st.full_name_ar AS student_name_ar,
         st.student_code, st.guardian_phone,
         COALESCE(c.name || ' - ' || s.name, '') AS class_label,
         COALESCE(COALESCE(c.name_ar, c.name) || ' - ' || COALESCE(s.name_ar, s.name), '') AS class_label_ar,
         r.name AS route_name, r.name_ar AS route_name_ar, r.fee_per_term,
         COALESCE((SELECT SUM(p.amount_paid) FROM transport_payments p
                    WHERE p.rider_id = rd.id AND p.deleted_at IS NULL), 0) AS paid
    FROM transport_riders rd
    JOIN students st ON st.id = rd.student_id
    JOIN transport_routes r ON r.id = rd.route_id
    LEFT JOIN sections s ON s.id = st.section_id
    LEFT JOIN classes c ON c.id = s.class_id`

export function listRiders(filter: { routeId?: number; studentId?: number; unpaidOnly?: boolean; activeOnly?: boolean } = {}): Rider[] {
  const clauses = ['rd.deleted_at IS NULL', 'st.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.routeId) { clauses.push('rd.route_id = @routeId'); params.routeId = filter.routeId }
  if (filter.studentId) { clauses.push('rd.student_id = @studentId'); params.studentId = filter.studentId }
  if (filter.activeOnly !== false) clauses.push('rd.ended_at IS NULL')

  const rows = getDb()
    .prepare(`${RIDER_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY r.name, st.full_name`)
    .all(params) as (Rider & { paid: number; fee_per_term: number })[]

  const riders = rows.map((r) => ({ ...r, balance: Math.max(0, (r.fee_per_term ?? 0) - (r.paid ?? 0)) }))
  return filter.unpaidOnly ? riders.filter((r) => (r.balance ?? 0) > 0) : riders
}

export function addRider(input: {
  route_id: number
  student_id: number
  pickup_point?: string | null
  direction?: Rider['direction']
  term?: string | null
}): Rider {
  const d = getDb()
  const route = getRoute(input.route_id)
  if (!route) throw new Error('That bus route could not be found.')

  const already = d
    .prepare(`SELECT 1 FROM transport_riders WHERE student_id = ? AND deleted_at IS NULL AND ended_at IS NULL`)
    .get(input.student_id)
  if (already) throw new Error('This student is already on a bus route. Take them off that one first.')

  if (route.capacity !== null && (route.rider_count ?? 0) >= route.capacity) {
    throw new Error(`This bus is full (${route.capacity} seats).`)
  }

  const info = d
    .prepare(`INSERT INTO transport_riders (route_id, student_id, pickup_point, direction, term) VALUES (?, ?, ?, ?, ?)`)
    .run(input.route_id, input.student_id, input.pickup_point ?? null, input.direction ?? 'both', input.term ?? null)
  return listRiders({ routeId: input.route_id }).find((r) => r.id === Number(info.lastInsertRowid))!
}

export function updateRider(id: number, patch: Partial<Rider>): void {
  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  for (const key of ['pickup_point', 'direction', 'term', 'route_id'] as const) {
    if (patch[key] !== undefined) { sets.push(`${key} = @${key}`); params[key] = patch[key] }
  }
  if (sets.length) getDb().prepare(`UPDATE transport_riders SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

/** Taking a child off the bus keeps the record and the payments; it just ends. */
export function endRide(id: number): void {
  getDb().prepare(`UPDATE transport_riders SET ended_at = ? WHERE id = ?`).run(today(), id)
}

export function removeRider(id: number, userId: number | null): void {
  softDelete('transport_riders', id, `Bus rider #${id}`, userId)
}

/* ---------------- Payments ---------------- */

export function nextReceiptNo(): string {
  const year = new Date().getFullYear()
  const row = getDb()
    .prepare(`SELECT receipt_no FROM transport_payments WHERE receipt_no LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`T-${year}-%`) as { receipt_no: string } | undefined
  const n = row ? Number(row.receipt_no.split('-')[2]) + 1 : 1
  return `T-${year}-${String(n).padStart(5, '0')}`
}

export function listPayments(riderId?: number) {
  const where = riderId ? 'AND p.rider_id = @riderId' : ''
  return getDb()
    .prepare(
      `SELECT p.*, st.full_name AS student_name, st.full_name_ar AS student_name_ar,
              st.student_code, r.name AS route_name, r.name_ar AS route_name_ar,
              COALESCE(c.name || ' - ' || sec.name, '') AS class_label,
              COALESCE(COALESCE(c.name_ar, c.name) || ' - ' || COALESCE(sec.name_ar, sec.name), '') AS class_label_ar,
              r.fee_per_term,
              /* What was still owed the moment this receipt was written. */
              MAX(0, r.fee_per_term - COALESCE((
                SELECT SUM(e.amount_paid) FROM transport_payments e
                 WHERE e.rider_id = p.rider_id AND e.deleted_at IS NULL AND e.id <= p.id), 0)) AS balance_after
         FROM transport_payments p
         JOIN transport_riders rd ON rd.id = p.rider_id
         JOIN students st ON st.id = rd.student_id
         JOIN transport_routes r ON r.id = rd.route_id
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE p.deleted_at IS NULL ${where}
        ORDER BY p.date DESC, p.id DESC`
    )
    .all({ riderId: riderId ?? null }) as Record<string, unknown>[]
}

export function recordPayment(
  input: { rider_id: number; amount_paid: number; date?: string; method?: string; note?: string | null },
  userId: number | null
) {
  const row = {
    rider_id: id(input.rider_id, 'The rider'),
    amount_paid: amount(input.amount_paid),
    date: input.date ? isoDate(input.date, 'The payment date') : today(),
    method: paymentMethod(input.method),
    note: optionalText(input.note, 'The note'),
  }
  const d = getDb()
  const insert = d.transaction(() =>
    d
      .prepare(
        `INSERT INTO transport_payments (rider_id, amount_paid, date, method, receipt_no, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(row.rider_id, row.amount_paid, row.date, row.method, nextReceiptNo(), row.note, userId)
  )
  const newId = Number(insert().lastInsertRowid)
  return listPayments(row.rider_id).find((p) => p.id === newId)
}

export function deletePayment(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT receipt_no FROM transport_payments WHERE id = ?`).get(id) as { receipt_no: string } | undefined
  softDelete('transport_payments', id, row ? `Transport receipt ${row.receipt_no}` : `Transport payment #${id}`, userId)
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

export function summary(): TransportSummary {
  const routes = listRoutes()
  const riders = listRiders({})
  const anyUncapped = routes.some((r) => r.capacity === null)
  return {
    routes: routes.length,
    riders: riders.length,
    seatsLeft: anyUncapped ? null : routes.reduce((s, r) => s + (r.seats_left ?? 0), 0),
    expected: routes.reduce((s, r) => s + (r.expected ?? 0), 0),
    collected: routes.reduce((s, r) => s + (r.collected ?? 0), 0),
    outstanding: routes.reduce((s, r) => s + (r.outstanding ?? 0), 0),
    unpaidRiders: riders.filter((r) => (r.balance ?? 0) > 0).length,
  }
}
