import { useMemo, useState } from 'react'
import { HelpCircle, Search, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'

interface Article { id: string; title: string; body: string[] }

/**
 * Help lives inside the app and works offline. Articles are written in the
 * same plain language as the interface, and are keyed to the screens they
 * describe so the "?" button on each page can jump straight to them.
 */
function useArticles(): Article[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        id: 'students',
        title: t('students.addStudent'),
        body: [
          t('students.wizardStep1Help'),
          t('students.wizardStep2Help'),
          t('students.wizardStep3Help'),
          t('common.autoSaved'),
        ],
      },
      {
        id: 'attendance',
        title: t('attendance.title'),
        body: [t('attendance.chooseClass'), t('attendance.markAllPresent'), t('attendance.thenTapExceptions'), t('attendance.printSheet')],
      },
      {
        id: 'grades',
        title: t('grades.title'),
        body: [t('grades.emptyBody'), t('grades.gridHelp'), t('grades.printAllReportCards')],
      },
      {
        id: 'fees',
        title: t('fees.title'),
        body: [t('fees.emptyBody'), t('fees.recordPayment'), t('fees.printReceipt'), t('fees.onlyOutstanding')],
      },
      {
        id: 'timetable',
        title: t('timetable.title'),
        body: [t('timetable.emptyBody'), t('timetable.dragHint'), t('timetable.conflictTitle'), t('timetable.printTimetable')],
      },
      {
        id: 'import',
        title: t('students.bulkImport'),
        body: [t('students.importHelp'), t('students.importMatchHelp'), t('students.importRun')],
      },
      {
        id: 'backup',
        title: t('settings.backup'),
        body: [t('settings.backupNowHelp'), t('settings.backupToHelp'), t('settings.restoreHelp'), t('settings.autoBackup')],
      },
      {
        id: 'recycle',
        title: t('recycle.title'),
        body: [t('recycle.subtitle'), t('common.deleteExplain')],
      },
      {
        id: 'language',
        title: t('settings.language'),
        body: [t('setup.languageHelp'), t('settings.fontHelp'), t('settings.numerals'), t('settings.calendarType')],
      },
    ],
    [t]
  )
}

export function HelpPage() {
  const { t } = useTranslation()
  const articles = useArticles()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(articles[0]?.id ?? null)

  const filtered = query.trim()
    ? articles.filter((a) =>
        (a.title + a.body.join(' ')).toLowerCase().includes(query.trim().toLowerCase())
      )
    : articles

  return (
    <div>
      <PageHeader title={t('help.title')} subtitle={t('help.subtitle')} />

      <div className="mb-5 max-w-xl">
        <TextInput
          label={t('help.searchHelp')}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search')}
        />
      </div>

      {!filtered.length ? (
        <Card><EmptyState icon={<Search size={44} />} title={t('help.noArticles')} /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => (
            <Card key={article.id} padded={false}>
              <button
                type="button"
                onClick={() => setOpen((o) => (o === article.id ? null : article.id))}
                aria-expanded={open === article.id}
                className="flex w-full min-h-touch items-center gap-3 p-4 text-start focus-ring"
              >
                <HelpCircle size={22} className="shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1 text-lg font-bold">{article.title}</span>
                <ChevronDown size={20} className={`shrink-0 transition-transform ${open === article.id ? 'rotate-180' : ''}`} />
              </button>
              {open === article.id && (
                <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--app-border)' }}>
                  <ol className="space-y-2">
                    {article.body.map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{line}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
