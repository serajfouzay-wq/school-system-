import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Undo2, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { Button } from './Button'

/** Toasts sit bottom-centre and carry the Undo offer (design rule 8). */
export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  const { t } = useTranslation()

  if (!toasts.length) return null

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
  }
  const tones = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-ink-800 text-white',
  }

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex max-w-2xl items-center gap-3 rounded-2xl px-5 py-3 shadow-lift ${tones[toast.tone]}`}
        >
          {icons[toast.tone]}
          <span className="font-medium">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => { void toast.action?.run(); dismiss(toast.id) }}
              className="ms-2 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 font-bold hover:bg-white/30 focus-ring"
            >
              <Undo2 size={16} className="flip-rtl" />
              {toast.action.label ?? t('common.undo')}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/** Never show a blank screen: say what this screen is for and offer the action. */
export function EmptyState({
  title, body, action, icon,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-950">
        {icon ?? <Inbox size={44} strokeWidth={1.5} />}
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      {body && <p className="max-w-md text-base text-ink-500 dark:text-ink-300">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Loading({ label }: { label?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-500 dark:text-ink-300">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-base">{label ?? t('app.loading')}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950">
        <AlertCircle size={38} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold">{t('common.somethingWentWrong')}</h3>
      <p className="max-w-md text-ink-500 dark:text-ink-300">{message}</p>
      {onRetry && <Button variant="primary" onClick={onRetry}>{t('common.tryAgain')}</Button>}
    </div>
  )
}

/** Status is never colour alone — each pill carries a word and a shape. */
export function StatusPill({
  tone, children, icon,
}: {
  tone: 'green' | 'red' | 'amber' | 'blue' | 'grey' | 'violet'
  children: ReactNode
  icon?: ReactNode
}) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
    red: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    amber: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    blue: 'bg-brand-100 text-brand-800 border-brand-300 dark:bg-brand-950 dark:text-brand-200 dark:border-brand-800',
    violet: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800',
    grey: 'bg-ink-100 text-ink-700 border-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-600',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  )
}
