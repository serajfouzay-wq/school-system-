import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TimetableEntry } from '@shared/types'
import { useLang, useNumerals } from '@/store/app'
import { toNumerals } from '@/lib/format'

const DAYS = [0, 1, 2, 3, 4]

export interface Period { start_time: string; end_time: string }

/**
 * The weekly grid. Lessons are draggable; empty boxes are clickable. It renders
 * identically in Arabic because the table itself mirrors with the document.
 */
export function TimetableGrid({
  entries, periods, readOnly, showSection, onCellClick, onEntryClick, onMove, onDelete,
}: {
  entries: TimetableEntry[]
  periods: Period[]
  readOnly?: boolean
  showSection?: boolean
  onCellClick?: (day: number, period: Period) => void
  onEntryClick?: (entry: TimetableEntry) => void
  onMove?: (entry: TimetableEntry, day: number, period: Period) => void
  onDelete?: (entry: TimetableEntry) => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()

  const at = (day: number, period: Period) =>
    entries.find((e) => e.day_of_week === day && e.start_time === period.start_time)

  const handleDrop = (e: React.DragEvent, day: number, period: Period) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    const entry = entries.find((x) => x.id === id)
    if (entry && onMove) onMove(entry, day, period)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse">
        <thead>
          <tr>
            <th className="border p-2 text-sm font-bold" style={{ borderColor: 'var(--app-border)', width: '9rem' }}>
              {t('common.time')}
            </th>
            {DAYS.map((d) => (
              <th key={d} className="border p-2 text-sm font-bold" style={{ borderColor: 'var(--app-border)' }}>
                {t(`days.${d}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.start_time}>
              <th
                className="border p-2 text-center text-sm font-semibold"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <span dir="ltr" className="whitespace-nowrap">
                  {toNumerals(period.start_time, numerals)}
                  <br />
                  {toNumerals(period.end_time, numerals)}
                </span>
              </th>
              {DAYS.map((day) => {
                const entry = at(day, period)
                return (
                  <td
                    key={day}
                    className="border p-1 align-top"
                    style={{ borderColor: 'var(--app-border)', height: '4.75rem' }}
                    onDragOver={(e) => { if (!readOnly && onMove) e.preventDefault() }}
                    onDrop={(e) => !readOnly && handleDrop(e, day, period)}
                  >
                    {entry ? (
                      <div
                        draggable={!readOnly && !!onMove}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(entry.id))}
                        onClick={() => !readOnly && onEntryClick?.(entry)}
                        className={[
                          'group relative h-full rounded-lg border-2 border-brand-300 bg-brand-50 p-2 text-start dark:border-brand-800 dark:bg-brand-950',
                          readOnly ? '' : 'cursor-grab active:cursor-grabbing hover:border-brand-500',
                        ].join(' ')}
                      >
                        <p className="truncate text-sm font-bold">
                          {lang === 'ar' && entry.subject_name_ar ? entry.subject_name_ar : entry.subject_name}
                        </p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-300">
                          {showSection ? entry.section_label : entry.staff_name ?? ''}
                        </p>
                        {entry.room && <p className="truncate text-xs text-ink-400">{entry.room}</p>}
                        {!readOnly && onDelete && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(entry) }}
                            aria-label={t('common.delete')}
                            className="absolute end-1 top-1 hidden h-7 w-7 place-items-center rounded-lg bg-white/90 text-rose-600 group-hover:grid focus-ring dark:bg-ink-900"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ) : readOnly ? (
                      <span className="grid h-full place-items-center text-sm text-ink-300">{t('timetable.free')}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCellClick?.(day, period)}
                        className="grid h-full w-full place-items-center rounded-lg border-2 border-dashed text-ink-400 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 focus-ring dark:hover:bg-ink-800"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
