import { useState } from 'react'
import { Pencil, Phone, Mail, Plus, Trash2, CalendarDays, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType, useCurrency } from '@/store/app'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Loading, ErrorState, StatusPill, EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { StaffForm } from './StaffForm'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { sectionTitle } from '@/features/students/StudentWizard'
import { formatDate, formatMoney, localName } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { gridReportHtml } from '@/print/templates'

export function StaffProfilePage({ id }: { id: number }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const { context, print, school } = usePrinting()

  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const { data: staff, loading, error, reload } = useAsync(() => api.staff.get(id), [id])
  const { data: assignments, reload: reloadAssignments } = useAsync(() => api.assignments.list({ staff_id: id }), [id])
  const { data: lessons } = useAsync(() => api.timetable.list({ staff_id: id }), [id])
  const { data: periods } = useAsync(() => api.timetable.periods(), [])

  if (loading && !staff) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!staff) return null

  const name = localName(staff, lang, 'full_name')

  const printTimetable = async () => {
    if (!school || !lessons?.length) return
    const days = [0, 1, 2, 3, 4, 5, 6]
    const rows = (periods ?? []).map((p) => [
      `${p.start_time} - ${p.end_time}`,
      ...days.map((d) => {
        const lesson = lessons.find((l) => l.day_of_week === d && l.start_time === p.start_time)
        return lesson ? `${lang === 'ar' && lesson.subject_name_ar ? lesson.subject_name_ar : lesson.subject_name}\n${lesson.section_label ?? ''}` : ''
      }),
    ])
    await print(
      gridReportHtml({
        school,
        logo: (await context()).logo,
        title: t('timetable.title'),
        meta: name,
        headerRow: [t('common.time'), ...days.map((d) => t(`days.${d}`))],
        bodyRows: rows,
        lang,
        t,
        landscape: true,
      })
    )
  }

  return (
    <div>
      <PageHeader
        title={name}
        subtitle={`${staff.staff_code} · ${t(`roles.${staff.role}`, { defaultValue: staff.role })}`}
        actions={
          <>
            <Button onClick={() => void printTimetable()} icon={<CalendarDays size={18} />}>{t('staff.printTimetable')}</Button>
            <Button variant="primary" onClick={() => setEditing(true)} icon={<Pencil size={18} />}>{t('common.edit')}</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={name} photoPath={staff.photo_path} size={110} />
            <h2 className="text-xl font-bold">{name}</h2>
            <StatusPill tone={staff.status === 'active' ? 'green' : 'grey'}>
              {staff.status === 'active' ? t('staff.statusActive') : t('staff.statusInactive')}
            </StatusPill>
          </div>
          <dl className="mt-5 space-y-3 border-t pt-5" style={{ borderColor: 'var(--app-border)' }}>
            <Row label={t('staff.staffId')} value={staff.staff_code} />
            <Row label={t('staff.jobRole')} value={t(`roles.${staff.role}`, { defaultValue: staff.role })} />
            <Row label={t('common.phone')} value={staff.phone ? <span dir="ltr" className="inline-flex items-center gap-1.5"><Phone size={15} />{staff.phone}</span> : '—'} />
            <Row label={t('common.email')} value={staff.email ? <span dir="ltr" className="inline-flex items-center gap-1.5"><Mail size={15} />{staff.email}</span> : '—'} />
            <Row label={t('staff.hireDate')} value={formatDate(staff.hire_date, lang, { calendar, numerals })} />
            {staff.salary != null && <Row label={t('staff.salary')} value={formatMoney(staff.salary, currency, lang, numerals)} />}
            {staff.address && <Row label={t('common.address')} value={staff.address} />}
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardTitle action={<Button onClick={() => setAssigning(true)} icon={<Plus size={18} />}>{t('staff.addAssignment')}</Button>}>
              {t('staff.assignments')}
            </CardTitle>
            {!assignments?.length ? (
              <EmptyState icon={<BookOpen size={36} />} title={t('staff.noAssignments')} />
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                    <BookOpen size={20} className="shrink-0 text-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {lang === 'ar' && a.subject_name_ar ? a.subject_name_ar : a.subject_name}
                      </span>
                      <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{a.section_label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.assignments.remove(a.id)
                        reloadAssignments()
                        toast(t('common.saved'), 'success')
                      }}
                      aria-label={t('common.remove')}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 focus-ring dark:hover:bg-rose-950"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>{t('timetable.title')}</CardTitle>
            <TimetableGrid entries={lessons ?? []} periods={periods ?? []} readOnly showSection />
          </Card>
        </div>
      </div>

      {editing && <StaffForm open={editing} editing={staff} onClose={() => { setEditing(false); reload() }} />}

      {assigning && (
        <AssignDialog
          staffId={id}
          onClose={() => setAssigning(false)}
          onSaved={() => { setAssigning(false); reloadAssignments() }}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="text-end font-semibold">{value}</dd>
    </div>
  )
}

function AssignDialog({ staffId, onClose, onSaved }: { staffId: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: subjects } = useAsync(() => api.subjects.list(), [])
  const [sectionId, setSectionId] = useState('')
  const [subjectId, setSubjectId] = useState('')

  const save = async () => {
    try {
      await api.assignments.save({ staff_id: staffId, section_id: Number(sectionId), subject_id: Number(subjectId) })
      toast(t('common.saved'), 'success')
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('staff.addAssignment')}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" disabled={!sectionId || !subjectId} onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('common.class')}
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          placeholder={t('common.select')}
          options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
        />
        <Select
          label={t('common.subject')}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder={t('common.select')}
          options={(subjects ?? []).map((s) => ({ value: s.id, label: localName(s, lang) }))}
        />
      </div>
    </Modal>
  )
}
