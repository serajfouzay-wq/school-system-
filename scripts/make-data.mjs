/**
 * Turns a school's spreadsheets into the database their program will ship with.
 *
 * Reads the `data` block of a brand file, loads whatever CSV files it points
 * at, and hands a plan to `dist-electron/seed-cli.js`, which builds the real
 * database through the app's own code.
 *
 *   node scripts/make-data.mjs brands/alnoor.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readTable, STUDENT_COLUMNS, STAFF_COLUMNS, CLASS_COLUMNS, SUBJECT_COLUMNS } from './csv.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function read(file, columns, label) {
  const full = path.resolve(ROOT, file)
  if (!fs.existsSync(full)) throw new Error(`${label} file not found: ${full}`)
  const rows = readTable(fs.readFileSync(full, 'utf8'), columns)
  if (!rows.length) throw new Error(`${label} file has no rows we could read: ${file}`)
  return rows
}

/**
 * Builds the plan. Returns null when the brand file asks for no data at all,
 * which is the normal case for a build the client will set up themselves.
 */
export function buildPlan(brand) {
  const data = brand.data
  if (!data || (!data.students && !data.staff && !data.classes && !data.owner)) return null

  const plan = { school: { ...brand.school }, owner: data.owner ?? undefined }

  if (data.classes) {
    plan.classes = read(data.classes, CLASS_COLUMNS, 'Classes').map((c, i) => ({
      name: c.name,
      name_ar: c.name_ar,
      grade_level: Number(c.grade_level) || i + 1,
      // "A,B,C" or "A|B|C" — whichever the office typed.
      sections: (c.sections ?? 'A').split(/[,|;/]/).map((s) => s.trim()).filter(Boolean),
    })).filter((c) => c.name)
  }
  if (data.subjects) {
    plan.subjects = read(data.subjects, SUBJECT_COLUMNS, 'Subjects').filter((s) => s.name)
  }
  if (data.terms) plan.terms = data.terms
  if (data.students) {
    plan.students = read(data.students, STUDENT_COLUMNS, 'Students').filter((s) => s.full_name)
  }
  if (data.staff) {
    plan.staff = read(data.staff, STAFF_COLUMNS, 'Staff').filter((s) => s.full_name)
  }

  // Classes the students mention but the classes file never listed. Without
  // this those students would arrive with no class at all.
  if (plan.students?.length) {
    const known = new Set((plan.classes ?? []).map((c) => c.name.toLowerCase()))
    const missing = new Map()
    for (const s of plan.students) {
      if (!s.class || known.has(s.class.toLowerCase())) continue
      const sections = missing.get(s.class) ?? new Set()
      if (s.section) sections.add(s.section)
      missing.set(s.class, sections)
    }
    if (missing.size) {
      plan.classes = plan.classes ?? []
      for (const [name, sections] of missing) {
        plan.classes.push({ name, sections: sections.size ? [...sections] : ['A'] })
      }
    }
  }
  return plan
}

export function makeData(brandFile, outDir) {
  const brand = JSON.parse(fs.readFileSync(path.resolve(ROOT, brandFile), 'utf8'))
  const plan = buildPlan(brand)
  if (!plan) return null

  fs.mkdirSync(outDir, { recursive: true })
  const planFile = path.join(outDir, 'plan.json')
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 1))

  // The seeder needs its own bundle, which is not part of the app's build.
  execFileSync(npx, ['vite', 'build', '--config', 'vite.seed.config.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync(npx, ['electron', 'dist-electron/seed-cli.js', planFile, path.join(outDir, 'school_data.db'), '--no-sandbox'],
    { cwd: ROOT, stdio: 'inherit' })

  fs.rmSync(planFile, { force: true })
  return path.join(outDir, 'school_data.db')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  if (!file) { console.error('Usage: node scripts/make-data.mjs brands/<school>.json'); process.exit(1) }
  const result = makeData(file, path.join(ROOT, 'preseed'))
  console.log(result ? `\n  data ready: ${result}` : '\n  this brand file asks for no data; nothing to build')
}
