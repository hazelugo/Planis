<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import { useTripStore } from '@/stores/trips'
import type { TripEvent, EventCategory } from '@/types/domain'

const trip = useTripStore()

// ── Form ──────────────────────────────────────────────────────────────────
const newEvent = ref({ name: '', date: '', time: '', category: 'Adventure' as EventCategory, cost: 0, perPerson: false, notes: '', url: '' })
const addSuccess = ref(false)
const formExpanded = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)
function expandForm() { formExpanded.value = true; nextTick(() => nameInputRef.value?.focus()) }

// ── Edit ──────────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editForm = reactive({ name: '', date: '', time: '', category: 'Adventure' as EventCategory, cost: 0, perPerson: false, notes: '', url: '' })

function startEdit(event: TripEvent) {
  editingId.value = event.id
  Object.assign(editForm, { ...event })
}
function saveEdit() {
  if (!editForm.name.trim() || !editingId.value) return
  trip.updateEvent(editingId.value, { ...editForm, name: editForm.name.trim() })
  editingId.value = null
}
function cancelEdit() { editingId.value = null }

// ── Search / filter ───────────────────────────────────────────────────────
const searchText = ref('')
const costMin = ref<number | ''>('')
const costMax = ref<number | ''>('')
const showFilters = ref(false)

const hasFilter = computed(() =>
  searchText.value.trim() !== '' || costMin.value !== '' || costMax.value !== ''
)

function clearFilters() {
  searchText.value = ''
  costMin.value = ''
  costMax.value = ''
}

// ── Drag to reorder ───────────────────────────────────────────────────────
const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(e: DragEvent, id: string) {
  draggedId.value = id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }
}
function onDragOver(e: DragEvent, id: string) {
  e.preventDefault()
  if (id !== draggedId.value) dragOverId.value = id
}
function onDragLeave(id: string) { if (dragOverId.value === id) dragOverId.value = null }
function onDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggedId.value || draggedId.value === targetId) { draggedId.value = null; dragOverId.value = null; return }
  const from = trip.state.events.findIndex(ev => ev.id === draggedId.value)
  const to = trip.state.events.findIndex(ev => ev.id === targetId)
  if (from !== -1 && to !== -1) trip.reorderEvents(from, to)
  draggedId.value = null; dragOverId.value = null
}
function onDragEnd() { draggedId.value = null; dragOverId.value = null }

// ── Sorted + filtered + grouped ───────────────────────────────────────────
const totalParticipants = computed(() => trip.state.friends.length || trip.state.attendance.adults + trip.state.attendance.kids)

const sortedEvents = computed(() =>
  [...trip.state.events].sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1; if (!b.date) return -1
    const dc = a.date.localeCompare(b.date)
    if (dc !== 0) return dc
    if (!a.time && !b.time) return 0
    if (!a.time) return 1; if (!b.time) return -1
    return a.time.localeCompare(b.time)
  })
)

const filteredEvents = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  const min = costMin.value !== '' ? Number(costMin.value) : null
  const max = costMax.value !== '' ? Number(costMax.value) : null
  return sortedEvents.value.filter(e => {
    if (q && !e.name.toLowerCase().includes(q) && !(e.notes ?? '').toLowerCase().includes(q)) return false
    const lineCost = e.perPerson ? e.cost * totalParticipants.value : e.cost
    if (min !== null && lineCost < min) return false
    if (max !== null && lineCost > max) return false
    return true
  })
})

const groupedEvents = computed(() => {
  const map = new Map<string, { label: string; date: string; events: TripEvent[]; total: number }>()
  filteredEvents.value.forEach(ev => {
    const key = ev.date || '__none__'
    if (!map.has(key)) {
      const label = ev.date
        ? new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'No date set'
      map.set(key, { label, date: ev.date, events: [], total: 0 })
    }
    const g = map.get(key)!
    g.events.push(ev)
    g.total += ev.perPerson ? ev.cost * totalParticipants.value : ev.cost
  })
  return [...map.values()]
})

