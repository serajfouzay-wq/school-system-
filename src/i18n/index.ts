import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ar from './ar.json'

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' as const, flag: '🇬🇧' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' as const, flag: '🇱🇾' },
]

export type LanguageCode = 'en' | 'ar'

export function dirFor(code: string): 'ltr' | 'rtl' {
  return code === 'ar' ? 'rtl' : 'ltr'
}

/**
 * Switching language re-points the document's `dir`, which is what makes the
 * whole layout mirror: every component uses CSS logical properties, so the
 * sidebar, tables and forms flip without any component knowing about it.
 */
export function applyLanguage(code: string): void {
  const dir = dirFor(code)
  document.documentElement.setAttribute('lang', code)
  document.documentElement.setAttribute('dir', dir)
}

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })

export default i18n
