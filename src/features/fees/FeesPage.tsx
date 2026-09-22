import { useState } from 'react'
import { Wallet, Plus, Printer, Receipt, TrendingUp, Trash2, Pencil, Bell, FolderInput, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { hasModule } from '@/lib/brand'
import { useAsync, useDebounced } from '@/lib/hooks'
import { useApp, useLang, useNumerals, useCalendarType, useCurrency } from '@/store/app'
import type { FeePayment, FeeStructure, StudentFeeSummary } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle, StatCard } from '@/components/ui/Card'
import { Select, TextInput, TextArea, Toggle } from '@/components/ui/Field'
import { EmptyState, Loading, ErrorState, StatusPill } from '@/components/ui/Feedback'
import { PageHeader, FilterBar, Tabs } from '@/components/ui/PageHeader'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ModuleTour } from '@/components/ui/Tour'
import { formatMoney, formatDate, studentName, classLabel, localName, todayIso } from '@/lib/format'
import { WhatsAppQueue } from '@/features/communication/WhatsAppQueue'
import type { Recipient } from '@shared/types'
import { usePrinting } from '@/lib/printing'
import { receiptHtml, reportHtml } from '@/print/templates'

export function FeesPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'overview' | 'balances' | 'payments' | 'structures'>('overview')

  return (
    <div>
      <PageHeader title={t('fees.title')} />
      <ModuleTour
        moduleKey="fees"
        tips={[
          { title: t('fees.structures'), body: t('fees.emptyBody') },
          { title: t('fees.recordPayment'), body: t('fees.printReceipt') },
        ]}
      />
      <Tabs
        tabs={[
          { id: 'overview' as const, label: t('fees.overview'), icon: <TrendingUp size={18} /> },
          { id: 'balances' as const, label: t('fees.balances'), icon: <Wallet size={18} /> },
          { id: 'payments' as const, label: t('fees.payments'), icon: <Receipt size={18} /> },
          { id: 'structures' as const, label: t('fees.structures'), icon: <Plus size={18} /> },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'balances' && <Balances />}
      {tab === 'payments' && <Payments />}
      {tab === 'structures' && <Structures />}
    </div>
  )
}

