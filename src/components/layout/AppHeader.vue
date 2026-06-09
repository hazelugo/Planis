<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTripStore } from '@/stores/trips'
import { useTrip } from '@/composables/useTrip'
import { useBanner } from '@/composables/useBanner'

const props = defineProps<{
  currentTab: string
  syncStatus: 'idle' | 'saving' | 'saved' | 'error'
}>()
const emit = defineEmits<{ (e: 'copy-link'): void }>()

const ui = useUIStore()
const trip = useTripStore()
const { navigateToTrip, getShareUrl, resolveEditToken, buildTripUrl } = useTrip()

const banner = useBanner()
const repositionMode = ref(false)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, posX: 50, posY: 50 })
const bannerFileInput = ref<HTMLInputElement | null>(null)

const linkCopied = ref(false)
const tripsOpen = ref(false)
const copiedTripId = ref<string | null>(null)

const TAB_META: Record<string, { label: string; desc: string }> = {
  overview:   { label: 'Overview',  desc: "How it's shaping up" },
  itinerary:  { label: 'Itinerary', desc: "What's on the agenda" },
  analytics:  { label: 'Spending',  desc: 'Follow the money' },
  splitter:   { label: 'Splitter',  desc: 'No awkward IOUs' },
  // photos:  { label: 'Photos',    desc: 'The memories' },
}
const meta = () => TAB_META[props.currentTab] ?? TAB_META.overview

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function copyLink() {
  const url = trip.canEdit
    ? getShareUrl(trip.tripId, resolveEditToken(trip.tripId))
    : buildTripUrl(trip.tripId)
  navigator.clipboard.writeText(url).catch(() => {})
  linkCopied.value = true
  emit('copy-link')
  setTimeout(() => { linkCopied.value = false }, 1600)
}

async function deleteTrip(id: string) {
  const name = trip.tripIndex.find(t => t.id === id)?.name || 'this trip'
  const ok = await ui.showConfirm({
    title: `Remove "${name}"?`,
    message: 'This removes it from your list. The trip data is not permanently deleted.',
    okLabel: 'Remove',
    okClass: 'bg-rose-500 hover:bg-rose-600',
  })
  if (!ok) return
  const idx = trip.tripIndex.findIndex(t => t.id === id)
  if (idx !== -1) trip.tripIndex.splice(idx, 1)
  localStorage.setItem('travelapp_trips', JSON.stringify(trip.tripIndex))
  if (id === trip.tripId) {
    trip.tripIndex.length > 0 ? switchTrip(trip.tripIndex[0].id) : startNewTrip()
  }
}

function copyTripLink(id: string) {
  const edit = resolveEditToken(id)
  const url = edit ? buildTripUrl(id, edit) : buildTripUrl(id)
  navigator.clipboard.writeText(url).catch(() => {})
  copiedTripId.value = id
  setTimeout(() => { copiedTripId.value = null }, 1600)
}

function switchTrip(id: string) {
  tripsOpen.value = false
  navigateToTrip(id)
}

function startNewTrip() {
  tripsOpen.value = false
  navigateToTrip(crypto.randomUUID())
}

async function importFromTrip(fromId: string) {
  const name = trip.tripIndex.find(t => t.id === fromId)?.name || 'that trip'
  const ok = await ui.showConfirm({
    title: `Copy data from "${name}"?`,
    message: 'This replaces everything in the current trip with the other trip\'s data. The current trip link stays the same.',
    okLabel: 'Copy data',
    okClass: 'bg-teal-600 hover:bg-teal-700',
  })
  if (!ok) return
  const result = await trip.importTripData(fromId)
  tripsOpen.value = false
  if (result === 'ok') return
  await ui.showConfirm({
    title: result === 'not-found' ? 'Trip not found' : 'Could not copy',
    message: result === 'not-found'
      ? 'That trip has no saved data yet.'
      : 'Check your connection and try again.',
    okLabel: 'OK',
    okClass: 'bg-teal-600 hover:bg-teal-700',
  })
}

const syncLabel = computed(() => {
  const labels: Record<string, string> = {
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
    idle: trip.hasSynced ? 'Saved' : 'Not saved yet',
  }
  return labels[props.syncStatus]
})
const syncClass = computed(() => {
  const classes: Record<string, string> = {
    saving: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    saved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    error: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    idle: trip.hasSynced
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
      : 'bg-slate-50 text-slate-500 dark:bg-inset dark:text-slate-400',
  }
  return classes[props.syncStatus]
})
const syncDot = computed(() => {
  const dots: Record<string, string> = {
    saving: 'bg-amber-400 animate-pulse',
    saved: 'bg-emerald-500',
    error: 'bg-rose-500',
    idle: trip.hasSynced ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
  }
  return dots[props.syncStatus]
})

