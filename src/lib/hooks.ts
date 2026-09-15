import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/store/app'

/** Loads data and re-runs whenever `dataVersion` changes or deps move. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[]
): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const dataVersion = useApp((s) => s.dataVersion)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let alive = true
    setLoading(true)
    loaderRef
      .current()
      .then((value) => {
        if (!alive) return
        setData(value)
        setError(null)
      })
      .catch((e: Error) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, dataVersion])

  return { data, error, loading, reload: useCallback(() => setNonce((n) => n + 1), []) }
}

/** Debounces a value — used by the search boxes so typing stays instant. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/** Warns before the window closes while a form still has unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
