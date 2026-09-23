import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, FileKey, KeyRound, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { appNameFor, brand } from '@/lib/brand'
import i18n, { applyLanguage, LANGUAGES } from '@/i18n'
import type { LicenseStatus } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PlainFields, TextArea } from '@/components/ui/Field'

/**
 * What a copy shows on a computer it is not licensed for, and nothing else.
 *
 * It appears before the school's own settings can be read (they are behind the
 * licence too), so it opens in the language the build was made for and has its
 * own switch.
 */
export function ActivationScreen({ status, onActivated }: { status: LicenseStatus; onActivated: () => void }) {
  const { t } = useTranslation()
  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar'
  const [current, setCurrent] = useState(status)
  const [key, setKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problemText = (s: LicenseStatus) =>
    s.problem && s.problem !== 'missing' ? t(`license.problem.${s.problem}`) : null

  const settle = (next: LicenseStatus | null) => {
    if (!next) return
    setCurrent(next)
    if (next.licensed) onActivated()
    else setError(problemText(next))
  }

  const run = async (work: () => Promise<LicenseStatus | null>) => {
    setBusy(true)
    setError(null)
    try {
      settle(await work())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const copyCode = async () => {
    if (!current.machineCode) return
    try {
      await navigator.clipboard.writeText(current.machineCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* the code is on screen to read out; copying is a convenience */
    }
  }

  const switchTo = (code: 'en' | 'ar') => {
    void i18n.changeLanguage(code)
    applyLanguage(code)
  }

  const shown = error ?? problemText(current)

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
              <ShieldCheck size={26} aria-hidden />
            </span>
            <div>
              <p className="text-sm text-ink-500">{appNameFor(lang)}</p>
              <h1 className="text-2xl font-bold">{t('license.title')}</h1>
            </div>
          </div>
          <div className="flex gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => switchTo(l.code as 'en' | 'ar')}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold focus-ring',
                  lang === l.code ? 'bg-brand-600 text-white' : 'hover:bg-ink-100 dark:hover:bg-ink-800',
                ].join(' ')}
              >
                {l.nativeLabel}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <p className="mb-5 text-ink-600 dark:text-ink-300">{t('license.intro', { app: appNameFor(lang) })}</p>

          <p className="mb-1 text-sm font-semibold">{t('license.yourCode')}</p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {/* Always left-to-right: it is read out character by character. */}
            <code dir="ltr" className="rounded-xl bg-ink-100 px-4 py-3 font-mono text-2xl font-bold tracking-wider dark:bg-ink-800">
              {current.machineCode ?? '—'}
            </code>
            {current.machineCode && (
              <Button onClick={() => void copyCode()} icon={copied ? <Check size={18} /> : <Copy size={18} />}>
                {copied ? t('license.copied') : t('license.copy')}
              </Button>
            )}
          </div>

          {shown && (
            <p role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {shown}
            </p>
          )}

          <div className="mb-5">
            <Button
              variant="primary"
              size="lg"
              block
              loading={busy}
              icon={<FileKey size={20} />}
              onClick={() => void run(() => api.license.activateFromFile())}
            >
              {t('license.fromFile')}
            </Button>
            <p className="mt-1 text-sm text-ink-500">{t('license.fromFileHint')}</p>
          </div>

          <PlainFields>
          <TextArea
            label={t('license.orPaste')}
            dir="ltr"
            rows={3}
            value={key}
            placeholder={t('license.pastePlaceholder')}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono text-sm"
          />
          </PlainFields>
          <div className="mt-3 flex justify-end">
            <Button
              icon={<KeyRound size={18} />}
              disabled={busy}
              onClick={() => {
                if (!key.trim()) return setError(t('license.noKey'))
                void run(() => api.license.activate(key))
              }}
            >
              {t('license.activate')}
            </Button>
          </div>
        </Card>

        {brand.notes && <p dir="auto" className="mt-4 whitespace-pre-line text-center text-sm text-ink-500">{brand.notes}</p>}
      </div>
    </div>
  )
}
