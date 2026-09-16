import { useState } from 'react'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { Exam, ExamQuestion, QuestionKind } from '@shared/types'
import { Button, ChoiceCard } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextInput, TextArea, Select, Field, Toggle } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, Loading, StatusPill } from '@/components/ui/Feedback'
import { sectionTitle } from '@/features/students/StudentWizard'
import { localName } from '@/lib/format'

/** The exam's own settings: what it is called, who sits it, how long. */
export function ExamSettings({
  exam, onClose, onSaved,
}: {
  exam: Exam | null
  onClose: () => void
  onSaved: (exam: Exam) => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const { data: subjects } = useAsync(() => api.subjects.list(), [])
  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: terms } = useAsync(() => api.terms.list(), [])

  const [form, setForm] = useState({
    title: exam?.title ?? '',
    title_ar: exam?.title_ar ?? '',
    subject_id: exam?.subject_id ? String(exam.subject_id) : '',
    section_id: exam?.section_id ? String(exam.section_id) : '',
    exam_term_id: exam?.exam_term_id ? String(exam.exam_term_id) : '',
    duration_minutes: String(exam?.duration_minutes ?? 30),
    shuffle: (exam?.shuffle ?? 1) === 1,
    instructions: exam?.instructions ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    try {
      const saved = await api.exams.save({
        ...(exam ? { id: exam.id } : {}),
        title: form.title,
        title_ar: form.title_ar || null,
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        section_id: form.section_id ? Number(form.section_id) : null,
        exam_term_id: form.exam_term_id ? Number(form.exam_term_id) : null,
        duration_minutes: Number(form.duration_minutes) || 30,
        shuffle: form.shuffle ? 1 : 0,
        instructions: form.instructions || null,
      })
      onSaved(saved)
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
      title={exam ? t('common.edit') : t('exams.addExam')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" loading={busy} disabled={!form.title.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('exams.examName')} required value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          <TextInput label={t('common.nameArabic')} dir="rtl" value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} />
        </div>
        <Select
          label={t('common.class')}
          required
          value={form.section_id}
          onChange={(e) => set('section_id', e.target.value)}
          placeholder={t('common.select')}
          options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('common.subject')}
            value={form.subject_id}
            onChange={(e) => set('subject_id', e.target.value)}
            placeholder={t('common.select')}
            options={(subjects ?? []).map((s) => ({ value: s.id, label: localName(s, lang) }))}
          />
          <Select
            label={t('grades.chooseTerm')}
            value={form.exam_term_id}
            onChange={(e) => set('exam_term_id', e.target.value)}
            placeholder={t('common.select')}
            options={(terms ?? []).map((x) => ({ value: x.id, label: localName(x, lang) }))}
          />
        </div>
        <TextInput
          label={t('exams.duration')}
          type="number"
          dir="ltr"
          value={form.duration_minutes}
          onChange={(e) => set('duration_minutes', e.target.value)}
        />
        <Toggle checked={form.shuffle} onChange={(v) => set('shuffle', v)} label={t('exams.shuffle')} hint={t('exams.shuffleHelp')} />
        <TextArea label={t('exams.instructions')} rows={2} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
      </div>
    </Modal>
  )
}

/** The question list for one exam, with its editor. */
export function QuestionList({ exam }: { exam: Exam }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [editing, setEditing] = useState<ExamQuestion | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ExamQuestion | null>(null)

  const { data: questions, loading, reload } = useAsync(() => api.exams.questions(exam.id), [exam.id])

  const kindLabel: Record<QuestionKind, string> = {
    mcq: t('exams.kindMcq'),
    truefalse: t('exams.kindTrueFalse'),
    short: t('exams.kindShort'),
  }

  if (loading && !questions) return <Loading />

  const total = (questions ?? []).reduce((s, q) => s + q.marks, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusPill tone="blue">{t('exams.totalMarks')}: {total}</StatusPill>
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
          {t('exams.addQuestion')}
        </Button>
      </div>

      <Card padded={false}>
        {!questions?.length ? (
          <EmptyState
            title={t('exams.noQuestions')}
            body={t('exams.noQuestionsBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('exams.addQuestion')}</Button>}
          />
        ) : (
          <ol>
            {questions.map((q, i) => (
              <li key={q.id} className="flex flex-wrap items-start gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-sm font-bold dark:bg-ink-800">
                  {i + 1}
                </span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-semibold">{q.text}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusPill tone="grey">{kindLabel[q.kind]}</StatusPill>
                    <StatusPill tone="violet">{q.marks}</StatusPill>
                    {q.kind === 'mcq' && (
                      <span className="text-sm text-ink-500 dark:text-ink-300">
                        {t('exams.correctAnswer')}: {q.options[Number(q.correct)] ?? '—'}
                      </span>
                    )}
                    {q.kind === 'truefalse' && (
                      <span className="text-sm text-ink-500 dark:text-ink-300">
                        {t('exams.correctAnswer')}: {q.correct === 'true' ? t('exams.trueLabel') : t('exams.falseLabel')}
                      </span>
                    )}
                    {q.kind === 'short' && (
                      <span className="text-sm text-ink-500 dark:text-ink-300">
                        {t('exams.acceptedAnswers')}: {q.correct}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => setEditing(q)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(q)} icon={<Trash2 size={16} className="text-rose-600" />}>
                    <span className="sr-only">{t('common.delete')}</span>
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {(adding || editing) && (
        <QuestionEditor
          examId={exam.id}
          question={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.areYouSure')}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.exams.removeQuestion(deleting.id)
          setDeleting(null); reload(); touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function QuestionEditor({
  examId, question, onClose, onSaved,
}: {
  examId: number
  question: ExamQuestion | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [kind, setKind] = useState<QuestionKind>(question?.kind ?? 'mcq')
  const [text, setText] = useState(question?.text ?? '')
  const [marks, setMarks] = useState(String(question?.marks ?? 1))
  const [options, setOptions] = useState<string[]>(question?.options.length ? question.options : ['', ''])
  const [correct, setCorrect] = useState(question?.correct ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api.exams.saveQuestion({
        ...(question ? { id: question.id } : {}),
        exam_id: examId,
        kind,
        text,
        marks: Number(marks) || 1,
        options: kind === 'mcq' ? options : [],
        correct: kind === 'truefalse' ? correct || 'true' : correct,
      })
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
      title={question ? t('exams.editQuestion') : t('exams.addQuestion')}
      size="lg"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" loading={busy} disabled={!text.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('exams.kind')}>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['mcq', 'truefalse', 'short'] as QuestionKind[]).map((k) => (
              <ChoiceCard
                key={k}
                selected={kind === k}
                onClick={() => { setKind(k); setCorrect(k === 'truefalse' ? 'true' : '') }}
                title={k === 'mcq' ? t('exams.kindMcq') : k === 'truefalse' ? t('exams.kindTrueFalse') : t('exams.kindShort')}
              />
            ))}
          </div>
        </Field>

        <TextArea label={t('exams.questionText')} required rows={2} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <TextInput label={t('exams.marks')} type="number" dir="ltr" value={marks} onChange={(e) => setMarks(e.target.value)} />

        {kind === 'mcq' && (
          <Field label={t('exams.choices')} hint={t('exams.markCorrect')}>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(String(i))}
                    aria-label={t('exams.markCorrect')}
                    className={[
                      'grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-colors focus-ring',
                      correct === String(i) ? 'border-emerald-600 bg-emerald-600 text-white' : 'surface hover:border-emerald-400',
                    ].join(' ')}
                  >
                    <Check size={20} />
                  </button>
                  <input
                    value={opt}
                    onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                    className="surface min-h-touch w-full rounded-xl border px-3 text-base focus-ring"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOptions((o) => o.filter((_, j) => j !== i))
                        if (correct === String(i)) setCorrect('')
                      }}
                      aria-label={t('common.remove')}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 focus-ring dark:hover:bg-rose-950"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
              <Button onClick={() => setOptions((o) => [...o, ''])} icon={<Plus size={18} />}>{t('exams.addChoice')}</Button>
            </div>
          </Field>
        )}

        {kind === 'truefalse' && (
          <Field label={t('exams.correctAnswer')}>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard selected={correct === 'true'} onClick={() => setCorrect('true')} title={t('exams.trueLabel')} />
              <ChoiceCard selected={correct === 'false'} onClick={() => setCorrect('false')} title={t('exams.falseLabel')} />
            </div>
          </Field>
        )}

        {kind === 'short' && (
          <TextInput
            label={t('exams.acceptedAnswers')}
            hint={t('exams.acceptedHelp')}
            required
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
          />
        )}
      </div>
    </Modal>
  )
}