function Overview() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const { data, loading, error, reload } = useAsync(() => api.fees.summary(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const monthly = data.byMonth.map((m) => ({ label: m.month, amount: m.amount }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`${t('fees.collected')} — ${t('fees.thisMonth')}`} value={formatMoney(data.collectedThisMonth, currency, lang, numerals)} icon={<Wallet size={28} />} tone="emerald" />
        <StatCard label={`${t('fees.collected')} — ${t('fees.thisYear')}`} value={formatMoney(data.collectedThisYear, currency, lang, numerals)} icon={<TrendingUp size={28} />} tone="brand" />
        <StatCard label={t('fees.expected')} value={formatMoney(data.expectedTotal, currency, lang, numerals)} icon={<Receipt size={28} />} tone="violet" />
        <StatCard label={t('fees.balance')} value={formatMoney(data.outstandingTotal, currency, lang, numerals)} icon={<Bell size={28} />} tone="rose" />
      </div>

      <Card>
        <CardTitle>{t('fees.byMonth')}</CardTitle>
        {monthly.length ? (
          <div style={{ height: 260 }} dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--app-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12 }}
                  formatter={(v: number) => [formatMoney(v, currency, lang, numerals), t('fees.collected')]}
                />
                <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-ink-500 dark:text-ink-300">{t('fees.noPayments')}</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 pb-0"><CardTitle>{t('fees.byClass')}</CardTitle></div>
          <table className="w-full">
            <thead>
              <tr className="border-b text-sm" style={{ borderColor: 'var(--app-border)' }}>
                <th className="p-3 text-start font-bold">{t('common.class')}</th>
                <th className="p-3 text-end font-bold">{t('fees.billed')}</th>
                <th className="p-3 text-end font-bold">{t('fees.paid')}</th>
                <th className="p-3 text-end font-bold">{t('fees.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {data.byClass.map((c) => (
                <tr key={c.class_name} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <td className="p-3 font-semibold">{c.class_name}</td>
                  <td className="p-3 text-end" dir="ltr">{formatMoney(c.billed, currency, lang, numerals)}</td>
                  <td className="p-3 text-end" dir="ltr">{formatMoney(c.paid, currency, lang, numerals)}</td>
                  <td className="p-3 text-end font-bold" dir="ltr">{formatMoney(c.balance, currency, lang, numerals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardTitle>{t('fees.byMethod')}</CardTitle>
          {data.byMethod.length ? (
            <ul className="space-y-2">
              {data.byMethod.map((m) => (
                <li key={m.method} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="font-semibold">{t(`fees.${m.method}`, { defaultValue: m.method })}</span>
                  <span dir="ltr" className="font-bold">{formatMoney(m.amount, currency, lang, numerals)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-ink-500 dark:text-ink-300">{t('fees.noPayments')}</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Balances() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const { context, print, exportCsv, school } = usePrinting()

  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState('')
  const [onlyOwing, setOnlyOwing] = useState(false)
  const [paying, setPaying] = useState<StudentFeeSummary | null>(null)
  const [waOpen, setWaOpen] = useState(false)
  const [waRecipients, setWaRecipients] = useState<Recipient[]>([])
  const debounced = useDebounced(search, 250)

  const { data: classes } = useAsync(() => api.classes.list(), [])
  const { data, loading, error, reload } = useAsync(
    () => api.fees.balances({ search: debounced, classId: classId ? Number(classId) : null, onlyOutstanding: onlyOwing }),
    [debounced, classId, onlyOwing]
  )

  const printReminder = async (row: StudentFeeSummary) => {
    if (!school) return
    await print(
      reportHtml({
        school,
        logo: (await context()).logo,
        title: t('fees.reminderTitle'),
        meta: studentName(row.student, lang),
        columns: [{ label: t('fees.feeItem') }, { label: t('common.amount'), numeric: true }],
        rows: [
          [t('fees.billed'), formatMoney(row.billed, currency, lang, numerals)],
          [t('fees.paid'), formatMoney(row.paid, currency, lang, numerals)],
          [t('fees.balance'), formatMoney(row.balance, currency, lang, numerals)],
        ],
        summary: [
          {
            label: t('fees.reminderTitle'),
            value: t('fees.reminderBody', {
              amount: formatMoney(row.balance, currency, lang, numerals),
              name: studentName(row.student, lang),
            }),
          },
        ],
        lang,
        t,
      })
    )
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <FilterBar>
        <div className="min-w-[13rem] flex-1">
          <TextInput label={t('common.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[11rem]">
          <Select
            label={t('common.class')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder={t('common.all')}
            options={(classes ?? []).map((c) => ({ value: c.id, label: localName(c, lang) }))}
          />
        </div>
        <div className="min-w-[16rem]">
          <Toggle checked={onlyOwing} onChange={setOnlyOwing} label={t('fees.onlyOutstanding')} />
        </div>
        {hasModule('whatsapp') && (
          <Button
            variant="success"
            icon={<MessageCircle size={18} />}
            onClick={async () => {
              // Everyone who still owes, in one queue.
              setWaRecipients(await api.whatsapp.feeDebtors(classId ? Number(classId) : null))
              setWaOpen(true)
            }}
          >
            {t('whatsapp.sendAll')}
          </Button>
        )}
        <Button
          onClick={() =>
            void exportCsv(
              'fee-balances.csv',
              [
                { key: 'code', label: t('students.studentId') },
                { key: 'name', label: t('common.name') },
                { key: 'class', label: t('common.class') },
                { key: 'billed', label: t('fees.billed') },
                { key: 'paid', label: t('fees.paid') },
                { key: 'balance', label: t('fees.balance') },
              ],
              (data ?? []).map((r) => ({
                code: r.student.student_code,
                name: studentName(r.student, lang),
                class: classLabel(r.student, lang),
                billed: r.billed,
                paid: r.paid,
                balance: r.balance,
              }))
            )
          }
          icon={<FolderInput size={18} />}
        >
          {t('common.exportCsv')}
        </Button>
      </FilterBar>

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState icon={<Wallet size={44} />} title={t('common.nothingHereYet')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="p-3 text-start font-bold">{t('common.student')}</th>
                  <th className="p-3 text-start font-bold">{t('common.class')}</th>
                  <th className="p-3 text-end font-bold">{t('fees.billed')}</th>
                  <th className="p-3 text-end font-bold">{t('fees.paid')}</th>
                  <th className="p-3 text-end font-bold">{t('fees.balance')}</th>
                  <th className="p-3 text-end font-bold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.student.id} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    <td className="p-3">
                      <span className="block font-semibold">{studentName(row.student, lang)}</span>
                      <span className="block text-sm text-ink-500 dark:text-ink-300">{row.student.student_code}</span>
                    </td>
                    <td className="p-3">{classLabel(row.student, lang)}</td>
                    <td className="p-3 text-end" dir="ltr">{formatMoney(row.billed, currency, lang, numerals)}</td>
                    <td className="p-3 text-end" dir="ltr">{formatMoney(row.paid, currency, lang, numerals)}</td>
                    <td className="p-3 text-end">
                      <StatusPill tone={row.balance > 0 ? 'red' : 'green'}>
                        <span dir="ltr">{formatMoney(row.balance, currency, lang, numerals)}</span>
                      </StatusPill>
                    </td>
                    <td className="p-3">
                      <span className="flex justify-end gap-2">
                        {row.balance > 0 && (
                          <>
                            {hasModule('whatsapp') && (
                              <Button
                                size="sm"
                                variant="success"
                                icon={<MessageCircle size={16} />}
                                onClick={() => {
                                  setWaRecipients([{
                                    student_id: row.student.id,
                                    student_name: row.student.full_name,
                                    student_name_ar: row.student.full_name_ar,
                                    student_code: row.student.student_code,
                                    guardian_name: row.student.guardian_name ?? null,
                                    phone: row.student.guardian_phone ?? null,
                                    class_label: classLabel(row.student, lang),
                                    amount: Math.round(row.balance),
                                  }])
                                  setWaOpen(true)
                                }}
                              >
                                {t('whatsapp.send')}
                              </Button>
                            )}
                            <Button size="sm" onClick={() => void printReminder(row)} icon={<Bell size={16} />}>{t('fees.sendReminder')}</Button>
                          </>
                        )}
                        <Button size="sm" variant="primary" onClick={() => setPaying(row)} icon={<Plus size={16} />}>{t('fees.recordPayment')}</Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paying && <PaymentDialog summary={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); reload() }} />}

      <WhatsAppQueue recipients={waRecipients} purpose="fees" open={waOpen} onClose={() => setWaOpen(false)} />
    </div>
  )
}

function PaymentDialog({
  summary, onClose, onSaved,
}: {
  summary: StudentFeeSummary
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print } = usePrinting()

  const [amount, setAmount] = useState(summary.balance > 0 ? String(summary.balance) : '')
  const [method, setMethod] = useState<FeePayment['method']>('cash')
  const [date, setDate] = useState(todayIso())
  const [structureId, setStructureId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: structures } = useAsync(() => api.fees.structures(), [])

  const save = async (thenPrint: boolean) => {
    setBusy(true)
    try {
      const payment = await api.fees.recordPayment({
        student_id: summary.student.id,
        fee_structure_id: structureId ? Number(structureId) : null,
        amount_paid: Number(amount),
        date,
        method,
        note: note || null,
      })
      touch()
      toast(`${t('fees.receiptNo')}: ${payment.receipt_no}`, 'success')
      if (thenPrint) {
        const receipt = await api.fees.receipt(payment.id)
        await print(receiptHtml(receipt, await context()))
      }
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
      title={t('fees.recordPayment')}
      subtitle={`${studentName(summary.student, lang)} · ${t('fees.balance')}: ${formatMoney(summary.balance, currency, lang, numerals)}`}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="lg" loading={busy} disabled={!Number(amount)} onClick={() => void save(false)}>{t('common.save')}</Button>
          <Button size="lg" variant="primary" loading={busy} disabled={!Number(amount)} onClick={() => void save(true)} icon={<Printer size={18} />}>
            {t('fees.printReceipt')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label={t('common.amount')}
          required
          type="number"
          inputMode="decimal"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('fees.paymentMethod')}
            value={method}
            onChange={(e) => setMethod(e.target.value as FeePayment['method'])}
            options={(['cash', 'bank', 'card', 'other'] as const).map((m) => ({ value: m, label: t(`fees.${m}`) }))}
          />
          <TextInput label={t('common.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Select
          label={t('fees.feeItem')}
          value={structureId}
          onChange={(e) => setStructureId(e.target.value)}
          placeholder={t('common.none')}
          options={(structures ?? []).map((s) => ({
            value: s.id,
            label: `${localName(s, lang, 'item_name')} — ${formatMoney(s.amount, currency, lang, numerals)}`,
          }))}
        />
        <TextArea label={t('common.notes')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

function Payments() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const calendar = useCalendarType()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)
  const { context, print } = usePrinting()

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [deleting, setDeleting] = useState<FeePayment | null>(null)
  const debounced = useDebounced(search, 250)

  const { data, loading, error, reload } = useAsync(
    () => api.fees.payments({ search: debounced, from: from || undefined, to: to || undefined }),
    [debounced, from, to]
  )

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <FilterBar>
        <div className="min-w-[13rem] flex-1">
          <TextInput label={t('common.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[10rem]"><TextInput label={t('common.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="min-w-[10rem]"><TextInput label={t('common.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </FilterBar>

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState icon={<Receipt size={44} />} title={t('fees.noPayments')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="p-3 text-start font-bold">{t('fees.receiptNo')}</th>
                  <th className="p-3 text-start font-bold">{t('common.student')}</th>
                  <th className="p-3 text-start font-bold">{t('common.date')}</th>
                  <th className="p-3 text-start font-bold">{t('fees.paymentMethod')}</th>
                  <th className="p-3 text-end font-bold">{t('common.amount')}</th>
                  <th className="p-3 text-end font-bold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                    <td className="p-3 font-mono font-semibold" dir="ltr">{p.receipt_no}</td>
                    <td className="p-3">
                      <span className="block font-semibold">{p.student_name}</span>
                      <span className="block text-sm text-ink-500 dark:text-ink-300">{p.student_code}</span>
                    </td>
                    <td className="p-3">{formatDate(p.date, lang, { calendar, numerals })}</td>
                    <td className="p-3">{t(`fees.${p.method}`, { defaultValue: p.method })}</td>
                    <td className="p-3 text-end font-bold" dir="ltr">{formatMoney(p.amount_paid, currency, lang, numerals)}</td>
                    <td className="p-3">
                      <span className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const receipt = await api.fees.receipt(p.id)
                            await print(receiptHtml(receipt, await context()))
                          }}
                          icon={<Printer size={16} />}
                        >
                          {t('common.print')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(p)} icon={<Trash2 size={16} className="text-rose-600" />}>
                          <span className="sr-only">{t('common.delete')}</span>
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.receipt_no ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          const victim = deleting
          setDeleting(null)
          await api.fees.removePayment(victim.id)
          touch()
          reload()
          toast(t('common.delete'), 'success', {
            label: t('common.undo'),
            run: async () => {
              const bin = await api.recycle.list()
              const entry = bin.find((b) => b.table_name === 'fee_payments' && b.record_id === victim.id)
              if (entry) { await api.recycle.restore(entry.id); touch(); reload(); toast(t('common.undone'), 'info') }
            },
          })
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function Structures() {
  const { t } = useTranslation()
  const lang = useLang()
  const numerals = useNumerals()
  const currency = useCurrency()
  const toast = useApp((s) => s.toast)
  const touch = useApp((s) => s.touch)

  const [editing, setEditing] = useState<FeeStructure | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<FeeStructure | null>(null)

  const { data, loading, error, reload } = useAsync(() => api.fees.structures(), [])

  if (loading && !data) return <Loading />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <div className="mb-4">
        <Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('fees.addFeeItem')}</Button>
      </div>

      <Card padded={false}>
        {!data?.length ? (
          <EmptyState
            icon={<Wallet size={44} />}
            title={t('fees.emptyTitle')}
            body={t('fees.emptyBody')}
            action={<Button size="lg" variant="primary" onClick={() => setAdding(true)} icon={<Plus size={20} />}>{t('fees.addFeeItem')}</Button>}
          />
        ) : (
          <ul>
            {data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-bold">{localName(f, lang, 'item_name')}</span>
                  <span className="block text-sm text-ink-500 dark:text-ink-300">
                    {f.class_name ?? t('fees.allClasses')}{f.term ? ` · ${f.term}` : ''}
                  </span>
                </span>
                <span dir="ltr" className="text-lg font-bold">{formatMoney(f.amount, currency, lang, numerals)}</span>
                <Button size="sm" onClick={() => setEditing(f)} icon={<Pencil size={16} />}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(f)} icon={<Trash2 size={16} className="text-rose-600" />}>
                  <span className="sr-only">{t('common.delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(adding || editing) && (
        <StructureEditor
          structure={editing}
          onClose={() => { setAdding(false); setEditing(null) }}
          onSaved={() => { setAdding(false); setEditing(null); reload(); touch() }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('common.confirmDelete', { name: deleting?.item_name ?? '' })}
        body={t('common.deleteExplain')}
        onConfirm={async () => {
          if (!deleting) return
          await api.fees.removeStructure(deleting.id)
          setDeleting(null)
          reload()
          touch()
          toast(t('common.delete'), 'success')
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function StructureEditor({
  structure, onClose, onSaved,
}: {
  structure: FeeStructure | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const toast = useApp((s) => s.toast)
  const { data: classes } = useAsync(() => api.classes.list(), [])

  const [itemName, setItemName] = useState(structure?.item_name ?? '')
  const [itemNameAr, setItemNameAr] = useState(structure?.item_name_ar ?? '')
  const [amount, setAmount] = useState(structure ? String(structure.amount) : '')
  const [classId, setClassId] = useState(structure?.class_id ? String(structure.class_id) : '')
  const [term, setTerm] = useState(structure?.term ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={structure ? t('common.edit') : t('fees.addFeeItem')}
      size="md"
      footer={
        <>
          <Button size="lg" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="lg"
            variant="primary"
            disabled={!itemName.trim() || !amount}
            onClick={async () => {
              try {
                await api.fees.saveStructure({
                  ...(structure ? { id: structure.id } : {}),
                  item_name: itemName,
                  item_name_ar: itemNameAr || null,
                  amount: Number(amount),
                  class_id: classId ? Number(classId) : null,
                  term: term || null,
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
        <TextInput label={t('fees.feeItem')} hint={t('fees.feeItemHelp')} required value={itemName} onChange={(e) => setItemName(e.target.value)} autoFocus />
        <TextInput label={t('common.nameArabic')} dir="rtl" value={itemNameAr} onChange={(e) => setItemNameAr(e.target.value)} />
        <TextInput label={t('common.amount')} required type="number" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('fees.appliesTo')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder={t('fees.allClasses')}
            options={(classes ?? []).map((c) => ({ value: c.id, label: localName(c, lang) }))}
          />
          <TextInput label={t('fees.term')} value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
