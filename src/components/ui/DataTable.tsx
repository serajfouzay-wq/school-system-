import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Value used for sorting and CSV export. */
  value?: (row: T) => string | number | null
  render?: (row: T) => ReactNode
  align?: 'start' | 'end' | 'center'
  width?: string
  sortable?: boolean
  /** Hidden on screen but still exported (e.g. raw IDs). */
  exportOnly?: boolean
}

/**
 * Tables use logical alignment (`text-start` / `text-end`) throughout, so the
 * whole grid mirrors automatically in Arabic without any RTL-specific code.
 */
export function DataTable<T extends { id: number }>({
  columns, rows, onRowClick, selectable, selected, onSelectedChange, emptyState, rowKey,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  selectable?: boolean
  selected?: number[]
  onSelectedChange?: (ids: number[]) => void
  emptyState?: ReactNode
  rowKey?: (row: T) => string | number
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const visible = columns.filter((c) => !c.exportOnly)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.value) return rows
    return [...rows].sort((a, b) => {
      const av = col.value!(a)
      const bv = col.value!(b)
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
      // Arabic sorts correctly with a locale-aware comparison.
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sort.dir
    })
  }, [rows, sort, columns])

  const allSelected = selectable && rows.length > 0 && selected?.length === rows.length

  if (!rows.length && emptyState) return <>{emptyState}</>

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="border-b text-sm" style={{ borderColor: 'var(--app-border)' }}>
            {selectable && (
              <th className="w-12 p-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-600"
                  checked={!!allSelected}
                  onChange={(e) => onSelectedChange?.(e.target.checked ? rows.map((r) => r.id) : [])}
                  aria-label="Select all"
                />
              </th>
            )}
            {visible.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`p-3 font-bold text-ink-500 dark:text-ink-300 text-${col.align ?? 'start'}`}
              >
                {col.sortable && col.value ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded focus-ring hover:text-brand-600"
                    onClick={() =>
                      setSort((s) => (s?.key === col.key ? { key: col.key, dir: s.dir === 1 ? -1 : 1 } : { key: col.key, dir: 1 }))
                    }
                  >
                    {col.header}
                    <ArrowUpDown size={14} className={sort?.key === col.key ? 'text-brand-600' : 'opacity-40'} />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey ? rowKey(row) : row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b last:border-0',
                onRowClick ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-ink-800' : '',
              ].join(' ')}
              style={{ borderColor: 'var(--app-border)' }}
            >
              {selectable && (
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-600"
                    checked={selected?.includes(row.id) ?? false}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...(selected ?? []), row.id]
                        : (selected ?? []).filter((id) => id !== row.id)
                      onSelectedChange?.(next)
                    }}
                    aria-label={`Select row ${row.id}`}
                  />
                </td>
              )}
              {visible.map((col) => (
                <td key={col.key} className={`p-3 text-${col.align ?? 'start'}`}>
                  {col.render ? col.render(row) : String(col.value?.(row) ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Turns table columns into the shape the CSV exporter expects. */
export function columnsToExport<T extends { id: number }>(
  columns: Column<T>[],
  rows: T[],
  headerText: (c: Column<T>) => string
): { columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } {
  const usable = columns.filter((c) => c.value)
  return {
    columns: usable.map((c) => ({ key: c.key, label: headerText(c) })),
    rows: rows.map((r) => Object.fromEntries(usable.map((c) => [c.key, c.value!(r)]))),
  }
}
