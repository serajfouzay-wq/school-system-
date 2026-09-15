import { useState } from 'react'
import { GraduationCap, Image as ImageIcon, Plus, Trash2, Sparkles, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useApp, useLang } from '@/store/app'
import { Button, ChoiceCard } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextInput, Field, Select } from '@/components/ui/Field'
import { Wizard } from '@/components/ui/Wizard'
import type { WizardStep } from '@/components/ui/Wizard'
import { usePhoto } from '@/components/ui/Avatar'

interface NamedItem { name: string; name_ar: string }

const SUGGESTED_CLASSES: NamedItem[] = [
  { name: 'Grade 1', name_ar: 'الصف الأول' },
  { name: 'Grade 2', name_ar: 'الصف الثاني' },
  { name: 'Grade 3', name_ar: 'الصف الثالث' },
  { name: 'Grade 4', name_ar: 'الصف الرابع' },
  { name: 'Grade 5', name_ar: 'الصف الخامس' },
  { name: 'Grade 6', name_ar: 'الصف السادس' },
]

const SUGGESTED_SUBJECTS: NamedItem[] = [
  { name: 'Arabic', name_ar: 'اللغة العربية' },
  { name: 'Mathematics', name_ar: 'الرياضيات' },
  { name: 'English', name_ar: 'اللغة الإنجليزية' },
  { name: 'Science', name_ar: 'العلوم' },
  { name: 'Islamic Studies', name_ar: 'التربية الإسلامية' },
  { name: 'Social Studies', name_ar: 'الدراسات الاجتماعية' },
  { name: 'Art', name_ar: 'التربية الفنية' },
  { name: 'Physical Education', name_ar: 'التربية البدنية' },
]

