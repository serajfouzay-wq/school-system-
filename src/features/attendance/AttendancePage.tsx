import { useEffect, useState } from 'react'
import { Check, X, Clock, FileCheck, Save, CalendarCheck, Users, Printer, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync, useUnsavedGuard } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { AttendanceStatus, StaffAttendanceStatus, Recipient } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { ModuleTour } from '@/components/ui/Tour'
import { Avatar } from '@/components/ui/Avatar'
import { sectionTitle } from '@/features/students/StudentWizard'
import { AttendanceCalendar } from './AttendanceCalendar'
import { formatDate, todayIso, monthIso } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { gridReportHtml } from '@/print/templates'
import { WhatsAppQueue } from '@/features/communication/WhatsAppQueue'

const STUDENT_STATUSES: { value: AttendanceStatus; labelKey: string; icon: React.ReactNode; on: string }[] = [
  { value: 'present', labelKey: 'attendance.present', icon: <Check size={18} />, on: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'absent', labelKey: 'attendance.absent', icon: <X size={18} />, on: 'bg-rose-600 border-rose-600 text-white' },
  { value: 'late', labelKey: 'attendance.late', icon: <Clock size={18} />, on: 'bg-amber-500 border-amber-500 text-white' },
  { value: 'excused', labelKey: 'attendance.excused', icon: <FileCheck size={18} />, on: 'bg-brand-600 border-brand-600 text-white' },
]

const STAFF_STATUSES: { value: StaffAttendanceStatus; labelKey: string; icon: React.ReactNode; on: string }[] = [
  { value: 'present', labelKey: 'attendance.present', icon: <Check size={18} />, on: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'absent', labelKey: 'attendance.absent', icon: <X size={18} />, on: 'bg-rose-600 border-rose-600 text-white' },
  { value: 'late', labelKey: 'attendance.late', icon: <Clock size={18} />, on: 'bg-amber-500 border-amber-500 text-white' },
  { value: 'leave', labelKey: 'attendance.leave', icon: <FileCheck size={18} />, on: 'bg-violet-600 border-violet-600 text-white' },
]

