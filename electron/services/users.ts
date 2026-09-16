import { getDb, hashSecret, verifySecret, softDelete } from '../db/index'
import type { Role, User } from '../../shared/types'
import { canActOnRole } from '../../shared/permissions'

const PUBLIC_COLS = `id, name, username, role, staff_id, security_question, is_active, created_at`

export function listUsers(includeInactive = true): User[] {
  const where = includeInactive ? '' : 'AND is_active = 1'
  return getDb()
    .prepare(`SELECT ${PUBLIC_COLS} FROM users WHERE deleted_at IS NULL ${where} ORDER BY name`)
    .all() as User[]
}

/**
 * The sign-in picker, and nothing more. This is the one list an unauthenticated
 * caller may read, so it carries only what a name badge needs — no security
 * question, no dates, no inactive accounts.
 */
export function signInList(): Pick<User, 'id' | 'name' | 'username' | 'role' | 'staff_id'>[] {
  return getDb()
    .prepare(`SELECT id, name, username, role, staff_id FROM users WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name`)
    .all() as Pick<User, 'id' | 'name' | 'username' | 'role' | 'staff_id'>[]
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

function roleOf(userId: number | null): Role | null {
  if (!userId) return null
  const row = getDb().prepare(`SELECT role FROM users WHERE id = ? AND deleted_at IS NULL`).get(userId) as
    | { role: Role }
    | undefined
  return row?.role ?? null
}

/**
 * Nobody may create or change an account that outranks them, and nobody may
 * promote anyone above themselves — which is what stops an administrator
 * quietly turning their own account into the owner.
 */
function assertMayActOn(actingUserId: number | null, targetRole: Role): void {
  // The very first account is created before anyone is signed in.
  if (countUsers() === 0) return
  const actor = roleOf(actingUserId)
  if (!canActOnRole(actor, targetRole)) {
    throw new Error('Your account is not allowed to manage this kind of user.')
  }
}

export function createUser(input: CreateUserInput, actingUserId: number | null = null): User {
  const d = getDb()
  assertMayActOn(actingUserId, input.role)
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

export function updateUser(
  id: number,
  patch: Partial<CreateUserInput> & { is_active?: 0 | 1 },
  actingUserId: number | null = null
): User {
  const d = getDb()
  const existing = getUser(id)
  if (!existing) throw new Error('That user could not be found.')
  // Both the account as it stands and the role being asked for are checked,
  // so nobody can edit upwards in either direction.
  assertMayActOn(actingUserId, existing.role)
  if (patch.role && patch.role !== existing.role) assertMayActOn(actingUserId, patch.role)

  if (existing.role === 'owner') {
    const owners = d
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND is_active = 1 AND deleted_at IS NULL`)
      .get() as { n: number }
    const losingOwner = (patch.role && patch.role !== 'owner') || patch.is_active === 0
    if (owners.n <= 1 && losingOwner) {
      throw new Error('This is the only owner account. Make another account the owner first.')
    }
  }
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
  const target = getUser(id)
  if (!target) throw new Error('That user could not be found.')
  assertMayActOn(actingUserId, target.role)
  if (id === actingUserId) throw new Error('You cannot remove the account you are signed in with.')

  // The school must never be left with no way in.
  const survivors = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM users
        WHERE role = ? AND is_active = 1 AND deleted_at IS NULL AND id <> ?`
    )
    .get(target.role, id) as { n: number }
  if ((target.role === 'owner' || target.role === 'admin') && survivors.n === 0) {
    throw new Error(
      target.role === 'owner'
        ? 'This is the only owner account. Make another account the owner before removing this one.'
        : 'This is the only administrator. Add another administrator before removing this one.'
    )
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
