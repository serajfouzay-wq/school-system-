import { ChevronLeft, ChevronRight, Check, X, Clock, FileCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AttendanceStatus } from '@shared/types'
import { useLang, useNumerals } from '@/store/app'
import { toNumerals } from '@/lib/format'

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; icon: React.ReactNode; labelKey: string }> = {
  present: { bg: 'bg-emerald-500 text-white', icon: <Check size={14} />, labelKey: 'attendance.present' },
  absent: { bg: 'bg-rose-500 text-white', icon: <X size={14} />, labelKey: 'attendance.absent' },
  late: { bg: 'bg-amber-500 text-white', icon: <Clock size={14} />, labelKey: 'attendance.late' },
  excused: { bg: 'bg-brand-500 text-white', icon: <FileCheck size={14} />, labelKey: 'attendance.excused' },
}

/**
 * Colour-coded month grid. Colour is never the only signal — every marked day
 * also carries an icon, for colour-blind users.
 */
export function AttendanceCalendar({
  month, onMonthChange, days,
}: {
  month: string
  onMonthChange: (month: string) => void
  days: { date: string; status: AttendanceStatus }[]
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()

  const [year, monthNum] = month.split('-').map(Number)
  const first = new Date(year, monthNum - 1, 1)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const leading = first.getDay()
  const byDate = new Map(days.map((d) => [d.date, d.status]))

  const shift = (delta: number) => {
    const d = new Date(year, monthNum - 1 + delta, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LY' : 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(first)

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LY' : 'en-GB', { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t('common.back')}
          className="grid h-10 w-10 place-items-center rounded-xl border surface hover:bg-ink-50 focus-ring dark:hover:bg-ink-800"
        >
          <ChevronLeft size={20} className="flip-rtl" />
        </button>
        <p className="font-bold">{toNumerals(monthLabel, numerals)}</p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t('common.next')}
          className="grid h-10 w-10 place-items-center rounded-xl border surface hover:bg-ink-50 focus-ring dark:hover:bg-ink-800"
        >
          <ChevronRight size={20} className="flip-rtl" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekdayNames.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-bold text-ink-500 dark:text-ink-300">{w}</div>
        ))}
        {Array.from({ length: leading }).map((_, i) => <div key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const iso = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const status = byDate.get(iso)
          const style = status ? STATUS_STYLE[status] : null
          return (
            <div
              key={iso}
              title={status ? t(STATUS_STYLE[status].labelKey) : undefined}
              className={[
                'grid aspect-square place-items-center rounded-lg border text-sm font-semibold',
                style ? `${style.bg} border-transparent` : 'surface',
              ].join(' ')}
            >
              <span className="flex flex-col items-center leading-none">
                <span>{toNumerals(day, numerals)}</span>
                {style && <span className="mt-0.5">{style.icon}</span>}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {(Object.keys(STATUS_STYLE) as AttendanceStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`grid h-5 w-5 place-items-center rounded ${STATUS_STYLE[s].bg}`}>{STATUS_STYLE[s].icon}</span>
            {t(STATUS_STYLE[s].labelKey)}
          </span>
        ))}
      </div>
    </div>
  )
}

export { STATUS_STYLE }