export function AttendancePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'students' | 'staff'>('students')
  return (
    <div>
      <PageHeader title={t('attendance.title')} />
      <ModuleTour
        moduleKey="attendance"
        tips={[
          { title: t('attendance.markAllPresent'), body: t('attendance.thenTapExceptions') },
          { title: t('common.save'), body: t('common.autoSaved') },
        ]}
      />
      <Tabs
        tabs={[
          { id: 'students' as const, label: t('attendance.students'), icon: <Users size={18} /> },
          { id: 'staff' as const, label: t('attendance.staffTab'), icon: <CalendarCheck size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'students' ? <StudentAttendance /> : <StaffAttendance />}
    </div>
  )
}

function StudentAttendance() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)
  const { context, print, school } = usePrinting()

  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(monthIso())
  const [waOpen, setWaOpen] = useState(false)
  const [waRecipients, setWaRecipients] = useState<Recipient[]>([])

  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: rows, loading, error, reload } = useAsync(
    () => (sectionId ? api.attendance.section(Number(sectionId), date) : Promise.resolve([])),
    [sectionId, date]
  )
  const { data: monthData, reload: reloadMonth } = useAsync(
    () => (sectionId ? api.attendance.sectionMonth(Number(sectionId), month) : Promise.resolve([])),
    [sectionId, month]
  )

  // Attendance is saved on a button, not as you type, so closing the window
  // with unsaved marks is the one place work could genuinely be lost.
  useUnsavedGuard(dirty)

  useEffect(() => {
    if (!sections?.length || sectionId) return
    setSectionId(String(sections[0].id))
  }, [sections, sectionId])

  useEffect(() => {
    if (!rows) return
    setMarks(Object.fromEntries(rows.filter((r) => r.status).map((r) => [r.student_id, r.status!])))
    setDirty(false)
  }, [rows])

  const setMark = (studentId: number, status: AttendanceStatus) => {
    setMarks((m) => ({ ...m, [studentId]: status }))
    setDirty(true)
  }

  const markAllPresent = () => {
    setMarks(Object.fromEntries((rows ?? []).map((r) => [r.student_id, 'present' as AttendanceStatus])))
    setDirty(true)
  }

  const save = async () => {
    const entries = Object.entries(marks).map(([id, status]) => ({ student_id: Number(id), status }))
    if (!entries.length) return
    setSaving(true)
    try {
      await api.attendance.save(date, entries)
      setDirty(false)
      reload()
      reloadMonth()
      toast(t('attendance.savedFor', { date: formatDate(date, lang, { calendar, numerals }) }), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const printSheet = async () => {
    if (!school || !rows?.length) return
    const section = sections?.find((s) => s.id === Number(sectionId))
    await print(
      gridReportHtml({
        school,
        logo: (await context()).logo,
        title: t('attendance.title'),
        meta: `${section ? sectionTitle(section, lang) : ''} · ${formatDate(date, lang, { calendar, numerals })}`,
        headerRow: ['#', t('students.studentId'), t('common.name'), t('common.status')],
        bodyRows: rows.map((r, i) => [
          String(i + 1),
          r.student_code,
          lang === 'ar' && r.full_name_ar ? r.full_name_ar : r.full_name,
          marks[r.student_id] ? t(`attendance.${marks[r.student_id]}`) : '',
        ]),
        lang,
        t,
      })
    )
  }

  const counts = STUDENT_STATUSES.map((s) => ({
    ...s,
    count: Object.values(marks).filter((m) => m === s.value).length,
  }))

  return (
    <div>
      <FilterBar>
        <div className="min-w-[14rem] flex-1">
          <Select
            label={t('attendance.chooseClass')}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder={t('common.select')}
            options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
          />
        </div>
        <div className="min-w-[11rem]">
          <TextInput label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button onClick={() => setDate(todayIso())}>{t('common.today')}</Button>
      </FilterBar>

      {!sectionId ? (
        <Card><EmptyState icon={<CalendarCheck size={44} />} title={t('attendance.chooseClass')} /></Card>
      ) : loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows?.length ? (
        <Card><EmptyState icon={<Users size={44} />} title={t('attendance.emptyTitle')} body={t('attendance.emptyBody')} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button size="lg" variant="success" onClick={markAllPresent} icon={<Check size={20} />}>
                  {t('attendance.markAllPresent')}
                </Button>
                <p className="text-sm text-ink-500 dark:text-ink-300">{t('attendance.thenTapExceptions')}</p>
                <div className="flex flex-wrap gap-2">
                  {/* Only offer this once the register is saved, or the list
                      would be built from marks that are not recorded yet. */}
                  <Button
                    variant="success"
                    disabled={dirty}
                    icon={<MessageCircle size={18} />}
                    onClick={async () => {
                      setWaRecipients(await api.whatsapp.absentToday(date, Number(sectionId)))
                      setWaOpen(true)
                    }}
                  >
                    {t('whatsapp.purposeAbsence')}
                  </Button>
                  <Button onClick={() => void printSheet()} icon={<Printer size={18} />}>{t('attendance.printSheet')}</Button>
                  <Button size="lg" variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()} icon={<Save size={20} />}>
                    {t('attendance.saveAttendance')}
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {counts.map((c) => (
                  <StatusPill
                    key={c.value}
                    tone={c.value === 'present' ? 'green' : c.value === 'absent' ? 'red' : c.value === 'late' ? 'amber' : 'blue'}
                    icon={c.icon}
                  >
                    {t(c.labelKey)}: {c.count}
                  </StatusPill>
                ))}
              </div>
            </Card>

            <Card padded={false}>
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.student_id}
                    className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <Avatar name={lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name} photoPath={row.photo_path} size={44} />
                    <span className="min-w-[8rem] flex-1">
                      <span className="block truncate font-semibold">
                        {lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name}
                      </span>
                      <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{row.student_code}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {STUDENT_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setMark(row.student_id, s.value)}
                          aria-pressed={marks[row.student_id] === s.value}
                          className={[
                            'inline-flex min-h-touch items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-colors focus-ring',
                            marks[row.student_id] === s.value ? s.on : 'surface hover:border-brand-300',
                          ].join(' ')}
                        >
                          {s.icon}
                          {t(s.labelKey)}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="h-fit">
            <CardTitle>{t('attendance.calendarView')}</CardTitle>
            <MonthSummary month={month} onMonthChange={setMonth} data={monthData ?? []} />
          </Card>
        </div>
      )}

      <WhatsAppQueue recipients={waRecipients} purpose="absence" open={waOpen} onClose={() => setWaOpen(false)} />
    </div>
  )
}

