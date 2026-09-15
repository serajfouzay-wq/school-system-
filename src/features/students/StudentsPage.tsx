import { useState } from 'react'
import { Plus, Users, Upload, IdCard, FolderInput, Trash2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync, useDebounced } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { Student } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Field'
import { DataTable, columnsToExport } from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, ActionBar } from '@/components/ui/PageHeader'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { Avatar } from '@/components/ui/Avatar'
import { StudentWizard, sectionTitle } from './StudentWizard'
import { ImportWizard } from './ImportWizard'
import { formatDate, studentName, classLabel } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { idCardsHtml } from '@/print/templates'

export function StudentsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print, exportCsv, school } = usePrinting()

  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [status, setStatus] = useState('active')
  const [selected, setSelected] = useState<number[]>([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [moving, setMoving] = useState(false)

  const debounced = useDebounced(search, 250)
  const { data: classes } = useAsync(() => api.classes.list(), [])
  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: students, error, loading, reload } = useAsync(
    () => api.students.list({ search: debounced, class_id: classId ? Number(classId) : null, status: status || null }),
    [debounced, classId, status]
  )

  const columns: Column<Student>[] = [
    {
      key: 'name',
      header: t('common.name'),
      value: (s) => studentName(s, lang),
      sortable: true,
      render: (s) => (
        <span className="flex items-center gap-3">
          <Avatar name={studentName(s, lang)} photoPath={s.photo_path} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{studentName(s, lang)}</span>
            <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{s.student_code}</span>
          </span>
        </span>
      ),
    },
    { key: 'class', header: t('common.class'), value: (s) => classLabel(s, lang), sortable: true },
    { key: 'guardian', header: t('students.guardian'), value: (s) => s.guardian_name ?? '', sortable: true },
    {
      key: 'phone',
      header: t('common.phone'),
      value: (s) => s.guardian_phone ?? '',
      render: (s) => <span dir="ltr">{s.guardian_phone ?? '—'}</span>,
    },
    { key: 'dob', header: t('common.dateOfBirth'), value: (s) => s.dob ?? '', render: (s) => formatDate(s.dob, lang, { calendar, numerals }) },
    {
      key: 'status',
      header: t('common.status'),
      value: (s) => s.status,
      render: (s) => (
        <StatusPill tone={s.status === 'active' ? 'green' : s.status === 'graduated' ? 'blue' : 'grey'}>
          {t(`students.status${s.status.charAt(0).toUpperCase()}${s.status.slice(1)}`)}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      render: (s) => (
        <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => { setEditing(s); setWizardOpen(true) }} icon={<Pencil size={16} />}>
            {t('common.edit')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} icon={<Trash2 size={16} className="text-rose-600" />}>
            <span className="sr-only">{t('common.delete')}</span>
          </Button>
        </span>
      ),
    },
  ]

  const doDelete = async () => {
    if (!deleting) return
    const victim = deleting
    setDeleting(null)
    try {
      await api.students.remove(victim.id)
      touch()
      reload()
      // Design rule 8: an Undo offer follows every change.
      toast(`${studentName(victim, lang)} — ${t('common.delete')}`, 'success', {
        label: t('common.undo'),
        run: async () => {
          const bin = await api.recycle.list()
          const entry = bin.find((b) => b.table_name === 'students' && b.record_id === victim.id)
          if (entry) {
            await api.recycle.restore(entry.id)
            touch()
            reload()
            toast(t('common.undone'), 'info')
          }
        },
      })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const printIdCards = async () => {
    const targets = (students ?? []).filter((s) => selected.includes(s.id))
    const list = targets.length ? targets : students ?? []
    if (!list.length || !school) return
    const withPhotos = await Promise.all(
      list.map(async (s) => ({ ...s, photoDataUrl: s.photo_path ? await api.files.readImage(s.photo_path) : null }))
    )
    await print(idCardsHtml(withPhotos, school, await context()))
  }

  const doExport = () => {
    const payload = columnsToExport(columns, students ?? [], (c) => String(c.header))
    void exportCsv('students.csv', payload.columns, payload.rows)
  }

  if (loading && !students) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const hasAnyStudents = (students?.length ?? 0) > 0 || !!debounced || !!classId

  return (
    <div>
      <PageHeader
        title={t('students.title')}
        subtitle={students ? t('common.showing', { count: students.length }) : undefined}
        actions={
          <ActionBar>
            <Button onClick={() => setImportOpen(true)} icon={<Upload size={18} />}>{t('students.bulkImport')}</Button>
            <Button onClick={doExport} icon={<FolderInput size={18} />}>{t('common.exportCsv')}</Button>
            <Button onClick={() => void printIdCards()} icon={<IdCard size={18} />}>
              {selected.length ? t('students.printIdCards') : t('students.printIdCards')}
            </Button>
            <Button size="lg" variant="primary" onClick={() => { setEditing(null); setWizardOpen(true) }} icon={<Plus size={20} />}>
              {t('students.addStudent')}
            </Button>
          </ActionBar>
        }
      />

      <ModuleTour
        moduleKey="students"
        tips={[
          { title: t('students.addStudent'), body: t('students.wizardStep1Help') },
          { title: t('common.search'), body: t('common.searchPlaceholder') },
          { title: t('students.printIdCards'), body: t('idcard.ifFound') },
        ]}
      />

      {hasAnyStudents && (
        <FilterBar>
          <div className="min-w-[14rem] flex-1">
            <TextInput
              label={t('common.search')}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
            />
          </div>
          <div className="min-w-[10rem]">
            <Select
              label={t('common.class')}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder={t('common.all')}
              options={(classes ?? []).map((c) => ({ value: c.id, label: lang === 'ar' && c.name_ar ? c.name_ar : c.name }))}
            />
          </div>
          <div className="min-w-[10rem]">
            <Select
              label={t('common.status')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder={t('common.all')}
              options={[
                { value: 'active', label: t('students.statusActive') },
                { value: 'inactive', label: t('students.statusInactive') },
                { value: 'graduated', label: t('students.statusGraduated') },
                { value: 'transferred', label: t('students.statusTransferred') },
              ]}
            />
          </div>
        </FilterBar>
      )}

      {selected.length > 0 && (
        <Card className="mb-4 border-2 border-brand-300 bg-brand-50 dark:bg-brand-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">{t('common.selected', { count: selected.length })}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setMoving(true)} icon={<Users size={18} />}>{t('students.moveToSection')}</Button>
              <Button onClick={() => void printIdCards()} icon={<IdCard size={18} />}>{t('students.printIdCards')}</Button>
              <Button variant="ghost" onClick={() => setSelected([])}>{t('common.clear')}</Button>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={students ?? []}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(s) => go({ name: 'studentProfile', id: s.id })}
          emptyState={
            <EmptyState
              icon={<Users size={44} />}
              title={debounced ? t('common.noResults') : t('students.emptyTitle')}
              body={debounced ? undefined : t('students.emptyBody')}
              action={
                !debounced && (
                  <Button size="lg" variant="primary" onClick={() => { setEditing(null); setWizardOpen(true) }} icon={<Plus size={20} />}>
                    {t('students.addFirst')}
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {wizardOpen && (
        <StudentWizard
          open={wizardOpen}
          editing={editing}
          onClose={() => { setWizardOpen(false); setEditing(null); reload() }}
          onSaved={() => reload()}
        />
      )}

      {importOpen && <ImportWizard open={importOpen} onClose={() => { setImportOpen(false); reload() }} />}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting ? studentName(deleting, lang) : '' })}
        body={t('common.deleteExplain')}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />

      <MoveDialog
        open={moving}
        count={selected.length}
        sections={sections ?? []}
        onClose={() => setMoving(false)}
        onMove={async (sectionId) => {
          await api.students.move(selected, sectionId)
          setSelected([])
          setMoving(false)
          touch()
          reload()
          toast(t('common.saved'), 'success')
        }}
      />
    </div>
  )
}

function MoveDialog({
  open, count, sections, onClose, onMove,
}: {
  open: boolean
  count: number
  sections: import('@shared/types').Section[]
  onClose: () => void
  onMove: (sectionId: number) => Promise<void>
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const [target, setTarget] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('students.moveToSection')}
      subtitle={t('common.selected', { count })}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" disabled={!target} onClick={() => void onMove(Number(target))}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Select
        label={t('common.class')}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder={t('common.select')}
        options={sections.map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
      />
    </Modal>
  )
}
