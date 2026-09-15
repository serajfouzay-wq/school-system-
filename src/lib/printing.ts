import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'

/**
 * One hook for every "Print" and "Save as PDF" button in the app. It gathers
 * the current language, numerals, calendar and school logo so a caller only
 * has to supply the document itself.
 */
export function usePrinting() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const school = useApp((s) => s.school)
  const toast = useApp((s) => s.toast)

  const context = useCallback(async () => {
    const logo = school?.logo_path ? await api.files.readImage(school.logo_path) : null
    return { t, lang, numerals, calendar, logo }
  }, [t, lang, numerals, calendar, school?.logo_path])

  const print = useCallback(
    async (html: string) => {
      try {
        await api.output.print(html)
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    },
    [toast]
  )

  const savePdf = useCallback(
    async (html: string, fileName: string) => {
      try {
        const path = await api.output.pdf(html, fileName)
        if (path) toast(`${t('common.saved')}: ${path}`, 'success')
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    },
    [toast, t]
  )

  const exportCsv = useCallback(
    async (fileName: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) => {
      try {
        const path = await api.output.csv(fileName, columns, rows)
        if (path) toast(`${t('common.saved')}: ${path}`, 'success')
      } catch (e) {
        toast((e as Error).message, 'error')
      }
    },
    [toast, t]
  )

  return { context, print, savePdf, exportCsv, lang, numerals, calendar, school }
}
