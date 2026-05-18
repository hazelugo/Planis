// src/composables/useTrip.ts

const STORAGE_KEY = 'travelapp_trip_id'

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
   * Replaces the `?trip=` param in the current URL without a page reload.
   */
  function getShareUrl(tripId: string): string {
    const url = new URL(window.location.href)
    url.searchParams.set('trip', tripId)
    return url.toString()
  }

  /**
   * Switch to a different trip by reloading the page with the new ID.
   * Saves the new ID to localStorage so it persists after reload.
   */
  function navigateToTrip(tripId: string): void {
    localStorage.setItem(STORAGE_KEY, tripId)
    const url = new URL(window.location.href)
    url.searchParams.set('trip', tripId)
    window.location.href = url.toString()
  }

  return {
    resolveTripId,
    getShareUrl,
    navigateToTrip,
  }
}
