import type { ReportCardData, ReceiptData, School, Student } from '@shared/types'
import type { TFunction } from 'i18next'
import brand from '@/brand.generated'
import { buildDocument, documentHeader, documentTable, escapeHtml } from './document'
import { formatDate, formatMoney, localName, studentName, classLabel } from '@/lib/format'

interface Ctx {
  t: TFunction
  lang: 'en' | 'ar'
  numerals: string
  calendar: string
  logo: string | null
}

const dirOf = (lang: string) => (lang === 'ar' ? 'rtl' : 'ltr')

function schoolName(school: School, lang: 'en' | 'ar'): string {
  return localName(school, lang, 'name')
}

/* ---------------- Report card ---------------- */

export function reportCardHtml(data: ReportCardData, ctx: Ctx): string {
  const { t, lang, numerals, calendar, logo } = ctx
  const name = studentName(data.student, lang)
  const rows = data.rows.map((r) => [
    lang === 'ar' && r.subject_ar ? r.subject_ar : r.subject,
    r.score === null ? '—' : String(r.score),
    String(r.max_score),
    r.score === null ? '—' : `${((r.score / r.max_score) * 100).toFixed(1)}%`,
    r.remarks ?? '',
  ])

  const body = `
  <div class="page">
    ${documentHeader({
      schoolName: schoolName(data.school, lang),
      logoDataUrl: logo,
      address: data.school.address,
      phone: data.school.phone,
      docTitle: t('grades.reportCard'),
      meta: localName(data.term, lang, 'name'),
    })}

    <div class="grid2">
      <div class="kv"><span class="k">${escapeHtml(t('common.student'))}</span><span class="v">${escapeHtml(name)}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('students.studentId'))}</span><span class="v num">${escapeHtml(data.student.student_code)}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('common.class'))}</span><span class="v">${escapeHtml(classLabel(data.student, lang))}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('common.dateOfBirth'))}</span><span class="v num">${escapeHtml(formatDate(data.student.dob, lang, { calendar, numerals }))}</span></div>
    </div>

    ${documentTable(
      [
        { label: t('common.subject') },
        { label: t('grades.score'), numeric: true },
        { label: t('grades.maxScore'), numeric: true },
        { label: t('common.percent'), numeric: true },
        { label: t('common.notes') },
      ],
      rows
    )}

    <table style="margin-top:14px">
      <tbody>
        <tr>
          <th style="width:40%">${escapeHtml(t('common.total'))}</th>
          <td class="num">${escapeHtml(`${data.total} / ${data.maxTotal}`)}</td>
          <th style="width:25%">${escapeHtml(t('common.percent'))}</th>
          <td class="num">${escapeHtml(`${data.percentage.toFixed(1)}%`)}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('grades.grade'))}</th>
          <td class="num">${escapeHtml(data.gradeLabel)}</td>
          <th>${escapeHtml(t('common.rank'))}</th>
          <td class="num">${escapeHtml(data.rank ? `${data.rank} / ${data.classSize}` : '—')}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('students.attendanceRate'))}</th>
          <td class="num">${escapeHtml(`${data.attendancePercent}%`)}</td>
          <th>${escapeHtml(t('common.date'))}</th>
          <td class="num">${escapeHtml(formatDate(new Date().toISOString().slice(0, 10), lang, { calendar, numerals }))}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:14px">
      <div style="font-weight:700; margin-bottom:4px">${escapeHtml(t('grades.teacherRemarks'))}</div>
      <div style="border:1px solid #c9ced8; border-radius:6px; min-height:60px; padding:9px">
        ${escapeHtml(data.teacherRemarks ?? '')}
      </div>
    </div>

    <div class="signatures">
      <div class="sig"><div class="line">${escapeHtml(t('grades.classTeacherSignature'))}</div></div>
      <div class="sig"><div class="line">${escapeHtml(t('grades.principalSignature'))}</div></div>
    </div>
  </div>`

  return buildDocument({
    title: `${t('grades.reportCard')} — ${name}`,
    dir: dirOf(lang),
    lang,
    body,
  })
}

