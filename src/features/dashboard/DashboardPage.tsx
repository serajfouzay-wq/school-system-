import { Users, GraduationCap, CalendarCheck, Wallet, Plus, CalendarDays, Megaphone, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType, useCurrency } from '@/store/app'
import { formatMoney, formatNumber, formatDate, localName, daysBetween, todayIso } from '@/lib/format'
import { Card, CardTitle, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading, ErrorState, EmptyState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'

/** The home screen: big friendly numbers, nothing technical. */
export function DashboardPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const go = useApp((s) => s.go)
  const user = useApp((s) => s.user)

  const { data, error, loading, reload } = useAsync(() => api.dashboard.summary(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const att = data.attendanceToday
  const attendanceTaken = att.present + att.absent + att.late + att.excused > 0

  const trend = data.attendanceTrend.map((d) => ({
    label: formatDate(d.date, lang, { calendar, numerals }).slice(0, 5),
    percent: d.percent,
  }))
  const enrollment = data.enrollmentByClass.map((c) => ({
    label: localName(c as unknown as Record<string, unknown>, lang, 'name'),
    count: c.count,
  }))

  return (
    <div>
      <PageHeader
        title={t('dashboard.greeting', { name: user?.name ?? '' })}
        subtitle={formatDate(todayIso(), lang, { calendar, numerals, style: 'long' })}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.totalStudents')}
          value={formatNumber(data.totalStudents, lang, numerals)}
          icon={<Users size={28} />}
          tone="brand"
          onClick={() => go({ name: 'students' })}
        />
        <StatCard
          label={t('dashboard.totalStaff')}
          value={formatNumber(data.totalStaff, lang, numerals)}
          icon={<GraduationCap size={28} />}
          tone="violet"
          onClick={() => go({ name: 'staff' })}
        />
        <StatCard
          label={t('dashboard.attendanceToday')}
          value={attendanceTaken ? `${formatNumber(att.percent, lang, numerals)}%` : '—'}
          hint={
            attendanceTaken
              ? t('attendance.summaryLine', { present: att.present, absent: att.absent, late: att.late })
              : t('dashboard.attendanceNotTaken')
          }
          icon={<CalendarCheck size={28} />}
          tone={attendanceTaken ? 'emerald' : 'amber'}
          onClick={() => go({ name: 'attendance' })}
        />
        <StatCard
          label={t('dashboard.feesCollected')}
          value={formatMoney(data.feesThisMonth.collected, currency, lang, numerals)}
          hint={`${t('dashboard.feesOutstanding')}: ${formatMoney(data.feesThisMonth.outstanding, currency, lang, numerals)}`}
          icon={<Wallet size={28} />}
          tone="emerald"
          onClick={() => go({ name: 'fees' })}
        />
      </div>

      {!attendanceTaken && (
        <Card className="mb-6 border-2 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2.5 font-bold">
              <AlertTriangle size={20} className="text-amber-600" />
              {t('dashboard.attendanceNotTaken')}
            </p>
            <Button variant="primary" onClick={() => go({ name: 'attendance' })}>{t('dashboard.takeAttendance')}</Button>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <CardTitle>{t('dashboard.quickActions')}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button size="lg" variant="primary" onClick={() => go({ name: 'students' })} icon={<Plus size={20} />}>
            {t('students.addStudent')}
          </Button>
          <Button size="lg" onClick={() => go({ name: 'attendance' })} icon={<CalendarCheck size={20} />}>
            {t('dashboard.takeAttendance')}
          </Button>
          <Button size="lg" onClick={() => go({ name: 'fees' })} icon={<Wallet size={20} />}>
            {t('fees.recordPayment')}
          </Button>
          <Button size="lg" onClick={() => go({ name: 'grades' })} icon={<GraduationCap size={20} />}>
            {t('grades.reportCards')}
          </Button>
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t('dashboard.attendanceTrend')}</CardTitle>
          {trend.length ? (
            <div style={{ height: 240 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12 }}
                    formatter={(v: number) => [`${v}%`, t('dashboard.attendanceToday')]}
                  />
                  <Line type="monotone" dataKey="percent" stroke="#1f5ceb" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-ink-500 dark:text-ink-300">{t('common.nothingHereYet')}</p>
          )}
        </Card>

        <Card>
          <CardTitle>{t('dashboard.studentsByClass')}</CardTitle>
          {enrollment.length ? (
            <div style={{ height: 240 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollment} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12 }}
                    formatter={(v: number) => [v, t('dashboard.totalStudents')]}
                  />
                  <Bar dataKey="count" fill="#1f5ceb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-ink-500 dark:text-ink-300">{t('common.nothingHereYet')}</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Button size="sm" onClick={() => go({ name: 'announcements' })}>{t('common.viewAll')}</Button>}>
            {t('dashboard.upcoming')}
          </CardTitle>
          {data.upcomingEvents.length === 0 ? (
            <EmptyState icon={<CalendarDays size={40} />} title={t('dashboard.noEvents')} />
          ) : (
            <ul className="space-y-2">
              {data.upcomingEvents.map((event) => {
                const days = daysBetween(todayIso(), event.date)
                const tone = event.type === 'exam' ? 'amber' : event.type === 'holiday' ? 'green' : event.type === 'reminder' ? 'rose' : 'blue'
                return (
                  <li key={event.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                    <StatusPill tone={tone as 'blue'}>{t(`calendar.${event.type}`)}</StatusPill>
                    <span className="min-w-0 flex-1 truncate font-semibold">{event.title}</span>
                    <span className="text-sm text-ink-500 dark:text-ink-300">
                      {days === 0 ? t('calendar.todayLabel') : days === 1 ? t('calendar.tomorrow') : t('calendar.inDays', { count: days })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Button size="sm" onClick={() => go({ name: 'announcements' })}>{t('common.viewAll')}</Button>}>
            {t('dashboard.announcements')}
          </CardTitle>
          {data.recentAnnouncements.length === 0 ? (
            <EmptyState icon={<Megaphone size={40} />} title={t('dashboard.noAnnouncements')} />
          ) : (
            <ul className="space-y-3">
              {data.recentAnnouncements.map((a) => (
                <li key={a.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                  <p className="font-bold">{a.title}</p>
                  {a.body && <p className="mt-1 text-sm text-ink-600 dark:text-ink-200">{a.body}</p>}
                  <p className="mt-1.5 text-xs text-ink-400">
                    {formatDate(a.date, lang, { calendar, numerals })}
                    {a.author_name ? ` · ${t('announcements.postedBy', { name: a.author_name })}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
