import { useState } from 'react'
import { FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang } from '@/store/app'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Wizard } from '@/components/ui/Wizard'
import type { WizardStep } from '@/components/ui/Wizard'
import { sectionTitle } from './StudentWizard'

const IMPORT_FIELDS = [
  { value: 'full_name', labelKey: 'common.nameEnglish' },
  { value: 'full_name_ar', labelKey: 'common.nameArabic' },
  { value: 'dob', labelKey: 'common.dateOfBirth' },
  { value: 'gender', labelKey: 'common.gender' },
  { value: 'guardian_name', labelKey: 'students.guardianName' },
  { value: 'guardian_phone', labelKey: 'students.guardianPhone' },
  { value: 'guardian_address', labelKey: 'students.guardianAddress' },
]

/** "Match your columns" — the user never has to reshape their spreadsheet. */
export function ImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { data: sections } = useAsync(() => api.sections.list(), [open])

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [sectionId, setSectionId] = useState('')
  const [result, setResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null)

  const headers = rows.length ? Object.keys(rows[0]) : []

  const pickFile = async () => {
    const picked = await api.files.pickCsv()
    if (!picked) return
    if (!picked.rows.length) {
      toast(t('reports.noData'), 'error')
      return
    }
    setRows(picked.rows)
    setFileName(picked.path.split(/[\\/]/).pop() ?? '')
    // Guess the mapping from the column names so most files need no work.
    const guess: Record<string, string> = {}
    for (const h of Object.keys(picked.rows[0])) {
      const key = h.toLowerCase().replace(/[^a-z]/g, '')
      if (key.includes('namear') || key.includes('arabic')) guess[h] = 'full_name_ar'
      else if (key.includes('name') && !key.includes('guardian') && !key.includes('parent')) guess[h] = 'full_name'
      else if (key.includes('birth') || key === 'dob') guess[h] = 'dob'
      else if (key.includes('gender') || key.includes('sex')) guess[h] = 'gender'
      else if (key.includes('phone') || key.includes('mobile')) guess[h] = 'guardian_phone'
      else if (key.includes('guardian') || key.includes('parent') || key.includes('father') || key.includes('mother')) guess[h] = 'guardian_name'
      else if (key.includes('address')) guess[h] = 'guardian_address'
      else guess[h] = ''
    }
    setMapping(guess)
    setStep(1)
  }

  const runImport = async () => {
    setBusy(true)
    try {
      const res = await api.students.import(rows, mapping, sectionId ? Number(sectionId) : null)
      setResult(res)
      touch()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const nameMapped = Object.values(mapping).includes('full_name') || Object.values(mapping).includes('full_name_ar')

  if (result) {
    return (
      <Modal open={open} onClose={onClose} title={t('students.bulkImport')} size="md">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 size={64} className="text-emerald-500" />
          <h3 className="text-xl font-bold">{t('students.importDone', { added: result.added, skipped: result.skipped })}</h3>
          {result.errors.length > 0 && (
            <div className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3 text-start dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-1.5 flex items-center gap-2 font-bold"><AlertTriangle size={18} />{t('common.somethingWentWrong')}</p>
              <ul className="max-h-40 list-inside list-disc overflow-y-auto text-sm">
                {result.errors.slice(0, 40).map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
          <Button size="lg" variant="primary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </Modal>
    )
  }

  const steps: WizardStep[] = [
    {
      title: t('students.importStep1'),
      subtitle: t('students.importHelp'),
      canContinue: rows.length > 0,
      content: (
        <div className="flex flex-col items-center gap-4 py-8">
          <FileSpreadsheet size={64} className="text-brand-500" />
          <Button size="lg" variant="primary" onClick={() => void pickFile()}>{t('students.importPickFile')}</Button>
          {fileName && <p className="font-semibold">{fileName} — {t('students.importReady', { count: rows.length })}</p>}
        </div>
      ),
    },
    {
      title: t('students.importStep2'),
      subtitle: t('students.importMatchHelp'),
      canContinue: nameMapped,
      content: (
        <div className="space-y-3">
          {headers.map((header) => (
            <div key={header} className="surface flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <span className="min-w-[8rem] flex-1 font-bold">{header}</span>
              <span className="text-ink-400">→</span>
              <div className="min-w-[14rem] flex-1">
                <Select
                  value={mapping[header] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                  placeholder={t('students.importIgnore')}
                  options={IMPORT_FIELDS.map((f) => ({ value: f.value, label: t(f.labelKey) }))}
                />
              </div>
              <span className="w-full truncate text-sm text-ink-500 dark:text-ink-300">
                {rows[0]?.[header] ? `"${rows[0][header]}"` : ''}
              </span>
            </div>
          ))}
          {!nameMapped && (
            <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {t('common.nameEnglish')} — {t('common.required')}
            </p>
          )}
        </div>
      ),
    },
    {
      title: t('students.importStep3'),
      content: (
        <div className="space-y-4">
          <Select
            label={t('common.class')}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder={t('common.none')}
            options={(sections ?? []).map((s) => ({ value: s.id, label: sectionTitle(s, lang) }))}
          />
          <p className="text-lg font-bold">{t('students.importReady', { count: rows.length })}</p>
          <div className="max-h-64 overflow-auto rounded-xl border" style={{ borderColor: 'var(--app-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--app-border)' }}>
                  {headers.filter((h) => mapping[h]).map((h) => (
                    <th key={h} className="p-2 text-start font-bold">{t(IMPORT_FIELDS.find((f) => f.value === mapping[h])?.labelKey ?? h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    {headers.filter((h) => mapping[h]).map((h) => <td key={h} className="p-2">{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('students.bulkImport')} size="lg">
      <div className="min-h-[24rem]">
        <Wizard
          steps={steps}
          current={step}
          onStepChange={setStep}
          onFinish={() => void runImport()}
          finishLabel={t('students.importRun')}
          onCancel={onClose}
          busy={busy}
        />
      </div>
    </Modal>
  )
}
