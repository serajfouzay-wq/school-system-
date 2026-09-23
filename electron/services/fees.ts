import { amount, id, isoDate, optionalId, optionalText, paymentMethod } from '../validate'
import { getDb, periodRange, softDelete, today } from '../db/index'
import type { FeePayment, FeeStructure, ReceiptData, StudentFeeSummary, School } from '../../shared/types'
import { getSchool } from './school'

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

/* ---------- Fee structures ---------- */

export function listFeeStructures(classId?: number | null): FeeStructure[] {
  const where = classId ? 'AND (f.class_id = @classId OR f.class_id IS NULL)' : ''
  return getDb()
    .prepare(
      `SELECT f.*, c.name AS class_name FROM fee_structures f
        LEFT JOIN classes c ON c.id = f.class_id
       WHERE f.deleted_at IS NULL ${where}
       ORDER BY c.grade_level, f.term, f.item_name`
    )
    .all({ classId: classId ?? null }) as FeeStructure[]
}

export function saveFeeStructure(input: {
  id?: number; class_id?: number | null; term?: string | null
  item_name: string; item_name_ar?: string | null; amount: number
}): void {
  const d = getDb()
  if (!input.item_name?.trim()) throw new Error('Please type what the fee is for.')
  if (!(input.amount >= 0)) throw new Error('Please type an amount of 0 or more.')
  if (input.id) {
    d.prepare(`UPDATE fee_structures SET class_id = ?, term = ?, item_name = ?, item_name_ar = ?, amount = ? WHERE id = ?`)
      .run(input.class_id ?? null, input.term ?? null, input.item_name.trim(), input.item_name_ar ?? null, input.amount, input.id)
    return
  }
  d.prepare(`INSERT INTO fee_structures (school_id, class_id, term, item_name, item_name_ar, amount) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(schoolId(), input.class_id ?? null, input.term ?? null, input.item_name.trim(), input.item_name_ar ?? null, input.amount)
}

export function deleteFeeStructure(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT item_name FROM fee_structures WHERE id = ?`).get(id) as { item_name: string } | undefined
  softDelete('fee_structures', id, row ? `${row.item_name} (fee)` : `Fee #${id}`, userId)
}

/* ---------- Payments ---------- */

export function nextReceiptNo(): string {
  const year = new Date().getFullYear()
  const row = getDb()
    .prepare(`SELECT receipt_no FROM fee_payments WHERE receipt_no LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`R-${year}-%`) as { receipt_no: string } | undefined
  const n = row ? Number(row.receipt_no.split('-')[2]) + 1 : 1
  return `R-${year}-${String(n).padStart(5, '0')}`
}

/** One definition of what a payment row looks like, for the list and for one. */
const PAYMENT_SELECT = `
  SELECT p.*, st.full_name AS student_name, st.student_code, f.item_name
    FROM fee_payments p
    JOIN students st ON st.id = p.student_id
    LEFT JOIN fee_structures f ON f.id = p.fee_structure_id`

/** A single payment by id: a primary-key lookup, whatever the history holds. */
export function getPayment(id: number): FeePayment | null {
  return (getDb().prepare(`${PAYMENT_SELECT} WHERE p.id = ?`).get(id) as FeePayment | undefined) ?? null
}

export function listPayments(filter: { student_id?: number; from?: string; to?: string; search?: string } = {}): FeePayment[] {
  const clauses = ['p.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.student_id) { clauses.push('p.student_id = @student_id'); params.student_id = filter.student_id }
  if (filter.from) { clauses.push('p.date >= @from'); params.from = filter.from }
  if (filter.to) { clauses.push('p.date <= @to'); params.to = filter.to }
  if (filter.search?.trim()) {
    clauses.push('(st.full_name LIKE @q OR st.full_name_ar LIKE @q OR p.receipt_no LIKE @q OR st.student_code LIKE @q)')
    params.q = `%${filter.search.trim()}%`
  }
  return getDb()
    .prepare(`${PAYMENT_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY p.date DESC, p.id DESC`)
    .all(params) as FeePayment[]
}

export function recordPayment(input: {
  student_id: number; fee_structure_id?: number | null; amount_paid: number
  date?: string; method?: FeePayment['method']; note?: string | null
}, userId: number | null): FeePayment {
  const row = {
    student_id: id(input.student_id, 'The student'),
    fee_structure_id: optionalId(input.fee_structure_id, 'The fee'),
    amount_paid: amount(input.amount_paid),
    date: input.date ? isoDate(input.date, 'The payment date') : today(),
    method: paymentMethod(input.method),
    note: optionalText(input.note, 'The note'),
  }
  const d = getDb()
  // Reading the next receipt number and using it happen in one transaction.
  // Nothing can interleave today — every call finishes on the one main thread
  // — and receipt_no is UNIQUE regardless; this keeps the pair atomic if the
  // database work is ever moved off that thread.
  const insert = d.transaction(() => {
    const receiptNo = nextReceiptNo()
    return d
      .prepare(
        `INSERT INTO fee_payments (student_id, fee_structure_id, amount_paid, date, method, receipt_no, note, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(row.student_id, row.fee_structure_id, row.amount_paid, row.date, row.method, receiptNo, row.note, userId)
  })
  // Read back the one row just written. This used to list every payment the
  // school had ever taken and pick one out, so each payment got slower than
  // the last for as long as the school used the program.
  return getPayment(Number(insert().lastInsertRowid))!
}

export function deletePayment(id: number, userId: number | null): void {
  const row = getDb().prepare(`SELECT receipt_no FROM fee_payments WHERE id = ?`).get(id) as { receipt_no: string } | undefined
  softDelete('fee_payments', id, row ? `Receipt ${row.receipt_no}` : `Payment #${id}`, userId)
}

/** What a student owes: everything billed for their class, minus what they paid. */
export function studentFeeSummary(studentId: number): StudentFeeSummary {
  const d = getDb()
  const student = d
    .prepare(
      `SELECT st.*, c.name AS class_name, s.name AS section_name
         FROM students st LEFT JOIN sections s ON s.id = st.section_id
         LEFT JOIN classes c ON c.id = s.class_id WHERE st.id = ?`
    )
    .get(studentId) as StudentFeeSummary['student'] | undefined
  if (!student) throw new Error('That student could not be found.')
  const billed = d
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_structures
        WHERE deleted_at IS NULL AND (class_id IS NULL OR class_id = (SELECT class_id FROM sections WHERE id = ?))`
    )
    .get(student.section_id) as { total: number }
  const paid = d
    .prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS total FROM fee_payments WHERE student_id = ? AND deleted_at IS NULL`)
    .get(studentId) as { total: number }
  return { student, billed: billed.total, paid: paid.total, balance: billed.total - paid.total }
}

