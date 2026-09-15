import { useEffect, useRef, useState } from 'react'
import { ClipboardList, Plus, Printer, FileText, Pencil, Trash2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals } from '@/store/app'
import type { ExamTerm, ReportCardData } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput, TextArea } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { sectionTitle } from '@/features/students/StudentWizard'
import { localName, formatNumber } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { reportCardHtml, reportCardsHtml } from '@/print/templates'

export function GradesPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'enter' | 'cards' | 'terms'>('enter')
  const { data: terms, reload: reloadTerms } = useAsync(() => api.terms.list(), [])

  return (
    <div>
      <PageHeader title={t('grades.title')} />
      <ModuleTour
        moduleKey="grades"
        tips={[
          { title: t('grades.enterGrades'), body: t('grades.gridHelp') },
          { title: t('grades.reportCards'), body: t('grades.printAllReportCards') },
        ]}
      />
      <Tabs
        tabs={[
          { id: 'enter' as const, label: t('grades.enterGrades'), icon: <ClipboardList size={18} /> },
          { id: 'cards' as const, label: t('grades.reportCards'), icon: <FileText size={18} /> },
          { id: 'terms' as const, label: t('grades.examTerms'), icon: <Check size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'enter' && <GradeEntry terms={terms ?? []} />}
      {tab === 'cards' && <ReportCards terms={terms ?? []} />}
      {tab === 'terms' && <ExamTerms terms={terms ?? []} onChange={reloadTerms} />}
    </div>
  )
}

/** Spreadsheet-like but simplified: big cells, Tab moves on, saves by itself. */
function GradeEntry({ terms }: { terms: ExamTerm[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const toast = useApp((s) => s.toast)

  const [sectionId, setSectionId] = useState('')
  const [termId, setTermId] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: subjects } = useAsync(
    () => (sectionId ? api.grades.subjectsForSection(Number(sectionId)) : Promise.resolve([])),
    [sectionId]
  )
  const { data: grid, loading, error, reload } = useAsync(
    () => (sectionId && termId ? api.grades.grid(Number(sectionId), Number(termId)) : Promise.resolve([])),
    [sectionId, termId]
  )

  useEffect(() => {
    if (sections?.length && !sectionId) setSectionId(String(sections[0].id))
    if (terms.length && !termId) setTermId(String(terms[0].id))
  }, [sections, terms, sectionId, termId])

  useEffect(() => { setDraft({}) }, [sectionId, termId])

  const cellKey = (studentId: number, subjectId: number) => `${studentId}:${subjectId}`

  const valueOf = (studentId: number, subjectId: number): string => {
    const key = cellKey(studentId, subjectId)
    if (key in draft) return draft[key]
    const row = grid?.find((r) => r.student_id === studentId)
    const score = row?.scores[subjectId]?.score
    return score === null || score === undefined ? '' : String(score)
  }

  // Auto-save a short moment after typing stops — no Save button to forget.
  const scheduleSave = (next: Record<string, string>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const entries = Object.entries(next)
        .map(([key, raw]) => {
          const [studentId, subjectId] = key.split(':').map(Number)
          const score = raw.trim() === '' ? null : Number(raw)
          return { student_id: studentId, subject_id: subjectId, score, max_score: 100 }
        })
        .filter((e) => e.score === null || Number.isFinite(e.score))
      if (!entries.length) return
      setSaveState('saving')
      try {
        await api.grades.save(Number(termId), entries)
        setSaveState('saved')
        setDraft({})
        reload()
      } catch (e) {
        setSaveState('idle')
        toast((e as Error).message, 'error')
      }
    }, 900)
  }

  const setCell = (studentId: number, subjectId: number, raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '')
    const next = { ...draft, [cellKey(studentId, subjectId)]: cleaned }
    setDraft(next)
    scheduleSave(next)
  }

  if (!terms.length) {
    return (
      <Card>
        <EmptyState icon={<ClipboardList size={44} />} title={t('grades.emptyTitle')} body={t('grades.emptyBody')} />
      </Card>
    )
  }

  return (
    <div>
      <FilterBar>
        <div className="min-w-[14rem] flex-1">
          <Select
            label={t('grades.chooseClass')}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder={t('common.select')}
            options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
          />
        </div>
        <div className="min-w-[14rem] flex-1">
          <Select
            label={t('grades.chooseTerm')}
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            placeholder={t('common.select')}
            options={terms.map((tm) => ({ value: tm.id, label: localName(tm as unknown as Record<string, unknown>, lang) }))}
          />
        </div>
        <StatusPill tone={saveState === 'saving' ? 'amber' : saveState === 'saved' ? 'green' : 'grey'}>
          {saveState === 'saving' ? t('common.saving') : saveState === 'saved' ? t('common.saved') : t('common.autoSaved')}
        </StatusPill>
      </FilterBar>

      {loading && !grid ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !grid?.length ? (
        <Card><EmptyState icon={<ClipboardList size={44} />} title={t('attendance.emptyTitle')} body={t('attendance.emptyBody')} /></Card>
      ) : (
        <Card padded={false}>
          <p className="border-b p-4 text-sm text-ink-500 dark:text-ink-300" style={{ borderColor: 'var(--app-border)' }}>
            {t('grades.gridHelp')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="sticky start-0 surface p-3 text-start text-sm font-bold" style={{ minWidth: '13rem' }}>
                    {t('common.student')}
                  </th>
                  {(subjects ?? []).map((s) => (
                    <th key={s.id} className="p-3 text-center text-sm font-bold" style={{ minWidth: '6.5rem' }}>
                      {localName(s as unknown as Record<string, unknown>, lang)}
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-bold">{t('common.total')}</th>
                  <th className="p-3 text-center text-sm font-bold">{t('common.rank')}</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.student_id} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    <td className="sticky start-0 surface p-3">
                      <span className="block truncate font-semibold">
                        {lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name}
                      </span>
                      <span className="block truncate text-xs text-ink-500 dark:text-ink-300">{row.student_code}</span>
                    </td>
                    {(subjects ?? []).map((s) => (
                      <td key={s.id} className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          value={valueOf(row.student_id, s.id)}
                          onChange={(e) => setCell(row.student_id, s.id, e.target.value)}
                          aria-label={`${row.full_name} — ${s.name}`}
                          className="surface h-12 w-full rounded-lg border text-center text-lg font-semibold focus-ring"
                        />
                      </td>
                    ))}
                    <td className="p-3 text-center font-bold">
                      {row.maxTotal ? `${formatNumber(row.percent, lang, numerals)}%` : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {row.rank ? <StatusPill tone={row.rank <= 3 ? 'green' : 'grey'}>{formatNumber(row.rank, lang, numerals)}</StatusPill> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function ReportCards({ terms }: { terms: ExamTerm[] }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const toast = useApp((s) => s.toast)
  const { context, print, savePdf } = usePrinting()

  const [sectionId, setSectionId] = useState('')
  const [termId, setTermId] = useState('')
  const [preview, setPreview] = useState<ReportCardData | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: sections } = useAsync(() => api.sections.list(), [])
  const { data: grid, loading } = useAsync(
    () => (sectionId && termId ? api.grades.grid(Number(sectionId), Number(termId)) : Promise.resolve([])),
    [sectionId, termId]
  )

  useEffect(() => {
    if (sections?.length && !sectionId) setSectionId(String(sections[0].id))
    if (terms.length && !termId) setTermId(String(terms[0].id))
  }, [sections, terms, sectionId, termId])

  const openPreview = async (studentId: number) => {
    try {
      const data = await api.grades.reportCard(studentId, Number(termId))
      setPreview(data)
      setRemarks(data.teacherRemarks ?? '')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const printOne = async (studentId: number) => {
    const data = await api.grades.reportCard(studentId, Number(termId))
    await print(reportCardHtml(data, await context()))
  }

  const printAll = async () => {
    if (!grid?.length) return
    setBusy(true)
    try {
      const cards = await Promise.all(grid.map((r) => api.grades.reportCard(r.student_id, Number(termId))))
      await print(reportCardsHtml(cards, await context()))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!terms.length) {
    return <Card><EmptyState icon={<FileText size={44} />} title={t('grades.emptyTitle')} body={t('grades.emptyBody')} /></Card>
  }

  return (
    <div>
      <FilterBar>
        <div className="min-w-[14rem] flex-1">
          <Select
            label={t('grades.chooseClass')}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder={t('common.select')}
            options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
          />
        </div>
        <div className="min-w-[14rem] flex-1">
          <Select
            label={t('grades.chooseTerm')}
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            placeholder={t('common.select')}
            options={terms.map((tm) => ({ value: tm.id, label: localName(tm as unknown as Record<string, unknown>, lang) }))}
          />
        </div>
        <Button size="lg" variant="primary" loading={busy} disabled={!grid?.length} onClick={() => void printAll()} icon={<Printer size={20} />}>
          {t('grades.printAllReportCards')}
        </Button>
      </FilterBar>

      {loading && !grid ? (
        <Loading />
      ) : !grid?.length ? (
        <Card><EmptyState icon={<FileText size={44} />} title={t('attendance.emptyTitle')} /></Card>
      ) : (
        <Card padded={false}>
          <ul>
            {grid.map((row) => (
              <li key={row.student_id} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block truncate font-semibold">{lang === 'ar' && row.full_name_ar ? row.full_name_ar : row.full_name}</span>
                  <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{row.student_code}</span>
                </span>
                <StatusPill tone={row.percent >= 50 ? 'green' : 'red'}>
                  {row.maxTotal ? `${formatNumber(row.percent, lang, numerals)}%` : t('grades.noGradesYet')}
                </StatusPill>
                {row.rank > 0 && <StatusPill tone="blue">{t('common.rank')}: {formatNumber(row.rank, lang, numerals)}</StatusPill>}
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => void openPreview(row.student_id)} icon={<Pencil size={16} />}>{t('grades.teacherRemarks')}</Button>
                  <Button size="sm" variant="primary" onClick={() => void printOne(row.student_id)} icon={<Printer size={16} />}>{t('common.print')}</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={t('grades.reportCard')}
          subtitle={preview.student.full_name}
          size="lg"
          footer={
            <>
              <Button size="lg" onClick={() => setPreview(null)}>{t('common.close')}</Button>
              <Button
                size="lg"
                onClick={async () => {
                  await savePdf(reportCardHtml({ ...preview, teacherRemarks: remarks }, await context()), `report-card-${preview.student.student_code}.pdf`)
                }}
              >
                {t('common.savePdf')}
              </Button>
              <Button
                size="lg"
                variant="primary"
                onClick={async () => {
                  await api.grades.saveRemarks(preview.student.id, preview.term.id, remarks)
                  await print(reportCardHtml({ ...preview, teacherRemarks: remarks }, await context()))
                  setPreview(null)
                }}
                icon={<Printer size={18} />}
              >
                {t('grades.printReportCard')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="p-2 text-start text-sm font-bold">{t('common.subject')}</th>
                  <th className="p-2 text-end text-sm font-bold">{t('grades.score')}</th>
                  <th className="p-2 text-end text-sm font-bold">{t('common.percent')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    <td className="p-2">{lang === 'ar' && r.subject_ar ? r.subject_ar : r.subject}</td>
                    <td className="p-2 text-end" dir="ltr">{r.score ?? '—'} / {r.max_score}</td>
                    <td className="p-2 text-end" dir="ltr">{r.score !== null ? `${((r.score / r.max_score) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-3">
              <StatusPill tone="blue">{t('common.total')}: {preview.total} / {preview.maxTotal}</StatusPill>
              <StatusPill tone="green">{t('grades.grade')}: {preview.gradeLabel}</StatusPill>
              {preview.rank > 0 && <StatusPill tone="violet">{t('common.rank')}: {preview.rank} / {preview.classSize}</StatusPill>}
              <StatusPill tone="amber">{t('students.attendanceRate')}: {preview.attendancePercent}%</StatusPill>
            </div>
            <TextArea
              label={t('grades.teacherRemarks')}
              placeholder={t('grades.remarksPlaceholder')}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

function ExamTerms({ terms, onChange }: { terms: ExamTerm[]; onChange: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [editing, setEditing] = useState<ExamTerm | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ExamTerm | null>(null)

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('grades.addTerm')}</Button>
      </div>
      <Card padded={false}>
        {!terms.length ? (
          <EmptyState icon={<ClipboardList size={44} />} title={t('grades.emptyTitle')} body={t('grades.emptyBody')} />
        ) : (
          <ul>
            {terms.map((term) => (
              <li key={term.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-bold">{localName(term as unknown as Record<string, unknown>, lang)}</span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">
                    {term.start_date ?? '—'} → {term.end_date ?? '—'}
                  </span>
                </span>
                <Button size="sm" onClick={() => setEditing(term)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(term)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <TermEditor
          term={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); onChange(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting ? localName(deleting as unknown as Record<string, unknown>, lang) : '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.terms.remove(deleting.id)
            onChange()
            touch()
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

function TermEditor({ term, onClose, onSaved }: { term: ExamTerm | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [name, setName] = useState(term?.name ?? '')
  const [nameAr, setNameAr] = useState(term?.name_ar ?? '')
  const [start, setStart] = useState(term?.start_date ?? '')
  const [end, setEnd] = useState(term?.end_date ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={term ? t('common.edit') : t('grades.addTerm')}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!name.trim()}
            onClick={async () => {
              try {
                await api.terms.save({ ...(term ? { id: term.id } : {}), name, name_ar: nameAr || null, start_date: start || null, end_date: end || null })
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
        <TextInput label={t('common.nameEnglish')} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextInput label={t('common.nameArabic')} dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('common.from')} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <TextInput label={t('common.to')} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
