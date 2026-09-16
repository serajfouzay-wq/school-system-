/**
 * Who is allowed to do what.
 *
 * Roles used to be labels only — a teacher could have deleted every student.
 * Every action the renderer can call is now mapped to a capability, and the
 * main process checks it before doing anything. The user interface hides what
 * you cannot do, but hiding is a courtesy; the check in the main process is
 * what actually protects the school's data.
 */

export type Role = 'owner' | 'admin' | 'registrar' | 'teacher' | 'accountant' | 'viewer'

export const ROLES: Role[] = ['owner', 'admin', 'registrar', 'teacher', 'accountant', 'viewer']

/** Higher outranks lower. Used to stop anyone editing an account above them. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 100,
  admin: 80,
  registrar: 50,
  accountant: 50,
  teacher: 40,
  viewer: 10,
}

export type Capability =
  // People who can sign in
  | 'users.view'
  | 'users.manage'        // create/edit ordinary staff accounts
  | 'users.manageAdmins'  // create/edit administrators
  | 'users.manageOwners'  // create/edit owners — the school's own account
  // The school itself
  | 'school.settings'
  | 'school.backup'
  | 'school.restore'
  | 'school.dangerZone'   // load demo data, anything that rewrites everything
  // Day-to-day records
  | 'students.view' | 'students.manage'
  | 'staff.view' | 'staff.manage'
  | 'academics.view' | 'academics.manage'
  | 'attendance.view' | 'attendance.manage'
  | 'timetable.view' | 'timetable.manage'
  | 'grades.view' | 'grades.manage'
  | 'exams.view' | 'exams.manage'
  | 'fees.view' | 'fees.manage'
  | 'library.view' | 'library.lend' | 'library.manage'
  | 'transport.view' | 'transport.manage'
  | 'announcements.view' | 'announcements.manage'
  | 'reports.view'
  | 'messages.send'
  | 'recycle.view' | 'recycle.restore'

const VIEWER: Capability[] = [
  'students.view', 'staff.view', 'academics.view', 'attendance.view',
  'timetable.view', 'grades.view', 'exams.view', 'fees.view',
  'library.view', 'transport.view', 'announcements.view', 'reports.view',
]

const TEACHER: Capability[] = [
  ...VIEWER,
  'attendance.manage', 'grades.manage', 'exams.manage',
  'library.lend', 'messages.send',
]

const REGISTRAR: Capability[] = [
  ...VIEWER,
  'students.manage', 'academics.manage', 'attendance.manage',
  'timetable.manage', 'announcements.manage', 'library.lend',
  'transport.manage',
  'messages.send', 'recycle.view',
]

const ACCOUNTANT: Capability[] = [
  ...VIEWER,
  'fees.manage', 'transport.manage', 'messages.send', 'recycle.view',
]

const ADMIN: Capability[] = [
  ...VIEWER,
  'users.view', 'users.manage', 'users.manageAdmins',
  'school.settings', 'school.backup', 'school.restore',
  'students.manage', 'staff.manage', 'academics.manage',
  'attendance.manage', 'timetable.manage', 'grades.manage',
  'exams.manage', 'fees.manage', 'library.lend', 'library.manage',
  'transport.manage',
  'announcements.manage', 'messages.send',
  'recycle.view', 'recycle.restore',
]

/** The owner is the school's own account: everything, with nothing withheld. */
const OWNER: Capability[] = [...ADMIN, 'users.manageOwners', 'school.dangerZone']

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  owner: OWNER,
  admin: ADMIN,
  registrar: REGISTRAR,
  teacher: TEACHER,
  accountant: ACCOUNTANT,
  viewer: VIEWER,
}

const LOOKUP: Record<Role, Set<Capability>> = Object.fromEntries(
  ROLES.map((r) => [r, new Set(ROLE_CAPABILITIES[r])])
) as Record<Role, Set<Capability>>

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return LOOKUP[role]?.has(capability) ?? false
}

/**
 * Whether `actor` may create, edit or delete an account with role `target`.
 * You can never act on an account that outranks you, and never promote someone
 * above yourself — which is what stops an administrator quietly making
 * themselves the owner.
 */
export function canActOnRole(actor: Role | null | undefined, target: Role): boolean {
  if (!actor) return false
  if (target === 'owner') return can(actor, 'users.manageOwners')
  if (target === 'admin') return can(actor, 'users.manageAdmins')
  if (!can(actor, 'users.manage')) return false
  return ROLE_RANK[actor] >= ROLE_RANK[target]
}

/** The roles this user is allowed to hand out. */
export function assignableRoles(actor: Role | null | undefined): Role[] {
  return ROLES.filter((r) => canActOnRole(actor, r))
}
