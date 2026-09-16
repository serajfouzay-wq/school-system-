import { useState } from 'react'
import { Plus, FileQuestion, Pencil, Trash2, Play, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { Exam } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { ExamSettings, QuestionList } from './ExamBuilder'
import { ExamLive } from './ExamLive'
import { localName } from '@/lib/format'

type View = { name: 'list' } | { name: 'questions'; exam: Exam } | { name: 'live'; exam: Exam }

export function ExamsPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [view, setView] = useState<View>({ name: 'list' })
  const [editing, setEditing] = useState<Exam | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Exam | null>(null)

  const { data: exams, loading, error, reload } = useAsync(() => api.exams.list(), [])

  if (view.name === 'questions') {
    return (
      <div>
        <PageHeader
          title={localName(view.exam, lang, 'title')}
          subtitle={`${view.exam.section_label ?? ''} · ${view.exam.subject_name ?? ''}`}
          actions={
            <>
              <Button onClick={() => { setView({ name: 'list' }); reload() }}>{t('common.back')}</Button>
              <Button variant="primary" onClick={() => setView({ name: 'live', exam: view.exam })} icon={<Play size={18} />}>
                {t('exams.startExam')}
              </Button>
            </>
          }
        />
        <QuestionList exam={view.exam} />
      </div>
    )
  }

  if (view.name === 'live') {
    return (
      <div>
        <PageHeader
          title={localName(view.exam, lang, 'title')}
          subtitle={view.exam.section_label ?? ''}
        />
        <ExamLive exam={view.exam} onBack={() => { setView({ name: 'list' }); reload() }} />
      </div>
    )
  }

  if (loading && !exams) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title={t('exams.title')}
        subtitle={t('exams.subtitle')}
        actions={
          <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
            {t('exams.addExam')}
          </Button>
        }
      />

      <ModuleTour
        moduleKey="exams"
        tips={[
          { title: t('exams.addExam'), body: t('exams.emptyBody') },
          { title: t('exams.startExam'), body: t('exams.addressHelp') },
          { title: t('exams.sendToReportCards'), body: t('exams.autoMarked') },
        ]}
      />

      <Card padded={false}>
        {!exams?.length ? (
          <EmptyState
            icon={<FileQuestion size={44} />}
            title={t('exams.emptyTitle')}
            body={t('exams.emptyBody')}
            action={
              <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
                {t('exams.addExam')}
              </Button>
            }
          />
        ) : (
          <ul>
            {exams.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[12rem] flex-1">
                  <span className="block text-lg font-bold">{localName(e, lang, 'title')}</span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">
                    {[e.section_label, e.subject_name, e.term_name].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
                <StatusPill tone="grey">{e.question_count ?? 0} {t('exams.questions')}</StatusPill>
                <StatusPill tone="violet">{e.total_marks ?? 0} {t('exams.totalMarks')}</StatusPill>
                <StatusPill tone="blue">{e.duration_minutes} min</StatusPill>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setView({ name: 'questions', exam: e })} icon={<ListChecks size={16} />}>
                    {t('exams.questions')}
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => setView({ name: 'live', exam: e })} icon={<Play size={16} />}>
                    {t('exams.startExam')}
                  </Button>
                  <Button size="sm" onClick={() => setEditing(e)} icon={<Pencil size={16} />}>
                    <span className="sr-only">{t('common.edit')}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(e)} icon={<Trash2 size={16} className="text-rose-600" />}>
                    <span className="sr-only">{t('common.delete')}</span>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <ExamSettings
          exam={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={(saved) => {
            setAdding(false)
            setEditing(null)
            reload()
            touch()
            // A brand new exam has no questions yet, so go straight there.
            if (!editing) setView({ name: 'questions', exam: saved })
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.title ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.exams.remove(deleting.id)
          setDeleting(null); reload(); touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