export function reportCardsHtml(list: ReportCardData[], ctx: Ctx): string {
  // Each card is its own page; the shared shell keeps one font copy for all.
  const pages = list.map((d) => extractPages(reportCardHtml(d, ctx))).join('')
  return buildDocument({ title: ctx.t('grades.reportCards'), dir: dirOf(ctx.lang), lang: ctx.lang, body: pages })
}

function extractPages(html: string): string {
  const start = html.indexOf('<body>')
  const end = html.lastIndexOf('</body>')
  return start >= 0 && end > start ? html.slice(start + 6, end) : ''
}

/* ---------------- Receipt ---------------- */

export function receiptHtml(data: ReceiptData, ctx: Ctx): string {
  const { t, lang, numerals, calendar, logo } = ctx
  const currency = data.school.currency
  const methodLabel = t(`fees.${data.payment.method}` as never, { defaultValue: data.payment.method })

  const body = `
  <div class="page" style="padding:12mm">
    ${documentHeader({
      schoolName: schoolName(data.school, lang),
      logoDataUrl: logo,
      address: data.school.address,
      phone: data.school.phone,
      docTitle: t('fees.receipt'),
      meta: data.payment.receipt_no,
    })}

    <div class="grid2">
      <div class="kv"><span class="k">${escapeHtml(t('fees.receiptNo'))}</span><span class="v num">${escapeHtml(data.payment.receipt_no)}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('common.date'))}</span><span class="v num">${escapeHtml(formatDate(data.payment.date, lang, { calendar, numerals }))}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('fees.receivedFrom'))}</span><span class="v">${escapeHtml(studentName(data.student, lang))}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('students.studentId'))}</span><span class="v num">${escapeHtml(data.student.student_code)}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('common.class'))}</span><span class="v">${escapeHtml(classLabel(data.student, lang))}</span></div>
      <div class="kv"><span class="k">${escapeHtml(t('fees.paymentMethod'))}</span><span class="v">${escapeHtml(methodLabel)}</span></div>
    </div>

    ${documentTable(
      [{ label: t('fees.feeItem') }, { label: t('common.amount'), numeric: true }],
      [
        [data.payment.item_name ?? t('fees.title'), formatMoney(data.payment.amount_paid, currency, lang, numerals)],
      ]
    )}

    <table style="margin-top:10px">
      <tbody>
        <tr>
          <th style="width:60%">${escapeHtml(t('fees.paid'))}</th>
          <td class="num" style="font-size:15pt; font-weight:800">${escapeHtml(formatMoney(data.payment.amount_paid, currency, lang, numerals))}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('fees.balance'))}</th>
          <td class="num">${escapeHtml(formatMoney(data.balanceAfter, currency, lang, numerals))}</td>
        </tr>
      </tbody>
    </table>

    ${data.payment.note ? `<p class="muted" style="margin-top:10px">${escapeHtml(data.payment.note)}</p>` : ''}

    <div class="signatures">
      <div class="sig"><div class="line">${escapeHtml(t('fees.receivedBy'))}</div></div>
      <div class="sig"><div class="line">${escapeHtml(t('fees.thankYou'))}</div></div>
    </div>
  </div>`

  return buildDocument({ title: `${t('fees.receipt')} ${data.payment.receipt_no}`, dir: dirOf(lang), lang, body })
}

/* ---------------- Student ID cards ---------------- */

