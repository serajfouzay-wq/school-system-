/**
 * The workshop's signing key, and the one thing it signs: licences.
 *
 * The key pair is made once, the first time a client build needs it, and kept
 * in keys/ on this machine. The private half never leaves: it is not in git,
 * not in any package, not sent anywhere. Every build carries the public half,
 * which can check a licence but cannot make one.
 *
 * Lose keys/ and you can no longer activate new computers for the builds you
 * have already delivered (the ones already activated keep working). Keep a
 * copy of that folder somewhere safe, away from this computer.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePayload, joinLicense, normaliseMachineCode, parseLicense } from '../shared/license.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const KEYS_DIR = path.join(ROOT, 'keys')
const PRIVATE = path.join(KEYS_DIR, 'license-private.pem')
const PUBLIC = path.join(KEYS_DIR, 'license-public.pem')

/**
 * Whether a build is locked to the computers it is licensed for.
 *
 * Every client build is, unless its brand file says `"license": false` (a demo
 * to show a prospective school, say). The plain default build is the
 * developer's own and is never locked.
 */
export function isLocked(brand) {
  return brand.id !== 'default' && brand.license !== false
}

/** Makes the key pair if there is none yet. Returns true if it was just made. */
export function ensureKeys() {
  if (fs.existsSync(PRIVATE) && fs.existsSync(PUBLIC)) return false
  if (fs.existsSync(PRIVATE) !== fs.existsSync(PUBLIC)) {
    // Half a pair is a copy gone wrong. Making a new pair here would quietly
    // orphan every build already delivered, so stop and say so instead.
    throw new Error(
      `keys/ has only one of license-private.pem and license-public.pem.\n` +
        `  Put the missing one back from your backup. A new pair would stop you\n` +
        `  activating computers for every school you have already delivered.`
    )
  }
  fs.mkdirSync(KEYS_DIR, { recursive: true })
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  fs.writeFileSync(PRIVATE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  fs.writeFileSync(PUBLIC, publicKey.export({ type: 'spki', format: 'pem' }))
  fs.writeFileSync(
    path.join(KEYS_DIR, 'README - BACK THIS FOLDER UP.txt'),
    'These two files let you activate your clients\' copies of the School System.\n\n' +
      'Copy this whole folder somewhere safe (a USB stick you keep, not the one\n' +
      'you take to clients). If it is lost, the schools you have already set up\n' +
      'keep working, but you cannot activate a new or replaced computer for them\n' +
      'without building and installing their copy again.\n\n' +
      'Never give license-private.pem to anyone. Whoever has it can activate\n' +
      'copies of your system.\n'
  )
  return true
}

/** The public key as base64 DER, which is what a build carries. */
export function publicKeyForBuild() {
  ensureKeys()
  return crypto.createPublicKey(fs.readFileSync(PUBLIC)).export({ type: 'spki', format: 'der' }).toString('base64')
}

/** A short fingerprint, so two copies of keys/ can be told apart at a glance. */
export function keyFingerprint() {
  return crypto.createHash('sha256').update(Buffer.from(publicKeyForBuild(), 'base64')).digest('hex').slice(0, 12)
}

/**
 * Signs a licence for one school's build on the given computers.
 * Throws with a plain message for a code that is not a code.
 */
export function makeLicense({ brand, school, machines }) {
  if (!brand) throw new Error('Which school is this licence for?')
  const codes = [...new Set((machines ?? []).map((m) => {
    const code = normaliseMachineCode(m)
    if (!code) throw new Error(`"${m}" is not a computer code. It looks like K7QF-3M9D-XW2P-A4TE.`)
    return code
  }))]
  if (!codes.length) throw new Error('Type the computer code shown on the client\'s screen.')

  ensureKeys()
  const payload = {
    v: 1,
    brand: String(brand),
    school: String(school || brand),
    machines: codes,
    issued: new Date().toISOString().slice(0, 10),
  }
  const encoded = encodePayload(payload)
  const signature = crypto.sign(null, Buffer.from(encoded, 'ascii'), crypto.createPrivateKey(fs.readFileSync(PRIVATE)))
  const text = joinLicense(encoded, signature)

  // Checked against the public key before it is handed over, so a damaged key
  // file shows up here and not at the client's desk.
  const parsed = parseLicense(text)
  const ok = crypto.verify(null, parsed.signed, crypto.createPublicKey(fs.readFileSync(PUBLIC)), parsed.signature)
  if (!ok) throw new Error('The two files in keys/ do not belong together. Restore them from your backup.')
  return { text, payload }
}
