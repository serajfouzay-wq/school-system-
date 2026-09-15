import { getDb, hashSecret, verifySecret, softDelete } from '../db/index'
import type { Role, User } from '../../shared/types'

const PUBLIC_COLS = `id, name, username, role, staff_id, security_question, is_active, created_at`

export function listUsers(includeInactive = true): User[] {
  const where = includeInactive ? '' : 'AND is_active = 1'
  return getDb()
    .prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE deleted_at IS NULL ${where} ORDER BY name`)
    .all() as User[]
}

export function countUsers(): number {
  const r = getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL`).get() as { n: number }
  return r.n
}

export interface CreateUserInput {
  name: string
  username: string
  pin: string
  role: Role
  staff_id?: number | null
  security_question?: string | null
  security_answer?: string | null
}

export function createUser(input: CreateUserInput): User {
  const d = getDb()
  const username = input.username.trim().toLowerCase()
  if (!username) throw new Error('A username is required.')
  if (!/^\d{4,8}$/.test(input.pin)) throw new Error('The PIN must be 4 to 8 digits.')
  const existing = d.prepare(`SELECT id FROM users WHERE username = ?`).get(username)
  if (existing) throw new Error('That username is already taken.')

  const pin = hashSecret(input.pin)
  const answer = input.security_answer ? hashSecret(input.security_answer.trim().toLowerCase()) : null
  const info = d
    .prepare(
      `INSERT INTO users (name, username, pin_hash, pin_salt, role, staff_id,
         security_question, security_answer_hash, security_answer_salt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      username,
      pin.hash,
      pin.salt,
      input.role,
      input.staff_id ?? null,
      input.security_question ?? null,
      answer?.hash ?? null,
      answer?.salt ?? null
    )
  return getUser(Number(info.lastInsertRowid))!
}

export function getUser(id: number): User | null {
  return (getDb().prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE id = ?`).get(id) as User) ?? null
}

export function updateUser(id: number, patch: Partial<CreateUserInput> & { is_active?: 0 | 1 }): User {
  const d = getDb()
  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  if (patch.name !== undefined) { sets.push('name = @name'); params.name = patch.name.trim() }
  if (patch.role !== undefined) { sets.push('role = @role'); params.role = patch.role }
  if (patch.staff_id !== undefined) { sets.push('staff_id = @staff_id'); params.staff_id = patch.staff_id }
  if (patch.is_active !== undefined) { sets.push('is_active = @is_active'); params.is_active = patch.is_active }
  if (patch.security_question !== undefined) {
    sets.push('security_question = @sq'); params.sq = patch.security_question
  }
  if (patch.security_answer) {
    const a = hashSecret(patch.security_answer.trim().toLowerCase())
    sets.push('security_answer_hash = @sah', 'security_answer_salt = @sas')
    params.sah = a.hash; params.sas = a.salt
  }
  if (patch.pin) {
    if (!/^\d{4,8}$/.test(patch.pin)) throw new Error('The PIN must be 4 to 8 digits.')
    const p = hashSecret(patch.pin)
    sets.push('pin_hash = @ph', 'pin_salt = @ps')
    params.ph = p.hash; params.ps = p.salt
  }
  if (sets.length) d.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params)
  return getUser(id)!
}

export function deleteUser(id: number, actingUserId: number | null): void {
  const admins = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL`)
    .get() as { n: number }
  const target = getUser(id)
  if (target?.role === 'admin' && admins.n <= 1) {
    throw new Error('This is the only administrator. Add another administrator before removing this one.')
  }
  softDelete('users', id, target ? `${target.name} (user)` : `User #${id}`, actingUserId)
}

export function login(username: string, pin: string): User {
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE username = ? AND deleted_at IS NULL`)
    .get(username.trim().toLowerCase()) as
    | (User & { pin_hash: string; pin_salt: string })
    | undefined
  if (!row) throw new Error('We could not find that user name.')
  if (!row.is_active) throw new Error('This account has been switched off. Ask an administrator for help.')
  if (!verifySecret(pin, row.pin_hash, row.pin_salt)) throw new Error('That PIN is not correct. Please try again.')
  return getUser(row.id)!
}

/** Offline password reset: answer the security question, then choose a new PIN. */
export function getSecurityQuestion(username: string): string | null {
  const row = getDb()
    .prepare(`SELECT security_question FROM users WHERE username = ? AND deleted_at IS NULL`)
    .get(username.trim().toLowerCase()) as { security_question: string | null } | undefined
  if (!row) throw new Error('We could not find that user name.')
  if (!row.security_question) throw new Error('This account has no security question. Ask an administrator to reset the PIN.')
  return row.security_question
}

export function resetPinWithAnswer(username: string, answer: string, newPin: string): User {
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE username = ? AND deleted_at IS NULL`)
    .get(username.trim().toLowerCase()) as
    | (User & { security_answer_hash: string | null; security_answer_salt: string | null })
    | undefined
  if (!row?.security_answer_hash || !row.security_answer_salt) throw new Error('This account cannot be reset here.')
  if (!verifySecret(answer.trim().toLowerCase(), row.security_answer_hash, row.security_answer_salt)) {
    throw new Error('That answer does not match. Please try again.')
  }
  return updateUser(row.id, { pin: newPin })
}
