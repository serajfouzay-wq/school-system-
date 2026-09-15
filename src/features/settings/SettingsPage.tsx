import { useState } from 'react'
import {
  School as SchoolIcon, Users, HardDriveDownload, Palette, Languages, Info,
  Plus, Pencil, Trash2, FolderOpen, Save, Image as ImageIcon, Sparkles, RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { Role, User } from '@shared/types'
import { Button, ChoiceCard } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Select, TextInput, Field, Toggle } from '@/components/ui/Field'
import { Loading, StatusPill, EmptyState } from '@/components/ui/Feedback'
import { PageHeader, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { usePhoto, Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/format'

export function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'school' | 'users' | 'backup' | 'appearance' | 'about'>('school')

  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <Tabs
        tabs={[
          { id: 'school' as const, label: t('settings.schoolInfo'), icon: <SchoolIcon size={18} /> },
          { id: 'users' as const, label: t('settings.users'), icon: <Users size={18} /> },
          { id: 'backup' as const, label: t('settings.backup'), icon: <HardDriveDownload size={18} /> },
          { id: 'appearance' as const, label: t('settings.appearance'), icon: <Palette size={18} /> },
          { id: 'about' as const, label: t('settings.about'), icon: <Info size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'school' && <SchoolSettings />}
      {tab === 'users' && <UserSettings />}
      {tab === 'backup' && <BackupSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
      {tab === 'about' && <AboutSettings />}
    </div>
  )
}

function SchoolSettings() {
  const { t } = useTranslation()
  const school = useApp((s) => s.school)
  const reloadSchool = useApp((s) => s.reloadSchool)
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    name: school?.name ?? '',
    name_ar: school?.name_ar ?? '',
    address: school?.address ?? '',
    phone: school?.phone ?? '',
    email: school?.email ?? '',
    currency: school?.currency ?? 'LYD',
    academic_year_start: school?.academic_year_start ?? '',
    academic_year_end: school?.academic_year_end ?? '',
    grading_scale: school?.grading_scale ?? 'percentage',
    logo_path: school?.logo_path ?? null,
  })
  const logoSrc = usePhoto(form.logo_path)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    try {
      await api.school.save({
        name: form.name,
        name_ar: form.name_ar || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        currency: form.currency,
        academic_year_start: form.academic_year_start || null,
        academic_year_end: form.academic_year_end || null,
        grading_scale: form.grading_scale,
        logo_path: form.logo_path,
      })
      await reloadSchool()
      toast(t('common.saved'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="max-w-2xl space-y-4">
        <Field label={t('setup.logo')} hint={t('setup.logoHelp')}>
          <div className="flex items-center gap-4">
            <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--app-border)' }}>
              {logoSrc ? <img src={logoSrc} alt="" className="h-full w-full object-contain" /> : <ImageIcon size={26} className="text-ink-400" />}
            </span>
            <Button
              onClick={async () => {
                const source = await api.files.pickImage()
                if (source) set('logo_path', await api.files.saveLogo(source))
              }}
              icon={<ImageIcon size={18} />}
            >
              {form.logo_path ? t('common.changePhoto') : t('common.choosePhoto')}
            </Button>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('setup.schoolName')} required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <TextInput label={t('setup.schoolNameAr')} dir="rtl" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.phone')} dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <TextInput label={t('common.email')} dir="ltr" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <TextInput label={t('common.address')} value={form.address} onChange={(e) => set('address', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('setup.yearStart')} type="date" value={form.academic_year_start} onChange={(e) => set('academic_year_start', e.target.value)} />
          <TextInput label={t('setup.yearEnd')} type="date" value={form.academic_year_end} onChange={(e) => set('academic_year_end', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.currency')} value={form.currency} onChange={(e) => set('currency', e.target.value)} />
          <Select
            label={t('setup.gradingScale')}
            value={form.grading_scale}
            onChange={(e) => set('grading_scale', e.target.value as typeof form.grading_scale)}
            options={[
              { value: 'percentage', label: t('setup.gradePercentage') },
              { value: 'letter', label: t('setup.gradeLetter') },
              { value: 'gpa', label: t('setup.gradeGpa') },
            ]}
          />
        </div>
        <Button size="lg" variant="primary" loading={busy} onClick={() => void save()} icon={<Save size={20} />}>
          {t('settings.saveChanges')}
        </Button>
      </div>
    </Card>
  )
}

function UserSettings() {
  const { t } = useTranslation()
  const current = useApp((s) => s.user)
  const toast = useApp((s) => s.toast)
  const [editing, setEditing] = useState<User | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<User | null>(null)

  const { data, loading, reload } = useAsync(() => api.users.list(true), [])

  if (loading && !data) return <Loading />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('settings.addUser')}</Button>
      </div>
      <Card padded={false}>
        <ul>
          {(data ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
              <Avatar name={u.name} size={44} />
              <span className="min-w-[10rem] flex-1">
                <span className="block font-bold">{u.name}</span>
                <span className="block text-sm text-ink-500 dark:text-ink-300">{u.username}</span>
              </span>
              <StatusPill tone="blue">{t(`roles.${u.role}`)}</StatusPill>
              <StatusPill tone={u.is_active ? 'green' : 'grey'}>
                {u.is_active ? t('settings.userActive') : t('settings.userInactive')}
              </StatusPill>
              <Button size="sm" onClick={() => setEditing(u)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
              {u.id !== current?.id && (
                <Button size="sm" variant="ghost" onClick={() => setDeleting(u)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {(adding || editing) && (
        <UserEditor
          user={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.users.remove(deleting.id)
            toast(t('common.delete'), 'success')
            reload()
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

function UserEditor({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'teacher')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [question, setQuestion] = useState(user?.security_question ?? '')
  const [answer, setAnswer] = useState('')
  const [isActive, setIsActive] = useState(user ? user.is_active === 1 : true)
  const [busy, setBusy] = useState(false)

  const pinValid = user ? (!pin || /^\d{4,8}$/.test(pin)) : /^\d{4,8}$/.test(pin)
  const pinsMatch = !pin || pin === confirmPin

  const save = async () => {
    setBusy(true)
    try {
      if (user) {
        await api.users.update(user.id, {
          name, role, is_active: isActive ? 1 : 0,
          ...(pin ? { pin } : {}),
          ...(question ? { security_question: question } : {}),
          ...(answer ? { security_answer: answer } : {}),
        })
      } else {
        await api.users.create({ name, username, pin, role, security_question: question || null, security_answer: answer || null })
      }
      toast(t('common.saved'), 'success')
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? t('settings.editUser') : t('settings.addUser')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            loading={busy}
            disabled={!name.trim() || (!user && !username.trim()) || !pinValid || !pinsMatch}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label={t('common.name')} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {!user && (
          <TextInput
            label={t('auth.username')}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
          />
        )}
        <Select
          label={t('settings.role')}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={(['admin', 'registrar', 'teacher', 'accountant', 'viewer'] as const).map((r) => ({ value: r, label: t(`roles.${r}`) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={user ? t('settings.changePin') : t('setup.choosePin')}
            required={!user}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
          <TextInput
            label={t('auth.confirmPin')}
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            error={!pinsMatch ? t('auth.pinMismatch') : undefined}
          />
        </div>
        <TextInput label={t('auth.securityQuestion')} hint={t('setup.securityQuestionHelp')} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <TextInput label={t('auth.yourAnswer')} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        {user && <Toggle checked={isActive} onChange={setIsActive} label={t('settings.userActive')} />}
      </div>
    </Modal>
  )
}

function BackupSettings() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  const { data: status, reload: reloadStatus } = useAsync(() => api.backup.status(), [])
  const { data: backups, reload: reloadBackups } = useAsync(() => api.backup.list(), [])

  const backupNow = async () => {
    setBusy(true)
    try {
      await api.backup.create()
      reloadStatus(); reloadBackups()
      toast(t('common.saved'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (file: string) => {
    setBusy(true)
    try {
      await api.backup.restore(file)
      toast(t('settings.restoreDone'), 'success')
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      setConfirmRestore(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{t('settings.backup')}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionTile
            title={t('settings.backupNow')}
            body={t('settings.backupNowHelp')}
            action={<Button size="lg" variant="primary" loading={busy} onClick={() => void backupNow()} icon={<HardDriveDownload size={20} />}>{t('settings.backupNow')}</Button>}
          />
          <ActionTile
            title={t('settings.backupTo')}
            body={t('settings.backupToHelp')}
            action={
              <Button
                size="lg"
                onClick={async () => {
                  const path = await api.backup.chooseAndCopy()
                  if (path) toast(`${t('common.saved')}: ${path}`, 'success')
                }}
                icon={<FolderOpen size={20} />}
              >
                {t('settings.backupTo')}
              </Button>
            }
          />
        </div>

        {status && (
          <div className="mt-5 space-y-4 border-t pt-5" style={{ borderColor: 'var(--app-border)' }}>
            <Toggle
              checked={status.autoEnabled}
              onChange={async (v) => { await api.backup.setAuto(v); reloadStatus() }}
              label={t('settings.autoBackup')}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-ink-500 dark:text-ink-300">{t('settings.lastBackup')}</span>
              <StatusPill tone={status.lastBackupAt ? 'green' : 'amber'}>
                {status.lastBackupAt
                  ? formatDate(status.lastBackupAt.slice(0, 10), lang, { calendar, numerals })
                  : t('settings.neverBackedUp')}
              </StatusPill>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-ink-500 dark:text-ink-300" dir="ltr">
                {t('settings.dataFolder')}: {status.folder}
              </span>
              <Button onClick={() => void api.files.openFolder(status.folder)} icon={<FolderOpen size={18} />}>
                {t('settings.openDataFolder')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle
          action={
            <Button
              onClick={async () => {
                const res = await api.backup.chooseAndRestore()
                if (res) {
                  toast(t('settings.restoreDone'), 'success')
                  setTimeout(() => window.location.reload(), 1200)
                }
              }}
              icon={<RotateCcw size={18} />}
            >
              {t('settings.restore')}
            </Button>
          }
        >
          {t('settings.pastBackups')}
        </CardTitle>
        <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">{t('settings.restoreHelp')}</p>
        {!backups?.length ? (
          <EmptyState icon={<HardDriveDownload size={40} />} title={t('settings.neverBackedUp')} />
        ) : (
          <ul className="space-y-2">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{formatDate(b.timestamp.slice(0, 10), lang, { calendar, numerals })}</span>
                  <span className="block truncate text-sm text-ink-500 dark:text-ink-300" dir="ltr">
                    {b.file_path.split(/[\\/]/).pop()} · {b.size_bytes ? `${Math.round(b.size_bytes / 1024)} KB` : ''}
                  </span>
                </span>
                <StatusPill tone={b.triggered_by === 'auto' ? 'grey' : 'blue'}>{b.triggered_by}</StatusPill>
                <Button size="sm" onClick={() => setConfirmRestore(b.file_path)} icon={<RotateCcw size={16} />}>{t('common.restore')}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmRestore}
        title={t('settings.restore')}
        body={t('settings.restoreConfirm')}
        confirmLabel={t('common.restore')}
        onConfirm={() => confirmRestore && void restore(confirmRestore)}
        onCancel={() => setConfirmRestore(null)}
      />
    </div>
  )
}

function ActionTile({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--app-border)' }}>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-ink-500 dark:text-ink-300">{body}</p>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  )
}

function AppearanceSettings() {
  const { t } = useTranslation()
  const lang = useLang()
  const preferences = useApp((s) => s.preferences)
  const setPreference = useApp((s) => s.setPreference)
  const setLanguage = useApp((s) => s.setLanguage)

  const theme = preferences.theme ?? 'light'
  const fontSize = preferences.fontSize ?? 'small'
  const numerals = preferences.numerals ?? 'western'
  const calendarType = preferences.calendar ?? 'gregorian'

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{t('settings.language')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={lang === 'en'} onClick={() => void setLanguage('en')} title="English" subtitle="Left to right" icon={<Languages size={24} />} />
          <ChoiceCard selected={lang === 'ar'} onClick={() => void setLanguage('ar')} title="العربية" subtitle="من اليمين إلى اليسار" icon={<Languages size={24} />} />
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.theme')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={theme === 'light'} onClick={() => void setPreference('theme', 'light')} title={t('settings.themeLight')} />
          <ChoiceCard selected={theme === 'dark'} onClick={() => void setPreference('theme', 'dark')} title={t('settings.themeDark')} />
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.fontSize')}</CardTitle>
        <p className="mb-3 text-sm text-ink-500 dark:text-ink-300">{t('settings.fontHelp')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <ChoiceCard
              key={size}
              selected={fontSize === size}
              onClick={() => void setPreference('fontSize', size)}
              title={<span style={{ fontSize: size === 'small' ? '1rem' : size === 'medium' ? '1.15rem' : '1.35rem' }}>
                {t(`settings.font${size.charAt(0).toUpperCase()}${size.slice(1)}`)}
              </span>}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.numerals')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={numerals === 'western'} onClick={() => void setPreference('numerals', 'western')} title="1 2 3 4 5" subtitle={t('settings.numeralsWestern')} />
          <ChoiceCard selected={numerals === 'arabic_indic'} onClick={() => void setPreference('numerals', 'arabic_indic')} title="١ ٢ ٣ ٤ ٥" subtitle={t('settings.numeralsArabic')} />
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.calendarType')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={calendarType === 'gregorian'} onClick={() => void setPreference('calendar', 'gregorian')} title={t('settings.calendarGregorian')} />
          <ChoiceCard selected={calendarType === 'hijri'} onClick={() => void setPreference('calendar', 'hijri')} title={t('settings.calendarHijri')} />
        </div>
      </Card>
    </div>
  )
}

function AboutSettings() {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const { data: version } = useAsync(() => api.app.version(), [])
  const { data: seeded, reload } = useAsync(() => api.demo.isSeeded(), [])

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>{t('settings.about')}</CardTitle>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500 dark:text-ink-300">{t('app.name')}</span>
            <span className="font-bold">{t('app.tagline')}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500 dark:text-ink-300">{t('app.version')}</span>
            <span className="font-bold" dir="ltr">{version ?? '—'}</span>
          </div>
        </div>
      </Card>

      {!seeded && (
        <Card>
          <CardTitle>{t('settings.loadDemoData')}</CardTitle>
          <p className="mb-4 text-ink-500 dark:text-ink-300">{t('setup.loadDemoHelp')}</p>
          <Button size="lg" variant="primary" onClick={() => setConfirmDemo(true)} icon={<Sparkles size={20} />}>
            {t('settings.loadDemoData')}
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDemo}
        tone="primary"
        title={t('settings.loadDemoData')}
        body={t('settings.loadDemoConfirm')}
        confirmLabel={t('common.continue')}
        onConfirm={async () => {
          setConfirmDemo(false)
          try {
            await api.demo.seed()
            touch(); reload()
            toast(t('setup.demoLoaded'), 'success')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        }}
        onCancel={() => setConfirmDemo(false)}
      />
    </div>
  )
}
