import { useState } from 'react'
import { Layers, Plus, Pencil, Trash2, BookOpen, Users, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { Klass, Section, Subject, TeacherAssignment } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { sectionTitle } from '@/features/students/StudentWizard'
import { localName } from '@/lib/format'

export function AcademicsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'classes' | 'sections' | 'subjects' | 'teachers'>('classes')

  return (
    <div>
      <PageHeader title={t('classes.title')} />
      <Tabs
        tabs={[
          { id: 'classes' as const, label: t('classes.classesTab'), icon: <Layers size={18} /> },
          { id: 'sections' as const, label: t('classes.sectionsTab'), icon: <Users size={18} /> },
          { id: 'subjects' as const, label: t('classes.subjectsTab'), icon: <BookOpen size={18} /> },
          { id: 'teachers' as const, label: t('classes.teachersTab'), icon: <GraduationCap size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'classes' && <ClassesTab />}
      {tab === 'sections' && <SectionsTab />}
      {tab === 'subjects' && <SubjectsTab />}
      {tab === 'teachers' && <TeachersTab />}
    </div>
  )
}

function ClassesTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [editing, setEditing] = useState<Klass | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Klass | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.classes.list(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('classes.addClass')}</Button>
      </div>
      <Card padded={false}>
        {!data?.length ? (
          <EmptyState
            icon={<Layers size={44} />}
            title={t('classes.emptyClasses')}
            body={t('classes.emptyClassesBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('classes.addClass')}</Button>}
          />
        ) : (
          <ul>
            {data.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block text-lg font-bold">{localName(k as unknown as Record<string, unknown>, lang)}</span>
                  {k.name_ar && lang !== 'ar' && <span className="block text-sm text-ink-500 dark:text-ink-300" dir="rtl">{k.name_ar}</span>}
                </span>
                <StatusPill tone="blue">{t('classes.sectionsInClass', { count: k.section_count ?? 0 })}</StatusPill>
                <StatusPill tone="green">{t('classes.studentsInClass', { count: k.student_count ?? 0 })}</StatusPill>
                <Button size="sm" onClick={() => setEditing(k)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(k)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <SimpleEditor
          title={editing ? t('common.edit') : t('classes.addClass')}
          initial={{ name: editing?.name ?? '', name_ar: editing?.name_ar ?? '', extra: String(editing?.grade_level ?? '') }}
          extraLabel={t('classes.gradeLevel')}
          extraHint={t('classes.gradeLevelHelp')}
          extraType="number"
          onClose={() => { setAdding(false); setEditing(null) }}
          onSave={async (v) => {
            await api.classes.save({ ...(editing ? { id: editing.id } : {}), name: v.name, name_ar: v.name_ar || null, grade_level: Number(v.extra) || 0 })
            setAdding(false); setEditing(null); reload(); touch()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.classes.remove(deleting.id)
            reload(); touch()
            toast(t('common.delete'), 'success')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function SectionsTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [editing, setEditing] = useState<Section | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Section | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.sections.list(), [])
  const { data: classes } = useAsync(() => api.classes.list(), [])
  const { data: staff } = useAsync(() => api.staff.list({ role: 'teacher' }), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" disabled={!classes?.length} onClick={() => setAdding(true)} icon={<Plus size={20} />}>
          {t('classes.addSection')}
        </Button>
      </div>
      <Card padded={false}>
        {!data?.length ? (
          <EmptyState icon={<Users size={44} />} title={t('classes.emptySections')} body={t('classes.emptySectionsBody')} />
        ) : (
          <ul>
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block text-lg font-bold">{sectionTitle(s, lang)}</span>
                  {s.homeroom_name && (
                    <span className="block text-sm text-ink-500 dark:text-ink-300">{t('classes.homeroomTeacher')}: {s.homeroom_name}</span>
                  )}
                </span>
                <StatusPill tone="green">{t('classes.studentsInClass', { count: s.student_count ?? 0 })}</StatusPill>
                <Button size="sm" onClick={() => setEditing(s)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <SectionEditor
          section={editing}
          classes={classes ?? []}
          staff={staff ?? []}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting ? sectionTitle(deleting, lang) : '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.sections.remove(deleting.id)
            reload(); touch()
            toast(t('common.delete'), 'success')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function SectionEditor({
  section, classes, staff, onClose, onSaved,
}: {
  section: Section | null
  classes: Klass[]
  staff: import('@shared/types').Staff[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const [classId, setClassId] = useState(section ? String(section.class_id) : String(classes[0]?.id ?? ''))
  const [name, setName] = useState(section?.name ?? '')
  const [nameAr, setNameAr] = useState(section?.name_ar ?? '')
  const [homeroom, setHomeroom] = useState(section?.homeroom_staff_id ? String(section.homeroom_staff_id) : '')
  const [capacity, setCapacity] = useState(section?.capacity ? String(section.capacity) : '')

  return (
    <Modal
      open
      onClose={onClose}
      title={section ? t('common.edit') : t('classes.addSection')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!name.trim() || !classId}
            onClick={async () => {
              try {
                await api.sections.save({
                  ...(section ? { id: section.id } : {}),
                  class_id: Number(classId),
                  name,
                  name_ar: nameAr || null,
                  homeroom_staff_id: homeroom ? Number(homeroom) : null,
                  capacity: capacity ? Number(capacity) : null,
                })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('common.class')}
          required
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={classes.map((c) => ({ value: c.id, label: localName(c as unknown as Record<string, unknown>, lang) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.nameEnglish')} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <TextInput label={t('common.nameArabic')} dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <Select
          label={t('classes.homeroomTeacher')}
          value={homeroom}
          onChange={(e) => setHomeroom(e.target.value)}
          placeholder={t('common.none')}
          options={staff.map((s) => ({ value: s.id, label: localName(s as unknown as Record<string, unknown>, lang, 'full_name') }))}
        />
        <TextInput label={t('classes.capacity')} type="number" dir="ltr" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </div>
    </Modal>
  )
}

function SubjectsTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.subjects.list(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('classes.addSubject')}</Button>
      </div>
      <Card padded={false}>
        {!data?.length ? (
          <EmptyState
            icon={<BookOpen size={44} />}
            title={t('classes.emptySubjects')}
            body={t('classes.emptySubjectsBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('classes.addSubject')}</Button>}
          />
        ) : (
          <ul>
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block text-lg font-bold">{localName(s as unknown as Record<string, unknown>, lang)}</span>
                  {s.name_ar && lang !== 'ar' && <span className="block text-sm text-ink-500 dark:text-ink-300" dir="rtl">{s.name_ar}</span>}
                </span>
                {s.code && <StatusPill tone="grey">{s.code}</StatusPill>}
                <Button size="sm" onClick={() => setEditing(s)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <SimpleEditor
          title={editing ? t('common.edit') : t('classes.addSubject')}
          initial={{ name: editing?.name ?? '', name_ar: editing?.name_ar ?? '', extra: editing?.code ?? '' }}
          extraLabel={t('classes.subjectCode')}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSave={async (v) => {
            await api.subjects.save({ ...(editing ? { id: editing.id } : {}), name: v.name, name_ar: v.name_ar || null, code: v.extra || null })
            setAdding(false); setEditing(null); reload(); touch()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.subjects.remove(deleting.id)
          setDeleting(null); reload(); touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function TeachersTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const [sectionId, setSectionId] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<TeacherAssignment | null>(null)

  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: staff } = useAsync(() => api.staff.list({ role: 'teacher' }), [])
  const { data: subjects } = useAsync(() => api.subjects.list(), [])
  const { data, loading, reload } = useAsync(
    () => api.assignments.list(sectionId ? { section_id: Number(sectionId) } : undefined),
    [sectionId]
  )

  if (loading && !data) return <Loading />

  if (!staff?.length) {
    return <Card><EmptyState icon={<GraduationCap size={44} />} title={t('classes.noTeachersYet')} /></Card>
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem]">
          <Select
            label={t('common.class')}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder={t('common.all')}
            options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
          />
        </div>
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('classes.assignTeacher')}</Button>
      </div>

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState icon={<GraduationCap size={44} />} title={t('staff.noAssignments')} />
        ) : (
          <ul>
            {data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-bold">{lang === 'ar' && a.subject_name_ar ? a.subject_name_ar : a.subject_name}</span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">{a.section_label}</span>
                </span>
                <StatusPill tone="blue">{a.staff_name}</StatusPill>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(a)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {adding && (
        <AssignmentEditor
          sections={sections ?? []}
          staff={staff}
          subjects={subjects ?? []}
          defaultSectionId={sectionId}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); reload() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.areYouSure')}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.assignments.remove(deleting.id)
          setDeleting(null); reload()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function AssignmentEditor({
  sections, staff, subjects, defaultSectionId, onClose, onSaved,
}: {
  sections: Section[]
  staff: import('@shared/types').Staff[]
  subjects: Subject[]
  defaultSectionId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const [sectionId, setSectionId] = useState(defaultSectionId || String(sections[0]?.id ?? ''))
  const [subjectId, setSubjectId] = useState('')
  const [staffId, setStaffId] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title={t('classes.assignTeacher')}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!sectionId || !subjectId || !staffId}
            onClick={async () => {
              try {
                await api.assignments.save({ section_id: Number(sectionId), subject_id: Number(subjectId), staff_id: Number(staffId) })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('common.class')}
          required
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          options={sections.map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
        />
        <Select
          label={t('common.subject')}
          required
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder={t('common.select')}
          options={subjects.map((s) => ({ value: s.id, label: localName(s as unknown as Record<string, unknown>, lang) }))}
        />
        <Select
          label={t('common.teacher')}
          required
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder={t('common.select')}
          options={staff.map((s) => ({ value: s.id, label: localName(s as unknown as Record<string, unknown>, lang, 'full_name') }))}
        />
      </div>
    </Modal>
  )
}

/** Shared name/name_ar/extra editor used by classes and subjects. */
function SimpleEditor({
  title, initial, extraLabel, extraHint, extraType, onClose, onSave,
}: {
  title: string
  initial: { name: string; name_ar: string; extra: string }
  extraLabel?: string
  extraHint?: string
  extraType?: string
  onClose: () => void
  onSave: (values: { name: string; name_ar: string; extra: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            loading={busy}
            disabled={!values.name.trim()}
            onClick={async () => {
              setBusy(true)
              try {
                await onSave(values)
              } catch (e) {
                toast((e as Error).message, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label={t('common.nameEnglish')} required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} autoFocus />
        <TextInput label={t('common.nameArabic')} dir="rtl" value={values.name_ar} onChange={(e) => setValues((v) => ({ ...v, name_ar: e.target.value }))} />
        {extraLabel && (
          <TextInput
            label={extraLabel}
            hint={extraHint}
            type={extraType}
            dir={extraType === 'number' ? 'ltr' : undefined}
            value={values.extra}
            onChange={(e) => setValues((v) => ({ ...v, extra: e.target.value }))}
          />
        )}
      </div>
    </Modal>
  )
}
