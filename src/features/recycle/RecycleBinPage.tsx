import { useState } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { RecycleBinEntry } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { formatDate, daysBetween, todayIso } from '@/lib/format'

/** Plain-language names, so the bin never shows a database table to the user. */
const KIND_KEYS: Record<string, string> = {
  students: 'student', staff: 'staff', classes: 'class', sections: 'section',
  subjects: 'subject', users: 'user', attendance: 'attendance',
  staff_attendance: 'attendance', exam_terms: 'examTerm', grades: 'grade',
  fee_structures: 'fee', fee_payments: 'payment', timetable_entries: 'lesson',
  announcements: 'announcement', calendar_events: 'event', student_notes: 'note',
  student_documents: 'document', teacher_assignments: 'assignment',
}

export function RecycleBinPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [restoring, setRestoring] = useState<RecycleBinEntry | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.recycle.list(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader title={t('recycle.title')} subtitle={t('recycle.subtitle')} />

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState icon={<Trash2 size={44} />} title={t('recycle.emptyTitle')} body={t('recycle.emptyBody')} />
        ) : (
          <ul>
            {data.map((entry) => {
              const deletedOn = entry.deleted_at.slice(0, 10)
              const left = 30 - daysBetween(deletedOn, todayIso())
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <StatusPill tone="grey">
                    {t(`kinds.${KIND_KEYS[entry.table_name] ?? 'note'}`, { defaultValue: entry.table_name })}
                  </StatusPill>
                  <span className="min-w-[10rem] flex-1 truncate font-semibold">{entry.label}</span>
                  <span className="text-sm text-ink-500 dark:text-ink-300">
                    {t('recycle.deletedOn')} {formatDate(deletedOn, lang, { calendar, numerals })}
                  </span>
                  <StatusPill tone={left <= 5 ? 'red' : 'amber'}>{t('recycle.daysLeft', { count: Math.max(0, left) })}</StatusPill>
                  <Button size="sm" variant="primary" onClick={() => setRestoring(entry)} icon={<RotateCcw size={16} className="flip-rtl" />}>
                    {t('common.restore')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!restoring}
        tone="primary"
        title={t('recycle.restoreConfirm', { name: restoring?.label ?? '' })}
        confirmLabel={t('common.restore')}
        onConfirm={async () => {
          if (!restoring) return
          const entry = restoring
          setRestoring(null)
          try {
            await api.recycle.restore(entry.id)
            touch(); reload()
            toast(t('recycle.restored', { name: entry.label }), 'success')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        }}
        onCancel={() => setRestoring(null)}
      />
    </div>
  )
}
