/**
 * The workshop: a small page for making a school's copy of the system.
 *
 * Runs on this machine only, opens in a browser, and does what editing a brand
 * file by hand used to do — name, colour, logo, which parts are included, and
 * the school's own spreadsheets — then runs the build and hands back the
 * finished package.
 *
 *   npm run builder
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MODULE_NAMES } from '../../shared/modules.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const PORT = Number(process.env.PORT) || 4321

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 80 * 1024 * 1024) { reject(new Error('That is a very large upload')); req.destroy() }
    })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })

/** A folder name safe on every platform. */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'school'

/** Writes everything the build needs, and returns the brand file's path. */
function stage(form) {
  const id = slug(form.id || form.appName)
  const dir = path.join(ROOT, 'clients', id)
  fs.mkdirSync(dir, { recursive: true })

  const write = (name, dataUrl) => {
    if (!dataUrl) return null
    const base64 = String(dataUrl).split(',').pop()
    const file = path.join(dir, name)
    fs.writeFileSync(file, Buffer.from(base64, 'base64'))
    return path.relative(ROOT, file).split(path.sep).join('/')
  }

  const logo = write(`logo${path.extname(form.logoName || '.png') || '.png'}`, form.logo)
  const data = {}
  for (const kind of ['classes', 'subjects', 'students', 'staff']) {
    const rel = write(`${kind}.csv`, form.files?.[kind])
    if (rel) data[kind] = rel
  }
  if (form.owner?.name || form.owner?.pin) data.owner = form.owner
  if (form.terms?.length) data.terms = form.terms

  const brand = {
    id,
    appName: form.appName,
    appNameAr: form.appNameAr || null,
    color: form.color,
    logo,
    school: form.school ?? {},
    modules: form.modules ?? {},
    notes: form.notes || null,
  }
  if (Object.keys(data).length) brand.data = data

  const brandFile = path.join(ROOT, 'brands', `${id}.json`)
  fs.mkdirSync(path.dirname(brandFile), { recursive: true })
  fs.writeFileSync(brandFile, JSON.stringify(brand, null, 2) + '\n')
  return { brandFile: path.relative(ROOT, brandFile).split(path.sep).join('/'), id }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, fs.readFileSync(path.join(HERE, 'page.html'), 'utf8'), 'text/html')
  }
  if (req.method === 'GET' && url.pathname === '/palette.mjs') {
    return send(res, 200, fs.readFileSync(path.join(ROOT, 'shared', 'palette.mjs'), 'utf8'), 'text/javascript')
  }
  if (req.method === 'GET' && url.pathname === '/api/modules') {
    return send(res, 200, { modules: MODULE_NAMES })
  }
  if (req.method === 'GET' && url.pathname === '/api/brands') {
    const dir = path.join(ROOT, 'brands')
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : []
    return send(res, 200, {
      brands: files.map((f) => {
        try {
          const b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
          return { file: f, id: b.id, appName: b.appName, color: b.color }
        } catch { return null }
      }).filter(Boolean),
    })
  }
  if (req.method === 'GET' && url.pathname === '/api/brand') {
    const file = path.join(ROOT, 'brands', path.basename(url.searchParams.get('file') || ''))
    if (!fs.existsSync(file)) return send(res, 404, { error: 'No such brand file' })
    return send(res, 200, JSON.parse(fs.readFileSync(file, 'utf8')))
  }

  if (req.method === 'POST' && url.pathname === '/api/build') {
    let form
    try { form = await readBody(req) } catch (e) { return send(res, 400, { error: e.message }) }
    if (!form.appName || !form.color) return send(res, 400, { error: 'A name and a colour are needed' })

    let staged
    try { staged = stage(form) } catch (e) { return send(res, 500, { error: e.message }) }

    // The build's own output is streamed straight to the page as it happens,
    // because a package takes minutes and silence looks like a hang.
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' })
    res.write(`Making ${form.appName}\nBrand file: ${staged.brandFile}\n\n`)

    const args = ['scripts/build-school.mjs', staged.brandFile]
    if (form.target && form.target !== 'none') args.push(`--${form.target}`)
    const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0' } })
    child.stdout.on('data', (d) => res.write(d))
    child.stderr.on('data', (d) => res.write(d))
    child.on('close', (code) => {
      res.write(code === 0 ? `\n__DONE__ ${path.join(ROOT, 'release')}\n` : `\n__FAILED__ ${code}\n`)
      res.end()
    })
    child.on('error', (e) => { res.write(`\n__FAILED__ ${e.message}\n`); res.end() })
    return
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  The workshop is open at  http://localhost:${PORT}\n`)
  console.log('  Open that address in your browser. Press Ctrl+C here when you are done.\n')
})