/**
 * A whole class's month at a glance. The colour reflects how much of the class
 * was in that day, not the worst single student — otherwise one absence turns
 * the entire month red and the view tells the reader nothing.
 */
function MonthSummary({
  month, onMonthChange, data,
}: {
  month: string
  onMonthChange: (m: string) => void
  data: { date: string; present: number; absent: number; late: number; excused: number }[]
}) {
  const { t } = useTranslation()
  const days = data.map((d) => {
    const total = d.present + d.absent + d.late + d.excused
    const here = d.present + d.late
    const percent = total ? (here / total) * 100 : 0
    const status: AttendanceStatus = percent >= 95 ? 'present' : percent >= 85 ? 'late' : 'absent'
    return { date: d.date, status }
  })
  return (
    <>
      <p className="mb-2 text-sm text-ink-500 dark:text-ink-300">{t('attendance.monthLegendClass')}</p>
      <AttendanceCalendar month={month} onMonthChange={onMonthChange} days={days} />
    </>
  )
}

function StaffAttendance() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)

  const [date, setDate] = useState(todayIso())
  const [marks, setMarks] = useState<Record<number, StaffAttendanceStatus>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: rows, loading, error, reload } = useAsync(() => api.attendance.staffDay(date), [date])

  useUnsavedGuard(dirty)

  useEffect(() => {
    if (!rows) return
    setMarks(Object.fromEntries(rows.filter((r) => r.status).map((r) => [r.staff_id, r.status!])))
    setDirty(false)
  }, [rows])

  const save = async () => {
    const entries = Object.entries(marks).map(([id, status]) => ({ staff_id: Number(id), status }))
    if (!entries.length) return
    setSaving(true)
    try {
      await api.attendance.saveStaff(date, entries)
      setDirty(false)
      reload()
      toast(t('attendance.savedFor', { date: formatDate(date, lang, { calendar, numerals }) }), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !rows) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <FilterBar>
        <div className="min-w-[11rem]">
          <TextInput label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button onClick={() => setDate(todayIso())}>{t('common.today')}</Button>
        <div className="flex-1" />
        <Button
          size="lg"
          variant="success"
          onClick={() => {
            setMarks(Object.fromEntries((rows ?? []).map((r) => [r.staff_id, 'present' as StaffAttendanceStatus])))
            setDirty(true)
          }}
          icon={<Check size={20} />}
        >
          {t('attendance.markAllPresent')}
        </Button>
        <Button size="lg" variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()} icon={<Save size={20} />}>
          {t('attendance.saveAttendance')}
        </Button>
      </FilterBar>

      <Card padded={false}>
        {!rows?.length ? (
          <EmptyState icon={<Users size={44} />} title={t('staff.emptyTitle')} body={t('staff.emptyBody')} />
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.staff_id} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <Avatar name={lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name} size={44} />
                <span className="min-w-[8rem] flex-1">
                  <span className="block truncate font-semibold">{lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name}</span>
                  <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{t(`roles.${row.role}`, { defaultValue: row.role })}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {STAFF_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => { setMarks((m) => ({ ...m, [row.staff_id]: s.value })); setDirty(true) }}
                      aria-pressed={marks[row.staff_id] === s.value}
                      className={[
                        'inline-flex min-h-touch items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-colors focus-ring',
                        marks[row.staff_id] === s.value ? s.on : 'surface hover:border-brand-300',
                      ].join(' ')}
                    >
                      {s.icon}
                      {t(s.labelKey)}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
