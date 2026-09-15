import fs from 'node:fs'
import path from 'node:path'
import { getDb, softDelete, filesDir } from '../db/index'
import type { Staff } from '../../shared/types'
import { getSchool } from './school'

function schoolId(): number {
  const s = getSchool()
  if (!s) throw new Error('Please finish the setup wizard first.')
  return s.id
}

export function nextStaffCode(): string {
  const year = new Date().getFullYear()
  const row = getDb()
    .prepare(`SELECT staff_code FROM staff WHERE staff_code LIKE ? ORDER BY staff_code DESC LIMIT 1`)
    .get(`T-${year}-%`) as { staff_code: string } | undefined
  const n = row ? Number(row.staff_code.split('-')[2]) + 1 : 1
  return `T-${year}-${String(n).padStart(3, '0')}`
}

export function listStaff(filter: { search?: string; role?: string | null; status?: string | null } = {}): Staff[] {
  const clauses = ['deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (filter.search?.trim()) {
    clauses.push(`(full_name LIKE @q OR full_name_ar LIKE @q OR staff_code LIKE @q OR phone LIKE @q)`)
    params.q = `%${filter.search.trim()}%`
  }
  if (filter.role) { clauses.push('role = @role'); params.role = filter.role }
  if (filter.status) { clauses.push('status = @status'); params.status = filter.status }
  return getDb().prepare(`SELECT * FROM staff WHERE ${clauses.join(' AND ')} ORDER BY full_name`).all(params) as Staff[]
}

export function getStaff(id: number): Staff | null {
  return (getDb().prepare(`SELECT * FROM staff WHERE id = ?`).get(id) as Staff) ?? null
}

export type StaffInput = Partial<Omit<Staff, 'id' | 'school_id'>> & { id?: number; full_name: string }

export function saveStaff(input: StaffInput): Staff {
  const d = getDb()
  if (!input.full_name?.trim()) throw new Error('Please type the name.')
  const fields = {
    full_name: input.full_name.trim(),
    full_name_ar: input.full_name_ar?.trim() || null,
    photo_path: input.photo_path ?? null,
    role: input.role ?? 'teacher',
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address ?? null,
    hire_date: input.hire_date ?? null,
    salary: input.salary ?? null,
    status: input.status ?? 'active',
  }
  if (input.id) {
    d.prepare(
      `UPDATE staff SET full_name = @full_name, full_name_ar = @full_name_ar, photo_path = @photo_path,
        role = @role, phone = @phone, email = @email, address = @address, hire_date = @hire_date,
        salary = @salary, status = @status WHERE id = @id`
    ).run({ ...fields, id: input.id })
    return getStaff(input.id)!
  }
  const info = d
    .prepare(
      `INSERT INTO staff (school_id, staff_code, full_name, full_name_ar, photo_path, role, phone, email,
         address, hire_date, salary, status)
       VALUES (@school_id, @staff_code, @full_name, @full_name_ar, @photo_path, @role, @phone, @email,
         @address, @hire_date, @salary, @status)`
    )
    .run({ ...fields, school_id: schoolId(), staff_code: nextStaffCode() })
  return getStaff(Number(info.lastInsertRowid))!
}

export function deleteStaff(id: number, userId: number | null): void {
  const assigned = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM teacher_assignments WHERE staff_id = ? AND deleted_at IS NULL`)
    .get(id) as { n: number }
  if (assigned.n > 0) throw new Error(`This teacher still has ${assigned.n} class(es) assigned. Remove those first.`)
  const s = getStaff(id)
  softDelete('staff', id, s ? `${s.full_name} (staff)` : `Staff #${id}`, userId)
}

export function saveStaffPhoto(sourcePath: string, staffCode: string): string {
  const ext = path.extname(sourcePath) || '.jpg'
  const dir = path.join(filesDir(), 'photos')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${staffCode}${ext}`)
  fs.copyFileSync(sourcePath, dest)
  return dest
}
