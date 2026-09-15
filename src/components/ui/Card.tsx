import type { ReactNode } from 'react'

export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`surface rounded-2xl border shadow-card ${padded ? 'p-5' : ''} ${className}`}>{children}</div>
  )
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  )
}

/** The big friendly numbers on the home screen. */
export function StatCard({
  label, value, hint, icon, tone = 'brand', onClick,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'violet'
  onClick?: () => void
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={[
        'surface flex items-center gap-4 rounded-2xl border p-5 text-start shadow-card',
        onClick ? 'transition-shadow hover:shadow-lift focus-ring w-full' : '',
      ].join(' ')}
    >
      {icon && <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-500 dark:text-ink-300">{label}</span>
        {/* Default wrapping only ever breaks at the space before the currency,
            so a figure like "109,600 LYD" can never be split mid-number — which
            is what both `break-words` and `anywhere` did here. */}
        <span className="block text-xl font-bold leading-tight xl:text-2xl">{value}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-ink-500 dark:text-ink-300">{hint}</span>}
      </span>
    </Tag>
  )
}
