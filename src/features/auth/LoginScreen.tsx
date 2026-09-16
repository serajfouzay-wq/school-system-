import { useEffect, useState } from 'react'
import { Delete, GraduationCap, LogIn, KeyRound, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '@/lib/api'
import { useApp, useLang } from '@/store/app'
import type { User } from '@shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'

const REMEMBERED_KEY = 'school.rememberedUser'

/**
 * Signing in is a two-tap job: pick your face from the list, then tap your PIN
 * on a big number pad. Typing a user name is only needed if the list is empty.
 */
export function LoginScreen() {
  const { t } = useTranslation()
  const lang = useLang()
  const setUser = useApp((s) => s.setUser)
  const setLanguage = useApp((s) => s.setLanguage)
  const school = useApp((s) => s.school)
  const toast = useApp((s) => s.toast)

  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    api.auth
      .signInList()
      .then((list) => {
        setUsers(list)
        const remembered = localStorage.getItem(REMEMBERED_KEY)
        const match = remembered ? list.find((u) => u.username === remembered) : null
        if (match) setSelected(match)
        else if (list.length === 1) setSelected(list[0])
      })
      .catch(() => setUsers([]))
  }, [])

  const submit = async (candidate = pin) => {
    if (!selected || candidate.length < 4) return
    setBusy(true)
    setError(null)
    try {
      const user = await api.auth.login(selected.username, candidate)
      if (remember) localStorage.setItem(REMEMBERED_KEY, user.username)
      else localStorage.removeItem(REMEMBERED_KEY)
      setUser(user)
      toast(`${t('auth.signedInAs')} ${user.name}`, 'success')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const tapDigit = (digit: string) => {
    const next = (pin + digit).slice(0, 8)
    setPin(next)
    setError(null)
    if (next.length === 4) void submit(next)
  }

  if (resetting) {
    return <PinReset users={users} onDone={() => setResetting(false)} onCancel={() => setResetting(false)} />
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-brand-600 text-white shadow-lift">
            <GraduationCap size={40} />
          </span>
          <h1 className="text-3xl font-bold">
            {(lang === 'ar' && school?.name_ar) || school?.name || t('app.name')}
          </h1>
          <p className="mt-1 text-ink-500 dark:text-ink-300">{t('auth.welcome')}</p>

          {/* The language toggle is on the very first screen a user ever sees. */}
          <div className="mt-4 inline-flex gap-2 rounded-xl border p-1 surface">
            {(['en', 'ar'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void setLanguage(code)}
                className={`min-h-touch rounded-lg px-5 font-semibold transition-colors focus-ring ${
                  lang === code ? 'bg-brand-600 text-white' : 'hover:bg-ink-100 dark:hover:bg-ink-800'
                }`}
              >
                {code === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-bold">{t('auth.chooseUser')}</h2>
            {users.length === 0 ? (
              <ManualLogin onSuccess={setUser} />
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelected(u); setPin(''); setError(null) }}
                    className={[
                      'flex w-full min-h-touch items-center gap-3 rounded-xl border-2 p-3 text-start transition-all focus-ring',
                      selected?.id === u.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                        : 'surface hover:border-brand-300',
                    ].join(' ')}
                  >
                    <Avatar name={u.name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{u.name}</span>
                      <span className="block truncate text-sm text-ink-500 dark:text-ink-300">{t(`roles.${u.role}`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-bold">{t('auth.enterPin')}</h2>
            <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">
              {selected ? selected.name : t('auth.chooseUser')}
            </p>

            <div className="mb-4 flex justify-center gap-2.5" aria-live="polite">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 ${
                    i < pin.length ? 'border-brand-600 bg-brand-600' : 'border-ink-300 dark:border-ink-600'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-center font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </p>
            )}

            <div className="mx-auto grid max-w-xs grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <PadKey key={d} onClick={() => tapDigit(d)} disabled={!selected || busy}>{d}</PadKey>
              ))}
              <PadKey onClick={() => setPin('')} disabled={!selected || busy} aria-label={t('auth.clear')}>
                <span className="text-base">{t('auth.clear')}</span>
              </PadKey>
              <PadKey onClick={() => tapDigit('0')} disabled={!selected || busy}>0</PadKey>
              <PadKey onClick={() => setPin((p) => p.slice(0, -1))} disabled={!selected || busy} aria-label="Delete">
                <Delete size={22} className="flip-rtl" />
              </PadKey>
            </div>

            <label className="mt-4 flex min-h-touch items-center gap-3 rounded-xl px-2">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 accent-brand-600"
              />
              <span className="font-medium">{t('auth.rememberMe')}</span>
            </label>

            <Button
              block
              size="lg"
              variant="primary"
              className="mt-3"
              loading={busy}
              disabled={!selected || pin.length < 4}
              onClick={() => void submit()}
              icon={<LogIn size={20} className="flip-rtl" />}
            >
              {t('auth.signIn')}
            </Button>

            <button
              type="button"
              onClick={() => setResetting(true)}
              className="mt-3 flex w-full min-h-touch items-center justify-center gap-2 rounded-xl font-semibold text-brand-700 hover:bg-brand-50 focus-ring dark:text-brand-300 dark:hover:bg-ink-800"
            >
              <KeyRound size={18} />
              {t('auth.forgotPin')}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PadKey({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="surface grid h-16 place-items-center rounded-xl border-2 text-2xl font-bold transition-colors hover:border-brand-400 hover:bg-brand-50 focus-ring disabled:opacity-40 dark:hover:bg-ink-800"
      {...rest}
    >
      {children}
    </button>
  )
}

function ManualLogin({ onSuccess }: { onSuccess: (user: User) => void }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onSuccess(await api.auth.login(username, pin))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); void submit() }}
    >
      <TextInput label={t('auth.username')} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
      <TextInput label={t('auth.pin')} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required />
      {error && <p role="alert" className="font-medium text-rose-600">{error}</p>}
      <Button type="submit" block size="lg" variant="primary" loading={busy}>{t('auth.signIn')}</Button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-300">{t('auth.demoHint')}</p>
    </form>
  )
}

/** Offline PIN recovery — a security question, never an email. */
function PinReset({ users, onDone, onCancel }: { users: User[]; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const toast = useApp((s) => s.toast)
  const [username, setUsername] = useState(users[0]?.username ?? '')
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadQuestion = async () => {
    setError(null)
    try {
      setQuestion(await api.auth.securityQuestion(username))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const submit = async () => {
    if (newPin !== confirm) { setError(t('auth.pinMismatch')); return }
    setBusy(true)
    setError(null)
    try {
      await api.auth.resetPin(username, answer, newPin)
      toast(t('auth.resetDone'), 'success')
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <button
          type="button"
          onClick={onCancel}
          className="mb-4 inline-flex min-h-touch items-center gap-2 rounded-xl font-semibold text-brand-700 hover:bg-brand-50 focus-ring dark:text-brand-300 dark:hover:bg-ink-800"
        >
          <ArrowLeft size={18} className="flip-rtl" />
          {t('common.back')}
        </button>
        <h2 className="mb-4 text-xl font-bold">{t('auth.forgotPin')}</h2>

        {!question ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void loadQuestion() }}>
            <TextInput label={t('auth.username')} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            {error && <p role="alert" className="font-medium text-rose-600">{error}</p>}
            <Button type="submit" block size="lg" variant="primary">{t('common.continue')}</Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-950">
              <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">{t('auth.securityQuestion')}</p>
              <p className="font-medium">{question}</p>
            </div>
            <TextInput label={t('auth.yourAnswer')} value={answer} onChange={(e) => setAnswer(e.target.value)} required autoFocus />
            <TextInput label={t('auth.newPin')} type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} required />
            <TextInput label={t('auth.confirmPin')} type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p role="alert" className="font-medium text-rose-600">{error}</p>}
            <Button type="submit" block size="lg" variant="primary" loading={busy}>{t('common.save')}</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
