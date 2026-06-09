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
