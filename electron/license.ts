import { app } from 'electron'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import brand from './brand'
import { extractLicense, formatMachineCode, parseLicense } from '../shared/license.mjs'
import type { LicenseProblem, LicenseStatus } from '../shared/types'

/**
 * Keeps a school's copy on the school's computers.
 *
 * A client build carries the workshop's public key. On start it works out this
 * computer's code and looks for a licence, signed by the workshop, that names
 * this build and this code. Without one, the program shows the activation
 * screen and nothing else: every other action is refused by the main process,
 * so the school's data stays closed.
 *
 * Copying the installed program, its data folder or its installer to another
 * computer gives a different code, which no licence names, so the copy does not
 * open. Making a licence needs the private key, which never leaves the
 * workshop.
 *
 * A build without a key (the plain default build, or a demo made with
 * `"license": false`) is not locked at all.
 */

const FILE_NAME = 'license.key'

/** The raw identity the operating system gives this installation. */
function rawMachineId(): string | null {
  try {
    if (process.platform === 'win32') {
      // MachineGuid is written when Windows is installed and survives updates.
      // /reg:64 reads the real key even from a 32-bit process.
      const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe')
      const out = execFileSync(
        reg,
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
        { encoding: 'utf8', windowsHide: true, timeout: 10_000 }
      )
      return /MachineGuid\s+REG_\w+\s+([0-9a-f-]{36})/i.exec(out)?.[1] ?? null
    }
    if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8', timeout: 10_000 })
      return /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(out)?.[1] ?? null
    }
    for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      if (fs.existsSync(file)) {
        const id = fs.readFileSync(file, 'utf8').trim()
        if (id) return id
      }
    }
  } catch (e) {
    console.error('[license] could not read this computer\'s identity:', (e as Error).message)
  }
  return null
}

let machineCode: string | null | undefined

/**
 * This computer's code, as the school reads it out: K7QF-3M9D-XW2P-A4TE.
 * Hashed, so the code says nothing about the computer beyond being its own.
 */
export function getMachineCode(): string | null {
  if (machineCode !== undefined) return machineCode
  const raw = rawMachineId()
  machineCode = raw
    ? formatMachineCode(crypto.createHash('sha256').update(`school-system:${raw.trim().toLowerCase()}`).digest())
    : null
  return machineCode
}

function publicKey(): crypto.KeyObject | null {
  if (!brand.licenseKey) return null
  return crypto.createPublicKey({ key: Buffer.from(brand.licenseKey, 'base64'), format: 'der', type: 'spki' })
}

/** Where an activated licence is kept: beside the school's data. */
function savedFile(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

/** A licence made for this computer before the build, carried inside it. */
function shippedFile(): string {
  return path.join(process.resourcesPath ?? '', 'preseed', FILE_NAME)
}

/** Checks one licence text against this build and this computer. */
function check(text: string): Omit<LicenseStatus, 'required' | 'machineCode'> {
  const fail = (problem: LicenseProblem) => ({ licensed: false, school: null, issued: null, problem })
  const key = publicKey()
  const parsed = parseLicense(text)
  if (!key || !parsed) return fail('invalid')

  let genuine = false
  try {
    genuine = crypto.verify(null, parsed.signed, key, parsed.signature)
  } catch {
    genuine = false
  }
  if (!genuine) return fail('invalid')

  const { payload } = parsed
  if (payload.v !== 1) return fail('invalid')
  if (payload.brand !== brand.id) return fail('otherSchool')
  const code = getMachineCode()
  if (!code) return fail('noComputerCode')
  if (!Array.isArray(payload.machines) || !payload.machines.includes(code)) return fail('otherComputer')

  return { licensed: true, school: payload.school ?? null, issued: payload.issued ?? null, problem: null }
}

let cached: LicenseStatus | null = null

export function licenseStatus(): LicenseStatus {
  if (cached) return cached
  const required = Boolean(brand.licenseKey)
  const code = getMachineCode()
  if (!required) {
    cached = { required, licensed: true, machineCode: code, school: null, issued: null, problem: null }
    return cached
  }

  // The worst problem found is the one reported: a licence for another
  // computer says more about what happened than "none found".
  let best: Omit<LicenseStatus, 'required' | 'machineCode'> = {
    licensed: false, school: null, issued: null, problem: code ? 'missing' : 'noComputerCode',
  }
  for (const file of [savedFile(), shippedFile()]) {
    let text: string
    try {
      if (!fs.existsSync(file)) continue
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const result = check(text)
    if (result.licensed) {
      best = result
      // A licence that came inside the package is copied beside the data, so
      // a later build made without this computer's code still opens here.
      if (file !== savedFile()) {
        try { fs.writeFileSync(savedFile(), extractLicense(text) + '\n') } catch { /* it still works from the package */ }
      }
      break
    }
    if (best.problem === 'missing') best = result
  }
  cached = { required, machineCode: code, ...best }
  return cached
}

/** True when this copy may open the school's data on this computer. */
export function isLicensed(): boolean {
  return licenseStatus().licensed
}

/**
 * Activates this computer with a licence — pasted, or read from a file. A
 * licence that does not fit is refused and nothing is saved, so a mistake can
 * never replace a licence that works.
 */
export function activate(text: string): LicenseStatus {
  const result = check(String(text ?? ''))
  if (!result.licensed) {
    return { required: Boolean(brand.licenseKey), machineCode: getMachineCode(), ...result }
  }
  const line = extractLicense(text)!
  fs.mkdirSync(path.dirname(savedFile()), { recursive: true })
  fs.writeFileSync(savedFile(), line + '\n')
  cached = null
  return licenseStatus()
}

/** Reads a licence file the school picked, refusing anything that is plainly not one. */
export function activateFromFile(file: string): LicenseStatus {
  const size = fs.statSync(file).size
  if (size > 64 * 1024) {
    return { required: true, licensed: false, machineCode: getMachineCode(), school: null, issued: null, problem: 'invalid' }
  }
  return activate(fs.readFileSync(file, 'utf8'))
}
