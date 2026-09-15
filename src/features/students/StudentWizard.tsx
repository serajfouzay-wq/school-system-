import { useMemo, useState } from 'react'
import { CheckCircle2, Image as ImageIcon, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { Section, Student } from '@shared/types'
import { Button, ChoiceCard } from '@/components/ui/Button'
import { TextInput, TextArea, Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Wizard } from '@/components/ui/Wizard'
import type { WizardStep } from '@/components/ui/Wizard'
import { usePhoto } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { localName, todayIso, studentName, classLabel } from '@/lib/format'

/**
 * "Add a New Student" as four short steps. Only two fields are ever required
 * (name, and a guardian contact is encouraged but not enforced), because an
 * office clerk will not have a birth certificate in front of them.
 */
export function StudentWizard({
  open, onClose, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  editing?: Student | null
  onSaved?: (student: Student) => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const go = useApp((s) => s.go)

  const { data: sections } = useAsync(() => api.sections.list(), [open])
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Student | null>(null)

  const blank = useMemo(
    () => ({
      full_name: '',
      full_name_ar: '',
      dob: '',
      gender: '' as '' | 'male' | 'female',
      photo_path: null as string | null,
      section_id: null as number | null,
      guardian_name: '',
      guardian_phone: '',
      guardian_address: '',
      emergency_contact: '',
      enrollment_date: todayIso(),
      previous_school: '',
      medical_notes: '',
    }),
    []
  )

  const [form, setForm] = useState(() =>
    editing
      ? {
          ...blank,
          full_name: editing.full_name,
          full_name_ar: editing.full_name_ar ?? '',
          dob: editing.dob ?? '',
          gender: (editing.gender ?? '') as '' | 'male' | 'female',
          photo_path: editing.photo_path,
          section_id: editing.section_id,
          guardian_name: editing.guardian_name ?? '',
          guardian_phone: editing.guardian_phone ?? '',
          guardian_address: editing.guardian_address ?? '',
          emergency_contact: editing.emergency_contact ?? '',
          enrollment_date: editing.enrollment_date ?? todayIso(),
          previous_school: editing.previous_school ?? '',
          medical_notes: editing.medical_notes ?? '',
        }
      : blank
  )

  const photoSrc = usePhoto(form.photo_path)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const pickPhoto = async () => {
    const source = await api.files.pickImage()
    if (!source) return
    // A temporary code is fine: the photo is re-keyed on save.
    const code = editing?.student_code ?? `tmp-${Date.now()}`
    set('photo_path', await api.files.saveStudentPhoto(source, code))
  }

  const selectedSection = sections?.find((s) => s.id === form.section_id) ?? null

  const save = async () => {
    setBusy(true)
    try {
      const student = await api.students.save({
        ...(editing ? { id: editing.id } : {}),
        full_name: form.full_name,
        full_name_ar: form.full_name_ar || null,
        dob: form.dob || null,
        gender: form.gender || null,
        photo_path: form.photo_path,
        section_id: form.section_id,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        guardian_address: form.guardian_address || null,
        emergency_contact: form.emergency_contact || null,
        enrollment_date: form.enrollment_date || null,
        previous_school: form.previous_school || null,
        medical_notes: form.medical_notes || null,
        status: editing?.status ?? 'active',
      })
      touch()
      onSaved?.(student)
      if (editing) {
        toast(t('common.saved'), 'success')
        onClose()
      } else {
        setSaved(student)
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setForm(blank)
    setStep(0)
    setSaved(null)
  }

  const steps: WizardStep[] = [
    {
      title: t('students.wizardStep1'),
      subtitle: t('students.wizardStep1Help'),
      canContinue: form.full_name.trim().length > 0 || form.full_name_ar.trim().length > 0,
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('common.nameEnglish')}
              required
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              autoFocus
            />
            <TextInput
              label={t('common.nameArabic')}
              dir="rtl"
              value={form.full_name_ar}
              onChange={(e) => set('full_name_ar', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('common.dateOfBirth')} type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
            <Field label={t('common.gender')}>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard selected={form.gender === 'male'} onClick={() => set('gender', form.gender === 'male' ? '' : 'male')} title={t('common.male')} />
                <ChoiceCard selected={form.gender === 'female'} onClick={() => set('gender', form.gender === 'female' ? '' : 'female')} title={t('common.female')} />
              </div>
            </Field>
          </div>
          <Field label={t('common.choosePhoto')}>
            <div className="flex items-center gap-4">
              <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--app-border)' }}>
                {photoSrc ? <img src={photoSrc} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={28} className="text-ink-400" />}
              </span>
              <Button onClick={() => void pickPhoto()} icon={<ImageIcon size={18} />}>
                {form.photo_path ? t('common.changePhoto') : t('common.choosePhoto')}
              </Button>
              {form.photo_path && <Button variant="ghost" onClick={() => set('photo_path', null)}>{t('common.removePhoto')}</Button>}
            </div>
          </Field>
        </div>
      ),
    },
    {
      title: t('students.wizardStep2'),
      subtitle: t('students.wizardStep2Help'),
      content: !sections?.length ? (
        <EmptyState
          icon={<Users size={40} />}
          title={t('students.noClassYet')}
          action={<Button variant="primary" onClick={() => { onClose(); go({ name: 'classes' }) }}>{t('nav.classes')}</Button>}
        />
      ) : (
        // Large tappable cards, not a dropdown (Section 6, step 3).
        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <ChoiceCard
              key={section.id}
              selected={form.section_id === section.id}
              onClick={() => set('section_id', section.id)}
              title={sectionTitle(section, lang)}
              subtitle={t('classes.studentsInClass', { count: section.student_count ?? 0 })}
            />
          ))}
        </div>
      ),
    },
    {
      title: t('students.wizardStep3'),
      subtitle: t('students.wizardStep3Help'),
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('students.guardianName')} value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} autoFocus />
            <TextInput label={t('students.guardianPhone')} type="tel" dir="ltr" value={form.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} />
          </div>
          <TextInput label={t('students.guardianAddress')} value={form.guardian_address} onChange={(e) => set('guardian_address', e.target.value)} />
          <TextInput label={t('students.emergencyContact')} value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('students.enrollmentDate')} type="date" value={form.enrollment_date} onChange={(e) => set('enrollment_date', e.target.value)} />
            <TextInput label={t('students.previousSchool')} value={form.previous_school} onChange={(e) => set('previous_school', e.target.value)} />
          </div>
          <TextArea label={t('students.medicalNotes')} hint={t('students.medicalHelp')} value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} />
        </div>
      ),
    },
    {
      title: t('students.wizardStep4'),
      content: (
        <div className="space-y-3">
          <div className="surface flex items-center gap-4 rounded-2xl border p-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              {photoSrc ? <img src={photoSrc} alt="" className="h-full w-full object-cover" /> : (form.full_name || form.full_name_ar || '?').slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{lang === 'ar' && form.full_name_ar ? form.full_name_ar : form.full_name || form.full_name_ar}</p>
              <p className="truncate text-ink-500 dark:text-ink-300">
                {selectedSection ? sectionTitle(selectedSection, lang) : t('common.none')}
              </p>
            </div>
          </div>
          <ReviewLine label={t('common.dateOfBirth')} value={form.dob || '—'} />
          <ReviewLine label={t('common.gender')} value={form.gender ? t(`common.${form.gender}`) : '—'} />
          <ReviewLine label={t('students.guardianName')} value={form.guardian_name || '—'} />
          <ReviewLine label={t('students.guardianPhone')} value={form.guardian_phone || '—'} />
          <ReviewLine label={t('students.enrollmentDate')} value={form.enrollment_date || '—'} />
          {form.medical_notes && <ReviewLine label={t('students.medicalNotes')} value={form.medical_notes} />}
        </div>
      ),
    },
  ]

  // Step 6 of the reference flow: a confirmation screen with exactly two ways on.
  if (saved) {
    return (
      <Modal open={open} onClose={() => { reset(); onClose() }} title={t('common.saved')} size="md">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 size={72} className="text-emerald-500" />
          <h3 className="text-2xl font-bold">{t('students.addedTitle', { name: studentName(saved, lang) })}</h3>
          <p className="text-ink-500 dark:text-ink-300">
            {t('students.addedBody', { class: classLabel(saved, lang) || t('common.none') })}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="primary" onClick={reset}>{t('common.add_another')}</Button>
            <Button size="lg" onClick={() => { reset(); onClose() }}>{t('students.goToList')}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('common.edit') : t('students.addStudent')}
      size="lg"
    >
      <div className="min-h-[26rem]">
        <Wizard
          steps={steps}
          current={step}
          onStepChange={setStep}
          onFinish={() => void save()}
          finishLabel={editing ? t('common.save') : t('common.save')}
          onCancel={onClose}
          busy={busy}
        />
      </div>
    </Modal>
  )
}

export function sectionTitle(section: Section, lang: 'en' | 'ar'): string {
  const cls = localName({ name: section.class_name, name_ar: section.class_name_ar }, lang)
  const sec = localName({ name: section.name, name_ar: section.name_ar }, lang)
  return `${cls} - ${sec}`
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
      <span className="text-sm font-semibold text-ink-500 dark:text-ink-300">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
