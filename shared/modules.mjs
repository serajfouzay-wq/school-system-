/**
 * Which parts of the system a particular school bought.
 *
 * A school that does not run buses should not be shown a Transport menu it
 * will never use, and a primary school with no formal exams should not have to
 * explain the Online Exams screen to its staff. Each optional module can be
 * left out when the build is made.
 *
 * The rest — students, staff, attendance, classes, settings, the recycle bin
 * and help — is the system itself and is always present.
 */

/**
 * Each entry lists the screens that vanish when the module is off, the action
 * prefixes the main process then refuses, and anything it cannot work without.
 */
export const MODULES = {
  grades: { screens: ['grades'], actions: ['grades.'] },
  // An exam's marks are written into Grades, so exams without grades would
  // have nowhere to put a result.
  exams: { screens: ['exams'], actions: ['exams.', 'examServer.'], needs: ['grades'] },
  fees: { screens: ['fees'], actions: ['fees.'] },
  timetable: { screens: ['timetable'], actions: ['timetable.'] },
  // The library shares the exam server, so it can switch that on by itself.
  library: { screens: ['library'], actions: ['library.', 'examServer.'] },
  transport: { screens: ['transport'], actions: ['transport.'] },
  announcements: { screens: ['announcements', 'calendar'], actions: ['announcements.', 'events.'] },
  reports: { screens: ['reports'], actions: ['reports.'] },
  whatsapp: { screens: [], actions: ['whatsapp.'] },
}

export const MODULE_NAMES = Object.keys(MODULES)

/** Everything on, which is what a build says when it says nothing. */
export function allModulesOn() {
  return Object.fromEntries(MODULE_NAMES.map((m) => [m, true]))
}

/**
 * Fills in what a brand file left out and applies the dependencies, so a
 * config asking for exams without grades gets a straight answer rather than a
 * half-working screen.
 */
export function resolveModules(wanted) {
  const out = allModulesOn()
  for (const name of MODULE_NAMES) {
    if (wanted && wanted[name] === false) out[name] = false
  }
  // A module whose dependency is off cannot itself be on.
  let settled = false
  while (!settled) {
    settled = true
    for (const name of MODULE_NAMES) {
      const needs = MODULES[name].needs ?? []
      if (out[name] && needs.some((n) => !out[n])) { out[name] = false; settled = false }
    }
  }
  return out
}

/** The screens to hide for this set of modules. */
export function hiddenScreens(modules) {
  const hidden = new Set()
  for (const name of MODULE_NAMES) {
    if (!modules[name]) for (const screen of MODULES[name].screens) hidden.add(screen)
  }
  return hidden
}

/**
 * Whether an action belongs to a module that is switched off. An action shared
 * by two modules — the small web server, used by both exams and the library —
 * is only refused when every module that uses it is off.
 */
export function actionIsOff(method, modules) {
  const owners = MODULE_NAMES.filter((m) => MODULES[m].actions.some((p) => method.startsWith(p)))
  return owners.length > 0 && owners.every((m) => !modules[m])
}
