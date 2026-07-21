/** Production app URL — set VITE_APP_URL on Vercel so magic links never point at localhost. */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function buildAppUrl(
  path = '/',
  query?: Record<string, string | null | undefined>,
): string {
  const origin = getAppOrigin() || 'http://localhost:5173'
  const url = new URL(path, origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value)
    }
  }
  return url.toString()
}
