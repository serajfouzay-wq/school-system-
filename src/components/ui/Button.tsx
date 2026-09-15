import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'md' | 'lg' | 'sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 border-brand-600 shadow-card',
  secondary: 'surface border text-[color:var(--app-text)] hover:bg-ink-50 dark:hover:bg-ink-800',
  ghost: 'bg-transparent border-transparent text-[color:var(--app-text)] hover:bg-ink-100 dark:hover:bg-ink-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-card',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-card',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-[2.25rem] px-3 text-sm gap-1.5',
  md: 'min-h-touch px-4 text-base gap-2',
  lg: 'min-h-[3.25rem] px-6 text-lg gap-2.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Icons always sit next to words, never on their own (design rule 2). */
  icon?: ReactNode
  block?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, loading, children, className = '', disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-xl border font-semibold',
        'transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed select-none',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  )
})

/** A large, obvious card-style choice — used instead of dropdowns wherever the
 *  list is short enough (design rule: wizards over forms). */
export function ChoiceCard({
  selected, onClick, title, subtitle, icon, disabled,
}: {
  selected?: boolean
  onClick: () => void
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'surface flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border-2 p-4 text-start',
        'transition-all focus-ring disabled:opacity-50',
        selected
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950 ring-2 ring-brand-200 dark:ring-brand-800'
          : 'hover:border-brand-300 hover:shadow-lift',
      ].join(' ')}
    >
      {icon && <span className={selected ? 'text-brand-600' : 'text-ink-400'}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{subtitle}</span>}
      </span>
      {selected && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-sm text-white">✓</span>
      )}
    </button>
  )
}
