<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTripStore } from '@/stores/trips'
import { useUIStore } from '@/stores/ui'

const trip = useTripStore()
const ui = useUIStore()
const totalParticipants = computed(() => trip.state.friends.length || trip.state.attendance.adults + trip.state.attendance.kids)

const CATS = [
  { key: 'Transport', color: '#60a5fa', light: '#dbeafe', darkBg: 'rgba(96,165,250,0.12)',  darkText: '#93c5fd' },
  { key: 'Lodging',   color: '#34d399', light: '#d1fae5', darkBg: 'rgba(52,211,153,0.12)',  darkText: '#6ee7b7' },
  { key: 'Food',      color: '#fbbf24', light: '#fef3c7', darkBg: 'rgba(251,191,36,0.12)',  darkText: '#fcd34d' },
  { key: 'Adventure',  color: '#a78bfa', light: '#ede9fe', darkBg: 'rgba(167,139,250,0.12)', darkText: '#c4b5fd' },
]

const breakdown = computed(() => CATS.map(c => {
  const events = trip.state.events.filter(e => e.category === c.key || (c.key === 'Adventure' && e.category === 'Activity'))
  const total = events.reduce((s, e) => s + (e.perPerson ? e.cost * totalParticipants.value : e.cost), 0)
  return { ...c, total, count: events.length, events }
}))

const grand = computed(() => breakdown.value.reduce((s, b) => s + b.total, 0))

// hover = donut ring interaction; selected = click to drill down
const hovered = ref<string | null>(null)
const selected = ref<string | null>(null)

function toggleSelected(key: string) {
  selected.value = selected.value === key ? null : key
  hovered.value = null
}

const activeKey = computed(() => hovered.value ?? selected.value)
const activeSlice = computed(() => activeKey.value ? breakdown.value.find(b => b.key === activeKey.value) ?? null : null)

const selectedBreakdown = computed(() =>
  selected.value ? breakdown.value.find(b => b.key === selected.value) ?? null : null
)

function fmt(n: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) }
function pct(n: number) { return grand.value > 0 ? Math.round(n / grand.value * 100) : 0 }

const donutAriaLabel = computed(() => {
  const parts = breakdown.value
    .filter(b => b.total > 0)
    .map(b => `${b.key} ${pct(b.total)}% ($${fmt(b.total)})`)
  return `Spending breakdown: ${parts.join(', ')}. Total $${fmt(grand.value)}.`
})

// Donut — r=80, enforce minimum arc of 12px so tiny slices stay clickable
const R = 80
const CIRC = 2 * Math.PI * R
const GAP = 3
const MIN_ARC = 12

const slices = computed(() => {
  const active = breakdown.value.filter(b => b.total > 0)
  // First pass: compute raw fractions and apply minimum arc
  const raw = active.map(b => ({ ...b, raw: b.total / grand.value }))
  const totalMinArc = raw.filter(b => b.raw * CIRC < MIN_ARC).length * MIN_ARC
  const remaining = CIRC - totalMinArc - GAP * raw.length
  const scaleFactor = remaining / raw.filter(b => b.raw * CIRC >= MIN_ARC).reduce((s, b) => s + b.raw * CIRC, 0) || 1

  let offset = -CIRC / 4
  return raw.map(b => {
    const arcLen = b.raw * CIRC < MIN_ARC ? MIN_ARC : b.raw * CIRC * scaleFactor
    const dash = Math.max(0, arcLen - GAP)
    const slice = { ...b, dash, gap: CIRC - dash, offset }
    offset += arcLen
    return slice
  })
})
</script>

