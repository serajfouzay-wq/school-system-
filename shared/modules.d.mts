/** Types for modules.mjs, which is plain JavaScript so the build scripts (run
 *  by node) and the app (bundled by vite) share one definition. */

export type ModuleName =
  | 'grades'
  | 'exams'
  | 'fees'
  | 'timetable'
  | 'library'
  | 'transport'
  | 'announcements'
  | 'reports'
  | 'whatsapp'

export interface ModuleSpec {
  screens: string[]
  actions: string[]
  needs?: ModuleName[]
}

export type ModuleSet = Record<ModuleName, boolean>

export const MODULES: Record<ModuleName, ModuleSpec>
export const MODULE_NAMES: ModuleName[]

export function allModulesOn(): ModuleSet
export function resolveModules(wanted?: Partial<ModuleSet> | null): ModuleSet
export function hiddenScreens(modules: ModuleSet): Set<string>
export function actionIsOff(method: string, modules: ModuleSet): boolean
