import arabicFont from '@/assets/fonts/cairo-arabic.woff2?inline'
import latinFont from '@/assets/fonts/cairo-latin.woff2?inline'

/**
 * Printed documents are rendered in a separate window from a `data:` URL, so
 * they cannot reach the app's own assets. The font is therefore embedded
 * directly — this is what keeps Arabic letters joined and correctly shaped in
 * the PDF instead of falling back to a system font that may not shape at all.
 */
const FONT_CSS = `
@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 200 1000;
  src: url('${arabicFont}') format('woff2');
  unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1,
    U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF,
    U+FE70-FE74, U+FE76-FEFC;
}
@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 200 1000;
  src: url('${latinFont}') format('woff2');
}
`

const BASE_CSS = `
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Cairo', system-ui, sans-serif;
  margin: 0;
  color: #1b1f27;
  background: #fff;
  font-size: 12pt;
  line-height: 1.6;
}
.page { padding: 14mm 12mm; }
.page + .page { page-break-before: always; }
h1, h2, h3 { margin: 0 0 4px; }
h1 { font-size: 20pt; }
h2 { font-size: 15pt; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { border: 1px solid #c9ced8; padding: 6px 9px; text-align: start; }
th { background: #eef2f8; font-weight: 700; }
/* Numbers read left-to-right even inside an Arabic document, as is standard. */
.num { direction: ltr; unicode-bidi: embed; text-align: end; font-variant-numeric: tabular-nums; }
.muted { color: #5a6474; }
.right { text-align: end; }
.center { text-align: center; }
.header {
  display: flex; align-items: center; gap: 14px;
  border-bottom: 3px solid #1f5ceb; padding-bottom: 10px; margin-bottom: 14px;
}
.header img { width: 64px; height: 64px; object-fit: contain; }
.header .school-name { font-size: 18pt; font-weight: 800; }
.badge {
  display: inline-block; border: 1px solid #c9ced8; border-radius: 999px;
  padding: 2px 10px; font-size: 10pt; font-weight: 700;
}
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 10px 0; }
.kv { display: flex; gap: 8px; }
.kv .k { color: #5a6474; min-width: 38%; }
.kv .v { font-weight: 600; }
.signatures { display: flex; justify-content: space-between; gap: 30px; margin-top: 34px; }
.sig { flex: 1; text-align: center; }
.sig .line { border-top: 1px solid #1b1f27; margin-top: 34px; padding-top: 5px; font-size: 10pt; }
.footer { margin-top: 16px; font-size: 9pt; color: #5a6474; text-align: center; }
@page { size: A4; margin: 0; }
`

export interface DocumentOptions {
  title: string
  dir: 'ltr' | 'rtl'
  lang: string
  body: string
  extraCss?: string
}

export function buildDocument({ title, dir, lang, body, extraCss = '' }: DocumentOptions): string {
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${FONT_CSS}${BASE_CSS}${extraCss}</style>
</head>
<body>${body}</body>
</html>`
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function documentHeader(opts: {
  schoolName: string
  logoDataUrl?: string | null
  address?: string | null
  phone?: string | null
  docTitle: string
  meta?: string
}): string {
  return `
  <div class="header">
    ${opts.logoDataUrl ? `<img src="${opts.logoDataUrl}" alt="">` : ''}
    <div style="flex:1; min-width:0">
      <div class="school-name">${escapeHtml(opts.schoolName)}</div>
      <div class="muted" style="font-size:10pt">
        ${escapeHtml(opts.address ?? '')}${opts.address && opts.phone ? ' · ' : ''}${escapeHtml(opts.phone ?? '')}
      </div>
    </div>
    <div style="text-align:end">
      <div style="font-size:14pt; font-weight:800">${escapeHtml(opts.docTitle)}</div>
      ${opts.meta ? `<div class="muted" style="font-size:10pt">${escapeHtml(opts.meta)}</div>` : ''}
    </div>
  </div>`
}

/** A plain data table used by every "Generate & Print" report. */
export function documentTable(
  columns: { label: string; align?: 'start' | 'end' | 'center'; numeric?: boolean }[],
  rows: (string | number | null)[][]
): string {
  const head = columns.map((c) => `<th class="${c.align ? `text-${c.align}` : ''}">${escapeHtml(c.label)}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((cell, i) => `<td class="${columns[i]?.numeric ? 'num' : ''}">${escapeHtml(cell ?? '')}</td>`)
          .join('')}</tr>`
    )
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}