<template>
  <div class="space-y-5 anim-fade-up">
    <div v-if="!grand" class="rounded-2xl border-2 border-dashed border-slate-200 dark:border-hairline p-16 text-center">
      <svg width="48" height="48" class="block mx-auto mb-3 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-spending"/></svg>
      <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">No spending data yet</p>
      <p class="text-xs text-slate-400 mt-1">Add events in the Itinerary tab to see breakdowns here.</p>
    </div>

    <div v-else class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6">
      <div class="flex items-baseline justify-between mb-6">
        <p class="eyebrow">Spending breakdown</p>
        <span class="text-xs text-slate-400">{{ trip.state.events.length }} events</span>
      </div>

      <!-- Donut + legend -->
      <div class="flex flex-col sm:flex-row items-center gap-8">

        <!-- Donut -->
        <div class="relative shrink-0" style="width:200px;height:200px">
          <svg width="200" height="200" viewBox="0 0 200 200" role="img" :aria-label="donutAriaLabel">
            <circle cx="100" cy="100" :r="R" fill="none"
              class="stroke-slate-100 dark:stroke-[#253047]" stroke-width="28" />
            <circle v-for="s in slices" :key="s.key"
              cx="100" cy="100" :r="R" fill="none"
              :stroke="s.color"
              :style="{
                strokeWidth: activeKey === s.key ? '34' : '28',
                strokeDasharray: `${s.dash} ${s.gap}`,
                strokeDashoffset: String(-s.offset),
                opacity: activeKey && activeKey !== s.key ? 0.3 : 1,
                transition: 'stroke-width 0.15s, opacity 0.15s',
                cursor: 'pointer',
              }"
              stroke-linecap="round"
              @mouseenter="hovered = s.key"
              @mouseleave="hovered = null"
              @click="toggleSelected(s.key)"
            />
          </svg>
          <!-- Centre -->
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <template v-if="activeSlice">
              <p class="text-lg font-black text-slate-800 dark:text-slate-100 leading-none">${{ fmt(activeSlice.total) }}</p>
              <p class="text-xs text-slate-400 mt-0.5">{{ activeSlice.key }}</p>
              <p class="text-xs font-bold mt-0.5" :style="`color:${activeSlice.color}`">{{ pct(activeSlice.total) }}%</p>
            </template>
            <template v-else>
              <p class="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">${{ fmt(grand) }}</p>
              <p class="text-xs text-slate-400 mt-1">total</p>
            </template>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex-1 w-full space-y-1.5">
          <button v-for="b in breakdown.filter(b => b.total > 0)" :key="b.key"
            :aria-label="`${b.key}: $${fmt(b.total)}, ${pct(b.total)}% of total`"
            class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left"
            :class="selected === b.key ? '' : 'hover:bg-slate-50 dark:hover:bg-inset'"
            :style="selected === b.key ? `background:${ui.darkMode ? b.darkBg : b.light};outline:2px solid ${b.color};outline-offset:-2px;border-radius:0.75rem` : ''"
            @mouseenter="hovered = b.key"
            @mouseleave="hovered = null"
            @click="toggleSelected(b.key)">
            <span class="w-3 h-3 rounded-full shrink-0" :style="`background:${b.color}`"></span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{{ b.key }}</span>
            <span class="text-xs text-slate-400">{{ b.count }} event{{ b.count !== 1 ? 's' : '' }}</span>
            <div class="text-right">
              <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${{ fmt(b.total) }}</span>
              <span class="text-xs text-slate-400 ml-1.5">{{ pct(b.total) }}%</span>
            </div>
            <svg v-if="selected === b.key" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="shrink-0 text-slate-400"><polyline points="18 15 12 9 6 15"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="shrink-0 text-slate-300"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <div v-for="b in breakdown.filter(b => b.total === 0)" :key="b.key + '-zero'"
            class="flex items-center gap-3 px-3 py-2 opacity-30">
            <span class="w-3 h-3 rounded-full shrink-0 bg-slate-200 dark:bg-slate-600"></span>
            <span class="text-sm text-slate-400 flex-1">{{ b.key }}</span>
            <span class="text-xs text-slate-300">—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Drill-down expense list -->
    <Transition name="fade">
      <div v-if="selectedBreakdown" class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-hairline"
          :style="`background:${ui.darkMode ? selectedBreakdown.darkBg : selectedBreakdown.light}`">
          <span class="w-3 h-3 rounded-full shrink-0" :style="`background:${selectedBreakdown.color}`"></span>
          <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ selectedBreakdown.key }}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400 ml-1">{{ selectedBreakdown.count }} event{{ selectedBreakdown.count !== 1 ? 's' : '' }}</span>
          <span class="ml-auto text-sm font-black text-slate-800 dark:text-slate-100">${{ fmt(selectedBreakdown.total) }}</span>
          <button @click="selected = null" aria-label="Close" class="ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <!-- Events -->
        <div class="divide-y divide-slate-50 dark:divide-hairline">
          <div v-for="e in selectedBreakdown.events" :key="e.id"
            class="flex items-center gap-4 px-6 py-3.5">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{{ e.name }}</p>
              <p v-if="e.date" class="text-xs text-slate-400 mt-0.5">
                {{ new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                <span v-if="e.time"> · {{ e.time }}</span>
                <span v-if="e.perPerson" class="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-inset text-slate-500 text-[10px] font-semibold">Per person</span>
              </p>
              <p v-if="e.notes" class="text-xs text-slate-400 mt-1 line-clamp-1 pl-2 border-l-2 border-slate-100 dark:border-hairline">{{ e.notes }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold text-slate-700 dark:text-slate-300">${{ fmt(e.perPerson ? e.cost * totalParticipants : e.cost) }}</p>
              <p v-if="e.perPerson && totalParticipants > 1" class="text-[11px] text-slate-500 dark:text-slate-400">${{ fmt(e.cost) }} / person</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
