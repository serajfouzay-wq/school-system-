/**
 * The licence format, shared by the workshop that issues licences and the
 * program that checks them.
 *
 * A licence is one line of text:
 *
 *   SSL1.<payload>.<signature>
 *
 * The payload is JSON — which school's build it is for and which computers may
 * run it — and the signature is Ed25519 over the payload exactly as written.
 * Only the workshop holds the private key, so only the workshop can make a
 * licence; each build carries the public key, so it can check one without a
 * network. Being one line of plain text, a licence can travel as a file on a
 * USB stick or be pasted from a WhatsApp message.
 *
 * Plain JavaScript so node (the workshop) and vite (the app) share one copy.
 */

export const LICENSE_PREFIX = 'SSL1'

/* ---------------- Computer codes ---------------- */

// Crockford's base32: no I, L, O or U, so a code read aloud over the phone or
// copied by hand cannot be mistaken for another.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 80 bits as sixteen characters, grouped in fours: K7QF-3M9D-XW2P-A4TE. */
export function formatMachineCode(bytes) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes.slice(0, 10)) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  return out.match(/.{4}/g).join('-')
}

/**
 * Tidies a code however it was typed: lower case, spaces, missing dashes, and
 * the letters people write for the digits that look like them.
 * Returns null for anything that cannot be a code.
 */
export function normaliseMachineCode(input) {
  const raw = String(input ?? '')
    .toUpperCase()
    .replace(/[O]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '')
  if (raw.length !== 16 || [...raw].some((c) => !ALPHABET.includes(c))) return null
  return raw.match(/.{4}/g).join('-')
}

/**
 * Every code in a list typed or pasted by a person: one per line, or separated
 * by commas. Returns the tidy codes and anything that was not one, so the
 * caller can say which entry was wrong.
 */
export function parseMachineCodes(text) {
  const codes = []
  const bad = []
  for (const item of String(text ?? '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const one = normaliseMachineCode(item)
    if (one) { codes.push(one); continue }
    // Several codes on one line with only spaces between them.
    const parts = item.split(/\s+/).map(normaliseMachineCode)
    if (parts.length > 1 && parts.every(Boolean)) codes.push(...parts)
    else bad.push(item)
  }
  return { codes: [...new Set(codes)], bad }
}

/* ---------------- The licence text ---------------- */

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')

/** The bytes the signature covers. */
export function encodePayload(payload) {
  return b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
}

export function joinLicense(encodedPayload, signature) {
  return `${LICENSE_PREFIX}.${encodedPayload}.${b64url(signature)}`
}

// An Ed25519 signature is always 64 bytes: 86 characters here. Fixing the
// length is what lets a licence be found with other words run straight on after
// it, which is what happens once a pasted message loses its line breaks.
const LICENSE_PATTERN = /SSL1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{86})/

/**
 * Pulls a licence out of whatever it arrived in — a file with a blank line at
 * the end, a WhatsApp message with a greeting around it, a paste that picked up
 * a line break halfway through — as the single line it was issued as.
 * Returns null when there is no licence in the text at all.
 */
export function extractLicense(text) {
  return LICENSE_PATTERN.exec(String(text ?? '').replace(/\s+/g, ''))?.[0] ?? null
}

/** The licence's parts, or null when there is no licence in the text. */
export function parseLicense(text) {
  const line = extractLicense(text)
  if (!line) return null
  const [, encodedPayload, encodedSignature] = LICENSE_PATTERN.exec(line)
  let payload
  try {
    payload = JSON.parse(unb64url(encodedPayload).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  return { payload, signed: Buffer.from(encodedPayload, 'ascii'), signature: unb64url(encodedSignature) }
}