const matchCount = computed(() => filteredEvents.value.length)

// ── Helpers ───────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, { badge: string; dot: string }> = {
  Transport: { badge: 'bg-blue-100 text-blue-600',       dot: 'bg-blue-100 text-blue-600'       },
  Lodging:   { badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-100 text-emerald-600' },
  Food:      { badge: 'bg-amber-100 text-amber-600',     dot: 'bg-amber-100 text-amber-600'     },
  Adventure:  { badge: 'bg-violet-100 text-violet-600',   dot: 'bg-violet-100 text-violet-600'   },
  Activity:   { badge: 'bg-violet-100 text-violet-600',   dot: 'bg-violet-100 text-violet-600'   },
}
const CAT_ICONS: Record<string, string> = {
  Transport: 'i-transport', Lodging: 'i-lodging', Food: 'i-food',
  Adventure: 'i-adventure', Activity: 'i-adventure',
}

function fmt(n: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) }
function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500'

function addEvent() {
  if (!newEvent.value.name.trim()) return
  trip.addEvent({ ...newEvent.value, name: newEvent.value.name.trim() })
  newEvent.value = { name: '', date: '', time: '', category: 'Adventure', cost: 0, perPerson: false, notes: '', url: '' }
  addSuccess.value = true
  setTimeout(() => { addSuccess.value = false; formExpanded.value = false }, 1200)
}

function removeEvent(id: string) { trip.removeEvent(id) }

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function exportPDF() {
  const dest = esc(trip.state.trip.destination || 'Trip Itinerary')
  const s = trip.state.trip.startDate ? fmtDate(trip.state.trip.startDate) : ''
  const e = trip.state.trip.endDate ? fmtDate(trip.state.trip.endDate) : ''
  const dateRange = s ? (e && e !== s ? `${s} – ${e}` : s) : ''

  const catColor: Record<string, string> = {
    Transport: '#2563eb', Lodging: '#059669', Food: '#d97706', Adventure: '#7c3aed', Activity: '#7c3aed',
  }

  let rows = ''
  let rowIdx = 0
  for (const group of groupedEvents.value) {
    rows += `<tr>
      <td colspan="2" style="padding:20px 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;border-bottom:1.5px solid #e2e8f0">${esc(group.label)}</td>
      <td style="padding:20px 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-align:right;border-bottom:1.5px solid #e2e8f0">$${fmt(group.total)}</td>
    </tr>`
    for (const ev of group.events) {
      const rowBg = rowIdx++ % 2 === 0 ? '#f8fafc' : '#ffffff'
      const costText = ev.perPerson
        ? `$${fmt(ev.cost)}<span style="font-size:11px;color:#94a3b8;font-weight:400">/pp</span>`
        : ev.cost > 0 ? `$${fmt(ev.cost)}` : '—'
      rows += `<tr style="background:${rowBg}">
        <td style="padding:10px 12px 10px 8px;width:84px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${catColor[ev.category]??'#64748b'};vertical-align:top">${esc(ev.category)}</td>
        <td style="padding:10px 0;font-size:14px;vertical-align:top">
          ${ev.url ? `<a href="${esc(ev.url)}" style="color:#0d9488;font-weight:600;text-decoration:none">${esc(ev.name)}</a>` : `<strong>${esc(ev.name)}</strong>`}
          ${ev.time ? `<span style="font-size:12px;color:#94a3b8"> · ${esc(ev.time)}</span>` : ''}
          ${ev.notes ? `<div style="font-size:12px;color:#64748b;font-style:italic;margin-top:3px">${esc(ev.notes)}</div>` : ''}
        </td>
        <td style="padding:10px 8px 10px 0;font-size:14px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;width:72px;vertical-align:top">${costText}</td>
      </tr>`
    }
  }

  const totalCost = groupedEvents.value.reduce((s, g) => s + g.total, 0)
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${dest} — Itinerary</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;color:#1e293b;padding:48px 40px;max-width:720px;margin:0 auto}@media print{@page{margin:1.5cm}body{padding:0}}table{width:100%;border-collapse:collapse}</style>
</head><body>
<h1 style="font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-.02em">${dest}</h1>
${dateRange ? `<p style="font-size:14px;color:#64748b;margin-top:4px">${dateRange}</p>` : ''}
<table style="margin-top:32px">${rows}</table>
${totalCost > 0 ? `<p style="margin-top:20px;font-size:13px;font-weight:700;color:#0f172a;text-align:right;border-top:2px solid #0f172a;padding-top:8px">Total: $${fmt(totalCost)}</p>` : ''}
</body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}
</script>

