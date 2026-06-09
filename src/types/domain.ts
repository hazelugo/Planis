// Domain interfaces for TravelApp.
// These map to the JSONB `data` column in the `trips` table.
// Do NOT add `any` — use unknown and narrow at the callsite.

import type { Database } from './database.types'

export type EventCategory = 'Transport' | 'Lodging' | 'Food' | 'Adventure' | 'Activity'

export interface TripMeta {
  destination: string
  startDate: string   // ISO date "YYYY-MM-DD" or empty string
  endDate: string     // ISO date "YYYY-MM-DD" or empty string
  bannerUrl?: string              // Pexels CDN URL or Supabase Storage public URL
  bannerPosition?: string         // CSS object-position, e.g. "50% 30%". Defaults "50% 50%"
  bannerPhotographer?: string     // Pexels photographer name; absent for custom uploads
  bannerPhotographerUrl?: string  // Pexels photographer profile URL; absent for custom uploads
}

export interface Attendance {
  adults: number
  kids: number
  adultPrice: number
  kidPrice: number
}

export interface TripEvent {
  id: string
  name: string
  date: string        // "YYYY-MM-DD" or '' (unscheduled)
  time: string        // "HH:MM" or '' (unscheduled)
  category: EventCategory
  cost: number
  perPerson: boolean
  notes: string
  url: string
}

export interface Friend {
  id: string
  name: string
}

export interface Payment {
  id: string
  paidById: string    // Friend.id of who paid
  amount: number
  description: string
  splitAmong: string[]                     // Array of Friend.id
  splitPercentages: Record<string, number> // Friend.id → percentage (0–100)
  settled: boolean
}

export interface Photo {
  id: string
  url: string         // Public URL for display
  path: string        // Supabase Storage path for deletion
  caption: string
  uploadedAt: string  // ISO datetime
}

// Root shape serialized into / out of the trips.data JSONB column.
export interface TripState {
  trip: TripMeta
  attendance: Attendance
  budget: number
  events: TripEvent[]
  friends: Friend[]
  payments: Payment[]
  settledPairs: string[]   // "fromId→toId" keys for settled debts
  photos: Photo[]
  /** Required in URL (?edit=) to write; absent on legacy trips (open edit). */
  editToken?: string
}

// Settlement algorithm output — derived at runtime, never persisted.
export interface Settlement {
  from: string   // Friend.id
  to: string     // Friend.id
  amount: number
}

// Typed Supabase row — narrows the generated Json type on `data` to TripState.
export type TripRow = Omit<Database['public']['Tables']['trips']['Row'], 'data'> & {
  data: TripState
}
