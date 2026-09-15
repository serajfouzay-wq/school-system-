import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { Button } from './Button'

export interface TourTip { title: ReactNode; body: ReactNode }

/**
 * A short guided tour shown the first time someone opens a module. It stores a
 * flag per module so it never nags after the first visit.
 */
export function ModuleTour({ moduleKey, tips }: { moduleKey: string; tips: TourTip[] }) {
  const { t } = useTranslation()
  const preferences = useApp((s) => s.preferences)
  const setPreference = useApp((s) => s.setPreference)
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const flag = `tour_seen_${moduleKey}`

  useEffect(() => {
    if (preferences[flag] !== 'yes' && tips.length) setOpen(true)
  }, [flag, preferences, tips.length])

  if (!open || !tips.length) return null
  const tip = tips[Math.min(index, tips.length - 1)]
  const isLast = index >= tips.length - 1

  const finish = () => {
    setOpen(false)
    void setPreference(flag, 'yes')
  }

  return (
    <div className="no-print mb-5 flex flex-wrap items-start gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Lightbulb size={22} />
      </span>
      <div className="min-w-[16rem] flex-1">
        <p className="font-bold">{tip.title}</p>
        <p className="mt-1 text-base text-ink-600 dark:text-ink-200">{tip.body}</p>
      </div>
      <div className="flex items-center gap-2">
        {tips.length > 1 && (
          <span className="text-sm font-semibold text-ink-500 dark:text-ink-300">
            {index + 1} {t('common.of')} {tips.length}
          </span>
        )}
        {isLast ? (
          <Button variant="primary" onClick={finish}>{t('common.gotIt')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={finish}>{t('common.skip')}</Button>
            <Button variant="primary" onClick={() => setIndex((i) => i + 1)}>{t('help.tourNext')}</Button>
          </>
        )}
      </div>
    </div>
  )
}
