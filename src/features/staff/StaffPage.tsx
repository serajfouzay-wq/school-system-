import { useState } from 'react'
import { Plus, GraduationCap, Pencil, Trash2, FolderInput } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync, useDebounced } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { Staff } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Field'
import { DataTable, columnsToExport } from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, ActionBar } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { StaffForm } from './StaffForm'
import { formatDate, localName } from '@/lib/format'
import { usePrinting } from '@/lib/printing'

export function StaffPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const go = useApp((s) => s.go)
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { exportCsv } = usePrinting()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState<Staff | null>(null)

  const debounced = useDebounced(search, 250)
  const { data: staff, loading, error, reload } = useAsync(
    () => api.staff.list({ search: debounced, role: role || null }),
    [debounced, role]
  )

  const name = (s: Staff) => localName(s, lang, 'full_name')

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: t('common.name'),
      value: name,
      sortable: true,
      render: (s) => (
        <span className="flex items-center gap-3">
          <Avatar name={name(s)} photoPath={s.photo_path} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name(s)}</span>
            <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{s.staff_code}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', header: t('staff.jobRole'), value: (s) => s.role, sortable: true, render: (s) => t(`roles.${s.role}`, { defaultValue: s.role }) },
    { key: 'phone', header: t('common.phone'), value: (s) => s.phone ?? '', render: (s) => <span dir="ltr">{s.phone ?? '—'}</span> },
    { key: 'email', header: t('common.email'), value: (s) => s.email ?? '', render: (s) => <span dir="ltr">{s.email ?? '—'}</span> },
    { key: 'hire', header: t('staff.hireDate'), value: (s) => s.hire_date ?? '', render: (s) => formatDate(s.hire_date, lang, { calendar, numerals }) },
    {
      key: 'status',
      header: t('common.status'),
      value: (s) => s.status,
      render: (s) => (
        <StatusPill tone={s.status === 'active' ? 'green' : 'grey'}>
          {s.status === 'active' ? t('staff.statusActive') : t('staff.statusInactive')}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      render: (s) => (
        <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => { setEditing(s); setFormOpen(true) }} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
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
      await api.staff.remove(victim.id)
      touch()
      reload()
      toast(`${name(victim)} — ${t('common.delete')}`, 'success', {
        label: t('common.undo'),
        run: async () => {
          const bin = await api.recycle.list()
          const entry = bin.find((b) => b.table_name === 'staff' && b.record_id === victim.id)
          if (entry) { await api.recycle.restore(entry.id); touch(); reload(); toast(t('common.undone'), 'info') }
        },
      })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  if (loading && !staff) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title={t('staff.title')}
        subtitle={staff ? t('common.showing', { count: staff.length }) : undefined}
        actions={
          <ActionBar>
            <Button
              onClick={() => {
                const payload = columnsToExport(columns, staff ?? [], (c) => String(c.header))
                void exportCsv('staff.csv', payload.columns, payload.rows)
              }}
              icon={<FolderInput size={18} />}
            >
              {t('common.exportCsv')}
            </Button>
            <Button size="lg" variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }} icon={<Plus size={20} />}>
              {t('staff.addStaff')}
            </Button>
          </ActionBar>
        }
      />

      {(staff?.length ?? 0) > 0 && (
        <FilterBar>
          <div className="min-w-[14rem] flex-1">
            <TextInput label={t('common.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="min-w-[11rem]">
            <Select
              label={t('staff.jobRole')}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('common.all')}
              options={['teacher', 'admin', 'registrar', 'accountant', 'other'].map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            />
          </div>
        </FilterBar>
      )}

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={staff ?? []}
          onRowClick={(s) => go({ name: 'staffProfile', id: s.id })}
          emptyState={
            <EmptyState
              icon={<GraduationCap size={44} />}
              title={debounced ? t('common.noResults') : t('staff.emptyTitle')}
              body={debounced ? undefined : t('staff.emptyBody')}
              action={
                !debounced && (
                  <Button size="lg" variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }} icon={<Plus size={20} />}>
                    {t('staff.addFirst')}
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      {formOpen && (
        <StaffForm open={formOpen} editing={editing} onClose={() => { setFormOpen(false); setEditing(null); reload() }} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting ? name(deleting) : '' })}
        body={t('common.deleteExplain')}
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
