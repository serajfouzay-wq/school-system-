import fs from 'node:fs'
import path from 'node:path'
import { getDb, softDelete, filesDir, getSetting, today } from '../db/index'
import { getSchool } from './school'

/**
 * Two kinds of book live here. A paper copy is lent out and comes back, with a
 * due date and a fine if it is late. A digital book has a file attached and can
 * be read on a phone from the school library page — no lending involved.
 * A book can be both.
 */

export interface Book {
  id: number
  title: string
  title_ar: string | null
  author: string | null
  category: string | null
  isbn: string | null
  shelf: string | null
  description: string | null
  cover_path: string | null
  file_path: string | null
  file_name: string | null
  copies_total: number
  /** Worked out from the loans that are still open. */
  copies_out?: number
  copies_available?: number
  is_digital?: boolean
}

export interface Loan {
  id: number
  book_id: number
  student_id: number | null
  staff_id: number | null
  borrowed_at: string
  due_at: string
  returned_at: string | null
  fine_amount: number
  fine_paid: 0 | 1
  note: string | null
  book_title?: string
  book_title_ar?: string | null
  borrower_name?: string
  borrower_name_ar?: string | null
  student_code?: string
  days_overdue?: number
}

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

export function loanDays(): number {
  return Number(getSetting('library_loan_days') ?? 14) || 14
}

export function finePerDay(): number {
  return Number(getSetting('library_fine_per_day') ?? 1) || 0
}

const BOOK_SELECT = `
  SELECT b.*,
         (SELECT COUNT(*) FROM library_loans l
           WHERE l.book_id = b.id AND l.returned_at IS NULL AND l.deleted_at IS NULL) AS copies_out
    FROM library_books b`

function decorate(b: Book & { copies_out: number }): Book {
  return {
    ...b,
    copies_available: Math.max(0, b.copies_total - b.copies_out),
    is_digital: !!b.file_path,
  }
}

export function listBooks(filter: { search?: string; category?: string | null; onlyAvailable?: boolean; onlyDigital?: boolean } = {}): Book[] {
  const clauses = ['b.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.search?.trim()) {
    clauses.push('(b.title LIKE @q OR b.title_ar LIKE @q OR b.author LIKE @q OR b.isbn LIKE @q OR b.category LIKE @q)')
    params.q = `%${filter.search.trim()}%`
  }
  if (filter.category) { clauses.push('b.category = @category'); params.category = filter.category }
  if (filter.onlyDigital) clauses.push('b.file_path IS NOT NULL')

  const rows = getDb()
    .prepare(`${BOOK_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY b.title`)
    .all(params) as (Book & { copies_out: number })[]
  const books = rows.map(decorate)
  return filter.onlyAvailable ? books.filter((b) => (b.copies_available ?? 0) > 0) : books
}

export function getBook(id: number): Book | null {
  const row = getDb().prepare(`${BOOK_SELECT} WHERE b.id = ?`).get(id) as (Book & { copies_out: number }) | undefined
  return row ? decorate(row) : null
}

export function categories(): string[] {
  const rows = getDb()
    .prepare(`SELECT DISTINCT category FROM library_books WHERE deleted_at IS NULL AND category IS NOT NULL AND category <> '' ORDER BY category`)
    .all() as { category: string }[]
  return rows.map((r) => r.category)
}