const ID_CARD_CSS = `
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; padding: 10mm; }
.card {
  border: 2px solid ${brand.palette[600]}; border-radius: 4mm; padding: 4mm;
  height: 54mm; display: flex; gap: 4mm; align-items: center; page-break-inside: avoid;
}
.card .photo {
  width: 24mm; height: 30mm; border: 1px solid #c9ced8; border-radius: 2mm;
  object-fit: cover; background: #eef2f8; flex: 0 0 auto;
}
.card .info { flex: 1; min-width: 0; font-size: 9pt; }
.card .sname { font-size: 12pt; font-weight: 800; margin-bottom: 1mm; }
.card .school { font-size: 8pt; font-weight: 700; color: ${brand.palette[600]}; text-transform: uppercase; letter-spacing: .4px; }
.card .row { display: flex; gap: 2mm; margin-top: .6mm; }
.card .row .k { color: #5a6474; }
.barcode { margin-top: 2mm; display: flex; gap: 1px; height: 8mm; align-items: flex-end; }
.barcode i { display: block; background: #1b1f27; width: 1px; height: 100%; }
.barcode i.w { width: 2.5px; }
.barcode i.g { background: transparent; }
.card .code { font-family: monospace; font-size: 8pt; letter-spacing: 1px; direction: ltr; }
`

/** A simple Code-39-style visual barcode; enough for a school to scan or read. */
function barcode(text: string): string {
  const bars = [...text].flatMap((ch) => {
    const n = ch.charCodeAt(0)
    return [
      `<i class="${n % 3 === 0 ? 'w' : ''}"></i>`,
      '<i class="g"></i>',
      `<i class="${n % 2 === 0 ? 'w' : ''}"></i>`,
      '<i class="g"></i>',
    ]
  })
  return `<div class="barcode">${bars.join('')}</div>`
}

export function idCardsHtml(
  students: (Student & { photoDataUrl?: string | null })[],
  school: School,
  ctx: Ctx
): string {
  const { t, lang, numerals, calendar } = ctx
  const year = school.academic_year_start
    ? `${formatDate(school.academic_year_start, lang, { calendar, numerals })} – ${formatDate(school.academic_year_end, lang, { calendar, numerals })}`
    : ''

  const cards = students
    .map(
      (s) => `
    <div class="card">
      ${s.photoDataUrl ? `<img class="photo" src="${s.photoDataUrl}" alt="">` : '<div class="photo"></div>'}
      <div class="info">
        <div class="school">${escapeHtml(schoolName(school, lang))}</div>
        <div class="sname">${escapeHtml(studentName(s, lang))}</div>
        <div class="row"><span class="k">${escapeHtml(t('idcard.studentId'))}:</span><span class="code">${escapeHtml(s.student_code)}</span></div>
        <div class="row"><span class="k">${escapeHtml(t('common.class'))}:</span><span>${escapeHtml(classLabel(s, lang))}</span></div>
        ${year ? `<div class="row"><span class="k">${escapeHtml(t('idcard.validFor'))}:</span><span class="num">${escapeHtml(year)}</span></div>` : ''}
        ${barcode(s.student_code)}
      </div>
    </div>`
    )
    .join('')

  return buildDocument({
    title: t('idcard.title'),
    dir: dirOf(lang),
    lang,
    extraCss: ID_CARD_CSS,
    body: `<div class="cards">${cards}</div>`,
  })
}

/* ---------------- Generic report ---------------- */

export function reportHtml(opts: {
  school: School
  logo: string | null
  title: string
  meta?: string
  columns: { label: string; numeric?: boolean }[]
  rows: (string | number | null)[][]
  summary?: { label: string; value: string }[]
  lang: 'en' | 'ar'
  t: TFunction
  landscape?: boolean
}): string {
  const { school, logo, title, meta, columns, rows, summary, lang, t } = opts
  const body = `
  <div class="page">
    ${documentHeader({
      schoolName: schoolName(school, lang),
      logoDataUrl: logo,
      address: school.address,
      phone: school.phone,
      docTitle: title,
      meta,
    })}
    ${rows.length ? documentTable(columns, rows) : `<p class="muted">${escapeHtml(t('reports.noData'))}</p>`}
    ${
      summary?.length
        ? `<table style="margin-top:12px"><tbody>${summary
            .map((s) => `<tr><th style="width:60%">${escapeHtml(s.label)}</th><td class="num">${escapeHtml(s.value)}</td></tr>`)
            .join('')}</tbody></table>`
        : ''
    }
    <div class="footer">${escapeHtml(
      t('reports.generatedOn', { date: new Date().toLocaleString(lang === 'ar' ? 'ar-LY' : 'en-GB') })
    )}</div>
  </div>`

  return buildDocument({
    title,
    dir: dirOf(lang),
    lang,
    body,
    extraCss: opts.landscape ? '@page { size: A4 landscape; margin: 0; }' : '',
  })
}

