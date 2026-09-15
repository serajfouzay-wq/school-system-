import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

export interface WizardStep {
  title: ReactNode
  subtitle?: ReactNode
  content: ReactNode
  /** Blocks "Next" until the step has what it needs. */
  canContinue?: boolean
}

/**
 * Long tasks are broken into short steps with a visible progress bar, never one
 * giant form (design rule 3).
 */
export function Wizard({
  steps, current, onStepChange, onFinish, finishLabel, onCancel, busy,
}: {
  steps: WizardStep[]
  current: number
  onStepChange: (index: number) => void
  onFinish: () => void
  finishLabel?: ReactNode
  onCancel?: () => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  const step = steps[current]
  const isLast = current === steps.length - 1
  const progress = ((current + 1) / steps.length) * 100

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-600">
            {t('common.step', { current: current + 1, total: steps.length })}
          </p>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i < current ? 'bg-brand-600' : i === current ? 'bg-brand-400' : 'bg-ink-200 dark:bg-ink-700'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ inlineSize: `${progress}%` }}
            role="progressbar"
            aria-valuenow={current + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          />
        </div>
      </div>

      <div className="mb-5">
        <h2 className="text-2xl font-bold">{step.title}</h2>
        {step.subtitle && <p className="mt-1.5 text-base text-ink-500 dark:text-ink-300">{step.subtitle}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">{step.content}</div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-5" style={{ borderColor: 'var(--app-border)' }}>
        {current > 0 ? (
          <Button size="lg" onClick={() => onStepChange(current - 1)} icon={<ChevronLeft size={20} className="flip-rtl" />}>
            {t('common.back')}
          </Button>
        ) : (
          <span>{onCancel && <Button size="lg" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>}</span>
        )}

        {isLast ? (
          <Button
            size="lg"
            variant="success"
            onClick={onFinish}
            loading={busy}
            disabled={step.canContinue === false}
            icon={<Check size={20} />}
          >
            {finishLabel ?? t('common.finish')}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="primary"
            onClick={() => onStepChange(current + 1)}
            disabled={step.canContinue === false}
            icon={<ChevronRight size={20} className="flip-rtl" />}
          >
            {t('common.next')}
          </Button>
        )}
      </div>
    </div>
  )
}
