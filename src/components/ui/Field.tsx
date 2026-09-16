import { createContext, forwardRef, useContext, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Marking every non-required field "(optional)" is reassuring in a data-entry
 * form, but it is noise on a filter bar where nothing is ever required.
 * Wrapping a group in this turns the marker off for everything inside.
 */
export const PlainFieldsContext = createContext(false)

/**
 * Turns off the "(optional)" marker for everything inside. Use it where nearly
 * every box is optional and the red * on the one required field says enough.
 */
export function PlainFields({ children }: { children: ReactNode }) {
  return <PlainFieldsContext.Provider value={true}>{children}</PlainFieldsContext.Provider>
}

const CONTROL =
  'surface w-full min-h-touch rounded-xl border px-3 py-2 text-base focus-ring ' +
  'placeholder:text-ink-400 disabled:opacity-60 text-start'

export function Field({
  label, hint, error, required, children, htmlFor,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  children: ReactNode
  htmlFor?: string
}) {
  const { t } = useTranslation()
  const plain = useContext(PlainFieldsContext)
  return (
    <label className="block" htmlFor={htmlFor}>
      {label && (
        <span className="mb-1.5 block text-sm font-semibold">
          {label}
          {required ? (
            <span className="ms-1 text-rose-600" aria-hidden>*</span>
          ) : plain ? null : (
            <span className="ms-1 font-normal text-ink-400">({t('common.optional')})</span>
          )}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-ink-500 dark:text-ink-300">{hint}</span>}
      {error && <span className="mt-1 block text-sm font-medium text-rose-600">{error}</span>}
    </label>
  )
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, required, className = '', ...rest },
  ref
) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <input
        id={id}
        ref={ref}
        required={required}
        aria-invalid={!!error}
        className={`${CONTROL} ${error ? 'border-rose-400' : ''} ${className}`}
        {...rest}
      />
    </Field>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  options: { value: string | number; label: ReactNode }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, className = '', ...rest },
  ref
) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select id={id} ref={ref} required={required} className={`${CONTROL} ${className}`} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
})

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, required, className = '', rows = 3, ...rest },
  ref
) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea id={id} ref={ref} rows={rows} required={required} className={`${CONTROL} ${className}`} {...rest} />
    </Field>
  )
})

export function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  hint?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="surface flex min-h-touch w-full items-center gap-3 rounded-xl border p-3 text-start focus-ring"
    >
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-600'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'start-6' : 'start-1'
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-ink-500 dark:text-ink-300">{hint}</span>}
      </span>
      {/* Never colour alone: the state is spelled out as well. */}
      <span className="shrink-0 text-sm font-semibold text-ink-500 dark:text-ink-300">
        {checked ? t('common.on') : t('common.off')}
      </span>
    </button>
  )
}
