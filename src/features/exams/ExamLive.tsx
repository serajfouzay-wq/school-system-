import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Play, Square, Users, CheckCircle2, AlertTriangle, Send, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import type { Exam, ExamAttempt, AttemptDetail, ServerStatus } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, Loading, StatusPill } from '@/components/ui/Feedback'
import { formatPercent } from '@/lib/format'

/**
 * The teacher's view while an exam is running: the code to read out, the
 * address to write on the board, and who has handed in — refreshed as it goes.
 */
export function ExamLive({ exam, onBack }: { exam: Exam; onBack: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [session, setSession] = useState<{ id: number; join_code: string } | null>(null)
  const [server, setServer] = useState<ServerStatus | null>(null)
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [busy, setBusy] = useState(false)
  const qrRef = useRef<HTMLCanvasElement>(null)

  const { data: existing } = useAsync(() => api.exams.activeSession(exam.id), [exam.id])
  const { data: serverStatus } = useAsync(() => api.examServer.status(), [])

  useEffect(() => { if (existing) setSession(existing) }, [existing])
  useEffect(() => { if (serverStatus) setServer(serverStatus) }, [serverStatus])

  // While the exam runs, the list refreshes by itself so the teacher never
  // has to think about pressing anything.
  useEffect(() => {
    if (!session) return
    let alive = true
    const load = () => {
      api.exams.attempts(session.id).then((rows) => { if (alive) setAttempts(rows) }).catch(() => {})
    }
    load()
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [session])

  useEffect(() => {
    if (!server?.url || !qrRef.current) return
    QRCode.toCanvas(qrRef.current, server.url, { width: 190, margin: 1 }).catch(() => {})
  }, [server?.url, session])

  const start = async () => {
    setBusy(true)
    try {
      const res = await api.exams.openSession(exam.id)
      setSession(res.session)
      setServer(res.server)
      if (!res.server.addresses.length) toast(t('exams.noNetwork'), 'error')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (!session) return
    setConfirmStop(false)
    try {
      await api.exams.closeSession(session.id)
      const rows = await api.exams.attempts(session.id)
      setAttempts(rows)
      setSession(null)
      await api.examServer.stop()
      setServer(await api.examServer.status())
      touch()
      toast(t('exams.statusClosed'), 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const push = async () => {
    if (!session && !attempts.length) return
    try {
      const sessionId = session?.id ?? 0
      const res = await api.exams.pushToGrades(sessionId)
      touch()
      toast(
        `${t('exams.pushed', { count: res.pushed })}${res.skipped ? ` · ${t('exams.pushedSkipped', { count: res.skipped })}` : ''}`,
        'success'
      )
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const submitted = attempts.filter((a) => a.submitted_at)
  const writing = attempts.filter((a) => !a.submitted_at)
  const needReview = submitted.filter((a) => a.needs_review)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBack}>{t('common.back')}</Button>
        {session ? (
          <Button size="lg" variant="danger" onClick={() => setConfirmStop(true)} icon={<Square size={20} />}>
            {t('exams.stopExam')}
          </Button>
        ) : (
          <Button size="lg" variant="success" loading={busy} onClick={() => void start()} icon={<Play size={20} />}>
            {t('exams.startExam')}
          </Button>
        )}
      </div>

      {session && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>{t('exams.joinCode')}</CardTitle>
            <p className="mb-3 text-sm text-ink-500 dark:text-ink-300">{t('exams.joinCodeHelp')}</p>
            <div
              className="rounded-2xl border-2 border-brand-300 bg-brand-50 py-6 text-center dark:border-brand-800 dark:bg-brand-950"
              dir="ltr"
            >
              <span className="text-6xl font-extrabold tracking-[0.2em] text-brand-700 dark:text-brand-200">
                {session.join_code}
              </span>
            </div>
          </Card>

          <Card>
            <CardTitle>{t('exams.address')}</CardTitle>
            <p className="mb-3 text-sm text-ink-500 dark:text-ink-300">{t('exams.addressHelp')}</p>
            {server?.url ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-xl bg-white p-2">
                  <canvas ref={qrRef} />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Wifi size={18} /> {t('exams.live')}
                  </p>
                  <p className="mt-1 break-all text-2xl font-bold" dir="ltr">{server.url}</p>
                  <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{t('exams.scanMe')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <WifiOff size={22} className="shrink-0 text-amber-600" />
                <p>{t('exams.noNetwork')}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-bold">{session ? t('exams.whoJoined') : t('exams.results')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="blue" icon={<Users size={16} />}>{attempts.length}</StatusPill>
            {!!writing.length && <StatusPill tone="amber">{t('exams.waiting')}: {writing.length}</StatusPill>}
            <StatusPill tone="green" icon={<CheckCircle2 size={16} />}>{t('exams.handedIn')}: {submitted.length}</StatusPill>
            {!!needReview.length && (
              <StatusPill tone="red" icon={<AlertTriangle size={16} />}>{t('exams.needsReview')}: {needReview.length}</StatusPill>
            )}
            {!!submitted.length && (
              <Button size="sm" variant="primary" onClick={() => void push()} icon={<Send size={16} />}>
                {t('exams.sendToReportCards')}
              </Button>
            )}
          </div>
        </div>

        {!attempts.length ? (
          <EmptyState icon={<Users size={44} />} title={t('exams.noOneYet')} body={session ? t('exams.joinCodeHelp') : undefined} />
        ) : (
          <ul>
            {attempts.map((a) => {
              const name = lang === 'ar' && a.full_name_ar ? a.full_name_ar : a.full_name
              const pct = a.max_score ? ((a.score ?? 0) / a.max_score) * 100 : 0
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="min-w-[10rem] flex-1">
                    <span className="block font-semibold">{name}</span>
                    <span className="block text-sm text-ink-500 dark:text-ink-300">{a.student_code}</span>
                  </span>
                  {!a.submitted_at ? (
                    <StatusPill tone="amber">{t('exams.waiting')}</StatusPill>
                  ) : (
                    <>
                      <StatusPill tone={a.needs_review ? 'red' : pct >= 50 ? 'green' : 'grey'}>
                        {a.score ?? 0} / {a.max_score ?? 0}
                      </StatusPill>
                      {!a.needs_review && <StatusPill tone="blue">{formatPercent(pct)}</StatusPill>}
                      {!!a.pushed_to_grades && <StatusPill tone="violet">{t('exams.sendToReportCards')} ✓</StatusPill>}
                      <Button size="sm" onClick={() => setReviewing(a.id)}>
                        {a.needs_review ? t('exams.reviewAnswers') : t('common.open')}
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {reviewing !== null && (
        <ReviewDialog
          attemptId={reviewing}
          onClose={() => setReviewing(null)}
          onChanged={() => { if (session) api.exams.attempts(session.id).then(setAttempts).catch(() => {}) }}
        />
      )}

      <ConfirmDialog
        open={confirmStop}
        title={t('exams.stopExam')}
        body={t('exams.stopConfirm')}
        confirmLabel={t('exams.stopExam')}
        onConfirm={() => void stop()}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  )
}

/** Marking the written answers the program would only be guessing at. */
function ReviewDialog({
  attemptId, onClose, onChanged,
}: {
  attemptId: number
  onClose: () => void
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<AttemptDetail | null>(null)

  const load = () => { api.exams.attemptDetail(attemptId).then(setDetail).catch(() => {}) }
  useEffect(load, [attemptId])

  const mark = async (answerId: number, correct: boolean) => {
    await api.exams.overrideAnswer(answerId, correct)
    load()
    onChanged()
  }

  if (!detail) {
    return <Modal open onClose={onClose} title={t('app.loading')} size="lg"><Loading /></Modal>
  }

  const attempt = detail.attempt as Record<string, unknown>

  return (
    <Modal
      open
      onClose={onClose}
      title={String(attempt.full_name ?? '')}
      subtitle={`${attempt.score ?? 0} / ${attempt.max_score ?? 0}`}
      size="lg"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.close')}</Button>
          <Button size="lg" onClick={() => { void api.exams.remark(attemptId).then(load).then(onChanged) }} icon={<RefreshCw size={18} />}>
            {t('exams.autoMarked')}
          </Button>
        </>
      }
    >
      <ol className="space-y-4">
        {detail.answers.map((a, i) => {
          const given =
            a.kind === 'mcq' ? a.options[Number(a.answer)] ?? '—'
            : a.kind === 'truefalse' ? (a.answer === 'true' ? t('exams.trueLabel') : a.answer === 'false' ? t('exams.falseLabel') : '—')
            : a.answer || '—'
          return (
            <li key={a.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--app-border)' }}>
              <p className="font-semibold">{i + 1}. {a.text}</p>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">{t('exams.studentWrote')}</p>
              <p className="rounded-lg bg-ink-50 p-2 dark:bg-ink-800">{given}</p>
              {a.kind === 'short' && (
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">{t('exams.expected')}: {a.correct}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {a.is_correct === null ? (
                  <StatusPill tone="amber" icon={<AlertTriangle size={16} />}>{t('exams.needsReview')}</StatusPill>
                ) : (
                  <StatusPill tone={a.is_correct ? 'green' : 'red'}>
                    {a.awarded_marks} / {a.marks}
                  </StatusPill>
                )}
                <Button size="sm" variant={a.is_correct === true ? 'success' : 'secondary'} onClick={() => void mark(a.id, true)}>
                  {t('exams.markCorrectBtn')}
                </Button>
                <Button size="sm" variant={a.is_correct === false ? 'danger' : 'secondary'} onClick={() => void mark(a.id, false)}>
                  {t('exams.markWrongBtn')}
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
