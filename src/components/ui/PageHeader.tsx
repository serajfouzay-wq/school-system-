import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PlainFieldsContext } from './Field'

export function PageHeader({
  title, subtitle, actions, helpKey, onHelp,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Every screen offers help for that exact screen (design rule 17). */
  helpKey?: string
  onHelp?: (key: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          {helpKey && onHelp && (
            <button
              type="button"
              onClick={() => onHelp(helpKey)}
              aria-label={t('common.help')}
              title={t('help.onThisScreen')}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-ring dark:hover:bg-ink-800"
            >
              <HelpCircle size={22} />
            </button>
          )}
        </div>
        {subtitle && <p className="mt-1 text-base text-ink-500 dark:text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { id: T; label: ReactNode; icon?: ReactNode }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap gap-2" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            'inline-flex min-h-touch items-center gap-2 rounded-xl border px-4 font-semibold transition-colors focus-ring',
            active === tab.id
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'surface hover:bg-ink-50 dark:hover:bg-ink-800',
          ].join(' ')}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <PlainFieldsContext.Provider value={true}>
      <div className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-2xl border p-4 surface">{children}</div>
    </PlainFieldsContext.Provider>
  )
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="no-print flex flex-wrap items-center gap-3">{children}</div>
}
