<script setup lang="ts">
import { useTripStore } from '@/stores/trips'
import { useUIStore } from '@/stores/ui'

const props = defineProps<{
  currentTab: string
}>()
const emit = defineEmits<{ (e: 'tab', id: string): void }>()

const trip = useTripStore()
const ui = useUIStore()

const tabs = [
  { id: 'overview',   label: 'Overview',  icon: 'i-overview'  },
  { id: 'itinerary',  label: 'Itinerary', icon: 'i-itinerary' },
  { id: 'analytics',  label: 'Spending',  icon: 'i-spending'  },
  { id: 'splitter',   label: 'Splitter',  icon: 'i-splitter'  },
  // { id: 'photos',  label: 'Photos',    icon: 'i-photos'    },
]

</script>

<template>
  <aside class="hidden lg:flex flex-col w-60 bg-surface border-r border-slate-100 dark:border-hairline shrink-0 overflow-y-auto">

    <!-- Planis wordmark -->
    <div class="px-5 pt-6 pb-5 border-b border-slate-100 dark:border-hairline">
      <div class="flex flex-col items-center gap-1.5">
        <img :src="ui.darkMode ? '/logo-dark.svg' : '/logo.svg'" alt="Planis" width="120" height="44" class="h-11 w-auto" />
        <p class="text-xs text-slate-400 text-center truncate max-w-[180px]">{{ trip.state.trip.destination || 'Making trip planning fun again' }}</p>
      </div>
    </div>

    <!-- Tab navigation -->
    <nav class="flex-1 px-3 py-4 space-y-0.5" aria-label="Navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="emit('tab', tab.id)"
        :aria-current="currentTab === tab.id ? 'page' : undefined"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
          currentTab === tab.id
            ? 'bg-teal-50 dark:bg-inset text-teal-700 dark:text-[#2dd4bf]'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset hover:text-slate-700 dark:hover:text-slate-200'
        ]"
      >
        <span class="shrink-0 w-[17px] h-[17px]" :class="currentTab === tab.id ? 'text-teal-600 dark:text-[#2dd4bf]' : 'text-slate-400 dark:text-slate-500'">
          <svg width="17" height="17" aria-hidden="true"><use :href="`/icons.svg#${tab.icon}`"/></svg>
        </span>
        {{ tab.label }}
      </button>
    </nav>

    <!-- Countdown widget -->
    <div v-if="trip.daysUntilTrip !== null && trip.daysUntilTrip > 0" class="m-3 p-4 rounded-2xl bg-teal-50 dark:bg-inset border border-teal-100 dark:border-hairline">
      <p class="text-[10px] text-teal-500 font-bold uppercase tracking-widest">Departing in</p>
      <p class="text-3xl font-extrabold text-teal-700 dark:text-[#2dd4bf] mt-0.5 leading-none">
        {{ trip.daysUntilTrip }}<span class="text-base font-normal ml-1 text-teal-600 dark:text-teal-400">days</span>
      </p>
      <p class="text-xs text-slate-400 mt-2 truncate">{{ trip.state.trip.destination }}</p>
    </div>
    <div v-else-if="trip.daysUntilTrip === 0" class="m-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
      <p class="text-[10px] font-bold uppercase tracking-widest opacity-70">It's today!</p>
      <p class="text-lg font-black mt-0.5 anim-bounce inline-block">🎉</p>
      <p class="text-sm font-semibold mt-1">Have an amazing trip!</p>
    </div>
  </aside>
</template>
