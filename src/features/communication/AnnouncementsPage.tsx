import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType } from '@/store/app'
import type { Announcement, CalendarEvent, EventType } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select, TextInput, TextArea } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { formatDate, todayIso, daysBetween } from '@/lib/format'

export function AnnouncementsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'notices' | 'calendar'>('notices')

  return (
    <div>
      <PageHeader title={tab === 'notices' ? t('announcements.title') : t('calendar.title')} />
      <Tabs
        tabs={[
          { id: 'notices' as const, label: t('announcements.title'), icon: <Megaphone size={18} /> },
          { id: 'calendar' as const, label: t('calendar.title'), icon: <CalendarDays size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'notices' ? <Notices /> : <Events />}
    </div>
  )
}

function Notices() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [editing, setEditing] = useState<Announcement | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Announcement | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.announcements.list(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('announcements.add')}</Button>
      </div>

      {!data?.length ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={44} />}
            title={t('announcements.emptyTitle')}
            body={t('announcements.emptyBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('announcements.add')}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{a.title}</h3>
                  {a.body && <p className="mt-1 whitespace-pre-wrap text-ink-600 dark:text-ink-200">{a.body}</p>}
                  <p className="mt-2 text-sm text-ink-400">
                    {formatDate(a.date, lang, { calendar, numerals })}
                    {a.author_name ? ` · ${t('announcements.postedBy', { name: a.author_name })}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditing(a)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(a)} icon={<Trash2 size={16} className="text-rose-600" />}>
                    <span className="sr-only">{t('common.delete')}</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <NoticeEditor
          announcement={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.title ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.announcements.remove(deleting.id)
          setDeleting(null); reload(); touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function NoticeEditor({
  announcement, onClose, onSaved,
}: {
  announcement: Announcement | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [body, setBody] = useState(announcement?.body ?? '')
  const [date, setDate] = useState(announcement?.date ?? todayIso())

  return (
    <Modal
      open
      onClose={onClose}
      title={announcement ? t('common.edit') : t('announcements.add')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!title.trim()}
            onClick={async () => {
              try {
                await api.announcements.save({ ...(announcement ? { id: announcement.id } : {}), title, body: body || null, date })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label={t('announcements.headline')} required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <TextArea label={t('announcements.message')} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        <TextInput label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  )
}

function Events() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.events.list(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const toneFor = (type: EventType) =>
    type === 'exam' ? 'amber' : type === 'holiday' ? 'green' : type === 'reminder' ? 'red' : 'blue'

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('calendar.addEvent')}</Button>
      </div>

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState
            icon={<CalendarDays size={44} />}
            title={t('calendar.emptyTitle')}
            body={t('calendar.emptyBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('calendar.addEvent')}</Button>}
          />
        ) : (
          <ul>
            {data.map((e) => {
              const days = daysBetween(todayIso(), e.date)
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <StatusPill tone={toneFor(e.type) as 'blue'}>{t(`calendar.${e.type}`)}</StatusPill>
                  <span className="min-w-[10rem] flex-1">
                    <span className="block font-bold">{e.title}</span>
                    <span className="block text-sm text-ink-500 dark:text-ink-300">
                      {formatDate(e.date, lang, { calendar, numerals })}
                      {e.end_date ? ` → ${formatDate(e.end_date, lang, { calendar, numerals })}` : ''}
                    </span>
                  </span>
                  {days >= 0 && (
                    <span className="text-sm text-ink-500 dark:text-ink-300">
                      {days === 0 ? t('calendar.todayLabel') : days === 1 ? t('calendar.tomorrow') : t('calendar.inDays', { count: days })}
                    </span>
                  )}
                  <Button size="sm" onClick={() => setEditing(e)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(e)} icon={<Trash2 size={16} className="text-rose-600" />}>
                    <span className="sr-only">{t('common.delete')}</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <EventEditor
          event={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.title ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.events.remove(deleting.id)
          setDeleting(null); reload(); touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function EventEditor({
  event, onClose, onSaved,
}: {
  event: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? todayIso())
  const [endDate, setEndDate] = useState(event?.end_date ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'event')
  const [note, setNote] = useState(event?.note ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={event ? t('common.edit') : t('calendar.addEvent')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!title.trim() || !date}
            onClick={async () => {
              try {
                await api.events.save({ ...(event ? { id: event.id } : {}), title, date, end_date: endDate || null, type, note: note || null })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label={t('calendar.eventName')} required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <Select
          label={t('calendar.eventType')}
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
          options={(['event', 'holiday', 'exam', 'reminder'] as const).map((v) => ({ value: v, label: t(`calendar.${v}`) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('calendar.startsOn')} required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextInput label={t('calendar.endsOn')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <TextArea label={t('common.notes')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}
