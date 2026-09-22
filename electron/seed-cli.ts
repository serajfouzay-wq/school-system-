/**
 * Builds a school's database before the program is ever installed.
 *
 * Run headlessly at build time with a plan describing the school, its classes
 * and its people. The result is a `school_data.db` that ships inside the
 * package, so the client installs the program and their data is already there
 * — no setup wizard, no import, no typing.
 *
 * It deliberately goes through the same service functions the app itself uses,
 * so every rule (student codes, receipt numbers, PIN hashing, soft deletes)
 * holds exactly as it would if a person had typed it all in.
 *
 *   npx electron dist-electron/seed-cli.js <plan.json> <output.db>
 */
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getDb, closeDb, setSetting } from './db/index'
import { saveSchool } from './services/school'
import { createUser } from './services/users'
import { saveClass, saveSection, saveSubject, saveExamTerm } from './services/academics'
import { saveStudent } from './services/students'
import { saveStaff } from './services/staff'
import type { SchoolDefaults } from './brand'

interface Plan {
  school: SchoolDefaults & { academic_year_start?: string; academic_year_end?: string }
  owner?: { name?: string; username?: string; pin?: string; security_question?: string; security_answer?: string }
  classes?: { name: string; name_ar?: string; grade_level?: number; sections?: string[] }[]
  subjects?: { name: string; name_ar?: string }[]
  terms?: { name: string; name_ar?: string }[]
  students?: Record<string, string>[]
  staff?: Record<string, string>[]
}

const out: string[] = []
const say = (line: string) => { out.push(line); console.log('  ' + line) }

function run(): void {
  const [planFile, outFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!planFile || !outFile) throw new Error('Usage: seed-cli <plan.json> <output.db>')

  const plan: Plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))

  // Work in a throwaway folder so a build never touches a real installation.
  const workshop = fs.mkdtempSync(path.join(os.tmpdir(), 'school-preseed-'))
  app.setPath('userData', workshop)

  const db = getDb()

  const year = new Date().getFullYear()
  saveSchool({
    name: plan.school.name || 'My School',
    name_ar: plan.school.name_ar ?? null,
    address: plan.school.address ?? null,
    phone: plan.school.phone ?? null,
    email: plan.school.email ?? null,
    academic_year_start: plan.school.academic_year_start ?? `${year}-09-01`,
    academic_year_end: plan.school.academic_year_end ?? `${year + 1}-06-30`,
    currency: plan.school.currency ?? 'LYD',
    language: plan.school.language ?? 'en',
    grading_scale: plan.school.grading_scale ?? 'percentage',
    calendar_type: plan.school.calendar_type ?? 'gregorian',
    numeral_system: plan.school.numeral_system ?? 'western',
    // The wizard has nothing left to ask.
    setup_complete: 1,
  })
  setSetting('whatsapp_country_code', plan.school.country_code || '218')
  say(`school: ${plan.school.name ?? 'My School'}`)

  // The owner account, so somebody can sign in the moment it is installed.
  const owner = createUser({
    name: plan.owner?.name || 'School Owner',
    username: (plan.owner?.username || 'owner').toLowerCase(),
    pin: plan.owner?.pin || '0000',
    role: 'owner',
    security_question: plan.owner?.security_question ?? null,
    security_answer: plan.owner?.security_answer ?? null,
  })
  say(`owner:  ${owner.username} (PIN ${plan.owner?.pin || '0000'})`)

  // Classes and their sections, remembered by name so students can be placed.
  const sectionByName = new Map<string, number>()
  let sectionCount = 0
  const classTx = db.transaction(() => {
    for (const [i, c] of (plan.classes ?? []).entries()) {
      const klass = saveClass({
        name: c.name,
        name_ar: c.name_ar ?? null,
        grade_level: c.grade_level ?? i + 1,
      })
      const sections = c.sections?.length ? c.sections : ['A']
      for (const s of sections) {
        const section = saveSection({ class_id: klass.id, name: s })
        sectionCount++
        sectionByName.set(`${c.name.toLowerCase()}|${s.toLowerCase()}`, section.id)
        sectionByName.set(`${c.name.toLowerCase()}|`, sectionByName.get(`${c.name.toLowerCase()}|`) ?? section.id)
      }
    }
  })
  classTx()
  if (plan.classes?.length) say(`classes: ${plan.classes.length}, sections: ${sectionCount}`)

  const subjectTx = db.transaction(() => {
    for (const s of plan.subjects ?? []) saveSubject({ name: s.name, name_ar: s.name_ar ?? null })
  })
  subjectTx()
  if (plan.subjects?.length) say(`subjects: ${plan.subjects.length}`)

  const termTx = db.transaction(() => {
    for (const [i, t] of (plan.terms ?? []).entries()) {
      void i
      saveExamTerm({ name: t.name, name_ar: t.name_ar ?? null })
    }
  })
  termTx()

  // Students, placed into their class and section by name.
  let placed = 0
  let unplaced = 0
  const studentTx = db.transaction(() => {
    for (const row of plan.students ?? []) {
      const key = `${(row.class ?? '').toLowerCase()}|${(row.section ?? '').toLowerCase()}`
      const sectionId = sectionByName.get(key) ?? sectionByName.get(`${(row.class ?? '').toLowerCase()}|`) ?? null
      if (sectionId) placed++
      else unplaced++
      saveStudent({
        full_name: row.full_name,
        full_name_ar: row.full_name_ar || null,
        section_id: sectionId,
        dob: row.dob || null,
        gender: (row.gender as 'male' | 'female') || null,
        guardian_name: row.guardian_name || null,
        guardian_phone: row.guardian_phone || null,
        guardian_address: row.guardian_address || null,
        enrollment_date: row.enrollment_date || null,
        status: 'active',
      })
    }
  })
  studentTx()
  if (plan.students?.length) {
    say(`students: ${plan.students.length}${unplaced ? ` (${unplaced} with no class yet)` : ''}`)
  }

  const staffTx = db.transaction(() => {
    for (const row of plan.staff ?? []) {
      saveStaff({
        full_name: row.full_name,
        full_name_ar: row.full_name_ar || null,
        role: row.role || 'teacher',
        phone: row.phone || null,
        email: row.email || null,
        address: row.address || null,
        hire_date: row.hire_date || null,
        status: 'active',
      })
    }
  })
  staffTx()
  if (plan.staff?.length) say(`staff: ${plan.staff.length}`)

  closeDb()

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.copyFileSync(path.join(workshop, 'school_data.db'), outFile)
  // Any photos or documents the plan brought along travel with the database.
  const files = path.join(workshop, 'files')
  if (fs.existsSync(files)) fs.cpSync(files, path.join(path.dirname(outFile), 'files'), { recursive: true })
  fs.rmSync(workshop, { recursive: true, force: true })

  const size = (fs.statSync(outFile).size / 1024).toFixed(0)
  say(`written: ${outFile} (${size} KB)`)
}

app.whenReady().then(() => {
  try {
    run()
    app.exit(0)
  } catch (e) {
    console.error('  data build FAILED: ' + (e instanceof Error ? e.message : String(e)))
    app.exit(1)
  }
})
