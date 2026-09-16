/**
 * Cross-building for Windows from Linux leaves the Linux build of
 * better-sqlite3 in the package: @electron/rebuild cannot compile a Windows
 * binary here, and copies the host one instead. The app would then crash on
 * Windows the moment it opened the database.
 *
 * This hook replaces it with the official prebuilt binary for the target
 * platform, and refuses to produce a package if it cannot — a silently broken
 * installer is far worse than a failed build.
 *
 * It is a no-op when building on the target platform itself (a Windows runner
 * compiles the real thing, and this just confirms it).
 */
const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')
const zlib = require('node:zlib')

/** Electron 33 ships Node 20's ABI; bump this alongside the Electron major. */
const ABI_BY_ELECTRON_MAJOR = { 30: 123, 31: 125, 32: 128, 33: 130, 34: 132, 35: 133 }

const PE_MAGIC = 'MZ'
const ELF_MAGIC = '\x7fELF'
const MACHO_MAGICS = ['\xcf\xfa\xed\xfe', '\xca\xfe\xba\xbe']

function detectFormat(file) {
  const head = fs.readFileSync(file).subarray(0, 4).toString('latin1')
  if (head.startsWith(PE_MAGIC)) return 'windows'
  if (head.startsWith(ELF_MAGIC)) return 'linux'
  if (MACHO_MAGICS.some((m) => head.startsWith(m))) return 'mac'
  return 'unknown'
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const get = (target, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      https
        .get(target, { headers: { 'User-Agent': 'school-system-build' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            return get(res.headers.location, redirects + 1)
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`HTTP ${res.statusCode} for ${target}`))
          }
          const out = fs.createWriteStream(dest)
          res.pipe(out)
          out.on('finish', () => out.close(() => resolve(dest)))
          out.on('error', reject)
        })
        .on('error', reject)
    }
    get(url)
  })
}

/** Minimal tar reader — enough to pull one known file out of a .tar.gz. */
function extractFromTarGz(archive, wantedSuffix) {
  const tar = zlib.gunzipSync(fs.readFileSync(archive))
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    if (!name) break
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim(), 8) || 0
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (name.endsWith(wantedSuffix)) return Buffer.from(body)
    offset += 512 + Math.ceil(size / 512) * 512
  }
  throw new Error(`${wantedSuffix} not found inside ${archive}`)
}

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName // 'win32' | 'darwin' | 'linux'
  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : 'x64'
  const expected = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'mac' : 'linux'

  const nodeFile = path.join(
    context.appOutDir,
    platform === 'darwin'
      ? `${context.packager.appInfo.productFilename}.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
      : 'resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
  )

  if (!fs.existsSync(nodeFile)) {
    throw new Error(`better-sqlite3 binary missing from the package at ${nodeFile}`)
  }

  const found = detectFormat(nodeFile)
  if (found === expected) {
    console.log(`  • better-sqlite3 binary is correct for ${platform}`)
    return
  }

  console.log(`  • better-sqlite3 binary is a ${found} build but ${platform} is needed — fetching the official prebuild`)

  const version = require('../node_modules/better-sqlite3/package.json').version
  const electronMajor = Number(require('../node_modules/electron/package.json').version.split('.')[0])
  const abi = ABI_BY_ELECTRON_MAJOR[electronMajor]
  if (!abi) {
    throw new Error(
      `No known Node ABI for Electron ${electronMajor}. Add it to ABI_BY_ELECTRON_MAJOR in build/after-pack.cjs, ` +
        `or build on ${platform} directly.`
    )
  }

  const asset = `better-sqlite3-v${version}-electron-v${abi}-${platform}-${arch}.tar.gz`
  const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/${asset}`
  const cacheDir = path.join(__dirname, '..', '.electron-cache', 'prebuilds')
  fs.mkdirSync(cacheDir, { recursive: true })
  const archive = path.join(cacheDir, asset)

  if (!fs.existsSync(archive)) await download(url, archive)

  const binary = extractFromTarGz(archive, 'better_sqlite3.node')
  fs.writeFileSync(nodeFile, binary)

  const now = detectFormat(nodeFile)
  if (now !== expected) {
    throw new Error(`Replacement binary is a ${now} build, not ${expected}. Refusing to ship a broken package.`)
  }
  console.log(`  • replaced better-sqlite3 with the ${platform}-${arch} prebuild (${(binary.length / 1024).toFixed(0)} KB)`)
}
