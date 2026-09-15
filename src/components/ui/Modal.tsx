import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

export function Modal({
  open, onClose, title, subtitle, children, footer, size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Move focus into the dialog so keyboard users are not left behind it.
    panelRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`surface relative flex max-h-[90vh] w-full ${widths[size]} flex-col rounded-2xl border shadow-lift focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--app-border)' }}>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')} icon={<X size={18} />}>
            <span className="sr-only">{t('common.close')}</span>
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t p-5" style={{ borderColor: 'var(--app-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Every delete goes through here — there is no silent destructive action. */
export function ConfirmDialog({
  open, title, body, confirmLabel, tone = 'danger', onConfirm, onCancel,
}: {
  open: boolean
  title: ReactNode
  body?: ReactNode
  confirmLabel?: ReactNode
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button size="lg" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button size="lg" variant={tone} onClick={onConfirm}>{confirmLabel ?? t('common.delete')}</Button>
        </>
      }
    >
      <p className="text-base leading-relaxed">{body}</p>
    </Modal>
  )
}
