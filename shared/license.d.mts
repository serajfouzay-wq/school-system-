/** Types for license.mjs, which is plain JavaScript so the workshop (run by
 *  node) and the app (bundled by vite) share one definition. */

export interface LicensePayload {
  v: 1
  /** The build this licence is for: brands/<id>.json. */
  brand: string
  /** Shown to the school, so they can see whose copy it is. */
  school: string
  /** The computers allowed to run it, as formatMachineCode writes them. */
  machines: string[]
  /** YYYY-MM-DD. */
  issued: string
}

export declare const LICENSE_PREFIX: 'SSL1'
export declare function formatMachineCode(bytes: Uint8Array): string
export declare function normaliseMachineCode(input: unknown): string | null
export declare function parseMachineCodes(text: unknown): { codes: string[]; bad: string[] }
export declare function encodePayload(payload: LicensePayload): string
export declare function joinLicense(encodedPayload: string, signature: Uint8Array): string
export declare function extractLicense(text: unknown): string | null
export declare function parseLicense(
  text: unknown
): { payload: Partial<LicensePayload>; signed: Buffer; signature: Buffer } | null
