import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { initials } from '@/lib/format'

const cache = new Map<string, string | null>()

/** Photos live outside the app bundle, so they are fetched through the bridge
 *  as data URLs and cached — the renderer never touches the filesystem. */
export function usePhoto(path: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(path ? cache.get(path) ?? null : null)

  useEffect(() => {
    let alive = true
    if (!path) { setSrc(null); return }
    if (cache.has(path)) { setSrc(cache.get(path) ?? null); return }
    api.files
      .readImage(path)
      .then((data) => {
        cache.set(path, data)
        if (alive) setSrc(data)
      })
      .catch(() => { if (alive) setSrc(null) })
    return () => { alive = false }
  }, [path])

  return src
}

export function Avatar({
  name, photoPath, size = 44,
}: {
  name: string
  photoPath?: string | null
  size?: number
}) {
  const src = usePhoto(photoPath)
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name || '?')
      )}
    </span>
  )
}
