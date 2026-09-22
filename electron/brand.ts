import type { GradingScale } from '../shared/types'
import type { ModuleSet } from '../shared/modules.mjs'
import { resolveModules } from '../shared/modules.mjs'
import generated from './brand.generated.json'

/**
 * The branding for this build, as the main process sees it.
 *
 * The JSON is written per school by `scripts/brand.mjs`, so its literal shape
 * changes from build to build. Declaring the type here keeps the rest of the
 * code honest about what is optional — a short brand file is allowed to say
 * nothing but a name and a colour.
 */
export interface SchoolDefaults {
  name?: string
  name_ar?: string
  address?: string
  phone?: string
  email?: string
  currency?: string
  country_code?: string
  language?: 'en' | 'ar'
  calendar_type?: 'gregorian' | 'hijri'
  numeral_system?: 'western' | 'arabic_indic'
  grading_scale?: GradingScale
}

export interface MainBrand {
  id: string
  appName: string
  color: string
  school: SchoolDefaults
  /** Which optional parts this build includes. */
  modules: ModuleSet
}

const brand: MainBrand = {
  ...(generated as MainBrand),
  school: ((generated as MainBrand).school ?? {}) as SchoolDefaults,
  // Resolved again here so an edited or older brand file can never leave the
  // main process with a half-defined set.
  modules: resolveModules((generated as MainBrand).modules),
}

export default brand