export function saveBook(input: Partial<Book> & { title: string }): Book {
  const d = getDb()
  if (!input.title?.trim()) throw new Error('Please type the name of the book.')
  const fields = {
    title: input.title.trim(),
    title_ar: input.title_ar?.trim() || null,
    author: input.author?.trim() || null,
    category: input.category?.trim() || null,
    isbn: input.isbn?.trim() || null,
    shelf: input.shelf?.trim() || null,
    description: input.description ?? null,
    cover_path: input.cover_path ?? null,
    file_path: input.file_path ?? null,
    file_name: input.file_name ?? null,
    copies_total: Math.max(0, input.copies_total ?? 1),
  }
  if (input.id) {
    const out = (d.prepare(`SELECT COUNT(*) AS n FROM library_loans WHERE book_id = ? AND returned_at IS NULL AND deleted_at IS NULL`)
      .get(input.id) as { n: number }).n
    if (fields.copies_total < out) {
      throw new Error(`${out} copies are out on loan, so there cannot be fewer than ${out} copies.`)
    }
    d.prepare(
      `UPDATE library_books SET title=@title, title_ar=@title_ar, author=@author, category=@category,
        isbn=@isbn, shelf=@shelf, description=@description, cover_path=@cover_path,
        file_path=@file_path, file_name=@file_name, copies_total=@copies_total WHERE id=@id`
    ).run({ ...fields, id: input.id })
    return getBook(input.id)!
  }
  const info = d
    .prepare(
      `INSERT INTO library_books (school_id, title, title_ar, author, category, isbn, shelf,
         description, cover_path, file_path, file_name, copies_total)
       VALUES (@school_id, @title, @title_ar, @author, @category, @isbn, @shelf,
         @description, @cover_path, @file_path, @file_name, @copies_total)`
    )
    .run({ ...fields, school_id: schoolId() })
  return getBook(Number(info.lastInsertRowid))!
}

export function deleteBook(id: number, userId: number | null): void {
  const out = (getDb().prepare(`SELECT COUNT(*) AS n FROM library_loans WHERE book_id = ? AND returned_at IS NULL AND deleted_at IS NULL`)
    .get(id) as { n: number }).n
  if (out > 0) throw new Error(`${out} copies are still out on loan. Take them back in first.`)
  const b = getBook(id)
  softDelete('library_books', id, b ? `${b.title} (book)` : `Book #${id}`, userId)
}

/** Copies the ebook into the school's own folder, so it survives a moved USB stick. */
export function attachFile(bookId: number, sourcePath: string): Book {
  const dir = path.join(filesDir(), 'library')
  fs.mkdirSync(dir, { recursive: true })
  const name = path.basename(sourcePath)
  const dest = path.join(dir, `${bookId}-${name}`)
  fs.copyFileSync(sourcePath, dest)
  getDb().prepare(`UPDATE library_books SET file_path = ?, file_name = ? WHERE id = ?`).run(dest, name, bookId)
  return getBook(bookId)!
}

export function removeFile(bookId: number): Book {
  getDb().prepare(`UPDATE library_books SET file_path = NULL, file_name = NULL WHERE id = ?`).run(bookId)
  return getBook(bookId)!
}

/* ---------------- Lending ---------------- */

const LOAN_SELECT = `
  SELECT l.*, b.title AS book_title, b.title_ar AS book_title_ar,
         COALESCE(st.full_name, sf.full_name) AS borrower_name,
         st.full_name_ar AS borrower_name_ar,
         st.student_code
    FROM library_loans l
    JOIN library_books b ON b.id = l.book_id
    LEFT JOIN students st ON st.id = l.student_id
    LEFT JOIN staff sf ON sf.id = l.staff_id`

function withOverdue(rows: Loan[]): Loan[] {
  const now = today()
  return rows.map((l) => {
    const end = l.returned_at ?? now
    const days = Math.max(0, Math.round((new Date(end).getTime() - new Date(l.due_at).getTime()) / 86_400_000))
    return { ...l, days_overdue: days }
  })
}

