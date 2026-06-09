// src/composables/useTrip.ts

const STORAGE_KEY = 'travelapp_trip_id'
export const EDIT_TOKEN_STORAGE_PREFIX = 'travelapp_edit_'

export function persistEditToken(tripId: string, token: string): void {
  localStorage.setItem(EDIT_TOKEN_STORAGE_PREFIX + tripId, token)
}

export function resolveEditToken(tripId: string): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get('edit')
  if (fromUrl) {
    persistEditToken(tripId, fromUrl)
    return fromUrl
  }
  return localStorage.getItem(EDIT_TOKEN_STORAGE_PREFIX + tripId)
}

/** Build a shareable trip URL. Include editToken only for editor links. */
export function buildTripUrl(tripId: string, editToken?: string | null): string {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('trip', tripId)
  if (editToken) url.searchParams.set('edit', editToken)
  return url.toString()
}

export function useTrip() {
  /**
   * Resolve the active trip ID in priority order:
   * 1. `?trip=UUID` URL parameter (persists to localStorage)
   * 2. Previously stored trip ID in localStorage
   * 3. Freshly generated UUID (persisted to localStorage for next visit)
   */
  function resolveTripId(): string {
    const urlId = new URLSearchParams(window.location.search).get('trip')
    if (urlId) {
      localStorage.setItem(STORAGE_KEY, urlId)
      return urlId
    }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    const fresh = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  }

  /**
   * Build the shareable URL for a given trip ID.
   * Includes the edit token when this browser has editor access.
   */
  function getShareUrl(tripId: string, editToken?: string | null): string {
    return buildTripUrl(tripId, editToken ?? resolveEditToken(tripId))
  }

  /**
   * Switch to a different trip by reloading the page with the new ID.
   * Preserves per-trip edit tokens from localStorage when available.
   */
  function navigateToTrip(tripId: string): void {
    localStorage.setItem(STORAGE_KEY, tripId)
    window.location.href = buildTripUrl(tripId, resolveEditToken(tripId))
  }

  return {
    resolveTripId,
    resolveEditToken,
    getShareUrl,
    navigateToTrip,
    buildTripUrl,
    persistEditToken,
  }
}
