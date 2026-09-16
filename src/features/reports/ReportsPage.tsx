import { useState } from 'react'
import { CalendarCheck, Wallet, ClipboardList, Users, GraduationCap, Printer, FolderInput } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType, useCurrency } from '@/store/app'
import { Button } from '@/components/ui/Button'
import { Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { sectionTitle } from '@/features/students/StudentWizard'
import { formatDate, formatMoney, studentName, classLabel, localName, todayIso, addDays } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { reportHtml } from '@/print/templates'

type ReportId = 'attendance' | 'fees' | 'grades' | 'students' | 'staff'

/** One page of big labelled buttons. Pick a report, pick your dates, print. */
export function ReportsPage() {
  const { t } = useTranslation()
  const [active, setActive] = useState<ReportId | null>(null)

  const reports: { id: ReportId; icon: React.ReactNode; titleKey: string; helpKey: string; tone: string }[] = [
    { id: 'attendance', icon: <CalendarCheck size={32} />, titleKey: 'reports.attendanceReport', helpKey: 'reports.attendanceReportHelp', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' },
    { id: 'fees', icon: <Wallet size={32} />, titleKey: 'reports.feeReport', helpKey: 'reports.feeReportHelp', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' },
    { id: 'grades', icon: <ClipboardList size={32} />, titleKey: 'reports.gradeReport', helpKey: 'reports.gradeReportHelp', tone: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200' },
    { id: 'students', icon: <Users size={32} />, titleKey: 'reports.studentList', helpKey: 'reports.studentListHelp', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200' },
    { id: 'staff', icon: <GraduationCap size={32} />, titleKey: 'reports.staffList', helpKey: 'reports.staffListHelp', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200' },
  ]

  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActive(r.id)}
            className="surface flex items-center gap-4 rounded-2xl border-2 p-6 text-start shadow-card transition-all hover:border-brand-400 hover:shadow-lift focus-ring"
          >
            <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${r.tone}`}>{r.icon}</span>
            <span className="min-w-0">
              <span className="block text-xl font-bold">{t(r.titleKey)}</span>
              <span className="block text-sm text-ink-500 dark:text-ink-300">{t(r.helpKey)}</span>
            </span>
          </button>
        ))}
      </div>

      {active && <ReportDialog id={active} onClose={() => setActive(null)} />}
    </div>
  )
}

function ReportDialog({ id, onClose }: { id: ReportId; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const { context, print, exportCsv, school } = usePrinting()

  const [from, setFrom] = useState(addDays(todayIso(), -30))
  const [to, setTo] = useState(todayIso())
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [termId, setTermId] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: classes } = useAsync(() => api.classes.list(), [])
  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: terms } = useAsync(() => api.terms.list(), [])

  const titles: Record<ReportId, string> = {
    attendance: t('reports.attendanceReport'),
    fees: t('reports.feeReport'),
    grades: t('reports.gradeReport'),
    students: t('reports.studentList'),
    staff: t('reports.staffList'),
  }

  /** Builds the rows once, shared by both Print and Export. */
  const build = async (): Promise<{ columns: { label: string; numeric?: boolean }[]; rows: (string | number | null)[][]; meta: string; summary?: { label: string; value: string }[] }> => {
    if (id === 'attendance') {
      const rows = await api.attendance.report({
        from, to,
        classId: classId ? Number(classId) : null,
        sectionId: sectionId ? Number(sectionId) : null,
      })
      return {
        columns: [
          { label: t('students.studentId') }, { label: t('common.name') }, { label: t('common.class') },
          { label: t('attendance.present'), numeric: true }, { label: t('attendance.absent'), numeric: true },
          { label: t('attendance.late'), numeric: true }, { label: t('attendance.excused'), numeric: true },
          { label: t('common.percent'), numeric: true },
        ],
        rows: rows.map((r) => [
          r.student_code,
          lang === 'ar' && r.full_name_ar ? r.full_name_ar : r.full_name,
          localName(r, lang, 'class_label'), r.present, r.absent, r.late, r.excused, `${r.percent}%`,
        ]),
        meta: `${formatDate(from, lang, { calendar, numerals })} → ${formatDate(to, lang, { calendar, numerals })}`,
      }
    }

    if (id === 'fees') {
      const rows = await api.fees.balances({ classId: classId ? Number(classId) : null })
      const billed = rows.reduce((s, r) => s + r.billed, 0)
      const paid = rows.reduce((s, r) => s + r.paid, 0)
      return {
        columns: [
          { label: t('students.studentId') }, { label: t('common.name') }, { label: t('common.class') },
          { label: t('fees.billed'), numeric: true }, { label: t('fees.paid'), numeric: true }, { label: t('fees.balance'), numeric: true },
        ],
        rows: rows.map((r) => [
          r.student.student_code, studentName(r.student, lang), classLabel(r.student, lang),
          formatMoney(r.billed, currency, lang, numerals),
          formatMoney(r.paid, currency, lang, numerals),
          formatMoney(r.balance, currency, lang, numerals),
        ]),
        meta: classId ? localName(classes?.find((c) => c.id === Number(classId)), lang) : t('reports.allClasses'),
        summary: [
          { label: t('fees.billed'), value: formatMoney(billed, currency, lang, numerals) },
          { label: t('fees.paid'), value: formatMoney(paid, currency, lang, numerals) },
          { label: t('fees.balance'), value: formatMoney(billed - paid, currency, lang, numerals) },
        ],
      }
    }

    if (id === 'grades') {
      if (!sectionId || !termId) throw new Error(t('reports.noData'))
      const [grid, subjects] = await Promise.all([
        api.grades.grid(Number(sectionId), Number(termId)),
        api.grades.subjectsForSection(Number(sectionId)),
      ])
      return {
        columns: [
          { label: t('students.studentId') }, { label: t('common.name') },
          ...subjects.map((s) => ({ label: localName(s, lang), numeric: true })),
          { label: t('common.percent'), numeric: true }, { label: t('common.rank'), numeric: true },
        ],
        rows: grid.map((r) => [
          r.student_code,
          lang === 'ar' && r.full_name_ar ? r.full_name_ar : r.full_name,
          ...subjects.map((s) => r.scores[s.id]?.score ?? ''),
          r.maxTotal ? `${r.percent.toFixed(1)}%` : '',
          r.rank || '',
        ]),
        meta: `${sections?.find((s) => s.id === Number(sectionId)) ? sectionTitle(sections.find((s) => s.id === Number(sectionId))!, lang) : ''} · ${localName(terms?.find((x) => x.id === Number(termId)), lang)}`,
      }
    }

    if (id === 'students') {
      const rows = await api.students.list({ class_id: classId ? Number(classId) : null, status: 'active' })
      return {
        columns: [
          { label: t('students.studentId') }, { label: t('common.name') }, { label: t('common.class') },
          { label: t('students.guardianName') }, { label: t('common.phone') }, { label: t('common.dateOfBirth') },
        ],
        rows: rows.map((s) => [
          s.student_code, studentName(s, lang), classLabel(s, lang),
          s.guardian_name ?? '', s.guardian_phone ?? '',
          formatDate(s.dob, lang, { calendar, numerals }),
        ]),
        meta: classId ? localName(classes?.find((c) => c.id === Number(classId)), lang) : t('reports.allClasses'),
      }
    }

    const rows = await api.staff.list({})
    return {
      columns: [
        { label: t('staff.staffId') }, { label: t('common.name') }, { label: t('staff.jobRole') },
        { label: t('common.phone') }, { label: t('common.email') }, { label: t('staff.hireDate') },
      ],
      rows: rows.map((s) => [
        s.staff_code, localName(s, lang, 'full_name'),
        t(`roles.${s.role}`, { defaultValue: s.role }), s.phone ?? '', s.email ?? '',
        formatDate(s.hire_date, lang, { calendar, numerals }),
      ]),
      meta: '',
    }
  }

  const doPrint = async () => {
    if (!school) return
    setBusy(true)
    try {
      const built = await build()
      await print(
        reportHtml({
          school, logo: (await context()).logo, title: titles[id], meta: built.meta,
          columns: built.columns, rows: built.rows, summary: built.summary,
          lang, t, landscape: built.columns.length > 6,
        })
      )
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doExport = async () => {
    setBusy(true)
    try {
      const built = await build()
      await exportCsv(
        `${id}-report.csv`,
        built.columns.map((c, i) => ({ key: `c${i}`, label: c.label })),
        built.rows.map((r) => Object.fromEntries(r.map((cell, i) => [`c${i}`, cell])))
      )
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const needsDates = id === 'attendance'
  const needsClass = id === 'attendance' || id === 'fees' || id === 'students'
  const needsSectionAndTerm = id === 'grades'

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[id]}
      subtitle={t('reports.filters')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" loading={busy} onClick={() => void doExport()} icon={<FolderInput size={18} />}>{t('common.exportCsv')}</Button>
          <Button size="lg" variant="primary" loading={busy} onClick={() => void doPrint()} icon={<Printer size={20} />}>
            {t('reports.generate')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {needsDates && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('common.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextInput label={t('common.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
        {needsClass && (
          <Select
            label={t('common.class')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder={t('reports.allClasses')}
            options={(classes ?? []).map((c) => ({ value: c.id, label: localName(c, lang) }))}
          />
        )}
        {needsSectionAndTerm && (
          <>
            <Select
              label={t('common.class')}
              required
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder={t('common.select')}
              options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
            />
            <Select
              label={t('grades.chooseTerm')}
              required
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              placeholder={t('common.select')}
              options={(terms ?? []).map((tm) => ({ value: tm.id, label: localName(tm, lang) }))}
            />
          </>
        )}
        {id === 'staff' && <p className="text-ink-500 dark:text-ink-300">{t('reports.staffListHelp')}</p>}
      </div>
    </Modal>
  )
}