/** Balances for every active student — drives the "who still owes?" list. */
export function feeBalances(filter: { classId?: number | null; onlyOutstanding?: boolean; search?: string } = {}): StudentFeeSummary[] {
  const clauses = ['st.deleted_at IS NULL', "st.status = 'active'"]
  const params: Record<string, unknown> = {}
  if (filter.classId) { clauses.push('sec.class_id = @classId'); params.classId = filter.classId }
  if (filter.search?.trim()) {
    clauses.push('(st.full_name LIKE @q OR st.full_name_ar LIKE @q OR st.student_code LIKE @q)')
    params.q = `%${filter.search.trim()}%`
  }
  const rows = getDb()
    .prepare(
      `SELECT st.*, c.name AS class_name, c.name_ar AS class_name_ar, sec.name AS section_name,
              COALESCE((SELECT SUM(f.amount) FROM fee_structures f
                         WHERE f.deleted_at IS NULL AND (f.class_id IS NULL OR f.class_id = sec.class_id)), 0) AS billed,
              COALESCE((SELECT SUM(p.amount_paid) FROM fee_payments p
                         WHERE p.student_id = st.id AND p.deleted_at IS NULL), 0) AS paid
         FROM students st
         LEFT JOIN sections sec ON sec.id = st.section_id
         LEFT JOIN classes c ON c.id = sec.class_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY c.grade_level, sec.name, st.full_name`
    )
    .all(params) as (StudentFeeSummary['student'] & { billed: number; paid: number })[]

  return rows
    .map((r) => {
      const { billed, paid, ...student } = r
      return { student, billed, paid, balance: billed - paid }
    })
    .filter((r) => (filter.onlyOutstanding ? r.balance > 0 : true))
}

export function getReceipt(paymentId: number): ReceiptData {
  const school = getSchool()
  if (!school) throw new Error('Please finish the setup wizard first.')
  const payment = listPayments({}).find((p) => p.id === paymentId)
  if (!payment) throw new Error('That receipt could not be found.')
  const summary = studentFeeSummary(payment.student_id)
  return { school: school as School, payment, student: summary.student, balanceAfter: summary.balance }
}

export interface FinancialSummary {
  collectedThisMonth: number
  collectedThisYear: number
  expectedTotal: number
  outstandingTotal: number
  byMonth: { month: string; amount: number }[]
  byClass: { class_name: string; billed: number; paid: number; balance: number }[]
  byMethod: { method: string; amount: number }[]
}

export function financialSummary(): FinancialSummary {
  const d = getDb()
  const month = today().slice(0, 7)
  const year = today().slice(0, 4)
  const balances = feeBalances()

  const byClassMap = new Map<string, { class_name: string; billed: number; paid: number; balance: number }>()
  for (const b of balances) {
    const key = b.student.class_name ?? '—'
    const e = byClassMap.get(key) ?? { class_name: key, billed: 0, paid: 0, balance: 0 }
    e.billed += b.billed; e.paid += b.paid; e.balance += b.balance
    byClassMap.set(key, e)
  }

  // Ranges, not LIKE: see periodRange. Both run on every dashboard load.
  const collectedIn = (period: string) => {
    const { from, to } = periodRange(period)
    return (d
      .prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS t FROM fee_payments WHERE deleted_at IS NULL AND date >= ? AND date < ?`)
      .get(from, to) as { t: number }).t
  }
  const collectedThisMonth = collectedIn(month)
  const collectedThisYear = collectedIn(String(year))

  const byMonth = d
    .prepare(
      `SELECT substr(date, 1, 7) AS month, SUM(amount_paid) AS amount
         FROM fee_payments WHERE deleted_at IS NULL
        GROUP BY month ORDER BY month DESC LIMIT 12`
    )
    .all() as { month: string; amount: number }[]

  const byMethod = d
    .prepare(`SELECT method, SUM(amount_paid) AS amount FROM fee_payments WHERE deleted_at IS NULL GROUP BY method`)
    .all() as { method: string; amount: number }[]

  return {
    collectedThisMonth,
    collectedThisYear,
    expectedTotal: balances.reduce((s, b) => s + b.billed, 0),
    outstandingTotal: balances.reduce((s, b) => s + Math.max(0, b.balance), 0),
    byMonth: byMonth.reverse(),
    byClass: [...byClassMap.values()],
    byMethod,
  }
}
