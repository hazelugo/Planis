<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import { useTripStore } from '@/stores/trips'
import type { TripEvent, EventCategory } from '@/types/domain'

const trip = useTripStore()

// ── Form ──────────────────────────────────────────────────────────────────
const newEvent = ref({ name: '', date: '', time: '', category: 'Activity' as EventCategory, cost: 0, perPerson: false, notes: '', url: '' })
const addSuccess = ref(false)

// ── Edit ──────────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editForm = reactive({ name: '', date: '', time: '', category: 'Activity' as EventCategory, cost: 0, perPerson: false, notes: '', url: '' })

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

// ── View toggle ───────────────────────────────────────────────────────────
const groupByDay = ref(false)

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

// ── Sorted + grouped events ───────────────────────────────────────────────
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

const groupedEvents = computed(() => {
  const map = new Map<string, { label: string; date: string; events: TripEvent[]; total: number }>()
  sortedEvents.value.forEach(ev => {
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

// ── Helpers ───────────────────────────────────────────────────────────────
const totalParticipants = computed(() => trip.state.friends.length || trip.state.attendance.adults + trip.state.attendance.kids)

const CAT_COLORS: Record<string, { badge: string; dot: string }> = {
  Transport: { badge: 'bg-blue-100 text-blue-600',       dot: 'bg-blue-100 text-blue-600'       },
  Lodging:   { badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-100 text-emerald-600' },
  Food:      { badge: 'bg-amber-100 text-amber-600',     dot: 'bg-amber-100 text-amber-600'     },
  Activity:  { badge: 'bg-violet-100 text-violet-600',   dot: 'bg-violet-100 text-violet-600'   },
}

const CAT_ICONS: Record<string, string> = {
  Transport: 'i-transport',
  Lodging:   'i-lodging',
  Food:      'i-food',
  Activity:  'i-activity',
}

function fmt(n: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) }
function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 dark:border-[#2a3347] rounded-xl text-sm bg-white dark:bg-[#1e2535] text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500'

function addEvent() {
  if (!newEvent.value.name.trim()) return
  trip.addEvent({ ...newEvent.value, name: newEvent.value.name.trim() })
  newEvent.value = { name: '', date: '', time: '', category: 'Activity', cost: 0, perPerson: false, notes: '', url: '' }
  addSuccess.value = true
  setTimeout(() => { addSuccess.value = false }, 1200)
}

async function removeEvent(id: string) { trip.removeEvent(id) }
</script>

<template>
  <div class="space-y-5 anim-fade-up">

    <!-- Add event form -->
    <div class="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-slate-100 dark:border-[#2a3347] shadow-sm p-6">
      <input v-model="newEvent.name" @keydown.enter="addEvent" type="text" maxlength="120"
        placeholder="What's the plan? e.g. Eiffel Tower visit"
        class="w-full text-xl font-semibold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 mb-5" />

      <!-- Row 1: Category · Cost · Cost type -->
      <div class="flex flex-wrap gap-3 mb-4">
        <div class="flex-1 min-w-[120px]">
          <label class="eyebrow block mb-1.5">Category</label>
          <select v-model="newEvent.category" :class="inputCls">
            <option>Transport</option><option>Lodging</option><option>Food</option><option>Activity</option>
          </select>
        </div>
        <div class="flex-1 min-w-[100px]">
          <label class="eyebrow block mb-1.5">Cost</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input v-model.number="newEvent.cost" type="number" min="0" step="0.01" placeholder="0"
              :class="inputCls + ' pl-7'" />
          </div>
        </div>
        <div class="flex-1 min-w-[140px]">
          <label class="eyebrow block mb-1.5">Cost Type</label>
          <div class="flex gap-1.5 h-[42px]">
            <button @click="newEvent.perPerson = false"
              :class="['flex-1 rounded-xl text-xs font-semibold border transition-all',
                !newEvent.perPerson ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'border-slate-200 dark:border-[#2a3347] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e2535]']">
              Flat Rate
            </button>
            <button @click="newEvent.perPerson = true"
              :class="['flex-1 rounded-xl text-xs font-semibold border transition-all',
                newEvent.perPerson ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'border-slate-200 dark:border-[#2a3347] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e2535]']">
              Per Person
            </button>
          </div>
        </div>
      </div>

      <!-- Row 2: Date · Time -->
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

      <!-- Notes -->
      <div class="mb-4">
        <label class="eyebrow block mb-1.5">Notes <span class="normal-case font-normal text-slate-300">(optional)</span></label>
        <textarea v-model="newEvent.notes" rows="2" placeholder="Booking refs, addresses, reminders…" maxlength="500"
          class="w-full px-3 py-2.5 border border-slate-200 dark:border-[#2a3347] rounded-xl text-sm bg-white dark:bg-[#1e2535] text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"></textarea>
      </div>

      <!-- Link -->
      <div class="mb-5">
        <label class="eyebrow block mb-1.5">Link <span class="normal-case font-normal text-slate-300">(optional)</span></label>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <input v-model="newEvent.url" type="url" placeholder="https://…" maxlength="500"
            :class="inputCls + ' pl-8'" />
        </div>
      </div>

      <!-- CTA -->
      <button @click="addEvent" :disabled="!newEvent.name.trim()"
        :class="['w-full py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-all',
          addSuccess ? 'bg-emerald-500' : 'hover:opacity-90']"
        :style="addSuccess ? '' : 'background:#0d9488;box-shadow:0 2px 8px rgba(20,184,166,.35)'">
        {{ addSuccess ? '✓ Added to your itinerary!' : 'Add to Itinerary' }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!trip.state.events.length" class="bg-white dark:bg-[#1a1f2e] rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#2a3347] py-16 px-8 text-center">
      <div class="flex flex-col items-center gap-0 mb-6">
        <div class="w-px h-8 border-l-2 border-dashed border-slate-200 dark:border-[#2a3347]"></div>
        <div class="w-3 h-3 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1f2e]"></div>
        <div class="w-px h-6 border-l-2 border-dashed border-slate-200 dark:border-[#2a3347]"></div>
        <div class="text-4xl my-2 select-none">🗺️</div>
        <div class="w-px h-6 border-l-2 border-dashed border-slate-200 dark:border-[#2a3347]"></div>
        <div class="w-3 h-3 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1f2e]"></div>
        <div class="w-px h-8 border-l-2 border-dashed border-slate-200 dark:border-[#2a3347]"></div>
      </div>
      <p class="text-xl font-bold text-slate-600 dark:text-slate-400">Your adventure is waiting</p>
      <p class="text-sm text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">Start adding flights, dinners, hikes, and hidden gems. Every great trip begins with a plan.</p>
    </div>

    <!-- Toolbar + event list -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-400 font-medium">
          {{ trip.state.events.length }} event{{ trip.state.events.length !== 1 ? 's' : '' }}
          <span v-if="!groupByDay" class="ml-1 text-slate-300 hidden lg:inline">· drag to reorder</span>
        </span>
        <button @click="groupByDay = !groupByDay"
          :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
            groupByDay
              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
              : 'bg-white dark:bg-[#1a1f2e] border-slate-200 dark:border-[#2a3347] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1e2535]']">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Group by Day
        </button>
      </div>

      <!-- ── Flat timeline ── -->
      <div v-if="!groupByDay" class="relative">
        <div class="absolute left-9 top-0 bottom-0 w-px bg-slate-200 dark:bg-[#2a3347]"></div>
        <TransitionGroup name="slide-up" tag="div" class="space-y-1">
          <template v-for="event in sortedEvents" :key="event.id">

            <!-- Inline edit -->
            <div v-if="editingId === event.id"
              class="ml-10 bg-white dark:bg-[#1a1f2e] rounded-2xl border-2 border-teal-300 dark:border-teal-700 shadow-md p-5 mb-2">
              <p class="eyebrow text-teal-600 dark:text-teal-400 mb-4">Editing Event</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div class="sm:col-span-2 lg:col-span-1">
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
                    <option>Transport</option><option>Lodging</option><option>Food</option><option>Activity</option>
                  </select>
                </div>
                <div>
                  <label class="eyebrow block mb-1.5">Cost ($)</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input v-model.number="editForm.cost" type="number" min="0" step="0.01" :class="inputCls + ' pl-7'" />
                  </div>
                </div>
                <div>
                  <label class="eyebrow block mb-1.5">Cost Type</label>
                  <div class="flex gap-1.5 h-[42px]">
                    <button @click="editForm.perPerson = false"
                      :class="['flex-1 rounded-xl text-xs font-semibold border transition-all',
                        !editForm.perPerson ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 dark:border-[#2a3347] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1e2535]']">
                      Flat Rate
                    </button>
                    <button @click="editForm.perPerson = true"
                      :class="['flex-1 rounded-xl text-xs font-semibold border transition-all',
                        editForm.perPerson ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 dark:border-[#2a3347] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1e2535]']">
                      Per Person
                    </button>
                  </div>
                </div>
                <div class="sm:col-span-2 lg:col-span-3">
                  <label class="eyebrow block mb-1.5">Notes</label>
                  <textarea v-model="editForm.notes" rows="2"
                    class="w-full px-3 py-2.5 border border-slate-200 dark:border-[#2a3347] rounded-xl text-sm bg-white dark:bg-[#1e2535] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"></textarea>
                </div>
                <div class="sm:col-span-2 lg:col-span-3">
                  <label class="eyebrow block mb-1.5">Link <span class="normal-case font-normal text-slate-300">(optional)</span></label>
                  <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <input v-model="editForm.url" type="url" placeholder="https://…" :class="inputCls + ' pl-8'" />
                  </div>
                </div>
              </div>
              <div class="flex gap-2 mt-4">
                <button @click="saveEdit" :disabled="!editForm.name.trim()"
                  class="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-colors shadow-sm">
                  Save Changes
                </button>
                <button @click="cancelEdit"
                  class="px-5 py-2 bg-slate-100 dark:bg-[#253047] text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            <!-- Draggable timeline entry -->
            <div v-else
              draggable="true"
              @dragstart="onDragStart($event, event.id)"
              @dragover.prevent="onDragOver($event, event.id)"
              @dragleave="onDragLeave(event.id)"
              @drop.prevent="onDrop($event, event.id)"
              @dragend="onDragEnd"
              :class="['relative flex items-start gap-0 group select-none py-2 transition-all rounded-xl',
                draggedId === event.id  ? 'opacity-40' : 'opacity-100',
                dragOverId === event.id ? 'bg-teal-50/60 dark:bg-teal-900/10' : '']">

              <!-- Drag handle -->
              <div class="hidden lg:flex items-center justify-center w-5 shrink-0 pt-3 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 transition-colors z-10">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </div>

              <!-- Category dot with design-system icon -->
              <div class="relative flex flex-col items-center shrink-0 z-10 mr-4" style="width:32px">
                <div :class="['w-8 h-8 rounded-full border-2 border-white dark:border-[#0f1117] shadow-sm flex items-center justify-center mt-2 shrink-0', CAT_COLORS[event.category]?.dot]">
                  <svg width="18" height="18" aria-hidden="true"><use :href="`/icons.svg#${CAT_ICONS[event.category]}`"/></svg>
                </div>
              </div>

              <!-- Content card -->
              <div class="flex-1 min-w-0 bg-white dark:bg-[#1a1f2e] rounded-2xl border border-slate-100 dark:border-[#2a3347] shadow-sm px-4 py-3.5 hover:border-slate-200 hover:shadow-md transition-all">
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <a v-if="event.url" :href="event.url" target="_blank" rel="noopener"
                      class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug truncate block hover:text-teal-600 hover:underline transition-colors">
                      {{ event.name }}
                    </a>
                    <p v-else class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug truncate">{{ event.name }}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span v-if="event.date" class="text-xs text-slate-400">{{ fmtDate(event.date) }}<span v-if="event.time" class="text-slate-300"> · </span><span v-if="event.time" class="text-slate-400">{{ event.time }}</span></span>
                      <span :class="['text-[11px] px-2 py-0.5 rounded-full font-semibold', CAT_COLORS[event.category]?.badge]">{{ event.category }}</span>
                      <span v-if="event.perPerson" class="text-[11px] bg-slate-100 dark:bg-[#1e2535] text-slate-500 px-2 py-0.5 rounded-full">Per person</span>
                    </div>
                    <p v-if="event.notes" class="text-xs text-slate-400 mt-2 leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-[#2a3347] line-clamp-2">{{ event.notes }}</p>
                  </div>
                  <div class="text-right shrink-0 ml-2">
                    <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">${{ fmt(event.perPerson ? event.cost * totalParticipants : event.cost) }}</p>
                    <p v-if="event.perPerson && totalParticipants > 1" class="text-[11px] text-slate-400 mt-0.5">${{ fmt(event.cost) }}/pp</p>
                  </div>
                  <!-- Actions -->
                  <div class="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <a :href="`https://maps.google.com/?q=${encodeURIComponent(event.name + (trip.state.trip.destination ? ' ' + trip.state.trip.destination : ''))}`"
                      target="_blank" rel="noopener"
                      class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </a>
                    <button @click.stop="startEdit(event)"
                      class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button @click.stop="removeEvent(event.id)"
                      class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </TransitionGroup>
      </div>

      <!-- ── Group by Day view ── -->
      <div v-else class="space-y-8">
        <div v-for="group in groupedEvents" :key="group.date || '__none__'">
          <div class="flex items-baseline justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#2a3347]">
            <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 leading-none">{{ group.label }}</h3>
            <span class="text-xs font-semibold text-slate-400 ml-3 whitespace-nowrap">${{ fmt(group.total) }}</span>
          </div>
          <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-px bg-slate-200 dark:bg-[#2a3347]"></div>
            <div class="space-y-1">
              <div v-for="event in group.events" :key="event.id" class="relative flex items-start gap-0 group transition-all select-none py-2">
                <div class="relative flex flex-col items-center shrink-0 z-10 mr-4" style="width:24px">
                  <div :class="['w-5 h-5 rounded-full border-2 border-white dark:border-[#0f1117] shadow-sm flex items-center justify-center mt-2.5 shrink-0', CAT_COLORS[event.category]?.dot]">
                    <svg width="10" height="10" aria-hidden="true"><use :href="`/icons.svg#${CAT_ICONS[event.category]}`"/></svg>
                  </div>
                </div>
                <div class="flex-1 min-w-0 bg-white dark:bg-[#1a1f2e] rounded-2xl border border-slate-100 dark:border-[#2a3347] shadow-sm px-4 py-3.5 hover:border-slate-200 hover:shadow-md transition-all mb-1">
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <a v-if="event.url" :href="event.url" target="_blank" rel="noopener"
                        class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug block hover:text-teal-600 hover:underline transition-colors">
                        {{ event.name }}
                      </a>
                      <p v-else class="font-semibold text-slate-800 dark:text-slate-100 text-base leading-snug">{{ event.name }}</p>
                      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span v-if="event.time" class="text-xs text-slate-400">{{ event.time }}</span>
                        <span :class="['text-[11px] px-2 py-0.5 rounded-full font-semibold', CAT_COLORS[event.category]?.badge]">{{ event.category }}</span>
                        <span v-if="event.perPerson" class="text-[11px] bg-slate-100 dark:bg-[#1e2535] text-slate-500 px-2 py-0.5 rounded-full">Per person</span>
                      </div>
                      <p v-if="event.notes" class="text-xs text-slate-400 mt-2 leading-relaxed pl-3 border-l-2 border-slate-100 dark:border-[#2a3347] line-clamp-2">{{ event.notes }}</p>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                      <p class="font-bold text-slate-700 dark:text-slate-300 text-sm">${{ fmt(event.perPerson ? event.cost * totalParticipants : event.cost) }}</p>
                      <p v-if="event.perPerson && totalParticipants > 1" class="text-[11px] text-slate-400 mt-0.5">${{ fmt(event.cost) }}/pp</p>
                    </div>
                    <div class="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
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
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.slide-up-enter-active { animation: fade-up 0.18s var(--ease-out) both; }
.slide-up-leave-active { transition: opacity 0.15s, transform 0.15s; }
.slide-up-leave-to    { opacity: 0; transform: translateY(-4px); }
</style>