function parsePct(pos: string): [number, number] {
  const parts = (pos || '50% 50%').split(' ').map(p => parseFloat(p))
  return [parts[0] || 50, parts[1] || 50]
}

function onBannerPointerDown(e: PointerEvent) {
  if (!repositionMode.value || !trip.state.trip.bannerUrl) return
  const [posX, posY] = parsePct(trip.state.trip.bannerPosition ?? '50% 50%')
  dragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, posX, posY }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onBannerPointerMove(e: PointerEvent) {
  if (!dragging.value || !repositionMode.value) return
  const el = e.currentTarget as HTMLElement
  const dx = ((e.clientX - dragStart.value.x) / el.offsetWidth) * 100
  const dy = ((e.clientY - dragStart.value.y) / el.offsetHeight) * 100
  const newX = Math.max(0, Math.min(100, dragStart.value.posX + dx))
  const newY = Math.max(0, Math.min(100, dragStart.value.posY + dy))
  banner.setPosition(newX, newY)
}

function onBannerPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  repositionMode.value = false
  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
}

async function onBannerFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''
  await banner.uploadBanner(file)
}
</script>

<template>
  <header
    class="relative shrink-0 transition-[height] duration-300"
    :class="!trip.state.trip.bannerUrl
      ? 'bg-surface border-b border-slate-100 dark:border-hairline'
      : repositionMode ? 'cursor-grab' : 'cursor-default'"
    :style="trip.state.trip.bannerUrl ? 'height: 180px' : ''"
    @pointerdown="onBannerPointerDown"
    @pointermove="onBannerPointerMove"
    @pointerup="onBannerPointerUp"
    @pointerleave="onBannerPointerUp"
  >
    <!-- Banner background: clipped in its own container so the dropdown can overflow the header -->
    <div v-if="trip.state.trip.bannerUrl" class="absolute inset-0 overflow-hidden pointer-events-none">
      <img
        :src="trip.state.trip.bannerUrl"
        :style="`object-position: ${trip.state.trip.bannerPosition ?? '50% 50%'}`"
        class="absolute inset-0 w-full h-full object-cover select-none"
        width="1200"
        height="180"
        fetchpriority="high"
        draggable="false"
        alt=""
      />
      <div
        class="absolute inset-0"
        style="background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)"
      />
    </div>

    <!-- Pexels attribution (only when bannerPhotographer is set — i.e. Pexels photos, not custom uploads) -->
    <a
      v-if="trip.state.trip.bannerUrl && trip.state.trip.bannerPhotographer && trip.state.trip.bannerPhotographerUrl"
      :href="trip.state.trip.bannerPhotographerUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="absolute bottom-2 left-4 z-10 text-[10px] text-white/50 hover:text-white/80 transition-colors"
      @click.stop
    >
      Photo by {{ trip.state.trip.bannerPhotographer }} on Pexels
    </a>

    <!-- Content row — sits above image + gradient -->
    <div class="relative z-10 px-6 flex justify-between gap-4"
      :class="trip.state.trip.bannerUrl ? 'h-full items-start pt-5' : 'items-center py-4'">
      <div class="min-w-0">
        <h1 class="text-base font-semibold"
          :class="trip.state.trip.bannerUrl ? 'text-white' : 'text-slate-900 dark:text-slate-100'">
          {{ meta().label }}
        </h1>
        <p class="text-xs mt-0.5"
          :class="trip.state.trip.bannerUrl ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'">
          {{ meta().desc }}
        </p>
      </div>

      <div class="hidden lg:flex items-center gap-2 shrink-0">

      <!-- Banner controls (desktop) -->
      <div v-if="trip.state.trip.bannerUrl && trip.canEdit" class="flex items-center gap-1 mr-1">
        <!-- Reposition -->
        <button
          @click="repositionMode = !repositionMode"
          :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-all',
            repositionMode ? 'bg-white/30 text-white' : 'text-white/60 hover:text-white hover:bg-white/20']"
          :aria-label="repositionMode ? 'Exit reposition mode' : 'Drag to reposition banner'"
          :title="repositionMode ? 'Click again to finish' : 'Drag to reposition'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
        </button>
        <!-- Try another -->
        <button
          @click="banner.tryAnother()"
          :disabled="banner.loading.value || !banner.pexelsConfigured"
          class="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/20 disabled:opacity-40 transition-all"
          aria-label="Load another Pexels photo"
          :title="banner.pexelsConfigured ? 'Try another photo' : 'Pexels not configured — upload your own photo'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <!-- Upload -->
        <button
          @click="bannerFileInput?.click()"
          class="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/20 transition-all"
          aria-label="Upload custom banner photo"
          title="Upload your own photo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <!-- Hidden file input -->
        <input
          ref="bannerFileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onBannerFileChange"
        />
      </div>

      <!-- My Trips dropdown -->
      <div class="relative">
        <button @click="tripsOpen = !tripsOpen" aria-label="My Trips"
          :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
            trip.state.trip.bannerUrl
              ? tripsOpen
                ? 'bg-white/30 border-white/30 text-white'
                : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
              : tripsOpen
                ? 'bg-teal-50 dark:bg-inset border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-400'
                : 'bg-surface border-slate-200 dark:border-hairline text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          My Trips
          <span v-if="trip.tripIndex.length > 1" class="bg-teal-100 dark:bg-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full px-1.5 text-[10px] font-bold leading-none py-0.5">{{ trip.tripIndex.length }}</span>
        </button>

        <Transition name="fade">
          <div v-if="tripsOpen" class="absolute right-0 top-full mt-2 w-72 bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-xl shadow-slate-200/60 dark:shadow-none z-50 overflow-hidden">
            <div class="px-4 pt-4 pb-2 border-b border-slate-50 dark:border-hairline">
              <p class="eyebrow">My Trips</p>
            </div>
            <div class="max-h-60 overflow-y-auto">
              <div v-for="t in trip.tripIndex" :key="t.id"
                :class="['flex items-center gap-3 px-4 py-3 transition-colors',
                  t.id === trip.tripId ? 'bg-teal-50/60 dark:bg-teal-900/10' : 'hover:bg-slate-50 dark:hover:bg-inset']">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {{ t.name || 'Untitled Trip' }}
                    <span v-if="t.id === trip.tripId" class="ml-1.5 text-[10px] font-semibold bg-teal-100 dark:bg-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full px-1.5 py-0.5">current</span>
                  </p>
                  <p class="text-xs text-slate-400 mt-0.5">
                    <template v-if="t.startDate">{{ fmtDate(t.startDate) }}<template v-if="t.endDate"> → {{ fmtDate(t.endDate) }}</template></template>
                    <span v-else class="italic">No dates set</span>
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button v-if="t.id !== trip.tripId && trip.canEdit" @click="importFromTrip(t.id)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-lift transition-all"
                    aria-label="Copy this trip's data into current trip"
                    title="Copy into current trip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button v-if="t.id !== trip.tripId" @click="switchTrip(t.id)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-lift transition-all"
                    aria-label="Switch to this trip"
                    title="Open this trip">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                  <button @click="copyTripLink(t.id)"
                    :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-all',
                      copiedTripId === t.id ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-lift' : 'text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-lift']"
                    :aria-label="copiedTripId === t.id ? 'Copied!' : 'Copy link'">
                    <svg v-if="copiedTripId !== t.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button @click="deleteTrip(t.id)" aria-label="Remove trip"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
              <div v-if="!trip.tripIndex.length" class="px-4 py-6 text-center text-sm text-slate-400 italic">No trips saved yet.</div>
            </div>
            <div class="px-4 py-3 border-t border-slate-100 dark:border-hairline">
              <button @click="startNewTrip"
                class="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-inset transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Trip
              </button>
            </div>
          </div>
        </Transition>

        <!-- Click-outside overlay -->
        <div v-if="tripsOpen" class="fixed inset-0 z-40" @click="tripsOpen = false" aria-hidden="true"></div>
      </div>

      <!-- Sync pill -->
      <div :class="['flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors', syncClass]">
        <span :class="['w-1.5 h-1.5 rounded-full', syncDot]"></span>
        {{ syncLabel }}
      </div>

      <!-- Copy link -->
      <button @click="copyLink" :aria-label="linkCopied ? 'Copied!' : 'Copy share link'"
        :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-all',
          trip.state.trip.bannerUrl
            ? linkCopied ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/20'
            : linkCopied ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-inset' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-inset']">
        <svg v-if="!linkCopied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>

      <!-- Theme toggle -->
      <button @click="ui.toggleDark()" :aria-label="ui.darkMode ? 'Light mode' : 'Dark mode'"
        :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-all',
          trip.state.trip.bannerUrl
            ? 'text-white/70 hover:text-white/90 hover:bg-white/20'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-inset']">
        <svg v-if="ui.darkMode" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>

      <!-- Mobile: briefcase icon + theme toggle -->
      <div class="lg:hidden flex items-center gap-1 shrink-0">
        <!-- Mobile banner controls -->
        <template v-if="trip.state.trip.bannerUrl && trip.canEdit">
          <button
            @click="repositionMode = !repositionMode"
            :class="['w-10 h-10 flex items-center justify-center rounded-xl transition-all',
              repositionMode ? 'text-white bg-white/30' : 'text-white/70 hover:bg-white/20']"
            aria-label="Reposition banner"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
              <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
          </button>
          <button
            @click="banner.tryAnother()"
            :disabled="banner.loading.value"
            class="w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:bg-white/20 disabled:opacity-40 transition-all"
            aria-label="Try another photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </template>
        <button @click="tripsOpen = !tripsOpen" aria-label="My Trips"
          :class="['relative w-10 h-10 flex items-center justify-center rounded-xl transition-all',
            tripsOpen ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-inset' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          <span v-if="trip.tripIndex.length > 1" class="absolute top-1.5 right-1.5 w-3.5 h-3.5 flex items-center justify-center bg-teal-500 text-white text-[9px] font-bold rounded-full leading-none">{{ trip.tripIndex.length }}</span>
        </button>
        <button @click="ui.toggleDark()"
          :aria-label="ui.darkMode ? 'Light mode' : 'Dark mode'"
          :class="['w-10 h-10 flex items-center justify-center rounded-xl transition-all',
            trip.state.trip.bannerUrl
              ? 'text-white/70 hover:bg-white/20'
              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
          <svg v-if="ui.darkMode" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div><!-- end content row -->
  </header>

  <!-- Mobile bottom sheet -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="tripsOpen" class="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" @click="tripsOpen = false" aria-hidden="true"></div>
    </Transition>
    <Transition name="sheet-up">
      <div v-if="tripsOpen" class="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl border-t border-slate-100 dark:border-hairline shadow-xl overflow-hidden" style="padding-bottom:env(safe-area-inset-bottom,0px)">
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-hairline">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">My Trips</p>
          <button @click="tripsOpen = false" aria-label="Close" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-inset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="max-h-72 overflow-y-auto">
          <div v-for="t in trip.tripIndex" :key="t.id"
            :class="['flex items-center gap-3 px-5 py-3.5 transition-colors', t.id === trip.tripId ? 'bg-teal-50/60 dark:bg-teal-900/10' : 'hover:bg-slate-50 dark:hover:bg-inset']">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {{ t.name || 'Untitled Trip' }}
                <span v-if="t.id === trip.tripId" class="ml-1.5 text-[10px] font-semibold bg-teal-100 dark:bg-teal-800/60 text-teal-700 dark:text-teal-300 rounded-full px-1.5 py-0.5">current</span>
              </p>
              <p class="text-xs text-slate-400 mt-0.5 truncate">
                <template v-if="t.startDate">{{ fmtDate(t.startDate) }}<template v-if="t.endDate"> → {{ fmtDate(t.endDate) }}</template></template>
                <span v-else class="italic">No dates set</span>
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button v-if="t.id !== trip.tripId && trip.canEdit" @click="importFromTrip(t.id)"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-lift transition-all"
                aria-label="Copy into current trip" title="Copy into current trip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button v-if="t.id !== trip.tripId" @click="switchTrip(t.id)"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-lift transition-all"
                aria-label="Open this trip" title="Open this trip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
              <button @click="copyTripLink(t.id)"
                :class="['w-8 h-8 flex items-center justify-center rounded-lg transition-all',
                  copiedTripId === t.id ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-lift' : 'text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-lift']"
                :aria-label="copiedTripId === t.id ? 'Copied!' : 'Copy link'">
                <svg v-if="copiedTripId !== t.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button @click="deleteTrip(t.id)" aria-label="Remove trip"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
          <div v-if="!trip.tripIndex.length" class="px-5 py-8 text-center text-sm text-slate-400 italic">No trips saved yet.</div>
        </div>
        <div class="px-5 py-4 border-t border-slate-100 dark:border-hairline">
          <button @click="startNewTrip"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-inset transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Trip
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-up-enter-active { transition: transform 0.28s cubic-bezier(0.32,0.72,0,1); }
.sheet-up-leave-active { transition: transform 0.22s cubic-bezier(0.4,0,1,1); }
.sheet-up-enter-from, .sheet-up-leave-to { transform: translateY(100%); }
</style>
