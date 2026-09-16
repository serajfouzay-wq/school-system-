import { useEffect, useState } from 'react'
import { CalendarDays, AlertTriangle, Printer, Users, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { TimetableEntry } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { TimetableGrid } from './TimetableGrid'
import type { Period } from './TimetableGrid'
import { sectionTitle } from '@/features/students/StudentWizard'
import { localName } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { gridReportHtml } from '@/print/templates'

export function TimetablePage() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print, school } = usePrinting()

  const [mode, setMode] = useState<'class' | 'teacher'>('class')
  const [sectionId, setSectionId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [editor, setEditor] = useState<{ entry?: TimetableEntry; day: number; period: Period } | null>(null)
  const [deleting, setDeleting] = useState<TimetableEntry | null>(null)

  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: staff } = useAsync(() => api.staff.list({ role: 'teacher' }), [])
  const { data: periods } = useAsync(() => api.timetable.periods(), [])

  useEffect(() => {
    if (mode === 'class' && sections?.length && !sectionId) setSectionId(String(sections[0].id))
    if (mode === 'teacher' && staff?.length && !staffId) setStaffId(String(staff[0].id))
  }, [mode, sections, staff, sectionId, staffId])

  const filter = mode === 'class'
    ? sectionId ? { section_id: Number(sectionId) } : null
    : staffId ? { staff_id: Number(staffId) } : null

  const { data: entries, loading, error, reload } = useAsync(
    () => (filter ? api.timetable.list(filter) : Promise.resolve([])),
    [mode, sectionId, staffId]
  )

  const move = async (entry: TimetableEntry, day: number, period: Period) => {
    try {
      const res = await api.timetable.save({
        id: entry.id,
        section_id: entry.section_id,
        subject_id: entry.subject_id,
        staff_id: entry.staff_id,
        day_of_week: day,
        start_time: period.start_time,
        end_time: period.end_time,
        room: entry.room,
      })
      touch()
      reload()
      if (res.conflicts.length) toast(res.conflicts[0].message, 'error')
      else toast(t('common.saved'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    const victim = deleting
    setDeleting(null)
    await api.timetable.remove(victim.id)
    touch()
    reload()
    toast(t('common.delete'), 'success', {
      label: t('common.undo'),
      run: async () => {
        const bin = await api.recycle.list()
        const entry = bin.find((b) => b.table_name === 'timetable_entries' && b.record_id === victim.id)
        if (entry) { await api.recycle.restore(entry.id); touch(); reload(); toast(t('common.undone'), 'info') }
      },
    })
  }

  const printGrid = async () => {
    if (!school || !entries?.length) return
    const days = [0, 1, 2, 3, 4]
    const label = mode === 'class'
      ? sections?.find((s) => s.id === Number(sectionId))
        ? sectionTitle(sections.find((s) => s.id === Number(sectionId))!, lang)
        : ''
      : localName(staff?.find((s) => s.id === Number(staffId)), lang, 'full_name')

    await print(
      gridReportHtml({
        school,
        logo: (await context()).logo,
        title: t('timetable.title'),
        meta: label,
        headerRow: [t('common.time'), ...days.map((d) => t(`days.${d}`))],
        bodyRows: (periods ?? []).map((p) => [
          `${p.start_time} - ${p.end_time}`,
          ...days.map((d) => {
            const e = entries.find((x) => x.day_of_week === d && x.start_time === p.start_time)
            if (!e) return ''
            const subject = lang === 'ar' && e.subject_name_ar ? e.subject_name_ar : e.subject_name
            return `${subject} — ${mode === 'class' ? e.staff_name ?? '' : e.section_label ?? ''}`
          }),
        ]),
        lang,
        t,
        landscape: true,
      })
    )
  }

  if (loading && !entries) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title={t('timetable.title')}
        actions={<Button onClick={() => void printGrid()} icon={<Printer size={18} />}>{t('timetable.printTimetable')}</Button>}
      />

      <ModuleTour
        moduleKey="timetable"
        tips={[
          { title: t('timetable.addLesson'), body: t('timetable.emptyBody') },
          { title: t('timetable.dragHint'), body: t('timetable.conflictTitle') },
        ]}
      />

      <Tabs
        tabs={[
          { id: 'class' as const, label: t('timetable.byClass'), icon: <Users size={18} /> },
          { id: 'teacher' as const, label: t('timetable.byTeacher'), icon: <GraduationCap size={18} /> },
        ]}
        active={mode}
        onChange={setMode}
      />

      <FilterBar>
        {mode === 'class' ? (
          <div className="min-w-[16rem] flex-1">
            <Select
              label={t('timetable.chooseClass')}
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder={t('common.select')}
              options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
            />
          </div>
        ) : (
          <div className="min-w-[16rem] flex-1">
            <Select
              label={t('common.teacher')}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder={t('common.select')}
              options={(staff ?? []).map((s) => ({ value: s.id, label: localName(s, lang, 'full_name') }))}
            />
          </div>
        )}
      </FilterBar>

      <Card>
        {!filter ? (
          <EmptyState icon={<CalendarDays size={44} />} title={t('timetable.chooseClass')} />
        ) : !entries?.length && mode === 'teacher' ? (
          <EmptyState icon={<CalendarDays size={44} />} title={t('timetable.emptyTitle')} />
        ) : (
          <>
            {mode === 'class' && (
              <p className="mb-3 text-sm text-ink-500 dark:text-ink-300">{t('timetable.dragHint')}</p>
            )}
            <TimetableGrid
              entries={entries ?? []}
              periods={periods ?? []}
              readOnly={mode === 'teacher'}
              showSection={mode === 'teacher'}
              onCellClick={(day, period) => setEditor({ day, period })}
              onEntryClick={(entry) => setEditor({ entry, day: entry.day_of_week, period: { start_time: entry.start_time, end_time: entry.end_time } })}
              onMove={(entry, day, period) => void move(entry, day, period)}
              onDelete={setDeleting}
            />
          </>
        )}
      </Card>

      {editor && sectionId && (
        <LessonEditor
          sectionId={Number(sectionId)}
          day={editor.day}
          period={editor.period}
          entry={editor.entry}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); touch(); reload() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.subject_name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

/** Conflicts warn rather than block — the user stays in control. */
function LessonEditor({
  sectionId, day, period, entry, onClose, onSaved,
}: {
  sectionId: number
  day: number
  period: Period
  entry?: TimetableEntry
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const { data: subjects } = useAsync(() => api.subjects.list(), [])
  const { data: staff } = useAsync(() => api.staff.list({ role: 'teacher' }), [])

  const [subjectId, setSubjectId] = useState(entry ? String(entry.subject_id) : '')
  const [staffId, setStaffId] = useState(entry?.staff_id ? String(entry.staff_id) : '')
  const [start, setStart] = useState(entry?.start_time ?? period.start_time)
  const [end, setEnd] = useState(entry?.end_time ?? period.end_time)
  const [room, setRoom] = useState(entry?.room ?? '')
  const [conflicts, setConflicts] = useState<{ kind: string; message: string }[]>([])
  const [busy, setBusy] = useState(false)

  const save = async (force = false) => {
    setBusy(true)
    try {
      const res = await api.timetable.save({
        ...(entry ? { id: entry.id } : {}),
        section_id: sectionId,
        subject_id: Number(subjectId),
        staff_id: staffId ? Number(staffId) : null,
        day_of_week: day,
        start_time: start,
        end_time: end,
        room: room || null,
      })
      if (res.conflicts.length && !force) {
        setConflicts(res.conflicts)
        setBusy(false)
        return
      }
      toast(t('common.saved'), 'success')
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? t('timetable.editLesson') : t('timetable.addLesson')}
      subtitle={`${t(`days.${day}`)} · ${period.start_time} – ${period.end_time}`}
      size="md"
      footer={
        conflicts.length ? (
          <>
            <Button size="lg" onClick={() => setConflicts([])}>{t('timetable.conflictFix')}</Button>
            <Button size="lg" variant="danger" onClick={() => void save(true)}>{t('timetable.conflictSaveAnyway')}</Button>
          </>
        ) : (
          <>
            <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
            <Button size="lg" variant="primary" loading={busy} disabled={!subjectId} onClick={() => void save()}>{t('common.save')}</Button>
          </>
        )
      }
    >
      {conflicts.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle size={20} className="text-amber-600" />{t('timetable.conflictTitle')}</p>
          <ul className="list-inside list-disc space-y-1">
            {conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
          </ul>
        </div>
      )}
      <div className="space-y-4">
        <Select
          label={t('common.subject')}
          required
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder={t('common.select')}
          options={(subjects ?? []).map((s) => ({ value: s.id, label: localName(s, lang) }))}
        />
        <Select
          label={t('common.teacher')}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder={t('common.none')}
          options={(staff ?? []).map((s) => ({ value: s.id, label: localName(s, lang, 'full_name') }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.startTime')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <TextInput label={t('common.endTime')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <TextInput label={t('common.room')} value={room} onChange={(e) => setRoom(e.target.value)} />
      </div>
    </Modal>
  )
}
