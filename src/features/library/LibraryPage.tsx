import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  BookOpen, Plus, Pencil, Trash2, ArrowLeftRight, Wifi, WifiOff,
  Smartphone, AlertTriangle, CheckCircle2, FileText, Paperclip,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync, useDebounced } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCurrency } from '@/store/app'
import type { Book, Role, ServerStatus } from '@shared/types'
import { can } from '@shared/permissions'
import { Button, ChoiceCard } from '@/components/ui/Button'
import { Card, StatCard } from '@/components/ui/Card'
import { Select, TextInput, TextArea, Toggle, Field, PlainFields } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { formatMoney, formatDate, localName } from '@/lib/format'

export function LibraryPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'books' | 'loans' | 'share'>('books')

  return (
    <div>
      <PageHeader title={t('library.title')} subtitle={t('library.subtitle')} />
      <ModuleTour
        moduleKey="library"
        tips={[
          { title: t('library.addBook'), body: t('library.addBookTip') },
          { title: t('library.attachFile'), body: t('library.attachHelp') },
          { title: t('library.shareOn'), body: t('library.shareHelp') },
        ]}
      />
      <Tabs
        tabs={[
          { id: 'books' as const, label: t('library.books'), icon: <BookOpen size={18} /> },
          { id: 'loans' as const, label: t('library.loans'), icon: <ArrowLeftRight size={18} /> },
          { id: 'share' as const, label: t('library.shareOn'), icon: <Smartphone size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'books' && <BooksTab />}
      {tab === 'loans' && <LoansTab />}
      {tab === 'share' && <ShareTab />}
    </div>
  )
}

function BooksTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const role = useApp((s) => s.user?.role) as Role | undefined
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState<Book | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Book | null>(null)
  const [lending, setLending] = useState<Book | null>(null)
  const debounced = useDebounced(search, 250)

  const { data: summary } = useAsync(() => api.library.summary(), [])
  const { data: categories } = useAsync(() => api.library.categories(), [])
  const { data: books, loading, error, reload } = useAsync(
    () => api.library.books({ search: debounced, category: category || null }),
    [debounced, category]
  )

  if (loading && !books) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      {summary && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('library.titles')} value={summary.titles} icon={<BookOpen size={26} />} tone="brand" />
          <StatCard label={t('library.loans')} value={summary.onLoan} icon={<ArrowLeftRight size={26} />} tone="violet" />
          <StatCard label={t('library.overdue')} value={summary.overdue} icon={<AlertTriangle size={26} />} tone={summary.overdue ? 'rose' : 'emerald'} />
          <StatCard label={t('library.digitalCount')} value={summary.digital} icon={<Smartphone size={26} />} tone="emerald" />
        </div>
      )}

      <FilterBar>
        <div className="min-w-[14rem] flex-1">
          <TextInput label={t('common.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[11rem]">
          <Select
            label={t('library.category')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('common.all')}
            options={(categories ?? []).map((c) => ({ value: c, label: c }))}
          />
        </div>
        {can(role, 'library.manage') && (
          <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
            {t('library.addBook')}
          </Button>
        )}
      </FilterBar>

      <Card padded={false}>
        {!books?.length ? (
          <EmptyState
            icon={<BookOpen size={44} />}
            title={debounced ? t('common.noResults') : t('library.emptyTitle')}
            body={debounced ? undefined : t('library.emptyBody')}
            action={
              !debounced && can(role, 'library.manage') && (
                <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
                  {t('library.addBook')}
                </Button>
              )
            }
          />
        ) : (
          <ul>
            {books.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  <BookOpen size={20} />
                </span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-bold">{localName(b, lang, 'title')}</span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">
                    {[b.author, b.category, b.shelf].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
                {b.is_digital && <StatusPill tone="green" icon={<Smartphone size={15} />}>{t('library.digital')}</StatusPill>}
                {b.copies_total > 0 && (
                  <StatusPill tone={(b.copies_available ?? 0) > 0 ? 'blue' : 'amber'}>
                    {(b.copies_available ?? 0) > 0
                      ? `${t('library.available')}: ${b.copies_available} / ${b.copies_total}`
                      : t('library.allOut')}
                  </StatusPill>
                )}
                <span className="flex flex-wrap gap-2">
                  {can(role, 'library.lend') && b.copies_total > 0 && (b.copies_available ?? 0) > 0 && (
                    <Button size="sm" variant="success" onClick={() => setLending(b)} icon={<ArrowLeftRight size={16} />}>
                      {t('library.borrow')}
                    </Button>
                  )}
                  {can(role, 'library.manage') && (
                    <>
                      <Button size="sm" onClick={() => setEditing(b)} icon={<Pencil size={16} />}>
                        <span className="sr-only">{t('common.edit')}</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(b)} icon={<Trash2 size={16} className="text-rose-600" />}>
                        <span className="sr-only">{t('common.delete')}</span>
                      </Button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <BookEditor
          book={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      {lending && (
        <BorrowDialog book={lending} onClose={() => setLending(null)} onSaved={() => { setLending(null); reload(); touch() }} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.title ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.library.removeBook(deleting.id)
            reload(); touch()
            toast(t('common.delete'), 'success')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function BookEditor({ book, onClose, onSaved }: { book: Book | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [form, setForm] = useState({
    title: book?.title ?? '',
    title_ar: book?.title_ar ?? '',
    author: book?.author ?? '',
    category: book?.category ?? '',
    isbn: book?.isbn ?? '',
    shelf: book?.shelf ?? '',
    description: book?.description ?? '',
    copies_total: String(book?.copies_total ?? 1),
  })
  const [file, setFile] = useState<{ path: string | null; name: string | null }>({
    path: book?.file_path ?? null,
    name: book?.file_name ?? null,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    try {
      const saved = await api.library.saveBook({
        ...(book ? { id: book.id } : {}),
        ...form,
        copies_total: Number(form.copies_total) || 0,
      })
      // The file is copied into the school's folder once the book has an id.
      if (file.path && file.path !== book?.file_path) await api.library.attachFile(saved.id, file.path)
      if (!file.path && book?.file_path) await api.library.removeFile(saved.id)
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={book ? t('library.editBook') : t('library.addBook')}
      size="lg"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" variant="primary" loading={busy} disabled={!form.title.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {/* The book's name is the only thing this needs; the rest is detail. */}
      <PlainFields>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('library.bookTitle')} required value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          <TextInput label={t('common.nameArabic')} dir="rtl" value={form.title_ar} onChange={(e) => set('title_ar', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('library.author')} value={form.author} onChange={(e) => set('author', e.target.value)} />
          <TextInput label={t('library.category')} value={form.category} onChange={(e) => set('category', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label={t('library.isbn')} dir="ltr" value={form.isbn} onChange={(e) => set('isbn', e.target.value)} />
          <TextInput label={t('library.shelf')} value={form.shelf} onChange={(e) => set('shelf', e.target.value)} />
          <TextInput
            label={t('library.copies')}
            hint={t('library.copiesHelp')}
            type="number"
            dir="ltr"
            value={form.copies_total}
            onChange={(e) => set('copies_total', e.target.value)}
          />
        </div>
        <TextArea label={t('library.description')} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />

        <Field label={t('library.attachFile')} hint={t('library.attachHelp')}>
          <div className="flex flex-wrap items-center gap-3">
            {file.name ? (
              <>
                <StatusPill tone="green" icon={<FileText size={15} />}>{file.name}</StatusPill>
                <Button variant="ghost" onClick={() => setFile({ path: null, name: null })}>{t('library.removeFile')}</Button>
              </>
            ) : (
              <Button
                icon={<Paperclip size={18} />}
                onClick={async () => {
                  const picked = await api.files.pickAny()
                  if (picked) setFile({ path: picked, name: picked.split(/[\\/]/).pop() ?? null })
                }}
              >
                {t('library.attachFile')}
              </Button>
            )}
          </div>
        </Field>
      </div>
      </PlainFields>
    </Modal>
  )
}

function BorrowDialog({ book, onClose, onSaved }: { book: Book; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const [who, setWho] = useState<'student' | 'staff'>('student')
  const [id, setId] = useState('')
  const { data: students } = useAsync(() => api.students.list({ status: 'active' }), [])
  const { data: staff } = useAsync(() => api.staff.list({ status: 'active' }), [])
  const { data: settings } = useAsync(() => api.library.settings(), [])

  return (
    <Modal
      open
      onClose={onClose}
      title={t('library.borrowTitle')}
      subtitle={localName(book, lang, 'title')}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!id}
            onClick={async () => {
              try {
                await api.library.borrow({
                  book_id: book.id,
                  ...(who === 'student' ? { student_id: Number(id) } : { staff_id: Number(id) }),
                })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            {t('library.borrow')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard selected={who === 'student'} onClick={() => { setWho('student'); setId('') }} title={t('library.student')} />
          <ChoiceCard selected={who === 'staff'} onClick={() => { setWho('staff'); setId('') }} title={t('library.staffMember')} />
        </div>
        <Select
          label={who === 'student' ? t('library.student') : t('library.staffMember')}
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t('common.select')}
          options={(who === 'student' ? students ?? [] : staff ?? []).map((p) => ({
            value: p.id,
            label: localName(p, lang, 'full_name'),
          }))}
        />
        {settings && (
          <p className="text-sm text-ink-500 dark:text-ink-300">
            {t('library.loanDays')} {settings.loanDays}
          </p>
        )}
      </div>
    </Modal>
  )
}

function LoansTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const role = useApp((s) => s.user?.role) as Role | undefined
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const [overdueOnly, setOverdueOnly] = useState(false)

  const { data: loans, loading, reload } = useAsync(
    () => api.library.loans({ openOnly: true, overdueOnly: overdueOnly }),
    [overdueOnly]
  )

  if (loading && !loans) return <Loading />

  return (
    <div>
      <FilterBar>
        <div className="min-w-[18rem]">
          <Toggle checked={overdueOnly} onChange={setOverdueOnly} label={t('library.overdue')} />
        </div>
      </FilterBar>

      <Card padded={false}>
        {!loans?.length ? (
          <EmptyState
            icon={<CheckCircle2 size={44} />}
            title={overdueOnly ? t('library.noOverdue') : t('library.noLoans')}
          />
        ) : (
          <ul>
            {loans.map((l) => {
              const late = (l.days_overdue ?? 0) > 0
              const name = lang === 'ar' && l.borrower_name_ar ? l.borrower_name_ar : l.borrower_name
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="min-w-[12rem] flex-1">
                    <span className="block font-bold">{localName(l, lang, 'book_title')}</span>
                    <span className="block text-sm text-ink-500 dark:text-ink-300">
                      {name}{l.student_code ? ` · ${l.student_code}` : ''}
                    </span>
                  </span>
                  <StatusPill tone={late ? 'red' : 'blue'}>
                    {t('library.dueOn')}: {formatDate(l.due_at, lang, { numerals })}
                  </StatusPill>
                  {late && (
                    <StatusPill tone="red" icon={<AlertTriangle size={15} />}>
                      {t('library.daysLate', { count: l.days_overdue })}
                    </StatusPill>
                  )}
                  {can(role, 'library.lend') && (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<ArrowLeftRight size={16} />}
                      onClick={async () => {
                        try {
                          const res = await api.library.returnBook(l.id)
                          reload(); touch()
                          toast(
                            res.fine > 0
                              ? `${t('library.returned')} · ${t('library.fine')}: ${formatMoney(res.fine, currency, lang, numerals)}`
                              : t('library.returned'),
                            'success'
                          )
                        } catch (e) {
                          toast((e as Error).message, 'error')
                        }
                      }}
                    >
                      {t('library.returnBook')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** Turning the library on for phones, using the same server the exams use. */
function ShareTab() {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const preferences = useApp((s) => s.preferences)
  const setPreference = useApp((s) => s.setPreference)
  const [server, setServer] = useState<ServerStatus | null>(null)
  const { data: status } = useAsync(() => api.examServer.status(), [])
  const { data: summary } = useAsync(() => api.library.summary(), [])
  const qrRef = useRef<HTMLCanvasElement>(null)

  const shared = (preferences.library_share ?? 'off') === 'on'
  const current = server ?? status

  const toggle = async (on: boolean) => {
    try {
      await setPreference('library_share', on ? 'on' : 'off')
      setServer(on ? await api.examServer.start() : await api.examServer.stop())
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const address = current?.url ? `${current.url}/library` : null

  // Typing an address into a phone is where this goes wrong, so give them
  // something to point a camera at — the same thing the exam screen does.
  useEffect(() => {
    if (!shared || !address || !qrRef.current) return
    QRCode.toCanvas(qrRef.current, address, { width: 190, margin: 1 }).catch(() => {})
  }, [shared, address])

  return (
    <Card>
      <div className="max-w-2xl space-y-5">
        <Toggle checked={shared} onChange={(v) => void toggle(v)} label={t('library.shareOn')} hint={t('library.shareHelp')} />

        {/* Sharing an empty shelf looks broken from a phone, so say so here. */}
        {shared && summary && summary.digital === 0 && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle size={22} className="shrink-0 text-amber-600" />
            <p>{t('library.shareNoFiles')}</p>
          </div>
        )}

        {shared && address ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
            <p className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
              <Wifi size={20} /> {t('library.shareAddress')}
            </p>
            <p className="mt-2 break-all text-2xl font-bold" dir="ltr">{address}</p>
            <div className="mt-4 flex items-center gap-4">
              <canvas ref={qrRef} className="rounded-xl bg-white p-2" />
              <p className="text-sm text-ink-600 dark:text-ink-300">{t('library.shareScan')}</p>
            </div>
          </div>
        ) : shared ? (
          <div className="flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <WifiOff size={22} className="shrink-0 text-amber-600" />
            <p>{t('exams.noNetwork')}</p>
          </div>
        ) : (
          <p className="text-ink-500 dark:text-ink-300">{t('library.shareOff')}</p>
        )}
      </div>
    </Card>
  )
}
