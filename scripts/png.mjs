/**
 * A minimal PNG writer, so an icon can always be produced.
 *
 * The good-looking icon is drawn by Electron, which needs a screen. On a
 * machine without one — a server, a container, a build robot — that is not
 * available, and a build should not fail over an icon. This draws the same
 * rounded square in the school's colour with no letters on it, using nothing
 * but zlib.
 */
import zlib from 'node:zlib'

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const hexToRgb = (hex) => {
  const h = String(hex).replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/**
 * A rounded square shading from `top` to `bottom`, with a soft edge so it does
 * not look jagged at small sizes.
 */
export function roundedSquarePng(topHex, bottomHex, size = 512, radiusRatio = 0.22) {
  const top = hexToRgb(topHex)
  const bottom = hexToRgb(bottomHex)
  const r = size * radiusRatio
  const rows = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0 // no per-row filter
    const t = y / (size - 1)
    const colour = [0, 1, 2].map((i) => Math.round(top[i] + (bottom[i] - top[i]) * t))
    for (let x = 0; x < size; x++) {
      // Distance outside the rounded rectangle, for a one-pixel soft edge.
      const dx = Math.max(r - x, x - (size - 1 - r), 0)
      const dy = Math.max(r - y, y - (size - 1 - r), 0)
      const d = Math.hypot(dx, dy)
      const alpha = d <= r - 0.5 ? 255 : d >= r + 0.5 ? 0 : Math.round((r + 0.5 - d) * 255)
      const o = 1 + x * 4
      row[o] = colour[0]; row[o + 1] = colour[1]; row[o + 2] = colour[2]; row[o + 3] = alpha
    }
    rows.push(row)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8    // bit depth
  ihdr[9] = 6    // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
