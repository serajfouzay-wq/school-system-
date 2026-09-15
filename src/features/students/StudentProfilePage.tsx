import { useState } from 'react'
import { Pencil, Phone, MapPin, HeartPulse, StickyNote, IdCard, FileText, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType, useCurrency } from '@/store/app'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle, StatCard } from '@/components/ui/Card'
import { TextArea } from '@/components/ui/Field'
import { Loading, ErrorState, StatusPill, EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { StudentWizard } from './StudentWizard'
import { AttendanceCalendar } from '@/features/attendance/AttendanceCalendar'
import { formatDate, formatMoney, formatNumber, studentName, classLabel, monthIso } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { idCardsHtml } from '@/print/templates'

/** One screen with everything about a student: photo, class, attendance,
 *  grades, fee balance and guardian contacts. */
export function StudentProfilePage({ id }: { id: number }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print, school } = usePrinting()

  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [deletingNote, setDeletingNote] = useState<number | null>(null)
  const [month, setMonth] = useState(monthIso())

  const { data, error, loading, reload } = useAsync(() => api.students.profile(id), [id])
  const { data: attendanceMonth } = useAsync(() => api.attendance.studentMonth(id, month), [id, month])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { student, attendance, fees, notes, documents } = data
  const name = studentName(student, lang)

  const addNote = async () => {
    if (!note.trim()) return
    try {
      await api.students.addNote(id, note)
      setNote('')
      reload()
      toast(t('common.saved'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const addDocument = async () => {
    const path = await api.files.pickAny()
    if (!path) return
    try {
      await api.students.addDocument(id, path.split(/[\\/]/).pop() ?? 'Document', path)
      reload()
      toast(t('common.saved'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const printCard = async () => {
    if (!school) return
    const photoDataUrl = student.photo_path ? await api.files.readImage(student.photo_path) : null
    await print(idCardsHtml([{ ...student, photoDataUrl }], school, await context()))
  }

  const trend = data.gradeTrend.map((g) => ({
    label: lang === 'ar' && g.term_ar ? g.term_ar : g.term,
    average: g.average,
  }))

  return (
    <div>
      <PageHeader
        title={name}
        subtitle={`${student.student_code} · ${classLabel(student, lang) || t('common.none')}`}
        actions={
          <>
            <Button onClick={() => void printCard()} icon={<IdCard size={18} />}>{t('students.printIdCard')}</Button>
            <Button variant="primary" onClick={() => setEditing(true)} icon={<Pencil size={18} />}>{t('common.edit')}</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={name} photoPath={student.photo_path} size={120} />
            <div>
              <h2 className="text-xl font-bold">{name}</h2>
              {student.full_name_ar && lang !== 'ar' && <p className="text-ink-500 dark:text-ink-300" dir="rtl">{student.full_name_ar}</p>}
              <p className="mt-1 text-ink-500 dark:text-ink-300">{student.student_code}</p>
            </div>
            <StatusPill tone={student.status === 'active' ? 'green' : 'grey'}>
              {t(`students.status${student.status.charAt(0).toUpperCase()}${student.status.slice(1)}`)}
            </StatusPill>
          </div>

          <dl className="mt-5 space-y-3 border-t pt-5" style={{ borderColor: 'var(--app-border)' }}>
            <InfoRow label={t('common.class')} value={classLabel(student, lang) || '—'} />
            <InfoRow label={t('common.dateOfBirth')} value={formatDate(student.dob, lang, { calendar, numerals })} />
            <InfoRow label={t('common.gender')} value={student.gender ? t(`common.${student.gender}`) : '—'} />
            <InfoRow label={t('students.enrollmentDate')} value={formatDate(student.enrollment_date, lang, { calendar, numerals })} />
            {student.previous_school && <InfoRow label={t('students.previousSchool')} value={student.previous_school} />}
          </dl>

          <div className="mt-5 space-y-3 border-t pt-5" style={{ borderColor: 'var(--app-border)' }}>
            <p className="font-bold">{t('students.guardian')}</p>
            <InfoRow label={t('common.name')} value={student.guardian_name ?? '—'} />
            <InfoRow
              label={t('common.phone')}
              value={student.guardian_phone ? <span dir="ltr" className="inline-flex items-center gap-1.5"><Phone size={15} />{student.guardian_phone}</span> : '—'}
            />
            {student.guardian_address && (
              <InfoRow label={t('common.address')} value={<span className="inline-flex items-center gap-1.5"><MapPin size={15} />{student.guardian_address}</span>} />
            )}
            {student.emergency_contact && <InfoRow label={t('students.emergencyContact')} value={student.emergency_contact} />}
          </div>

          {student.medical_notes && (
            <div className="mt-5 rounded-xl border-2 border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950">
              <p className="mb-1 flex items-center gap-2 font-bold text-rose-800 dark:text-rose-200">
                <HeartPulse size={18} />
                {t('students.medicalNotes')}
              </p>
              <p className="text-sm">{student.medical_notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={t('students.attendanceRate')}
              value={`${formatNumber(attendance.percent, lang, numerals)}%`}
              hint={t('attendance.summaryLine', { present: attendance.present, absent: attendance.absent, late: attendance.late })}
              tone={attendance.percent >= 90 ? 'emerald' : attendance.percent >= 75 ? 'amber' : 'rose'}
            />
            <StatCard
              label={t('students.gradesTrend')}
              value={trend.length ? `${formatNumber(trend[trend.length - 1].average, lang, numerals)}%` : '—'}
              hint={trend.length ? trend[trend.length - 1].label : t('grades.noGradesYet')}
              tone="brand"
            />
            <StatCard
              label={t('students.feeBalance')}
              value={formatMoney(fees.balance, currency, lang, numerals)}
              hint={`${t('fees.paid')}: ${formatMoney(fees.paid, currency, lang, numerals)}`}
              tone={fees.balance > 0 ? 'rose' : 'emerald'}
            />
          </div>

          <Card>
            <CardTitle>{t('students.gradesTrend')}</CardTitle>
            {trend.length ? (
              <div style={{ height: 200 }} dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                    <Tooltip contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12 }} />
                    <Line type="monotone" dataKey="average" stroke="#1f5ceb" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-ink-500 dark:text-ink-300">{t('grades.noGradesYet')}</p>
            )}
          </Card>

          <Card>
            <CardTitle>{t('attendance.calendarView')}</CardTitle>
            <AttendanceCalendar
              month={month}
              onMonthChange={setMonth}
              days={(attendanceMonth ?? []).map((d) => ({ date: d.date, status: d.status }))}
            />
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t('students.internalNotes')}</CardTitle>
          <div className="mb-4 space-y-2">
            <TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('students.notePlaceholder')}
              rows={2}
            />
            <Button variant="primary" disabled={!note.trim()} onClick={() => void addNote()} icon={<Plus size={18} />}>
              {t('students.addNote')}
            </Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState icon={<StickyNote size={36} />} title={t('common.nothingHereYet')} />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="min-w-0 flex-1">
                    <span className="block">{n.body}</span>
                    <span className="mt-1 block text-xs text-ink-400">
                      {formatDate(n.created_at.slice(0, 10), lang, { calendar, numerals })}
                      {n.author_name ? ` · ${n.author_name}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeletingNote(n.id)}
                    aria-label={t('common.delete')}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 focus-ring dark:hover:bg-rose-950"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Button onClick={() => void addDocument()} icon={<Plus size={18} />}>{t('students.addDocument')}</Button>}>
            {t('students.documents')}
          </CardTitle>
          {documents.length === 0 ? (
            <EmptyState icon={<FileText size={36} />} title={t('common.nothingHereYet')} />
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                  <FileText size={20} className="shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                  <Button size="sm" onClick={() => void api.files.showItem(doc.file_path)}>{t('common.open')}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editing && (
        <StudentWizard
          open={editing}
          editing={student}
          onClose={() => { setEditing(false); reload() }}
          onSaved={() => { touch(); reload() }}
        />
      )}

      <ConfirmDialog
        open={deletingNote !== null}
        title={t('common.areYouSure')}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (deletingNote === null) return
          await api.students.removeNote(deletingNote)
          setDeletingNote(null)
          reload()
        }}
        onCancel={() => setDeletingNote(null)}
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="text-end font-semibold">{value}</dd>
    </div>
  )
}