/** Attendance sheets and timetables print as their own grid. */
export function gridReportHtml(opts: {
  school: School
  logo: string | null
  title: string
  meta?: string
  headerRow: string[]
  bodyRows: string[][]
  lang: 'en' | 'ar'
  t: TFunction
  landscape?: boolean
}): string {
  return reportHtml({
    school: opts.school,
    logo: opts.logo,
    title: opts.title,
    meta: opts.meta,
    columns: opts.headerRow.map((label) => ({ label })),
    rows: opts.bodyRows,
    lang: opts.lang,
    t: opts.t,
    landscape: opts.landscape,
  })
}

/* ---------------- Transport receipt ---------------- */

/**
 * Bus money is not school fees, so it gets its own receipt rather than a fee
 * receipt wearing a different label. The layout is deliberately the same one
 * the office already knows.
 */
export function transportReceiptHtml(
  data: {
    school: School
    receiptNo: string
    date: string
    method: string
    amount: number
    studentName: string
    studentCode: string
    classLabel: string
    routeName: string
    balanceAfter: number
    note?: string | null
  },
  ctx: Ctx
): string {
  const { t, lang, numerals, calendar, logo } = ctx
  const currency = data.school.currency
  const methodLabel = t(`fees.${data.method}` as never, { defaultValue: data.method })
  const kv = (k: string, v: string, numeric = false) =>
    `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v${numeric ? ' num' : ''}">${escapeHtml(v)}</span></div>`

  const body = `
  <div class="page" style="padding:12mm">
    ${documentHeader({
      schoolName: schoolName(data.school, lang),
      logoDataUrl: logo,
      address: data.school.address,
      phone: data.school.phone,
      docTitle: t('transport.receipt'),
      meta: data.receiptNo,
    })}

    <div class="grid2">
      ${kv(t('fees.receiptNo'), data.receiptNo, true)}
      ${kv(t('common.date'), formatDate(data.date, lang, { calendar, numerals }), true)}
      ${kv(t('fees.receivedFrom'), data.studentName)}
      ${kv(t('students.studentId'), data.studentCode, true)}
      ${kv(t('common.class'), data.classLabel)}
      ${kv(t('transport.route'), data.routeName)}
    </div>

    ${documentTable(
      [{ label: t('transport.busFee') }, { label: t('common.amount'), numeric: true }],
      [[data.routeName, formatMoney(data.amount, currency, lang, numerals)]]
    )}

    <table style="margin-top:10px">
      <tbody>
        <tr>
          <th style="width:60%">${escapeHtml(t('fees.paid'))}</th>
          <td class="num" style="font-size:15pt; font-weight:800">${escapeHtml(
            formatMoney(data.amount, currency, lang, numerals)
          )}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('transport.balance'))}</th>
          <td class="num">${escapeHtml(formatMoney(data.balanceAfter, currency, lang, numerals))}</td>
        </tr>
        <tr>
          <th>${escapeHtml(t('fees.paymentMethod'))}</th>
          <td>${escapeHtml(methodLabel)}</td>
        </tr>
      </tbody>
    </table>

    ${data.note ? `<p class="muted" style="margin-top:10px">${escapeHtml(data.note)}</p>` : ''}

    <div class="signatures">
      <div class="sig"><div class="line">${escapeHtml(t('fees.receivedBy'))}</div></div>
      <div class="sig"><div class="line">${escapeHtml(t('fees.thankYou'))}</div></div>
    </div>
  </div>`

  return buildDocument({ title: `${t('transport.receipt')} ${data.receiptNo}`, dir: dirOf(lang), lang, body })
}
