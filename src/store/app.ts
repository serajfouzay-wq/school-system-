import { create } from 'zustand'
import type { School, User } from '@shared/types'
import { api } from '@/lib/api'
import i18n, { applyLanguage } from '@/i18n'

export type Screen =
  | { name: 'dashboard' }
  | { name: 'students' }
  | { name: 'studentProfile'; id: number }
  | { name: 'staff' }
  | { name: 'staffProfile'; id: number }
  | { name: 'attendance' }
  | { name: 'timetable' }
  | { name: 'grades' }
  | { name: 'exams' }
  | { name: 'fees' }
  | { name: 'library' }
  | { name: 'transport' }
  | { name: 'classes' }
  | { name: 'announcements' }
  | { name: 'calendar' }
  | { name: 'reports' }
  | { name: 'settings' }
  | { name: 'recycleBin' }
  | { name: 'help' }

export interface ToastAction { label: string; run: () => void | Promise<void> }

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
  action?: ToastAction
}

interface AppState {
  ready: boolean
  school: School | null
  user: User | null
  preferences: Record<string, string>
  screen: Screen
  history: Screen[]
  toasts: Toast[]
  /** Bumped whenever data changes, so open screens know to reload. */
  dataVersion: number

  boot: () => Promise<void>
  reloadSchool: () => Promise<void>
  setUser: (user: User | null) => void
  signOut: () => Promise<void>
  go: (screen: Screen) => void
  goBack: () => void
  setLanguage: (code: 'en' | 'ar') => Promise<void>
  setPreference: (key: string, value: string) => Promise<void>
  toast: (message: string, tone?: Toast['tone'], action?: ToastAction) => number
  dismissToast: (id: number) => void
  touch: () => void
}

let toastSeq = 1

function applyAppearance(prefs: Record<string, string>): void {
  document.documentElement.setAttribute('data-theme', prefs.theme === 'dark' ? 'dark' : 'light')
  document.documentElement.setAttribute('data-font', prefs.fontSize ?? 'small')
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  school: null,
  user: null,
  preferences: {},
  screen: { name: 'dashboard' },
  history: [],
  toasts: [],
  dataVersion: 0,

  boot: async () => {
    const [school, preferences] = await Promise.all([api.school.get(), api.school.preferences()])
    const lang = (preferences.language ?? school?.language ?? 'en') as 'en' | 'ar'
    await i18n.changeLanguage(lang)
    applyLanguage(lang)
    applyAppearance(preferences)
    set({ school, preferences, ready: true })
  },

  reloadSchool: async () => {
    const school = await api.school.get()
    set({ school })
  },

  setUser: (user) => set({ user, screen: { name: 'dashboard' }, history: [] }),

  signOut: async () => {
    await api.auth.logout()
    set({ user: null, screen: { name: 'dashboard' }, history: [], toasts: [] })
  },

  go: (screen) => {
    const { screen: current, history } = get()
    set({ screen, history: [...history, current].slice(-30) })
  },

  goBack: () => {
    const { history } = get()
    if (!history.length) return set({ screen: { name: 'dashboard' } })
    const previous = history[history.length - 1]
    set({ screen: previous, history: history.slice(0, -1) })
  },

  setLanguage: async (code) => {
    await i18n.changeLanguage(code)
    applyLanguage(code)
    await api.school.setPreference('language', code)
    const school = get().school
    if (school) await api.school.save({ language: code })
    set((s) => ({ preferences: { ...s.preferences, language: code }, school: school ? { ...school, language: code } : null }))
  },

  setPreference: async (key, value) => {
    await api.school.setPreference(key, value)
    const preferences = { ...get().preferences, [key]: value }
    applyAppearance(preferences)
    set({ preferences })
  },

  toast: (message, tone = 'success', action) => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { id, message, tone, action }] }))
    // Design rule 8: the Undo offer stays on screen for 5 seconds.
    setTimeout(() => get().dismissToast(id), action ? 6000 : 3500)
    return id
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  touch: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}))

/** Convenience selectors used all over the UI. */
export function useLang(): 'en' | 'ar' {
  return (useApp((s) => s.preferences.language ?? s.school?.language ?? 'en') as 'en' | 'ar')
}

export function useNumerals(): string {
  return useApp((s) => s.preferences.numerals ?? s.school?.numeral_system ?? 'western')
}

export function useCalendarType(): string {
  return useApp((s) => s.preferences.calendar ?? s.school?.calendar_type ?? 'gregorian')
}

export function useCurrency(): string {
  return useApp((s) => s.school?.currency ?? 'LYD')
}