export function listLoans(filter: { openOnly?: boolean; overdueOnly?: boolean; studentId?: number; bookId?: number } = {}): Loan[] {
  const clauses = ['l.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.openOnly || filter.overdueOnly) clauses.push('l.returned_at IS NULL')
  if (filter.overdueOnly) clauses.push("l.due_at < date('now')")
  if (filter.studentId) { clauses.push('l.student_id = @studentId'); params.studentId = filter.studentId }
  if (filter.bookId) { clauses.push('l.book_id = @bookId'); params.bookId = filter.bookId }
  const rows = getDb()
    .prepare(`${LOAN_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY l.returned_at IS NULL DESC, l.due_at`)
    .all(params) as Loan[]
  return withOverdue(rows)
}

export function borrow(input: { book_id: number; student_id?: number | null; staff_id?: number | null; days?: number }, userId: number | null): Loan {
  const d = getDb()
  const book = getBook(input.book_id)
  if (!book) throw new Error('That book could not be found.')
  if ((book.copies_available ?? 0) <= 0) throw new Error('Every copy of this book is already out on loan.')
  if (!input.student_id && !input.staff_id) throw new Error('Choose who is borrowing the book.')

  // One person cannot hold two copies of the same book at once.
  if (input.student_id) {
    const already = d
      .prepare(`SELECT 1 FROM library_loans WHERE book_id = ? AND student_id = ? AND returned_at IS NULL AND deleted_at IS NULL`)
      .get(input.book_id, input.student_id)
    if (already) throw new Error('This student already has a copy of this book.')
  }

  const due = new Date()
  due.setDate(due.getDate() + (input.days ?? loanDays()))
  const info = d
    .prepare(`INSERT INTO library_loans (book_id, student_id, staff_id, due_at, created_by) VALUES (?, ?, ?, ?, ?)`)
    .run(input.book_id, input.student_id ?? null, input.staff_id ?? null, due.toISOString().slice(0, 10), userId)
  return listLoans({ bookId: input.book_id }).find((l) => l.id === Number(info.lastInsertRowid))!
}

/** Taking a book back works out the fine from how late it is. */
export function returnBook(loanId: number): { loan: Loan; fine: number; daysLate: number } {
  const d = getDb()
  const loan = d.prepare(`SELECT * FROM library_loans WHERE id = ? AND deleted_at IS NULL`).get(loanId) as Loan | undefined
  if (!loan) throw new Error('That loan could not be found.')
  if (loan.returned_at) throw new Error('This book has already been brought back.')

  const now = today()
  const daysLate = Math.max(0, Math.round((new Date(now).getTime() - new Date(loan.due_at).getTime()) / 86_400_000))
  const fine = Math.round(daysLate * finePerDay() * 100) / 100

  d.prepare(`UPDATE library_loans SET returned_at = ?, fine_amount = ? WHERE id = ?`).run(now, fine, loanId)
  return { loan: listLoans({ bookId: loan.book_id }).find((l) => l.id === loanId)!, fine, daysLate }
}

export function payFine(loanId: number): void {
  getDb().prepare(`UPDATE library_loans SET fine_paid = 1 WHERE id = ?`).run(loanId)
}

export function deleteLoan(id: number, userId: number | null): void {
  softDelete('library_loans', id, `Library loan #${id}`, userId)
}

export interface LibrarySummary {
  titles: number
  copies: number
  onLoan: number
  overdue: number
  digital: number
  unpaidFines: number
}

export function summary(): LibrarySummary {
  const d = getDb()
  const books = d
    .prepare(`SELECT COUNT(*) AS titles, COALESCE(SUM(copies_total), 0) AS copies,
                     SUM(file_path IS NOT NULL) AS digital
                FROM library_books WHERE deleted_at IS NULL`)
    .get() as { titles: number; copies: number; digital: number }
  const loans = d
    .prepare(`SELECT COUNT(*) AS onLoan, SUM(due_at < date('now')) AS overdue
                FROM library_loans WHERE returned_at IS NULL AND deleted_at IS NULL`)
    .get() as { onLoan: number; overdue: number }
  const fines = d
    .prepare(`SELECT COALESCE(SUM(fine_amount), 0) AS t FROM library_loans
               WHERE fine_paid = 0 AND fine_amount > 0 AND deleted_at IS NULL`)
    .get() as { t: number }
  return {
    titles: books.titles,
    copies: books.copies,
    onLoan: loans.onLoan || 0,
    overdue: loans.overdue || 0,
    digital: books.digital || 0,
    unpaidFines: fines.t,
  }
}
