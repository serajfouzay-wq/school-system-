import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useApp } from '@/store/app'
import type { Staff } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { TextInput, Select, Field, TextArea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { usePhoto } from '@/components/ui/Avatar'

export function StaffForm({
  open, editing, onClose,
}: {
  open: boolean
  editing: Staff | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    full_name: editing?.full_name ?? '',
    full_name_ar: editing?.full_name_ar ?? '',
    role: editing?.role ?? 'teacher',
    phone: editing?.phone ?? '',
    email: editing?.email ?? '',
    address: editing?.address ?? '',
    hire_date: editing?.hire_date ?? '',
    salary: editing?.salary != null ? String(editing.salary) : '',
    status: editing?.status ?? 'active',
    photo_path: editing?.photo_path ?? null,
  })
  const photoSrc = usePhoto(form.photo_path)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const pickPhoto = async () => {
    const source = await api.files.pickImage()
    if (!source) return
    set('photo_path', await api.files.saveStaffPhoto(source, editing?.staff_code ?? `tmp-${Date.now()}`))
  }

  const save = async () => {
    setBusy(true)
    try {
      await api.staff.save({
        ...(editing ? { id: editing.id } : {}),
        full_name: form.full_name,
        full_name_ar: form.full_name_ar || null,
        role: form.role,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        hire_date: form.hire_date || null,
        salary: form.salary ? Number(form.salary) : null,
        status: form.status,
        photo_path: form.photo_path,
      })
      touch()
      toast(t('common.saved'), 'success')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('common.edit') : t('staff.addStaff')}
      size="lg"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" loading={busy} disabled={!form.full_name.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('common.choosePhoto')}>
          <div className="flex items-center gap-4">
            <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--app-border)' }}>
              {photoSrc ? <img src={photoSrc} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={26} className="text-ink-400" />}
            </span>
            <Button onClick={() => void pickPhoto()} icon={<ImageIcon size={18} />}>
              {form.photo_path ? t('common.changePhoto') : t('common.choosePhoto')}
            </Button>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.nameEnglish')} required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
          <TextInput label={t('common.nameArabic')} dir="rtl" value={form.full_name_ar} onChange={(e) => set('full_name_ar', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('staff.jobRole')}
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            options={['teacher', 'admin', 'registrar', 'accountant', 'other'].map((r) => ({ value: r, label: t(`roles.${r}`) }))}
          />
          <Select
            label={t('common.status')}
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: 'active', label: t('staff.statusActive') },
              { value: 'inactive', label: t('staff.statusInactive') },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.phone')} type="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <TextInput label={t('common.email')} type="email" dir="ltr" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <TextArea label={t('common.address')} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('staff.hireDate')} type="date" value={form.hire_date} onChange={(e) => set('hire_date', e.target.value)} />
          <TextInput label={t('staff.salary')} type="number" inputMode="decimal" dir="ltr" value={form.salary} onChange={(e) => set('salary', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
