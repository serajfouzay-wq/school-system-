import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Home, Users, GraduationCap, CalendarCheck, CalendarDays, ClipboardList,
  Wallet, Layers, Megaphone, FileBarChart, Settings as SettingsIcon, FileQuestion,
  Trash2, HelpCircle, Search, Languages, ChevronLeft, X, UserRoundCog,
  BookOpen, Bus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp, useLang } from '@/store/app'
import type { Screen } from '@/store/app'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/hooks'
import type { SearchHit } from '@shared/types'
import { can } from '@shared/permissions'
import type { Capability, Role } from '@shared/permissions'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'

interface NavItem {
  screen: Screen['name']
  labelKey: string
  icon: ReactNode
  /** Leave unset for the screens everyone who can sign in may open. */
  needs?: Capability
}

/** The same icon always means the same thing, and the order never changes. */
const NAV: NavItem[] = [
  { screen: 'dashboard', labelKey: 'nav.dashboard', icon: <Home size={22} /> },
  { screen: 'students', labelKey: 'nav.students', icon: <Users size={22} />, needs: 'students.view' },
  { screen: 'staff', labelKey: 'nav.staff', icon: <GraduationCap size={22} />, needs: 'staff.view' },
  { screen: 'attendance', labelKey: 'nav.attendance', icon: <CalendarCheck size={22} />, needs: 'attendance.view' },
  { screen: 'timetable', labelKey: 'nav.timetable', icon: <CalendarDays size={22} />, needs: 'timetable.view' },
  { screen: 'grades', labelKey: 'nav.grades', icon: <ClipboardList size={22} />, needs: 'grades.view' },
  { screen: 'exams', labelKey: 'nav.exams', icon: <FileQuestion size={22} />, needs: 'exams.view' },
  { screen: 'fees', labelKey: 'nav.fees', icon: <Wallet size={22} />, needs: 'fees.view' },
  { screen: 'library', labelKey: 'nav.library', icon: <BookOpen size={22} />, needs: 'library.view' },
  { screen: 'transport', labelKey: 'nav.transport', icon: <Bus size={22} />, needs: 'transport.view' },
  { screen: 'classes', labelKey: 'nav.classes', icon: <Layers size={22} />, needs: 'academics.view' },
  { screen: 'announcements', labelKey: 'nav.announcements', icon: <Megaphone size={22} />, needs: 'announcements.view' },
  { screen: 'reports', labelKey: 'nav.reports', icon: <FileBarChart size={22} />, needs: 'reports.view' },
]

/** Shown after a divider, at the end of the same list. */
const FOOTER_NAV: NavItem[] = [
  { screen: 'settings', labelKey: 'nav.settings', icon: <SettingsIcon size={22} /> },
  { screen: 'recycleBin', labelKey: 'nav.recycleBin', icon: <Trash2 size={22} />, needs: 'recycle.view' },
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
  const role = (user?.role ?? null) as Role | null

  return (
    <div className="flex h-full">
      {/* The sidebar is always on the inline-start edge, which puts it on the
          right automatically once the document direction is RTL. */}
      <nav className="no-print flex w-64 shrink-0 flex-col border-e surface" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <GraduationCap size={22} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">
              {(lang === 'ar' && school?.name_ar) || school?.name || t('app.name')}
            </p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-300">{t('app.name')}</p>
          </div>
        </div>

        {/* One continuous menu. On a short screen it scrolls, and the fade at
            the bottom edge is there so it is obvious something is below —
            a hairline scrollbar is not a clue most people notice. */}
        <NavList role={role} screen={screen.name} go={go} />

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

/**
 * The menu. It scrolls when the window is short, and says so: a fade on
 * whichever edge has more behind it, kept in step with the scroll position.
 */
function NavList({ role, screen, go }: { role: Role | null; screen: Screen['name']; go: (s: Screen) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const measure = () => {
    const el = ref.current
    if (!el) return
    const room = el.scrollHeight - el.clientHeight
    setEdges({ top: el.scrollTop > 4, bottom: room > 4 && el.scrollTop < room - 4 })
  }

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [role])

  const items = [...NAV.filter((i) => allowed(role, i)), null, ...FOOTER_NAV.filter((i) => allowed(role, i))]

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} onScroll={measure} className="h-full space-y-0.5 overflow-y-auto px-3 pb-3">
        {items.map((item) =>
          item === null ? (
            <hr key="divider" className="my-2 border-0 border-t" style={{ borderColor: 'var(--app-border)' }} />
          ) : (
            <NavButton
              key={item.screen}
              item={item}
              active={screen === item.screen}
              onClick={() => go({ name: item.screen } as Screen)}
            />
          )
        )}
        {/* Room for the fade, so the last item is never half-hidden under it. */}
        <div aria-hidden className="h-2" />
      </div>
      {edges.top && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-6 nav-fade-top" />}
      {edges.bottom && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 nav-fade-bottom" />}
    </div>
  )
}

/** Hide what this person cannot use; the main process refuses it regardless. */
function allowed(role: Role | null, item: NavItem): boolean {
  return !item.needs || can(role, item.needs)
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
