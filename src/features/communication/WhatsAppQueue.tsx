import { useEffect, useState } from 'react'
import { MessageCircle, Send, SkipForward, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useApp, useLang } from '@/store/app'
import type { MessagePurpose, PreparedMessage, Recipient } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Loading, StatusPill, EmptyState } from '@/components/ui/Feedback'

/**
 * WhatsApp does not let a program send on your behalf without a paid business
 * account, so this prepares each message and opens WhatsApp with it ready —
 * the user presses send there. The queue keeps track of who is done, which is
 * the part that is genuinely tedious by hand.
 */
export function WhatsAppQueue({
  recipients, purpose, open, onClose, customBody,
}: {
  recipients: Recipient[]
  purpose: MessagePurpose
  open: boolean
  onClose: () => void
  customBody?: string
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)

  const [messages, setMessages] = useState<PreparedMessage[] | null>(null)
  const [sent, setSent] = useState<number[]>([])
  const [skipped, setSkipped] = useState<number[]>([])
  const [custom, setCustom] = useState(customBody ?? '')

  useEffect(() => {
    if (!open) return
    let alive = true
    setMessages(null)
    api.whatsapp
      .prepare(recipients, purpose, lang, purpose === 'custom' ? { message: custom } : {})
      .then((m) => { if (alive) setMessages(m) })
      .catch((e: Error) => toast(e.message, 'error'))
    return () => { alive = false }
    // `custom` intentionally excluded: retyping should not re-fetch on each key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipients, purpose, lang])

  useEffect(() => {
    if (!open) return
    api.whatsapp.contactedToday(purpose).then(setSent).catch(() => {})
  }, [open, purpose])

  const send = async (m: PreparedMessage) => {
    try {
      await api.whatsapp.send(m, purpose)
      setSent((s) => [...s, m.student_id])
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const refreshCustom = async () => {
    const m = await api.whatsapp.prepare(recipients, 'custom', lang, { message: custom })
    setMessages(m)
  }

  const sendable = (messages ?? []).filter((m) => m.link)
  const broken = (messages ?? []).filter((m) => !m.link)
  const remaining = sendable.filter((m) => !sent.includes(m.student_id) && !skipped.includes(m.student_id))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('whatsapp.queueTitle')}
      subtitle={t(`whatsapp.purpose${purpose.charAt(0).toUpperCase()}${purpose.slice(1)}`)}
      size="lg"
      footer={<Button size="lg" onClick={onClose}>{t('common.close')}</Button>}
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950">
        <Info size={20} className="mt-0.5 shrink-0 text-brand-600" />
        <div>
          <p className="font-bold">{t('whatsapp.howItWorks')}</p>
          <p className="text-sm">{t('whatsapp.howItWorksBody')}</p>
        </div>
      </div>

      {purpose === 'custom' && (
        <div className="mb-4">
          <TextArea
            label={t('whatsapp.yourMessage')}
            rows={3}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => void refreshCustom()}
          />
        </div>
      )}

      {!messages ? (
        <Loading />
      ) : !messages.length ? (
        <EmptyState icon={<MessageCircle size={40} />} title={t('common.nothingHereYet')} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusPill tone="blue">{t('whatsapp.readyCount', { count: remaining.length })}</StatusPill>
            <StatusPill tone="green" icon={<CheckCircle2 size={16} />}>{sent.length}</StatusPill>
            {!!broken.length && (
              <StatusPill tone="amber" icon={<AlertTriangle size={16} />}>
                {t('whatsapp.problemCount', { count: broken.length })}
              </StatusPill>
            )}
          </div>

          <ul className="space-y-2">
            {messages.map((m) => {
              const isSent = sent.includes(m.student_id)
              const isSkipped = skipped.includes(m.student_id)
              return (
                <li
                  key={m.student_id}
                  className={`rounded-xl border p-3 ${isSent ? 'opacity-60' : ''}`}
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-[9rem] flex-1">
                      <span className="block font-semibold">{m.student_name}</span>
                      <span className="block text-sm text-ink-500 dark:text-ink-300" dir="ltr">
                        {m.phone ? `+${m.phone}` : t('whatsapp.noPhone')}
                      </span>
                    </span>
                    {!m.link ? (
                      <StatusPill tone="amber">{t('whatsapp.noPhoneBody')}</StatusPill>
                    ) : isSent ? (
                      <StatusPill tone="green" icon={<CheckCircle2 size={16} />}>{t('whatsapp.markSent')}</StatusPill>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setSkipped((s) => [...s, m.student_id])} icon={<SkipForward size={16} />}>
                          {t('whatsapp.skip')}
                        </Button>
                        <Button size="sm" variant="success" onClick={() => void send(m)} icon={<Send size={16} />}>
                          {t('whatsapp.send')}
                        </Button>
                      </>
                    )}
                  </div>
                  {!isSkipped && (
                    <p className="mt-2 rounded-lg bg-ink-50 p-2 text-sm dark:bg-ink-800">{m.body}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Modal>
  )
}

/** A single green WhatsApp button, for one parent. */
export function WhatsAppButton({
  studentId, purpose = 'custom', size = 'sm', label,
}: {
  studentId: number
  purpose?: MessagePurpose
  size?: 'sm' | 'md' | 'lg'
  label?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const toast = useApp((s) => s.toast)

  const start = async () => {
    try {
      setRecipient(await api.whatsapp.oneStudent(studentId))
      setOpen(true)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <>
      <Button size={size} variant="success" onClick={() => void start()} icon={<MessageCircle size={16} />}>
        {label ?? t('whatsapp.send')}
      </Button>
      {open && recipient && (
        <WhatsAppQueue recipients={[recipient]} purpose={purpose} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
