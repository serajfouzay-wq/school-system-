import { useState } from 'react'
import {
  Bus, Plus, Pencil, Trash2, Phone, Clock, Users, Wallet,
  UserMinus, Printer, MessageCircle, AlertTriangle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useAsync } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCurrency, useCalendarType } from '@/store/app'
import type { Route, Rider, Role, Recipient } from '@shared/types'
import { can } from '@shared/permissions'
import { Button } from '@/components/ui/Button'
import { Card, StatCard } from '@/components/ui/Card'
import { Select, TextInput, TextArea, Toggle, PlainFields } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { WhatsAppQueue } from '@/features/communication/WhatsAppQueue'
import { formatMoney, formatDate, localName, todayIso } from '@/lib/format'
import { usePrinting } from '@/lib/printing'
import { reportHtml, transportReceiptHtml } from '@/print/templates'

export function TransportPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'routes' | 'riders' | 'money'>('routes')

  return (
    <div>
      <PageHeader title={t('transport.title')} subtitle={t('transport.subtitle')} />
      <ModuleTour
        moduleKey="transport"
        tips={[
          { title: t('transport.addRoute'), body: t('transport.emptyBody') },
          { title: t('transport.addRider'), body: t('transport.addRiderTip') },
          { title: t('transport.money'), body: t('transport.moneyTip') },
        ]}
      />
      <Tabs
        tabs={[
          { id: 'routes' as const, label: t('transport.routes'), icon: <Bus size={18} /> },
          { id: 'riders' as const, label: t('transport.riders'), icon: <Users size={18} /> },
          { id: 'money' as const, label: t('transport.money'), icon: <Wallet size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'routes' && <RoutesTab />}
      {tab === 'riders' && <RidersTab />}
      {tab === 'money' && <MoneyTab />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="text-end font-semibold">{value}</dd>
    </div>
  )
}

function RoutesTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const role = useApp((s) => s.user?.role) as Role | undefined
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [editing, setEditing] = useState<Route | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Route | null>(null)

  const { data: summary } = useAsync(() => api.transport.summary(), [])
  const { data: routes, loading, error, reload } = useAsync(() => api.transport.routes(), [])

  if (loading && !routes) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      {summary && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('transport.routes')} value={summary.routes} icon={<Bus size={26} />} tone="brand" />
          <StatCard label={t('transport.riders')} value={summary.riders} icon={<Users size={26} />} tone="violet" />
          <StatCard
            label={t('transport.collected')}
            value={formatMoney(summary.collected, currency, lang, numerals)}
            icon={<Wallet size={26} />}
            tone="emerald"
          />
          <StatCard
            label={t('transport.outstanding')}
            value={formatMoney(summary.outstanding, currency, lang, numerals)}
            hint={`${t('transport.unpaidRiders')}: ${summary.unpaidRiders}`}
            icon={<AlertTriangle size={26} />}
            tone={summary.outstanding > 0 ? 'rose' : 'emerald'}
          />
        </div>
      )}

      {can(role, 'transport.manage') && (
        <div className="mb-4">
          <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
            {t('transport.addRoute')}
          </Button>
        </div>
      )}

      {!routes?.length ? (
        <Card>
          <EmptyState
            icon={<Bus size={44} />}
            title={t('transport.emptyTitle')}
            body={t('transport.emptyBody')}
            action={
              can(role, 'transport.manage') && (
                <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>
                  {t('transport.addRoute')}
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{localName(r, lang)}</h3>
                  {r.vehicle_number && <p className="text-sm text-ink-500 dark:text-ink-300">{r.vehicle_number}</p>}
                </div>
                {can(role, 'transport.manage') && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditing(r)} icon={<Pencil size={16} />}>
                      <span className="sr-only">{t('common.edit')}</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(r)} icon={<Trash2 size={16} className="text-rose-600" />}>
                      <span className="sr-only">{t('common.delete')}</span>
                    </Button>
                  </div>
                )}
              </div>

              <dl className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
                <Row label={t('transport.driverName')} value={localName(r, lang, 'driver_name') || '—'} />
                <Row
                  label={t('transport.driverPhone')}
                  value={
                    r.driver_phone ? (
                      <span dir="ltr" className="inline-flex items-center gap-1.5"><Phone size={14} />{r.driver_phone}</span>
                    ) : '—'
                  }
                />
                {r.assistant_name && <Row label={t('transport.assistant')} value={r.assistant_name} />}
                <Row
                  label={t('transport.morningTime')}
                  value={
                    r.morning_time ? (
                      <span dir="ltr" className="inline-flex items-center gap-1.5"><Clock size={14} />{r.morning_time}</span>
                    ) : '—'
                  }
                />
                <Row
                  label={t('transport.afternoonTime')}
                  value={
                    r.afternoon_time ? (
                      <span dir="ltr" className="inline-flex items-center gap-1.5"><Clock size={14} />{r.afternoon_time}</span>
                    ) : '—'
                  }
                />
                {r.stops && <Row label={t('transport.stops')} value={r.stops} />}
              </dl>

              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
                <StatusPill tone="blue" icon={<Users size={15} />}>{r.rider_count ?? 0}</StatusPill>
                {r.seats_left !== null && r.seats_left !== undefined && (
                  <StatusPill tone={r.seats_left === 0 ? 'red' : 'grey'}>
                    {r.seats_left === 0 ? t('transport.busFull') : t('transport.seatsLeft', { count: r.seats_left })}
                  </StatusPill>
                )}
                <StatusPill tone="violet">{formatMoney(r.fee_per_term, currency, lang, numerals)}</StatusPill>
                {(r.outstanding ?? 0) > 0 && (
                  <StatusPill tone="red">
                    {t('transport.outstanding')}: {formatMoney(r.outstanding ?? 0, currency, lang, numerals)}
                  </StatusPill>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <RouteEditor
          route={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.transport.removeRoute(deleting.id)
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

function RouteEditor({ route, onClose, onSaved }: { route: Route | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [form, setForm] = useState({
    name: route?.name ?? '',
    name_ar: route?.name_ar ?? '',
    driver_name: route?.driver_name ?? '',
    driver_name_ar: route?.driver_name_ar ?? '',
    driver_phone: route?.driver_phone ?? '',
    assistant_name: route?.assistant_name ?? '',
    vehicle_number: route?.vehicle_number ?? '',
    capacity: route?.capacity != null ? String(route.capacity) : '',
    morning_time: route?.morning_time ?? '',
    afternoon_time: route?.afternoon_time ?? '',
    stops: route?.stops ?? '',
    fee_per_term: String(route?.fee_per_term ?? 0),
    notes: route?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal
      open
      onClose={onClose}
      title={route ? t('transport.editRoute') : t('transport.addRoute')}
      size="lg"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            loading={busy}
            disabled={!form.name.trim()}
            onClick={async () => {
              setBusy(true)
              try {
                await api.transport.saveRoute({
                  ...(route ? { id: route.id } : {}),
                  ...form,
                  capacity: form.capacity ? Number(form.capacity) : null,
                  fee_per_term: Number(form.fee_per_term) || 0,
                })
                onSaved()
              } catch (e) {
                toast((e as Error).message, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      {/* Only the route's name is required here. Marking the other eleven
          boxes "(optional)" is noise, so the red * carries the message alone. */}
      <PlainFields>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('transport.routeName')} required value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          <TextInput label={t('common.nameArabic')} dir="rtl" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label={t('transport.driverName')} value={form.driver_name} onChange={(e) => set('driver_name', e.target.value)} />
          <TextInput label={t('transport.driverNameAr')} value={form.driver_name_ar} onChange={(e) => set('driver_name_ar', e.target.value)} dir="rtl" />
          <TextInput label={t('transport.driverPhone')} type="tel" dir="ltr" value={form.driver_phone} onChange={(e) => set('driver_phone', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label={t('transport.assistant')} value={form.assistant_name} onChange={(e) => set('assistant_name', e.target.value)} />
          <TextInput label={t('transport.vehicle')} dir="ltr" value={form.vehicle_number} onChange={(e) => set('vehicle_number', e.target.value)} />
          <TextInput label={t('transport.capacity')} type="number" dir="ltr" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label={t('transport.morningTime')} type="time" value={form.morning_time} onChange={(e) => set('morning_time', e.target.value)} />
          <TextInput label={t('transport.afternoonTime')} type="time" value={form.afternoon_time} onChange={(e) => set('afternoon_time', e.target.value)} />
          <TextInput label={t('transport.feePerTerm')} type="number" dir="ltr" value={form.fee_per_term} onChange={(e) => set('fee_per_term', e.target.value)} />
        </div>
        <TextArea label={t('transport.stops')} rows={2} value={form.stops} onChange={(e) => set('stops', e.target.value)} />
        <TextArea label={t('common.notes')} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      </PlainFields>
    </Modal>
  )
}

function RidersTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const role = useApp((s) => s.user?.role) as Role | undefined
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print, school } = usePrinting()

  const [routeId, setRouteId] = useState('')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [adding, setAdding] = useState(false)
  const [ending, setEnding] = useState<Rider | null>(null)
  const [paying, setPaying] = useState<Rider | null>(null)

  const { data: routes } = useAsync(() => api.transport.routes(), [])
  const { data: riders, loading, reload } = useAsync(
    () => api.transport.riders({ routeId: routeId ? Number(routeId) : undefined, unpaidOnly }),
    [routeId, unpaidOnly]
  )

  /** The sheet the driver actually carries: who gets on, where, and a number. */
  const printDriverSheet = async () => {
    if (!school || !riders?.length) return
    const route = routes?.find((r) => r.id === Number(routeId))
    await print(
      reportHtml({
        school,
        logo: (await context()).logo,
        title: t('transport.driverSheet'),
        meta: route ? `${localName(route, lang)} · ${localName(route, lang, 'driver_name')} · ${route.morning_time ?? ''}` : '',
        columns: [
          { label: t('common.name') },
          { label: t('common.class') },
          { label: t('transport.pickupPoint') },
          { label: t('students.guardianPhone') },
        ],
        rows: riders.map((r) => [
          localName(r, lang, 'student_name'),
          localName(r, lang, 'class_label'),
          r.pickup_point ?? '',
          r.guardian_phone ?? '',
        ]),
        lang,
        t,
      })
    )
  }

  if (loading && !riders) return <Loading />

  return (
    <div>
      <FilterBar>
        <div className="min-w-[13rem] flex-1">
          <Select
            label={t('transport.routes')}
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            placeholder={t('common.all')}
            options={(routes ?? []).map((r) => ({ value: r.id, label: localName(r, lang) }))}
          />
        </div>
        <div className="min-w-[16rem]">
          <Toggle checked={unpaidOnly} onChange={setUnpaidOnly} label={t('transport.onlyUnpaid')} />
        </div>
        <Button onClick={() => void printDriverSheet()} icon={<Printer size={18} />}>{t('transport.printList')}</Button>
        {can(role, 'transport.manage') && (
          <Button size="lg" variant="primary" disabled={!routes?.length} onClick={() => setAdding(true)} icon={<Plus size={20} />}>
            {t('transport.addRider')}
          </Button>
        )}
      </FilterBar>

      <Card padded={false}>
        {!riders?.length ? (
          <EmptyState icon={<Users size={44} />} title={t('transport.noRiders')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="p-3 text-start font-bold">{t('common.student')}</th>
                  <th className="p-3 text-start font-bold">{t('transport.routes')}</th>
                  <th className="p-3 text-start font-bold">{t('transport.pickupPoint')}</th>
                  <th className="p-3 text-start font-bold">{t('transport.direction')}</th>
                  <th className="p-3 text-end font-bold">{t('transport.paid')}</th>
                  <th className="p-3 text-end font-bold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => {
                  const owes = (r.balance ?? 0) > 0
                  const partly = owes && (r.paid ?? 0) > 0
                  return (
                    <tr key={r.id} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                      <td className="p-3">
                        <span className="block font-semibold">
                          {localName(r, lang, 'student_name')}
                        </span>
                        <span className="block text-sm text-ink-500 dark:text-ink-300">
                          {r.student_code} · {localName(r, lang, 'class_label')}
                        </span>
                      </td>
                      <td className="p-3">{localName(r, lang, 'route_name')}</td>
                      <td className="p-3">{r.pickup_point ?? '—'}</td>
                      <td className="p-3">
                        {t(`transport.dir${r.direction.charAt(0).toUpperCase()}${r.direction.slice(1)}`)}
                      </td>
                      <td className="p-3 text-end">
                        {/* Never colour alone: the state is spelled out too. */}
                        <StatusPill tone={owes ? (partly ? 'amber' : 'red') : 'green'}>
                          {owes
                            ? `${partly ? t('transport.partPaid') : t('transport.notPaid')} · ${formatMoney(r.balance ?? 0, currency, lang, numerals)}`
                            : t('transport.paid')}
                        </StatusPill>
                      </td>
                      <td className="p-3">
                        <span className="flex justify-end gap-2">
                          {can(role, 'transport.manage') && owes && (
                            <Button size="sm" variant="primary" onClick={() => setPaying(r)} icon={<Wallet size={16} />}>
                              {t('transport.recordPayment')}
                            </Button>
                          )}
                          {can(role, 'transport.manage') && (
                            <Button size="sm" variant="ghost" onClick={() => setEnding(r)} icon={<UserMinus size={16} className="text-rose-600" />}>
                              <span className="sr-only">{t('transport.endRide')}</span>
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && (
        <AddRiderDialog
          routes={routes ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); reload(); touch() }}
        />
      )}

      {paying && (
        <PayDialog rider={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload(); touch() }} />
      )}

      <ConfirmDialog
        open={!!ending}
        title={t('transport.endRide')}
        body={t('transport.endRideConfirm')}
        confirmLabel={t('transport.endRide')}
        onConfirm={async () => {
          if (!ending) return
          await api.transport.endRide(ending.id)
          setEnding(null); reload(); touch()
          toast(t('common.saved'), 'success')
        }}
        onCancel={() => setEnding(null)}
      />
    </div>
  )
}

function AddRiderDialog({ routes, onClose, onSaved }: { routes: Route[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const [routeId, setRouteId] = useState(String(routes[0]?.id ?? ''))
  const [studentId, setStudentId] = useState('')
  const [pickup, setPickup] = useState('')
  const [direction, setDirection] = useState<Rider['direction']>('both')
  const { data: students } = useAsync(() => api.students.list({ status: 'active' }), [])

  return (
    <Modal
      open
      onClose={onClose}
      title={t('transport.addRider')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!routeId || !studentId}
            onClick={async () => {
              try {
                await api.transport.addRider({
                  route_id: Number(routeId),
                  student_id: Number(studentId),
                  pickup_point: pickup || null,
                  direction,
                })
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
        <Select
          label={t('transport.routes')}
          required
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          options={routes.map((r) => ({ value: r.id, label: localName(r, lang) }))}
        />
        <Select
          label={t('common.student')}
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder={t('common.select')}
          options={(students ?? []).map((s) => ({
            value: s.id,
            label: `${localName(s, lang, 'full_name')} — ${s.student_code}`,
          }))}
        />
        <TextInput label={t('transport.pickupPoint')} value={pickup} onChange={(e) => setPickup(e.target.value)} />
        <Select
          label={t('transport.direction')}
          value={direction}
          onChange={(e) => setDirection(e.target.value as Rider['direction'])}
          options={[
            { value: 'both', label: t('transport.dirBoth') },
            { value: 'morning', label: t('transport.dirMorning') },
            { value: 'afternoon', label: t('transport.dirAfternoon') },
          ]}
        />
      </div>
    </Modal>
  )
}

/** What the office hands the parent. Called straight after saving a payment,
 *  and again from the list when someone asks for a duplicate. */
interface ReceiptFacts {
  receiptNo: string
  date: string
  method: string
  amount: number
  studentName: string
  studentCode: string
  classLabel: string
  routeName: string
  balanceAfter: number
  note?: string | null
}

function PayDialog({ rider, onClose, onSaved }: { rider: Rider; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const { context, print, school } = usePrinting()
  const [amount, setAmount] = useState(String(rider.balance ?? 0))
  const [date, setDate] = useState(todayIso())
  const [method, setMethod] = useState('cash')

  const printReceipt = async (facts: ReceiptFacts) => {
    if (!school) return
    const ctx = await context()
    await print(transportReceiptHtml({ school, ...facts }, ctx))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('transport.recordPayment')}
      subtitle={`${localName(rider, lang, 'student_name')} · ${t('transport.balance')}: ${formatMoney(rider.balance ?? 0, currency, lang, numerals)}`}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!Number(amount)}
            onClick={async () => {
              try {
                const paid = Number(amount)
                const saved = await api.transport.recordPayment({
                  rider_id: rider.id,
                  amount_paid: paid,
                  date,
                  method,
                })
                onSaved()
                // The parent is standing at the desk; the receipt goes with them.
                void printReceipt({
                  receiptNo: String(saved?.receipt_no ?? ''),
                  date,
                  method,
                  amount: paid,
                  studentName: localName(rider, lang, 'student_name'),
                  studentCode: rider.student_code ?? '',
                  classLabel: localName(rider, lang, 'class_label'),
                  routeName: localName(rider, lang, 'route_name'),
                  balanceAfter: Math.max(0, (rider.balance ?? 0) - paid),
                })
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
        <TextInput
          label={t('common.amount')}
          required
          type="number"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <Select
          label={t('fees.paymentMethod')}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={(['cash', 'bank', 'card', 'other'] as const).map((m) => ({ value: m, label: t(`fees.${m}`) }))}
        />
        <TextInput label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  )
}

function MoneyTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const { context, print, school } = usePrinting()
  const [waOpen, setWaOpen] = useState(false)
  const [waRecipients, setWaRecipients] = useState<Recipient[]>([])

  const { data: summary } = useAsync(() => api.transport.summary(), [])
  const { data: unpaid } = useAsync(() => api.transport.riders({ unpaidOnly: true }), [])
  const { data: payments, loading } = useAsync(() => api.transport.payments(), [])

  if (loading && !payments) return <Loading />

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('transport.expected')} value={formatMoney(summary.expected, currency, lang, numerals)} tone="violet" />
          <StatCard label={t('transport.collected')} value={formatMoney(summary.collected, currency, lang, numerals)} tone="emerald" />
          <StatCard
            label={t('transport.outstanding')}
            value={formatMoney(summary.outstanding, currency, lang, numerals)}
            tone={summary.outstanding ? 'rose' : 'emerald'}
          />
        </div>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-bold">{t('transport.unpaidRiders')}</h2>
          {!!unpaid?.length && (
            <Button
              variant="success"
              icon={<MessageCircle size={18} />}
              onClick={() => {
                // Bus money reuses the same WhatsApp queue as school fees.
                setWaRecipients(
                  unpaid.map((r) => ({
                    student_id: r.student_id,
                    student_name: r.student_name ?? '',
                    student_name_ar: r.student_name_ar ?? null,
                    student_code: r.student_code ?? '',
                    guardian_name: null,
                    phone: r.guardian_phone ?? null,
                    class_label: localName(r, lang, 'class_label'),
                    amount: Math.round(r.balance ?? 0),
                  }))
                )
                setWaOpen(true)
              }}
            >
              {t('whatsapp.sendAll')}
            </Button>
          )}
        </div>
        {!unpaid?.length ? (
          <EmptyState title={t('transport.paid')} />
        ) : (
          <ul>
            {unpaid.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-semibold">
                    {localName(r, lang, 'student_name')}
                  </span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">{localName(r, lang, 'route_name')} · {localName(r, lang, 'class_label')}</span>
                </span>
                <StatusPill tone="red">{formatMoney(r.balance ?? 0, currency, lang, numerals)}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-3"><h2 className="text-lg font-bold">{t('fees.payments')}</h2></div>
        {!payments?.length ? (
          <EmptyState title={t('fees.noPayments')} />
        ) : (
          <ul>
            {payments.slice(0, 30).map((p) => (
              <li key={String(p.id)} className="flex flex-wrap items-center gap-3 border-b p-3 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="font-mono text-sm font-semibold" dir="ltr">{String(p.receipt_no)}</span>
                <span className="min-w-[8rem] flex-1">{localName(p, lang, 'student_name')}</span>
                <span className="text-sm text-ink-500 dark:text-ink-300">{localName(p, lang, 'route_name')}</span>
                <span>{formatDate(String(p.date), lang, { calendar, numerals })}</span>
                <StatusPill tone="green">{formatMoney(Number(p.amount_paid), currency, lang, numerals)}</StatusPill>
                {/* Parents lose receipts; printing another one should not mean
                    hunting through a ledger. */}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Printer size={16} />}
                  onClick={async () => {
                    if (!school) return
                    const ctx = await context()
                    await print(
                      transportReceiptHtml(
                        {
                          school,
                          receiptNo: String(p.receipt_no),
                          date: String(p.date),
                          method: String(p.method ?? 'cash'),
                          amount: Number(p.amount_paid),
                          studentName: localName(p, lang, 'student_name'),
                          studentCode: String(p.student_code ?? ''),
                          classLabel: localName(p, lang, 'class_label'),
                          routeName: localName(p, lang, 'route_name'),
                          balanceAfter: Number(p.balance_after ?? 0),
                          note: (p.note as string) ?? null,
                        },
                        ctx
                      )
                    )
                  }}
                >
                  {t('transport.printReceipt')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <WhatsAppQueue recipients={waRecipients} purpose="fees" open={waOpen} onClose={() => setWaOpen(false)} />
    </div>
  )
}
