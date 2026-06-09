// src/stores/trips.ts
import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { computeSettlements } from '@/utils/settlements'
import type {
  TripState,
  TripEvent,
  Friend,
  Payment,
  Settlement,
} from '@/types/domain'

const genId = () => crypto.randomUUID().slice(0, 8)

export const useTripStore = defineStore('trip', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const tripId = ref<string>('')
  const syncStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const state = reactive<TripState>({
    trip: { destination: '', startDate: '', endDate: '' },
    attendance: { adults: 2, kids: 0, adultPrice: 0, kidPrice: 0 },
    budget: 0,
    events: [],
    friends: [],
    payments: [],
    settledPairs: [],
    photos: [],
  })

  // ── Computed ─────────────────────────────────────────────────────────────
  const totalParticipants = computed(
    () => state.attendance.adults + state.attendance.kids
  )

  const totalEventCost = computed(() =>
    state.events.reduce(
      (sum, e) =>
        sum + (e.perPerson ? (e.cost * totalParticipants.value) : e.cost) || 0,
      0
    )
  )

  const baseGroupCost = computed(() =>
    state.attendance.adults * (state.attendance.adultPrice || 0) +
    state.attendance.kids * (state.attendance.kidPrice || 0)
  )

  const costPerPerson = computed(() =>
    totalParticipants.value > 0
      ? totalEventCost.value / totalParticipants.value
      : 0
  )

  const daysUntilTrip = computed(() => {
    if (!state.trip.startDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(state.trip.startDate + 'T00:00:00')
    return Math.ceil((start.getTime() - today.getTime()) / 86400000)
  })

  const tripDuration = computed(() => {
    if (!state.trip.startDate || !state.trip.endDate) return 0
    const s = new Date(state.trip.startDate + 'T00:00:00')
    const e = new Date(state.trip.endDate + 'T00:00:00')
    return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / 86400000))
  })

  const settlements = computed<Settlement[]>(() =>
    computeSettlements(state.friends, state.payments, state.settledPairs)
  )

  // ── Supabase persistence ──────────────────────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let remoteUpdate = false

  async function saveTrip(): Promise<void> {
    if (!tripId.value) return
    try {
      syncStatus.value = 'saving'
      const { error } = await supabase.from('trips').upsert({
        id: tripId.value,
        data: JSON.parse(JSON.stringify(state)) as TripState,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      syncStatus.value = 'saved'
      setTimeout(() => {
        if (syncStatus.value === 'saved') syncStatus.value = 'idle'
      }, 2500)
    } catch {
      syncStatus.value = 'error'
    }
  }

  function debouncedSave(): void {
    if (remoteUpdate) return
    syncStatus.value = 'saving'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveTrip, 1400)
  }

  // ── Trip index (localStorage) ─────────────────────────────────────────────
  // Maintains a local list of trips the user has visited, used by TripSwitcher.
  const TRIP_INDEX_KEY = 'travelapp_trips'
  const tripIndex = ref<
    { id: string; name: string; startDate: string; endDate: string; savedAt: string }[]
  >([])

  function loadTripIndex(): void {
    try {
      tripIndex.value = JSON.parse(
        localStorage.getItem(TRIP_INDEX_KEY) ?? '[]'
      )
    } catch {
      tripIndex.value = []
    }
  }

  function saveTripIndexToStorage(): void {
    localStorage.setItem(TRIP_INDEX_KEY, JSON.stringify(tripIndex.value))
  }

  function upsertTripIndex(
    id: string,
    name: string,
    startDate: string,
    endDate: string
  ): void {
    const entry = {
      id,
      name: name || 'Untitled Trip',
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      savedAt: new Date().toISOString(),
    }
    const idx = tripIndex.value.findIndex(t => t.id === id)
    if (idx >= 0) {
      tripIndex.value[idx] = { ...tripIndex.value[idx], ...entry }
    } else {
      tripIndex.value.unshift(entry)
    }
    saveTripIndexToStorage()
  }

  // ── Real-time subscription ────────────────────────────────────────────────
  // Initialized once; survives tab navigation because the store is a singleton.
  let channel: ReturnType<typeof supabase.channel> | null = null

  function subscribeToRealTime(): void {
    if (channel) return // already subscribed — guard against double-init
    if (!tripId.value) return

    channel = supabase
      .channel(`trip:${tripId.value}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId.value}`,
        },
        (payload) => {
          if (payload.new && 'data' in payload.new && payload.new.data) {
            remoteUpdate = true
            Object.assign(state, payload.new.data as TripState)
            syncStatus.value = 'saved'
            setTimeout(() => {
              remoteUpdate = false
              if (syncStatus.value === 'saved') syncStatus.value = 'idle'
            }, 0)
          }
        }
      )
      .subscribe()
  }

  function unsubscribeFromRealTime(): void {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  // ── Banner URL cache (localStorage) ─────────────────────────────────────
  // Caches bannerUrl per tripId so the header renders at the correct height
  // before Supabase responds, eliminating the layout shift (CLS).
  const bannerCacheKey = (id: string) => `planis_banner_${id}`

  function restoreBannerCache(id: string): void {
    const cached = localStorage.getItem(bannerCacheKey(id))
    if (cached) state.trip.bannerUrl = cached
  }

  function updateBannerCache(id: string): void {
    const url = state.trip.bannerUrl
    if (url) {
      localStorage.setItem(bannerCacheKey(id), url)
    } else {
      localStorage.removeItem(bannerCacheKey(id))
    }
  }

  // ── Initialization ────────────────────────────────────────────────────────
  // Called once from App.vue onMounted. Safe to await before mounting children.
  async function initialize(id: string): Promise<void> {
    tripId.value = id

    // Sync URL so copying the address bar always shares the right trip
    const shareUrl = new URL(window.location.href)
    shareUrl.searchParams.set('trip', id)
    window.history.replaceState({}, '', shareUrl)

    // Pre-populate bannerUrl from cache so header renders at correct height
    // immediately, before the Supabase round-trip completes (fixes CLS).
    restoreBannerCache(id)

    try {
      const { data } = await supabase
        .from('trips')
        .select('data')
        .eq('id', id)
        .single()
      if (data?.data) {
        Object.assign(state, data.data as TripState)
        updateBannerCache(id)
      }
    } catch {
      // First visit — state stays at defaults
    }

    loadTripIndex()
    upsertTripIndex(
      id,
      state.trip.destination,
      state.trip.startDate,
      state.trip.endDate
    )

    subscribeToRealTime()

    // Start watching for local changes AFTER initial load to avoid a spurious save
    watch(state, debouncedSave, { deep: true })

    // Keep trip index fresh as user edits destination / dates
    watch(
      () => [state.trip.destination, state.trip.startDate, state.trip.endDate] as const,
      ([dest, start, end]) => {
        upsertTripIndex(id, dest, start, end)
      }
    )

    // Keep banner cache in sync so the header height is correct on next visit
    watch(() => state.trip.bannerUrl, () => updateBannerCache(id))

    // Keep document title in sync with destination
    watch(
      () => state.trip.destination,
      (dest) => {
        document.title = dest ? `${dest} — Planis` : 'Planis — Plan & Budget'
      },
      { immediate: true }
    )
  }

  // ── CRUD: Events ──────────────────────────────────────────────────────────
  function addEvent(event: Omit<TripEvent, 'id'>): void {
    state.events.push({ ...event, id: genId() })
  }

  function updateEvent(id: string, patch: Partial<TripEvent>): void {
    const idx = state.events.findIndex(e => e.id === id)
    if (idx !== -1) Object.assign(state.events[idx], patch)
  }

  function removeEvent(id: string): void {
    const idx = state.events.findIndex(e => e.id === id)
    if (idx !== -1) state.events.splice(idx, 1)
  }

  function reorderEvents(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return
    const [item] = state.events.splice(fromIndex, 1)
    state.events.splice(toIndex, 0, item)
  }

  // ── CRUD: Friends ─────────────────────────────────────────────────────────
  function addFriend(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    state.friends.push({ id: genId(), name: trimmed })
  }

  function removeFriend(id: string): void {
    const idx = state.friends.findIndex(f => f.id === id)
    if (idx !== -1) state.friends.splice(idx, 1)

    // Remove payments paid by this friend and clean splitAmong arrays
    for (let i = state.payments.length - 1; i >= 0; i--) {
      if (state.payments[i].paidById === id) {
        state.payments.splice(i, 1)
        continue
      }
      state.payments[i].splitAmong = state.payments[i].splitAmong.filter(
        sid => sid !== id
      )
      if (state.payments[i].splitAmong.length === 0) {
        state.payments.splice(i, 1)
      }
    }
  }

  // ── CRUD: Payments ────────────────────────────────────────────────────────
  function addPayment(p: Omit<Payment, 'id' | 'settled'>): void {
    state.payments.push({ ...p, id: genId(), settled: false })
  }

  function updatePayment(id: string, patch: Partial<Payment>): void {
    const idx = state.payments.findIndex(p => p.id === id)
    if (idx !== -1) Object.assign(state.payments[idx], patch)
  }

  function removePayment(id: string): void {
    const idx = state.payments.findIndex(p => p.id === id)
    if (idx !== -1) state.payments.splice(idx, 1)
  }

  function toggleSettled(fromId: string, toId: string): void {
    const key = `${fromId}→${toId}`
    const idx = state.settledPairs.indexOf(key)
    if (idx === -1) state.settledPairs.push(key)
    else state.settledPairs.splice(idx, 1)
  }

  function clearSettledPairs(): void {
    state.settledPairs.splice(0)
  }

  function unsettleAll(): void {
    state.settledPairs.splice(0)
    state.payments.forEach(p => { p.settled = false })
  }

  return {
    // State
    tripId,
    syncStatus,
    state,
    tripIndex,
    // Computed
    totalParticipants,
    totalEventCost,
    baseGroupCost,
    costPerPerson,
    daysUntilTrip,
    tripDuration,
    settlements,
    // Lifecycle
    initialize,
    saveTrip,
    subscribeToRealTime,
    unsubscribeFromRealTime,
    // Event actions
    addEvent,
    updateEvent,
    removeEvent,
    reorderEvents,
    // Friend actions
    addFriend,
    removeFriend,
    // Payment actions
    addPayment,
    updatePayment,
    removePayment,
    toggleSettled,
    clearSettledPairs,
    unsettleAll,
    // Trip index helpers
    loadTripIndex,
    upsertTripIndex,
  }
})
