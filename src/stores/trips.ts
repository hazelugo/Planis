// src/stores/trips.ts
import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { computeSettlements } from '@/utils/settlements'
import { persistEditToken } from '@/composables/useTrip'
import { daysUntil, tripDurationDays } from '@/utils/dates'
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
  const hasSynced = ref(false)
  const loadStatus = ref<'loading' | 'ready' | 'error'>('loading')
  const loadError = ref<string | null>(null)
  const sessionEditToken = ref<string | null>(null)

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
    () => state.friends.length || state.attendance.adults + state.attendance.kids
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

  const daysUntilTrip = computed(() =>
    state.trip.startDate ? daysUntil(state.trip.startDate) : null
  )

  const tripDuration = computed(() =>
    tripDurationDays(state.trip.startDate, state.trip.endDate)
  )

  const settlements = computed<Settlement[]>(() =>
    computeSettlements(state.friends, state.payments, state.settledPairs)
  )

  const canEdit = computed(() => {
    if (loadStatus.value !== 'ready') return false
    if (!state.editToken) return true
    return sessionEditToken.value === state.editToken
  })

  const isReadOnly = computed(() => loadStatus.value === 'ready' && !canEdit.value)

  /** Legacy trip with no editToken — anyone with the link can still edit. */
  const needsProtection = computed(
    () => loadStatus.value === 'ready' && canEdit.value && !state.editToken
  )

  // ── Supabase persistence ──────────────────────────────────────────────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let remoteUpdate = false

  async function saveTrip(): Promise<void> {
    if (!tripId.value || !canEdit.value) return
    try {
      syncStatus.value = 'saving'
      const auth = useAuthStore()
      const row: {
        id: string
        data: TripState
        updated_at: string
        owner_id?: string
      } = {
        id: tripId.value,
        data: JSON.parse(JSON.stringify(state)) as TripState,
        updated_at: new Date().toISOString(),
      }
      if (auth.user?.id) row.owner_id = auth.user.id

      const { error } = await supabase.from('trips').upsert(row)
      if (error) throw error
      hasSynced.value = true
      broadcastLocalState()
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
    if (!canEdit.value) return
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

  // ── Cross-tab + Supabase realtime sync ───────────────────────────────────
  // Same-browser tabs: BroadcastChannel (instant, no Supabase config needed).
  // Cross-device / other browsers: Supabase postgres_changes on `trips`.
  const tabInstanceId = crypto.randomUUID()
  let channel: ReturnType<typeof supabase.channel> | null = null
  let broadcastChannel: BroadcastChannel | null = null
  let subscribedTripId: string | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null

  function parseTripData(raw: unknown): TripState | null {
    if (!raw) return null
    let parsed = raw
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        return null
      }
    }
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as TripState
  }

  /** Replace reactive state so Vue picks up array replacements (events, friends, etc.). */
  function mergeRemoteState(incoming: TripState): void {
    state.trip = { ...incoming.trip }
    state.attendance = { ...incoming.attendance }
    state.budget = incoming.budget ?? 0
    state.events = [...(incoming.events ?? [])]
    state.friends = [...(incoming.friends ?? [])]
    state.payments = [...(incoming.payments ?? [])]
    state.settledPairs = [...(incoming.settledPairs ?? [])]
    state.photos = [...(incoming.photos ?? [])]
    if (incoming.editToken !== undefined) state.editToken = incoming.editToken
    else delete state.editToken
  }

  function applyRemoteTripData(row: Record<string, unknown>): void {
    const incoming = parseTripData(row.data)
    if (!incoming) return

    remoteUpdate = true
    mergeRemoteState(incoming)
    hasSynced.value = true
    syncStatus.value = 'saved'
    setTimeout(() => {
      remoteUpdate = false
      if (syncStatus.value === 'saved') syncStatus.value = 'idle'
    }, 0)
  }

  function broadcastLocalState(): void {
    if (!broadcastChannel || remoteUpdate) return
    broadcastChannel.postMessage({
      source: tabInstanceId,
      type: 'state',
      payload: JSON.parse(JSON.stringify(state)) as TripState,
    })
  }

  function debouncedBroadcast(): void {
    if (remoteUpdate || loadStatus.value !== 'ready') return
    if (broadcastTimer) clearTimeout(broadcastTimer)
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null
      broadcastLocalState()
    }, 250)
  }

  let broadcastTripId: string | null = null

  function setupBroadcastSync(id: string): void {
    if (typeof BroadcastChannel === 'undefined') return
    if (broadcastChannel && broadcastTripId === id) return
    teardownBroadcastSync()
    broadcastTripId = id
    broadcastChannel = new BroadcastChannel(`planis:trip:${id}`)
    broadcastChannel.onmessage = (event: MessageEvent) => {
      const msg = event.data as { source?: string; type?: string; payload?: TripState }
      if (!msg || msg.source === tabInstanceId || msg.type !== 'state' || !msg.payload) return
      remoteUpdate = true
      mergeRemoteState(msg.payload)
      hasSynced.value = true
      syncStatus.value = 'saved'
      setTimeout(() => {
        remoteUpdate = false
        if (syncStatus.value === 'saved') syncStatus.value = 'idle'
      }, 0)
    }
  }

  function teardownBroadcastSync(): void {
    if (broadcastTimer) {
      clearTimeout(broadcastTimer)
      broadcastTimer = null
    }
    if (broadcastChannel) {
      broadcastChannel.close()
      broadcastChannel = null
    }
    broadcastTripId = null
  }

  function subscribeToRealTime(): void {
    if (!tripId.value) return
    if (channel && subscribedTripId === tripId.value) return

    const id = tripId.value
    setupBroadcastSync(id)
    teardownRealtimeOnly()
    subscribedTripId = id

    // No server-side filter — filter by trip id client-side so sync works even
    // when REPLICA IDENTITY / publication filters are misconfigured.
    channel = supabase
      .channel(`trip:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
          if (!row || row.id !== id) return
          if (payload.new) applyRemoteTripData(payload.new as Record<string, unknown>)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          teardownRealtimeOnly()
          if (reconnectTimer) clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            if (tripId.value === id && loadStatus.value === 'ready') subscribeToRealTime()
          }, 2000)
        }
      })
  }

  /** Reconnect Supabase channel if the websocket dropped in the background. */
  function ensureRealtimeSubscription(): void {
    if (loadStatus.value !== 'ready' || !tripId.value) return
    if (!broadcastChannel) setupBroadcastSync(tripId.value)
    if (!channel || subscribedTripId !== tripId.value) subscribeToRealTime()
  }

  function teardownRealtimeOnly(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    subscribedTripId = null
  }

  function unsubscribeFromRealTime(): void {
    teardownRealtimeOnly()
    teardownBroadcastSync()
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
  let syncWatchStarted = false

  function syncTripUrl(id: string): void {
    const url = new URL(window.location.href)
    url.searchParams.set('trip', id)
    window.history.replaceState({}, '', url)
  }

  function ensureEditTokenInUrl(token: string): void {
    const url = new URL(window.location.href)
    if (url.searchParams.get('edit') !== token) {
      url.searchParams.set('edit', token)
      window.history.replaceState({}, '', url)
    }
  }

  function mintEditToken(): string {
    const token = crypto.randomUUID()
    state.editToken = token
    return token
  }

  function startSyncWatchers(id: string): void {
    subscribeToRealTime()
    if (syncWatchStarted) return
    syncWatchStarted = true

    watch(state, debouncedBroadcast, { deep: true })
    watch(state, debouncedSave, { deep: true })

    watch(
      () => [state.trip.destination, state.trip.startDate, state.trip.endDate] as const,
      ([dest, start, end]) => {
        upsertTripIndex(id, dest, start, end)
      }
    )

    watch(() => state.trip.bannerUrl, () => updateBannerCache(id))

    watch(
      () => state.trip.destination,
      (dest) => {
        document.title = dest ? `${dest} — Planis` : 'Planis — Plan & Budget'
      },
      { immediate: true }
    )
  }

  function finishInitialize(id: string): void {
    loadTripIndex()
    upsertTripIndex(
      id,
      state.trip.destination,
      state.trip.startDate,
      state.trip.endDate
    )
    startSyncWatchers(id)
  }

  // Called once from App.vue onMounted. Safe to await before mounting children.
  async function initialize(id: string, editTokenFromSession: string | null): Promise<void> {
    tripId.value = id
    sessionEditToken.value = editTokenFromSession
    loadStatus.value = 'loading'
    loadError.value = null

    syncTripUrl(id)
    restoreBannerCache(id)

    const { data, error } = await supabase
      .from('trips')
      .select('data')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      loadStatus.value = 'error'
      loadError.value = 'Could not load this trip. Check your connection and try again.'
      syncStatus.value = 'error'
      return
    }

    if (!data) {
      const token = mintEditToken()
      sessionEditToken.value = token
      persistEditToken(id, token)
      ensureEditTokenInUrl(token)
      loadStatus.value = 'ready'
      finishInitialize(id)
      return
    }

    Object.assign(state, data.data as TripState)
    updateBannerCache(id)
    hasSynced.value = true

    if (state.editToken) {
      if (sessionEditToken.value === state.editToken) {
        ensureEditTokenInUrl(state.editToken)
      }
    }

    loadStatus.value = 'ready'
    finishInitialize(id)
  }

  async function retryLoad(editTokenFromSession: string | null): Promise<void> {
    await initialize(tripId.value, editTokenFromSession)
  }

  /** Mint an editToken on a legacy trip and persist it. Only works while the trip is still open-edit. */
  function protectTrip(): void {
    if (!canEdit.value || state.editToken) return
    const token = mintEditToken()
    sessionEditToken.value = token
    persistEditToken(tripId.value, token)
    ensureEditTokenInUrl(token)
    void saveTrip()
  }

  /** Replace current trip data with another trip's saved data (keeps this trip's ID and edit token). */
  async function importTripData(fromTripId: string): Promise<'ok' | 'not-found' | 'error'> {
    if (!canEdit.value || fromTripId === tripId.value) return 'error'
    const preservedEditToken = state.editToken
    const { data, error } = await supabase
      .from('trips')
      .select('data')
      .eq('id', fromTripId)
      .maybeSingle()
    if (error) return 'error'
    if (!data?.data) return 'not-found'
    Object.assign(state, data.data as TripState)
    state.editToken = preservedEditToken
    updateBannerCache(tripId.value)
    void saveTrip()
    return 'ok'
  }

  // ── CRUD: Events ──────────────────────────────────────────────────────────
  function addEvent(event: Omit<TripEvent, 'id'>): void {
    if (!canEdit.value) return
    state.events.push({ ...event, id: genId() })
  }

  function updateEvent(id: string, patch: Partial<TripEvent>): void {
    if (!canEdit.value) return
    const idx = state.events.findIndex(e => e.id === id)
    if (idx !== -1) Object.assign(state.events[idx], patch)
  }

  function removeEvent(id: string): void {
    if (!canEdit.value) return
    const idx = state.events.findIndex(e => e.id === id)
    if (idx !== -1) state.events.splice(idx, 1)
  }

  function reorderEvents(fromIndex: number, toIndex: number): void {
    if (!canEdit.value) return
    if (fromIndex === toIndex) return
    const [item] = state.events.splice(fromIndex, 1)
    state.events.splice(toIndex, 0, item)
  }

  // ── CRUD: Friends ─────────────────────────────────────────────────────────
  function addFriend(name: string): void {
    if (!canEdit.value) return
    const trimmed = name.trim()
    if (!trimmed) return
    state.friends.push({ id: genId(), name: trimmed })
  }

  function removeFriend(id: string): void {
    if (!canEdit.value) return
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

    state.settledPairs = state.settledPairs.filter(key => {
      const [from, to] = key.split('→')
      return from !== id && to !== id
    })
  }

  // ── CRUD: Payments ────────────────────────────────────────────────────────
  function addPayment(p: Omit<Payment, 'id' | 'settled'>): void {
    if (!canEdit.value) return
    state.payments.push({ ...p, id: genId(), settled: false })
  }

  function updatePayment(id: string, patch: Partial<Payment>): void {
    if (!canEdit.value) return
    const idx = state.payments.findIndex(p => p.id === id)
    if (idx !== -1) Object.assign(state.payments[idx], patch)
  }

  function removePayment(id: string): void {
    if (!canEdit.value) return
    const idx = state.payments.findIndex(p => p.id === id)
    if (idx !== -1) state.payments.splice(idx, 1)
  }

  function toggleSettled(fromId: string, toId: string): void {
    if (!canEdit.value) return
    const key = `${fromId}→${toId}`
    const idx = state.settledPairs.indexOf(key)
    if (idx === -1) state.settledPairs.push(key)
    else state.settledPairs.splice(idx, 1)
  }

  function clearSettledPairs(): void {
    if (!canEdit.value) return
    state.settledPairs.splice(0)
  }

  function unsettleAll(): void {
    if (!canEdit.value) return
    state.settledPairs.splice(0)
    state.payments.forEach(p => { p.settled = false })
  }

  return {
    // State
    tripId,
    syncStatus,
    hasSynced,
    loadStatus,
    loadError,
    canEdit,
    isReadOnly,
    needsProtection,
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
    retryLoad,
    protectTrip,
    importTripData,
    saveTrip,
    subscribeToRealTime,
    ensureRealtimeSubscription,
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