/**
 * First launch. Six short steps, plain questions, and a "try it with example
 * data" escape hatch so nobody has to commit before they have looked around.
 */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const setLanguage = useApp((s) => s.setLanguage)
  const reloadSchool = useApp((s) => s.reloadSchool)
  const toast = useApp((s) => s.toast)

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const thisYear = new Date().getFullYear()
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    address: '',
    phone: '',
    email: '',
    logo_path: null as string | null,
    academic_year_start: `${thisYear}-09-01`,
    academic_year_end: `${thisYear + 1}-06-30`,
    currency: 'LYD',
    grading_scale: 'percentage' as 'percentage' | 'letter' | 'gpa',
  })
  const [classes, setClasses] = useState<NamedItem[]>([])
  const [sectionsPerClass, setSectionsPerClass] = useState(1)
  const [subjects, setSubjects] = useState<NamedItem[]>([])
  const [admin, setAdmin] = useState({
    name: '', username: '', pin: '', confirmPin: '',
    security_question: 'What is the name of the town where the school is?',
    security_answer: '',
  })
  const [adminError, setAdminError] = useState<string | null>(null)

  const logoSrc = usePhoto(form.logo_path)

  const pickLogo = async () => {
    const source = await api.files.pickImage()
    if (!source) return
    setForm((f) => ({ ...f, logo_path: null }))
    const saved = await api.files.saveLogo(source)
    setForm((f) => ({ ...f, logo_path: saved }))
  }

  const loadDemo = async () => {
    setBusy(true)
    try {
      await api.demo.seed()
      await reloadSchool()
      toast(t('setup.demoLoaded'), 'success')
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    if (admin.pin !== admin.confirmPin) { setAdminError(t('auth.pinMismatch')); setStep(4); return }
    setBusy(true)
    try {
      await api.school.save({ ...form, language: lang, setup_complete: 1 })
      for (const [index, c] of classes.entries()) {
        const klass = await api.classes.save({ name: c.name, name_ar: c.name_ar || null, grade_level: index + 1 })
        const letters = ['A', 'B', 'C', 'D'].slice(0, sectionsPerClass)
        const arabicLetters = ['أ', 'ب', 'ج', 'د']
        for (const [i, letter] of letters.entries()) {
          await api.sections.save({ class_id: klass.id, name: letter, name_ar: arabicLetters[i] })
        }
      }
      for (const s of subjects) {
        await api.subjects.save({ name: s.name, name_ar: s.name_ar || null })
      }
      await api.users.create({
        name: admin.name,
        username: admin.username,
        pin: admin.pin,
        role: 'admin',
        security_question: admin.security_question,
        security_answer: admin.security_answer,
      })
      await reloadSchool()
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
      setBusy(false)
    }
  }

  const steps: WizardStep[] = [
    {
      title: t('setup.chooseLanguage'),
      subtitle: t('setup.languageHelp'),
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard selected={lang === 'en'} onClick={() => void setLanguage('en')} title="English" subtitle="English interface" />
            <ChoiceCard selected={lang === 'ar'} onClick={() => void setLanguage('ar')} title="العربية" subtitle="واجهة عربية من اليمين إلى اليسار" />
          </div>
          <Card className="border-dashed">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-amber-500" />{t('setup.loadDemo')}</p>
                <p className="text-sm text-ink-500 dark:text-ink-300">{t('setup.loadDemoHelp')}</p>
              </div>
              <Button onClick={() => void loadDemo()} loading={busy}>{t('setup.loadDemo')}</Button>
            </div>
          </Card>
        </div>
      ),
    },
    {
      title: t('setup.schoolInfo'),
      content: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('setup.schoolName')}
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <TextInput
              label={t('setup.schoolNameAr')}
              value={form.name_ar}
              onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
              dir="rtl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('common.phone')} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <TextInput label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <TextInput label={t('common.address')} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />

          <Field label={t('setup.logo')} hint={t('setup.logoHelp')}>
            <div className="flex items-center gap-4">
              <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--app-border)' }}>
                {logoSrc ? <img src={logoSrc} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={26} className="text-ink-400" />}
              </span>
              <Button onClick={() => void pickLogo()} icon={<ImageIcon size={18} />}>
                {form.logo_path ? t('common.changePhoto') : t('common.choosePhoto')}
              </Button>
              {form.logo_path && (
                <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, logo_path: null }))}>{t('common.removePhoto')}</Button>
              )}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('setup.yearStart')}
              type="date"
              value={form.academic_year_start}
              onChange={(e) => setForm((f) => ({ ...f, academic_year_start: e.target.value }))}
            />
            <TextInput
              label={t('setup.yearEnd')}
              type="date"
              value={form.academic_year_end}
              onChange={(e) => setForm((f) => ({ ...f, academic_year_end: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('common.currency')} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            <Select
              label={t('setup.gradingScale')}
              value={form.grading_scale}
              onChange={(e) => setForm((f) => ({ ...f, grading_scale: e.target.value as typeof f.grading_scale }))}
              options={[
                { value: 'percentage', label: t('setup.gradePercentage') },
                { value: 'letter', label: t('setup.gradeLetter') },
                { value: 'gpa', label: t('setup.gradeGpa') },
              ]}
            />
          </div>
        </div>
      ),
      canContinue: form.name.trim().length > 0,
    },
    {
      title: t('setup.classesStep'),
      subtitle: t('setup.classesHelp'),
      content: (
        <NameListEditor
          items={classes}
          onChange={setClasses}
          suggestions={SUGGESTED_CLASSES}
          addLabel={t('setup.addClass')}
          extra={
            <Select
              label={t('setup.sectionsPerClass')}
              value={String(sectionsPerClass)}
              onChange={(e) => setSectionsPerClass(Number(e.target.value))}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            />
          }
        />
      ),
    },
    {
      title: t('setup.subjectsStep'),
      subtitle: t('setup.subjectsHelp'),
      content: (
        <NameListEditor items={subjects} onChange={setSubjects} suggestions={SUGGESTED_SUBJECTS} addLabel={t('setup.addSubject')} />
      ),
    },
    {
      title: t('setup.adminStep'),
      subtitle: t('setup.adminHelp'),
      content: (
        <div className="space-y-4">
          <TextInput label={t('setup.yourName')} required value={admin.name} onChange={(e) => setAdmin((a) => ({ ...a, name: e.target.value }))} autoFocus />
          <TextInput
            label={t('setup.chooseUsername')}
            required
            value={admin.username}
            onChange={(e) => setAdmin((a) => ({ ...a, username: e.target.value.replace(/\s/g, '').toLowerCase() }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('setup.choosePin')}
              required
              type="password"
              inputMode="numeric"
              value={admin.pin}
              onChange={(e) => setAdmin((a) => ({ ...a, pin: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
            />
            <TextInput
              label={t('auth.confirmPin')}
              required
              type="password"
              inputMode="numeric"
              value={admin.confirmPin}
              onChange={(e) => setAdmin((a) => ({ ...a, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
              error={admin.confirmPin && admin.pin !== admin.confirmPin ? t('auth.pinMismatch') : undefined}
            />
          </div>
          <TextInput
            label={t('auth.securityQuestion')}
            hint={t('setup.securityQuestionHelp')}
            value={admin.security_question}
            onChange={(e) => setAdmin((a) => ({ ...a, security_question: e.target.value }))}
          />
          <TextInput label={t('auth.yourAnswer')} required value={admin.security_answer} onChange={(e) => setAdmin((a) => ({ ...a, security_answer: e.target.value }))} />
          {adminError && <p role="alert" className="font-medium text-rose-600">{adminError}</p>}
        </div>
      ),
      canContinue:
        admin.name.trim().length > 0 &&
        admin.username.trim().length > 0 &&
        /^\d{4,8}$/.test(admin.pin) &&
        admin.pin === admin.confirmPin &&
        admin.security_answer.trim().length > 0,
    },
    {
      title: t('setup.reviewStep'),
      subtitle: t('setup.reviewHelp'),
      content: (
        <div className="space-y-3">
          <ReviewRow label={t('setup.schoolName')} value={form.name} />
          {form.name_ar && <ReviewRow label={t('setup.schoolNameAr')} value={form.name_ar} />}
          <ReviewRow label={t('setup.academicYear')} value={`${form.academic_year_start} → ${form.academic_year_end}`} />
          <ReviewRow label={t('classes.classesTab')} value={classes.length ? classes.map((c) => c.name).join(', ') : t('common.none')} />
          <ReviewRow label={t('setup.sectionsPerClass')} value={String(sectionsPerClass)} />
          <ReviewRow label={t('classes.subjectsTab')} value={subjects.length ? subjects.map((s) => s.name).join(', ') : t('common.none')} />
          <ReviewRow label={t('setup.adminStep')} value={`${admin.name} (${admin.username})`} />
        </div>
      ),
    },
  ]

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="flex max-h-[92vh] w-full max-w-3xl flex-col" padded={false}>
        <div className="flex items-center gap-4 border-b p-6" style={{ borderColor: 'var(--app-border)' }}>
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <GraduationCap size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{t('setup.title')}</h1>
            <p className="text-ink-500 dark:text-ink-300">{t('setup.subtitle')}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-6">
          <Wizard
            steps={steps}
            current={step}
            onStepChange={setStep}
            onFinish={() => void finish()}
            finishLabel={t('setup.startUsing')}
            busy={busy}
          />
        </div>
      </Card>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border p-3 surface">
      <span className="text-sm font-semibold text-ink-500 dark:text-ink-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

/** Quick-add chips plus a free-text row, so a list is built in seconds. */
function NameListEditor({
  items, onChange, suggestions, addLabel, extra,
}: {
  items: NamedItem[]
  onChange: (items: NamedItem[]) => void
  suggestions: NamedItem[]
  addLabel: string
  extra?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<NamedItem>({ name: '', name_ar: '' })

  const add = (item: NamedItem) => {
    if (!item.name.trim()) return
    if (items.some((i) => i.name.toLowerCase() === item.name.trim().toLowerCase())) return
    onChange([...items, { name: item.name.trim(), name_ar: item.name_ar.trim() }])
  }

  const remaining = suggestions.filter((s) => !items.some((i) => i.name === s.name))

  return (
    <div className="space-y-5">
      {remaining.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-500 dark:text-ink-300">{t('setup.suggestions')}</p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => add(s)}
                className="surface inline-flex min-h-touch items-center gap-2 rounded-xl border px-3 font-medium hover:border-brand-400 hover:bg-brand-50 focus-ring dark:hover:bg-ink-800"
              >
                <Plus size={16} />
                {s.name} · {s.name_ar}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => { e.preventDefault(); add(draft); setDraft({ name: '', name_ar: '' }) }}
      >
        <div className="min-w-[10rem] flex-1">
          <TextInput label={t('common.nameEnglish')} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <TextInput label={t('common.nameArabic')} dir="rtl" value={draft.name_ar} onChange={(e) => setDraft((d) => ({ ...d, name_ar: e.target.value }))} />
        </div>
        <Button type="submit" variant="primary" icon={<Plus size={18} />}>{addLabel}</Button>
      </form>

      {extra}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={item.name} className="surface flex min-h-touch items-center gap-3 rounded-xl border p-3">
              <Check size={18} className="text-emerald-600" />
              <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
              {item.name_ar && <span className="truncate text-ink-500 dark:text-ink-300" dir="rtl">{item.name_ar}</span>}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, index) => index !== i))}
                aria-label={t('common.remove')}
                className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 focus-ring dark:hover:bg-rose-950"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
