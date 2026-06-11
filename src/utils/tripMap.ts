import type { TripEvent } from '@/types/domain'

/** Stops with a geocodable location string. */
export interface TripMapStop {
  name: string
  location: string
  notes?: string
}

export const GOOGLE_MY_MAPS_URL = 'https://www.google.com/maps/d/'

/** Open a single place in Google Maps (search / place view — not directions). */
export function buildGoogleMapsPlaceUrl(location: string): string | null {
  const q = location.trim()
  if (!q) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Lodging events with a location, oldest to newest. */
function lodgingWithLocation(events: TripEvent[]): TripEvent[] {
  return events
    .filter(e => e.category === 'Lodging' && e.date && (e.location ?? '').trim())
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date)
      if (byDate !== 0) return byDate
      return (a.time || '').localeCompare(b.time || '')
    })
}

/**
 * Hotel active on `date`: most recent Lodging (with location) on or before that date.
 * Add a new Lodging event on each check-in day when the property changes.
 */
export function resolveHotelLocationForDate(allEvents: TripEvent[], date: string): string | null {
  if (!date) return null
  let hotel: string | null = null
  for (const ev of lodgingWithLocation(allEvents)) {
    if (ev.date <= date) hotel = (ev.location ?? '').trim()
    else break
  }
  return hotel
}

/**
 * Daily directions: hotel → day's activities (time order) → same hotel.
 * Falls back to activity-only stops when no lodging applies.
 */
export function buildDayRouteLocations(
  dayEvents: TripEvent[],
  allEvents: TripEvent[],
  date: string,
): string[] {
  const hotel = resolveHotelLocationForDate(allEvents, date)
  const activityLocs: string[] = []
  for (const ev of dayEvents) {
    if (ev.category === 'Lodging') continue
    const loc = (ev.location ?? '').trim()
    if (loc) activityLocs.push(loc)
  }

  if (!hotel) return activityLocs
  const middle = activityLocs.filter(loc => loc !== hotel)
  if (middle.length === 0) return [hotel]
  return [hotel, ...middle, hotel]
}

/** Multi-stop directions for a single day (keep daily batches small). */
export function buildGoogleMapsDirectionsUrl(locations: string[]): string | null {
  const stops = locations.map(l => l.trim()).filter(Boolean)
  if (stops.length === 0) return null
  if (stops.length === 1) return buildGoogleMapsPlaceUrl(stops[0])
  return `https://www.google.com/maps/dir/${stops.map(s => encodeURIComponent(s)).join('/')}`
}

export function openMapsUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** KML for import into Google My Maps — named pins, no route overload. */
export function buildTripKml(stops: TripMapStop[], documentName: string): string {
  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const placemarks = stops.map(stop => {
    const desc = stop.notes?.trim()
      ? `<![CDATA[${stop.notes.trim()}]]>`
      : ''
    return `  <Placemark>
    <name>${escXml(stop.name)}</name>
    ${desc ? `<description>${desc}</description>` : ''}
    <address>${escXml(stop.location)}</address>
  </Placemark>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escXml(documentName)}</name>
${placemarks}
</Document>
</kml>`
}

export function downloadTripKml(stops: TripMapStop[], filename: string, documentName: string): void {
  const blob = new Blob([buildTripKml(stops, documentName)], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