<template>
  <div class="space-y-5 anim-fade-up">

    <!-- Collapsed add bar — shown when events exist and form is not open -->
    <div v-if="trip.state.events.length > 0 && !formExpanded"
      @click="expandForm"
      class="print:hidden bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm px-5 py-3.5 flex items-center gap-3 cursor-text group hover:border-teal-200 dark:hover:border-teal-700 transition-all">
      <div class="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="text-teal-500"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <span class="text-sm text-slate-400 dark:text-slate-500 flex-1">What's next on the trip?</span>
      <span class="text-xs text-slate-300 dark:text-slate-600 hidden sm:block">Click to add</span>
    </div>

    <!-- Full add form — always shown when no events, or when expanded -->
    <div v-else class="print:hidden bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6">
      <div v-if="trip.state.events.length > 0" class="flex items-center justify-between mb-4">
        <p class="eyebrow text-teal-600 dark:text-teal-400">Add event</p>
        <button @click="formExpanded = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-inset transition-all" aria-label="Close form">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <label for="event-name" class="sr-only">Event name</label>
      <input ref="nameInputRef" id="event-name" v-model="newEvent.name" @keydown.enter="addEvent" @keydown.escape="trip.state.events.length > 0 && (formExpanded = false)" type="text" maxlength="120"
        placeholder="What's the plan? e.g. Eiffel Tower visit"
        class="w-full text-xl font-semibold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 mb-5" />

      <div class="flex flex-wrap gap-3 mb-4">
        <div class="flex-1 min-w-[120px]">
          <label class="eyebrow block mb-1.5">Category</label>
          <select v-model="newEvent.category" :class="inputCls">
            <option>Transport</option><option>Lodging</option><option>Food</option><option>Adventure</option>
          </select>
        </div>
        <div class="flex-1 min-w-[100px]">
          <label class="eyebrow block mb-1.5">Cost</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input v-model.number="newEvent.cost" type="number" min="0" step="0.01" placeholder="0" :class="inputCls + ' pl-7'" />
          </div>
        </div>
        <div class="flex-1 min-w-[140px]">
          <label class="eyebrow block mb-1.5">Cost Type</label>
          <div class="flex gap-1.5 h-[42px]">
            <button @click="newEvent.perPerson = false"
              :class="['flex-1 rounded-xl text-xs font-semibold border transition-all', !newEvent.perPerson ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'border-slate-200 dark:border-hairline text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
              Flat Rate
            </button>
            <button @click="newEvent.perPerson = true"
              :class="['flex-1 rounded-xl text-xs font-semibold border transition-all', newEvent.perPerson ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'border-slate-200 dark:border-hairline text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
              Per Person
            </button>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mb-4">
        <div class="flex-1">
          <label class="eyebrow block mb-1.5">Date</label>
          <input v-model="newEvent.date" type="date" :class="inputCls" />
        </div>
        <div class="flex-1">
          <label class="eyebrow block mb-1.5">Time</label>
          <input v-model="newEvent.time" type="time" :class="inputCls" />
        </div>
      </div>

      <div class="mb-4">
        <label class="eyebrow block mb-1.5">Notes <span class="normal-case font-normal text-slate-300">(optional)</span></label>
        <textarea v-model="newEvent.notes" rows="2" placeholder="Booking refs, addresses, reminders…" maxlength="500"
          class="w-full px-3 py-2.5 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"></textarea>
      </div>

      <div class="mb-5">
        <label class="eyebrow block mb-1.5">Link <span class="normal-case font-normal text-slate-300">(optional)</span></label>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <input v-model="newEvent.url" type="url" placeholder="https://…" maxlength="500" :class="inputCls + ' pl-8'" />
        </div>
      </div>

      <button @click="addEvent" :disabled="!newEvent.name.trim()"
        :class="['w-full py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-all', addSuccess ? 'bg-emerald-500' : 'bg-teal-600 hover:bg-teal-700 shadow-[0_2px_8px_rgba(20,184,166,.35)]']">
        {{ addSuccess ? '✓ Added to your itinerary!' : 'Add to Itinerary' }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!trip.state.events.length" class="bg-surface rounded-2xl border-2 border-dashed border-slate-200 dark:border-hairline py-16 px-8 text-center">
      <div class="flex flex-col items-center gap-0 mb-6">
        <div class="w-px h-8 border-l-2 border-dashed border-slate-200 dark:border-hairline"></div>
        <div class="w-3 h-3 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-surface"></div>
        <div class="w-px h-6 border-l-2 border-dashed border-slate-200 dark:border-hairline"></div>
        <svg width="48" height="48" class="block mx-auto my-2 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-itinerary"/></svg>
        <div class="w-px h-6 border-l-2 border-dashed border-slate-200 dark:border-hairline"></div>
        <div class="w-3 h-3 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-surface"></div>
        <div class="w-px h-8 border-l-2 border-dashed border-slate-200 dark:border-hairline"></div>
      </div>
      <p class="text-xl font-bold text-slate-600 dark:text-slate-400">Your adventure is waiting</p>
      <p class="text-sm text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">Start adding flights, dinners, hikes, and hidden gems. Every great trip begins with a plan.</p>
    </div>

    <!-- Search bar + event list -->
    <div v-else class="space-y-4">

      <!-- Search / filter toolbar -->
      <div class="print:hidden bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm px-4 py-3 space-y-3">
        <div class="flex items-center gap-2">
          <!-- Text search -->
          <div class="flex-1 relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="searchText" type="text" placeholder="Search by name or notes…"
              class="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <!-- Filter toggle -->
          <button @click="showFilters = !showFilters"
            :class="['flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0',
              showFilters || costMin !== '' || costMax !== ''
                ? 'bg-teal-50 dark:bg-inset border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-400'
                : 'border-slate-200 dark:border-hairline text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset']">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Cost
          </button>
          <!-- Export PDF -->
          <button @click="exportPDF"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-hairline text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-inset transition-all shrink-0"
            title="Export to PDF">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            PDF
          </button>
          <!-- Clear -->
          <button v-if="hasFilter" @click="clearFilters"
            class="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-transparent transition-all shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear
          </button>
        </div>

        <!-- Cost range (expandable) -->
        <Transition name="fade">
          <div v-if="showFilters" class="flex items-center gap-2 pt-1">
            <span class="text-xs text-slate-400 shrink-0">Cost</span>
            <div class="relative flex-1">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input v-model.number="costMin" type="number" min="0" placeholder="Min"
                class="w-full pl-6 pr-2 py-1.5 border border-slate-200 dark:border-hairline rounded-lg text-xs bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <span class="text-xs text-slate-300">—</span>
            <div class="relative flex-1">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input v-model.number="costMax" type="number" min="0" placeholder="Max"
                class="w-full pl-6 pr-2 py-1.5 border border-slate-200 dark:border-hairline rounded-lg text-xs bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
        </Transition>

        <!-- Results count when filtering -->
        <p v-if="hasFilter" class="text-xs text-slate-400">
          <span class="font-semibold text-teal-600 dark:text-teal-400">{{ matchCount }}</span> of {{ trip.state.events.length }} events
        </p>
      </div>

      <!-- No results -->
      <div v-if="!groupedEvents.length" class="rounded-2xl border-2 border-dashed border-slate-200 dark:border-hairline p-12 text-center">
        <svg width="40" height="40" class="block mx-auto mb-3 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-search"/></svg>
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">No events match your search</p>
        <button @click="clearFilters" class="mt-3 text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline">Clear filters</button>
      </div>

      <!-- Grouped by day -->
      <div v-else class="space-y-8">
        <div v-for="group in groupedEvents" :key="group.date || '__none__'">
          <div class="flex items-baseline justify-between mb-4 pb-3 border-b border-slate-100 dark:border-hairline">
            <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 leading-none">{{ group.label }}</h3>
            <span class="text-xs font-semibold text-slate-400 ml-3 whitespace-nowrap">${{ fmt(group.total) }}</span>
          </div>
          <div class="relative">
            <div class="absolute left-5 top-0 bottom-0 w-px bg-slate-200 dark:bg-[#2a3347]"></div>
            <div class="space-y-1">
              <template v-for="event in group.events">

                <!-- Inline edit -->
                <div v-if="editingId === event.id" :key="event.id + '-edit'"
                  class="ml-10 bg-surface rounded-2xl border-2 border-teal-300 dark:border-teal-700 shadow-md p-5 mb-2">
                  <p class="eyebrow text-teal-600 dark:text-teal-400 mb-4">Editing Event</p>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="sm:col-span-2">
                      <label class="eyebrow block mb-1.5">Event Name</label>
                      <input v-model="editForm.name" type="text" :class="inputCls" />
                    </div>
                    <div>
                      <label class="eyebrow block mb-1.5">Date</label>
                      <input v-model="editForm.date" type="date" :class="inputCls" />
                    </div>
                    <div>
                      <label class="eyebrow block mb-1.5">Time</label>
                      <input v-model="editForm.time" type="time" :class="inputCls" />
                    </div>
                    <div>
                      <label class="eyebrow block mb-1.5">Category</label>
                      <select v-model="editForm.category" :class="inputCls">
                        <option>Transport</option><option>Lodging</option><option>Food</option><option>Adventure</option>
                      </select>
                    </div>
                    <div>
                      <label class="eyebrow block mb-1.5">Cost Type</label>
                      <div class="flex gap-1.5 h-[42px]">
                        <button @click="editForm.perPerson = false" :class="['flex-1 rounded-xl text-xs font-semibold border transition-all', !editForm.perPerson ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 dark:border-hairline text-slate-500']">Flat Rate</button>
                        <button @click="editForm.perPerson = true" :class="['flex-1 rounded-xl text-xs font-semibold border transition-all', editForm.perPerson ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 dark:border-hairline text-slate-500']">Per Person</button>
                      </div>
                    </div>
                    <div>
                      <label class="eyebrow block mb-1.5">Cost ($)</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input v-model.number="editForm.cost" type="number" min="0" step="0.01" :class="inputCls + ' pl-7'" />
                      </div>
                    </div>
                    <div class="sm:col-span-2">
                      <label class="eyebrow block mb-1.5">Notes</label>
                      <textarea v-model="editForm.notes" rows="2" class="w-full px-3 py-2.5 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"></textarea>
                    </div>
                    <div class="sm:col-span-2">
                      <label class="eyebrow block mb-1.5">Link <span class="normal-case font-normal text-slate-300">(optional)</span></label>
                      <div class="relative">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        <input v-model="editForm.url" type="url" placeholder="https://…" :class="inputCls + ' pl-8'" />
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-4">
                    <button @click="saveEdit" :disabled="!editForm.name.trim()" class="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-colors shadow-sm">Save Changes</button>
                    <button @click="cancelEdit" class="px-5 py-2 bg-slate-100 dark:bg-lift text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors">Cancel</button>
                  </div>
                </div>

                <!-- Normal entry with drag -->
                <div v-else :key="event.id"
                  draggable="true"
                  @dragstart="onDragStart($event, event.id)"
                  @dragover.prevent="onDragOver($event, event.id)"
                  @dragleave="onDragLeave(event.id)"
                  @drop.prevent="onDrop($event, event.id)"
                  @dragend="onDragEnd"
                  :class="['relative flex items-start gap-0 group select-none py-2 transition-all rounded-xl',
                    draggedId === event.id ? 'opacity-40' : 'opacity-100',
                    dragOverId === event.id ? 'bg-teal-50/60 dark:bg-teal-900/10' : '']">

                  <!-- Drag handle -->
                  <div class="hidden lg:flex print:hidden items-center justify-center w-4 shrink-0 pt-3 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 transition-colors z-10">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>

                  <!-- Category dot -->
                  <div class="relative flex flex-col items-center shrink-0 z-10 mr-4" style="width:32px">
                    <div :class="['w-8 h-8 rounded-full border-2 border-white dark:border-[#0f1117] shadow-sm flex items-center justify-center mt-2 shrink-0', CAT_COLORS[event.category]?.dot]">
                      <svg width="18" height="18" aria-hidden="true"><use :href="`/icons.svg#${CAT_ICONS[event.category]}`"/></svg>
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0 bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm px-4 py-3.5 hover:border-slate-200 hover:shadow-md transition-all mb-1">
                    <div class="flex items-start gap-2">
                      <div class="flex-1 min-w-0">
                        <a v-if="event.url" :href="event.url" target="_blank" rel="noopener"
                          class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug block hover:text-teal-600 hover:underline transition-colors">{{ event.name }}</a>
                        <p v-else class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug">{{ event.name }}</p>
                        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span v-if="event.time" class="text-xs text-slate-400">{{ event.time }}</span>
                          <span :class="['text-[11px] px-2 py-0.5 rounded-full font-semibold', CAT_COLORS[event.category]?.badge]">{{ event.category }}</span>
                          <span v-if="event.perPerson" class="text-[11px] bg-slate-100 dark:bg-inset text-slate-500 px-2 py-0.5 rounded-full">Per person</span>
                        </div>
                        <p v-if="event.notes" class="text-xs text-slate-400 mt-2 leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-hairline line-clamp-2">{{ event.notes }}</p>
                      </div>
                      <div class="text-right shrink-0 ml-2">
                        <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">${{ fmt(event.perPerson ? event.cost * totalParticipants : event.cost) }}</p>
                        <p v-if="event.perPerson && totalParticipants > 1" class="text-[11px] text-slate-400 mt-0.5">${{ fmt(event.cost) }}/pp</p>
                      </div>
                      <div class="print:hidden flex flex-col gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                        <a :href="`https://maps.google.com/?q=${encodeURIComponent(event.name + (trip.state.trip.destination ? ' ' + trip.state.trip.destination : ''))}`"
                          target="_blank" rel="noopener"
                          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </a>
                        <button @click="startEdit(event)"
                          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button @click="removeEvent(event.id)"
                          class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s, transform 0.12s; }
.fade-enter-from { opacity: 0; transform: translateY(-4px); }
.fade-leave-to   { opacity: 0; transform: translateY(-4px); }

@media print {
  @page { margin: 1.5cm; }
  /* Remove card shadows and soften borders */
  .bg-surface { box-shadow: none !important; }
  /* Keep timeline spine visible */
  .border-l-2 { border-color: #e2e8f0 !important; }
  /* Ensure text is black for print */
  .text-slate-800, .text-slate-700 { color: #1e293b !important; }
}
</style>
