import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Home, Users, GraduationCap, CalendarCheck, CalendarDays, ClipboardList,
  Wallet, Layers, Megaphone, FileBarChart, Settings as SettingsIcon, FileQuestion,
  Trash2, HelpCircle, Search, LogOut, Languages, ChevronLeft, X, UserRoundCog,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp, useLang } from '@/store/app'
import type { Screen } from '@/store/app'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/hooks'
import type { SearchHit } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

interface NavItem { screen: Screen['name']; labelKey: string; icon: ReactNode }

/** The same icon always means the same thing, and the order never changes. */
const NAV: NavItem[] = [
  { screen: 'dashboard', labelKey: 'nav.dashboard', icon: <Home size={22} /> },
  { screen: 'students', labelKey: 'nav.students', icon: <Users size={22} /> },
  { screen: 'staff', labelKey: 'nav.staff', icon: <GraduationCap size={22} /> },
  { screen: 'attendance', labelKey: 'nav.attendance', icon: <CalendarCheck size={22} /> },
  { screen: 'timetable', labelKey: 'nav.timetable', icon: <CalendarDays size={22} /> },
  { screen: 'grades', labelKey: 'nav.grades', icon: <ClipboardList size={22} /> },
  { screen: 'exams', labelKey: 'nav.exams', icon: <FileQuestion size={22} /> },
  { screen: 'fees', labelKey: 'nav.fees', icon: <Wallet size={22} /> },
  { screen: 'classes', labelKey: 'nav.classes', icon: <Layers size={22} /> },
  { screen: 'announcements', labelKey: 'nav.announcements', icon: <Megaphone size={22} /> },
  { screen: 'reports', labelKey: 'nav.reports', icon: <FileBarChart size={22} /> },
]

const FOOTER_NAV: NavItem[] = [
  { screen: 'settings', labelKey: 'nav.settings', icon: <SettingsIcon size={22} /> },
  { screen: 'recycleBin', labelKey: 'nav.recycleBin', icon: <Trash2 size={22} /> },
  { screen: 'help', labelKey: 'nav.help', icon: <HelpCircle size={22} /> },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const lang = useLang()
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)
  const goBack = useApp((s) => s.goBack)
  const history = useApp((s) => s.history)
  const user = useApp((s) => s.user)
  const school = useApp((s) => s.school)
  const signOut = useApp((s) => s.signOut)
  const setLanguage = useApp((s) => s.setLanguage)

  return (
    <div className="flex h-full">
      {/* The sidebar is always on the inline-start edge, which puts it on the
          right automatically once the document direction is RTL. */}
      <nav className="no-print flex w-64 shrink-0 flex-col border-e surface" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <GraduationCap size={24} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">
              {(lang === 'ar' && school?.name_ar) || school?.name || t('app.name')}
            </p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-300">{t('app.name')}</p>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {NAV.map((item) => (
            <NavButton key={item.screen} item={item} active={screen.name === item.screen} onClick={() => go({ name: item.screen } as Screen)} />
          ))}
        </div>

        <div className="space-y-1 border-t p-3" style={{ borderColor: 'var(--app-border)' }}>
          {FOOTER_NAV.map((item) => (
            <NavButton key={item.screen} item={item} active={screen.name === item.screen} onClick={() => go({ name: item.screen } as Screen)} />
          ))}
        </div>

        <div className="border-t p-3" style={{ borderColor: 'var(--app-border)' }}>
          <button
            type="button"
            onClick={() => void setLanguage(lang === 'ar' ? 'en' : 'ar')}
            className="mb-2 flex w-full min-h-touch items-center gap-3 rounded-xl px-3 font-semibold hover:bg-ink-100 focus-ring dark:hover:bg-ink-800"
          >
            <Languages size={22} />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          {user && (
            <>
              <div className="flex items-center gap-3 rounded-xl p-2">
                <Avatar name={user.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{user.name}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-300">{t(`roles.${user.role}`)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  title={t('nav.signOut')}
                  aria-label={t('nav.signOut')}
                  className="grid h-10 w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 focus-ring dark:hover:bg-ink-800"
                >
                  <LogOut size={20} className="flip-rtl" />
                </button>
              </div>
              {/* Office computers are shared: swapping to a colleague is one
                  click and lands straight back on the user picker. */}
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full min-h-touch items-center gap-3 rounded-xl px-3 font-semibold hover:bg-ink-100 focus-ring dark:hover:bg-ink-800"
              >
                <UserRoundCog size={22} />
                {t('nav.switchUser')}
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="no-print flex shrink-0 items-center gap-3 border-b px-6 py-3 surface"
          style={{ borderColor: 'var(--app-border)' }}
        >
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={goBack} icon={<ChevronLeft size={20} className="flip-rtl" />}>
              {t('common.back')}
            </Button>
          )}
          <GlobalSearch />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex w-full min-h-touch items-center gap-3 rounded-xl px-3 text-start font-semibold transition-colors focus-ring',
        active
          ? 'bg-brand-600 text-white shadow-card'
          : 'hover:bg-ink-100 dark:hover:bg-ink-800',
      ].join(' ')}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate">{t(item.labelKey)}</span>
    </button>
  )
}

/** One box that finds a student, teacher or receipt without knowing the menu. */
function GlobalSearch() {
  const { t } = useTranslation()
  const go = useApp((s) => s.go)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebounced(query, 220)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    if (debounced.trim().length < 1) { setHits([]); return }
    api.search
      .global(debounced)
      .then((r) => { if (alive) { setHits(r); setOpen(true) } })
      .catch(() => { if (alive) setHits([]) })
    return () => { alive = false }
  }, [debounced])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const openHit = (hit: SearchHit) => {
    setOpen(false)
    setQuery('')
    if (hit.type === 'student') go({ name: 'studentProfile', id: hit.id })
    else if (hit.type === 'staff') go({ name: 'staffProfile', id: hit.id })
    else if (hit.type === 'payment') go({ name: 'fees' })
    else go({ name: 'classes' })
  }

  const typeLabel: Record<SearchHit['type'], string> = {
    student: t('kinds.student'),
    staff: t('kinds.staff'),
    payment: t('kinds.payment'),
    class: t('kinds.class'),
  }

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-2xl">
      <div className="relative">
        <Search
          size={20}
          className="pointer-events-none absolute inset-block-0 my-auto h-5 start-3 text-ink-400"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder={t('common.searchPlaceholder')}
          aria-label={t('common.search')}
          className="surface w-full min-h-touch rounded-xl border ps-11 pe-10 py-2 text-base focus-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setHits([]) }}
            aria-label={t('common.clear')}
            className="absolute end-2 grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 focus-ring dark:hover:bg-ink-800"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="surface absolute inset-x-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-2xl border shadow-lift">
          {hits.length === 0 ? (
            <p className="p-4 text-center text-ink-500 dark:text-ink-300">{t('common.noResults')}</p>
          ) : (
            hits.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}`}
                type="button"
                onClick={() => openHit(hit)}
                className="flex w-full items-center gap-3 border-b p-3 text-start last:border-0 hover:bg-brand-50 focus-ring dark:hover:bg-ink-800"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <span className="rounded-lg bg-ink-100 px-2 py-1 text-xs font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-200">
                  {typeLabel[hit.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{hit.title}</span>
                  <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{hit.subtitle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
