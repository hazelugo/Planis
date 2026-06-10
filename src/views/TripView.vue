<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppBottomNav from '@/components/layout/AppBottomNav.vue'
import OverviewTab from '@/views/tabs/OverviewTab.vue'
import ItineraryTab from '@/views/tabs/ItineraryTab.vue'
import SpendingTab from '@/views/tabs/SpendingTab.vue'
import SplitterTab from '@/views/tabs/SplitterTab.vue'
// import PhotosTab from '@/views/tabs/PhotosTab.vue'
import { useTripStore } from '@/stores/trips'
import { useUIStore } from '@/stores/ui'
import { useTrip } from '@/composables/useTrip'

const currentTab = ref('overview')
const trip = useTripStore()
const ui = useUIStore()
const { resolveTripId, resolveEditToken } = useTrip()

function retryLoad() {
  trip.retryLoad(resolveEditToken(trip.tripId))
}

async function protectTrip() {
  const ok = await ui.showConfirm({
    title: 'Protect this trip?',
    message: 'You\'ll get a private editor link (?edit=…). Share the link without ?edit so others can view but not change anything.',
    okLabel: 'Protect trip',
    okClass: 'bg-teal-600 hover:bg-teal-700',
  })
  if (ok) trip.protectTrip()
}

const TABS: Record<string, typeof OverviewTab> = {
  overview:   OverviewTab,
  itinerary:  ItineraryTab,
  analytics:  SpendingTab,
  splitter:   SplitterTab,
  // photos:  PhotosTab,
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') trip.ensureRealtimeSubscription()
}

onMounted(async () => {
  const tripId = resolveTripId()
  await trip.initialize(tripId, resolveEditToken(tripId))
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  trip.unsubscribeFromRealTime()
})
</script>

<template>
  <div v-if="trip.loadStatus === 'loading'" class="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0f1117] text-slate-500 dark:text-slate-400 text-sm">
    Loading trip…
  </div>

  <div v-else-if="trip.loadStatus === 'error'" class="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-[#0f1117] px-6 text-center">
    <p class="text-slate-700 dark:text-slate-200 font-medium">Couldn't load this trip</p>
    <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{{ trip.loadError }}</p>
    <button type="button" @click="retryLoad" class="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors">
      Try again
    </button>
  </div>

  <div v-else class="flex min-h-dvh lg:h-dvh lg:overflow-hidden bg-slate-50 dark:bg-[#0f1117]">
    <!-- Sidebar (desktop) -->
    <AppSidebar :current-tab="currentTab" @tab="currentTab = $event" />

    <!-- Main area -->
    <div class="flex-1 flex flex-col min-w-0 lg:min-h-0 lg:overflow-hidden">
      <AppHeader :current-tab="currentTab" :sync-status="trip.syncStatus" />

      <div v-if="trip.isReadOnly" class="shrink-0 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/30 text-center text-xs text-amber-800 dark:text-amber-300">
        View-only — ask the trip organizer for the editor link to make changes.
      </div>

      <div v-else-if="trip.needsProtection" class="shrink-0 px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800/30 flex flex-wrap items-center justify-center gap-2 text-xs text-teal-800 dark:text-teal-300">
        <span>Anyone with this link can edit.</span>
        <button type="button" @click="protectTrip" class="font-semibold underline underline-offset-2 hover:text-teal-900 dark:hover:text-teal-200">
          Get private editor link
        </button>
      </div>

      <!-- Content -->
      <main
        class="flex-1 px-4 pt-5 pb-28 lg:overflow-y-auto lg:min-h-0 lg:p-8"
        :class="{ 'read-only-trip': trip.isReadOnly }"
      >
        <div class="max-w-5xl mx-auto">
          <!-- KeepAlive avoids blank gaps from out-in transitions when switching tabs quickly -->
          <KeepAlive :max="4">
            <component :is="TABS[currentTab] ?? OverviewTab" :key="currentTab" />
          </KeepAlive>
        </div>
      </main>
    </div>

    <!-- Bottom nav (mobile) -->
    <AppBottomNav :current-tab="currentTab" @tab="currentTab = $event" />
  </div>
</template>

