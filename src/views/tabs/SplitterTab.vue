<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useTripStore } from '@/stores/trips'
import { useUIStore } from '@/stores/ui'
import type { Payment } from '@/types/domain'

const trip = useTripStore()
const ui = useUIStore()

const newPayment = reactive({ paidById: '', amount: 0, description: '', splitAmong: [] as string[], splitPercentages: {} as Record<string, number> })
const editingPaymentId = ref<string | null>(null)
const newFriendName = ref('')
const formCardRef = ref<HTMLElement | null>(null)
const formFlashing = ref(false)
const AVATAR_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#10b981', '#8b5cf6']
const avatarColorMap = computed(() => new Map(trip.state.friends.map((f, i) => [f.id, AVATAR_COLORS[i % 5]])))
const avatarColor = (id: string) => avatarColorMap.value.get(id) ?? AVATAR_COLORS[0]

function addFriendLocal() {
  const n = newFriendName.value.trim()
  if (!n) return
  trip.addFriend(n)
  newFriendName.value = ''
}

const friendName = (id: string) => trip.state.friends.find(f => f.id === id)?.name ?? '?'
const friendInitial = (name: string) => name.trim().charAt(0).toUpperCase()
const isSettled = (from: string, to: string) => trip.state.settledPairs.includes(`${from}→${to}`)
const totalPayments = computed(() => trip.state.payments.reduce((s, p) => s + p.amount, 0))
const splitPercentageTotal = computed(() => {
  return Math.round(Object.values(newPayment.splitPercentages).reduce((s, v) => s + (v || 0), 0) * 100) / 100
})
const splitValid = computed(() => newPayment.splitAmong.length === 0 || Math.abs(splitPercentageTotal.value - 100) < 0.01)

function fmt(n: number) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) }

function redistributeEqual() {
  const pct = 100 / newPayment.splitAmong.length
  newPayment.splitAmong.forEach(id => { newPayment.splitPercentages[id] = Math.round(pct * 100) / 100 })
  // fix rounding on first person
  const off = 100 - splitPercentageTotal.value
  if (newPayment.splitAmong.length > 0 && Math.abs(off) > 0.001) {
    newPayment.splitPercentages[newPayment.splitAmong[0]] = Math.round((newPayment.splitPercentages[newPayment.splitAmong[0]] + off) * 100) / 100
  }
}

function toggleAllSplit() {
  if (newPayment.splitAmong.length === trip.state.friends.length) {
    newPayment.splitAmong = []
    newPayment.splitPercentages = {}
  } else {
    newPayment.splitAmong = trip.state.friends.map(f => f.id)
    redistributeEqual()
  }
}

function toggleSplitFriend(id: string) {
  const idx = newPayment.splitAmong.indexOf(id)
  if (idx !== -1) {
    newPayment.splitAmong.splice(idx, 1)
    delete newPayment.splitPercentages[id]
  } else {
    newPayment.splitAmong.push(id)
  }
  if (newPayment.splitAmong.length > 0) redistributeEqual()
}

function addPayment() {
  if (!newPayment.paidById || !(newPayment.amount > 0) || newPayment.splitAmong.length === 0 || !splitValid.value) return
  if (editingPaymentId.value) {
    trip.updatePayment(editingPaymentId.value, {
      paidById: newPayment.paidById,
      amount: newPayment.amount,
      description: newPayment.description,
      splitAmong: [...newPayment.splitAmong],
      splitPercentages: { ...newPayment.splitPercentages },
    })
    editingPaymentId.value = null
  } else {
    trip.addPayment({
      paidById: newPayment.paidById,
      amount: newPayment.amount,
      description: newPayment.description,
      splitAmong: [...newPayment.splitAmong],
      splitPercentages: { ...newPayment.splitPercentages },
    })
  }
  Object.assign(newPayment, { paidById: '', amount: 0, description: '', splitAmong: [], splitPercentages: {} })
}

function editPayment(p: Payment) {
  editingPaymentId.value = p.id
  newPayment.paidById = p.paidById
  newPayment.amount = p.amount
  newPayment.description = p.description
  newPayment.splitAmong = [...p.splitAmong]
  newPayment.splitPercentages = { ...p.splitPercentages }
  nextTick(() => {
    formCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    formFlashing.value = true
    setTimeout(() => { formFlashing.value = false }, 1200)
  })
}

function cancelEdit() {
  editingPaymentId.value = null
  Object.assign(newPayment, { paidById: '', amount: 0, description: '', splitAmong: [], splitPercentages: {} })
}

async function removePayment(id: string) {
  const ok = await ui.showConfirm({ title: 'Delete this expense?', message: 'This cannot be undone.', okLabel: 'Delete' })
  if (ok) trip.removePayment(id)
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 anim-fade-up">

    <!-- Log a payment — primary action, 2 cols wide -->
    <div ref="formCardRef" :class="['lg:col-span-2 bg-surface rounded-2xl border shadow-sm overflow-hidden transition-all duration-300',
      formFlashing ? 'border-teal-400 ring-2 ring-teal-300 ring-offset-2 dark:ring-offset-slate-900' : 'border-slate-100 dark:border-hairline']">
      <div class="px-6 pt-5 pb-4 bg-gradient-to-r from-teal-50 via-cyan-50 to-teal-50 dark:from-inset dark:via-inset dark:to-inset border-b border-dashed border-teal-100 dark:border-hairline">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="eyebrow text-teal-700 dark:text-teal-400">{{ editingPaymentId ? '✏️ Editing expense' : '🧾 Log an Expense' }}</h2>
            <p v-if="editingPaymentId && newPayment.description" class="text-xs text-teal-600 dark:text-teal-400 font-medium mt-0.5 truncate max-w-xs">{{ newPayment.description }}</p>
          </div>
          <button v-if="editingPaymentId" @click="cancelEdit" class="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 font-medium">Cancel</button>
        </div>
      </div>
      <div class="px-6 pb-6">
        <div v-if="trip.state.friends.length < 2" class="py-10 text-center">
          <svg width="36" height="36" class="block mx-auto mb-2 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-split"/></svg>
          <p class="text-sm text-slate-400 font-medium">Add at least 2 members to split costs</p>
        </div>
        <div v-else class="space-y-5 pt-4">
          <!-- Amount -->
          <div>
            <label class="eyebrow block mb-2">Amount</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl font-light pointer-events-none">$</span>
              <input v-model.number="newPayment.amount" type="number" min="0" step="0.01" placeholder="0.00"
                class="w-full pl-10 pr-4 py-3 border-0 border-b-2 border-slate-200 dark:border-hairline bg-transparent text-3xl font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition-colors placeholder-slate-200" />
            </div>
          </div>
          <!-- Description -->
          <div>
            <label class="eyebrow block mb-2">What was it for?</label>
            <input v-model="newPayment.description" @keydown.enter="addPayment" type="text" placeholder="e.g. Dinner at Le Jules Verne" maxlength="120"
              class="w-full px-3.5 py-2.5 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <!-- Who paid + Split with — side by side on wide screens -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <!-- Who paid -->
            <div>
              <label class="eyebrow block mb-2.5">Who paid?</label>
              <div class="grid grid-cols-4 gap-2">
                <button v-for="f in trip.state.friends" :key="f.id" @click="newPayment.paidById = f.id"
                  :class="['flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border font-semibold transition-all',
                    newPayment.paidById === f.id
                      ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-inset border-slate-200 dark:border-hairline text-slate-600 dark:text-slate-400 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-lift hover:text-teal-700']">
                  <span :class="['w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                    newPayment.paidById === f.id ? 'bg-white/25 text-white' : 'text-white']"
                    :style="newPayment.paidById !== f.id ? `background:${avatarColor(f.id)}` : ''">
                    {{ friendInitial(f.name) }}
                  </span>
                  <span class="truncate w-full text-center text-[11px] leading-tight">{{ f.name }}</span>
                </button>
              </div>
            </div>
            <!-- Split with -->
            <div>
              <label class="eyebrow block mb-2.5">Split with</label>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="f in trip.state.friends" :key="f.id"
                  :class="['rounded-xl border transition-colors',
                    newPayment.splitAmong.includes(f.id) ? 'bg-indigo-50 dark:bg-inset border-indigo-200 dark:border-indigo-700' : 'border-slate-200 dark:border-hairline hover:border-slate-300 dark:hover:border-slate-600']">
                  <div class="flex items-center gap-1.5 px-2 py-2">
                    <!-- Avatar toggle button -->
                    <button @click="toggleSplitFriend(f.id)" :aria-label="f.name"
                      :class="['w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold transition-all',
                        newPayment.splitAmong.includes(f.id) ? 'ring-2 ring-indigo-400 ring-offset-1' : 'opacity-40']"
                      :style="`background:${avatarColor(f.id)};color:white`">
                      {{ friendInitial(f.name) }}
                    </button>
                    <!-- Name -->
                    <span @click="toggleSplitFriend(f.id)"
                      :class="['text-xs font-medium truncate flex-1 cursor-pointer select-none',
                        newPayment.splitAmong.includes(f.id) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400']">
                      {{ f.name }}
                    </span>
                    <!-- % input — only when selected -->
                    <template v-if="newPayment.splitAmong.includes(f.id)">
                      <div class="relative shrink-0">
                        <input type="number" min="0" max="100" step="1"
                          :aria-label="`${f.name} split percentage`"
                          :value="newPayment.splitPercentages[f.id] ?? 0"
                          @input="(e: Event) => newPayment.splitPercentages[f.id] = parseFloat((e.target as HTMLInputElement).value) || 0"
                          class="w-16 pr-4 pl-1.5 py-1 border border-indigo-200 dark:border-indigo-700 bg-surface rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold text-indigo-700 dark:text-indigo-300" />
                        <span class="absolute right-1 top-1/2 -translate-y-1/2 text-indigo-400 text-[10px] pointer-events-none font-medium">%</span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div v-if="newPayment.splitAmong.length > 0" class="mt-2.5 flex items-center justify-between px-1">
                <span class="text-xs font-medium" :class="splitValid ? 'text-slate-400' : 'text-rose-500'">
                  Total: {{ splitPercentageTotal }}%
                  <span v-if="!splitValid" class="ml-1">— must equal 100%</span>
                </span>
                <button @click="toggleAllSplit" class="text-xs text-teal-500 hover:text-teal-700 font-semibold">
                  {{ newPayment.splitAmong.length === trip.state.friends.length ? 'Deselect all' : newPayment.splitAmong.length === 0 ? 'Everyone, equally' : 'Select all' }}
                </button>
              </div>
            </div>
          </div>
          <!-- Submit -->
          <button @click="addPayment"
            :disabled="!newPayment.paidById || !(newPayment.amount > 0) || newPayment.splitAmong.length === 0 || !splitValid"
            class="w-full py-3 text-white text-sm font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-teal-600 hover:bg-teal-700 shadow-[0_4px_12px_rgba(20,184,166,.35)]">
            {{ editingPaymentId ? '✓ Update Expense' : '+ Log Expense' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Right rail: Crew + Settlements stacked -->
    <div class="flex flex-col gap-5">

    <!-- Who's on this trip -->
    <div class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6 space-y-5">
      <h2 class="eyebrow">Who's on this trip</h2>
      <div class="flex gap-2">
        <input v-model="newFriendName" @keydown.enter="addFriendLocal" type="text" aria-label="Add crew member" placeholder="Add a name…" maxlength="50"
          class="flex-1 min-w-0 px-3.5 py-2.5 border border-slate-200 dark:border-hairline rounded-xl text-sm bg-white dark:bg-inset text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <button @click="addFriendLocal" :disabled="!newFriendName.trim()"
          class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-colors disabled:opacity-40 bg-teal-600 hover:bg-teal-700">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div v-if="!trip.state.friends.length" class="py-6 text-center">
        <svg width="36" height="36" class="block mx-auto mb-2 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-crew"/></svg>
        <p class="text-sm text-slate-400 font-medium">Add your crew to get started</p>
      </div>
      <div v-else class="grid grid-cols-2 gap-2.5">
        <div v-for="f in trip.state.friends" :key="f.id"
          class="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-inset hover:bg-teal-50 dark:hover:bg-lift transition-colors">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm"
            :style="`background:${avatarColor(f.id)}`">
            {{ friendInitial(f.name) }}
          </div>
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate w-full text-center">{{ f.name }}</span>
          <button @click="trip.removeFriend(f.id)"
            :aria-label="`Remove ${f.name}`"
            class="absolute top-1 right-1 w-6 h-6 rounded-full bg-surface text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shadow-sm transition-all lg:opacity-0 lg:group-hover:opacity-100 flex items-center justify-center">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Who Owes What -->
    <div class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6 space-y-4">
      <h2 class="eyebrow">Who Owes What</h2>
      <div v-if="!trip.state.payments.length" class="py-10 text-center">
        <svg width="36" height="36" class="block mx-auto mb-2 text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-spending"/></svg>
        <p class="text-sm text-slate-400 font-medium">Log expenses to see who owes what</p>
      </div>
      <div v-else-if="!trip.settlements.length" class="py-8 text-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
        <svg width="48" height="48" class="block mx-auto mb-3 text-emerald-500 dark:text-emerald-400" aria-hidden="true"><use href="/icons.svg#i-empty-settled"/></svg>
        <p class="text-base font-bold text-emerald-700 dark:text-emerald-400">All settled up!</p>
        <p class="text-sm text-emerald-600 dark:text-emerald-500 mt-1">Everyone's square — time to enjoy the trip.</p>
        <button v-if="trip.state.settledPairs.length || trip.state.payments.some(p => p.settled)" @click="trip.unsettleAll()"
          class="mt-4 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors">
          Reopen balances
        </button>
      </div>
      <div v-else class="space-y-3">
        <div v-for="tx in trip.settlements" :key="`${tx.from}-${tx.to}`"
          :class="['rounded-2xl border p-4 transition-all',
            isSettled(tx.from, tx.to)
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 opacity-60'
              : 'bg-white dark:bg-inset border-slate-100 dark:border-hairline shadow-sm hover:border-rose-100']">
          <div class="flex items-center gap-2 min-w-0">
            <div :class="['w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
              isSettled(tx.from, tx.to) ? 'grayscale opacity-60' : '']"
              style="background:linear-gradient(135deg,#fca5a5,#f87171)">
              {{ friendInitial(friendName(tx.from)) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm leading-snug">
                <span :class="['font-semibold', isSettled(tx.from, tx.to) ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200']">{{ friendName(tx.from) }}</span>
                <span class="text-slate-400 font-normal"> owes </span>
                <span :class="['font-semibold', isSettled(tx.from, tx.to) ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200']">{{ friendName(tx.to) }}</span>
              </p>
              <p :class="['text-xl font-bold leading-tight mt-0.5', isSettled(tx.from, tx.to) ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100']">
                ${{ fmt(tx.amount) }}
              </p>
            </div>
            <div :class="['w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
              isSettled(tx.from, tx.to) ? 'grayscale opacity-60' : '']"
              style="background:linear-gradient(135deg,#2dd4bf,#34d399)">
              {{ friendInitial(friendName(tx.to)) }}
            </div>
          </div>
          <div class="mt-3 flex justify-end">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" :checked="isSettled(tx.from, tx.to)" @change="trip.toggleSettled(tx.from, tx.to)"
                class="w-4 h-4 rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 cursor-pointer" />
              <span :class="['text-xs font-semibold', isSettled(tx.from, tx.to) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400']">
                {{ isSettled(tx.from, tx.to) ? '✓ Paid' : 'Mark paid' }}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    </div><!-- end right rail -->

    <!-- Expense Feed -->
    <div v-if="trip.state.payments.length" class="lg:col-span-3 bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6">
      <div class="flex items-center justify-between mb-5">
        <h2 class="eyebrow">Expense Feed</h2>
        <span class="text-xs text-slate-400 font-medium bg-slate-50 dark:bg-inset px-3 py-1 rounded-full">
          {{ trip.state.payments.length }} expense{{ trip.state.payments.length !== 1 ? 's' : '' }} ·
          <span class="text-teal-600 dark:text-teal-400">${{ fmt(totalPayments) }}</span>
        </span>
      </div>
      <div class="divide-y divide-slate-50 dark:divide-hairline">
        <div v-for="payment in trip.state.payments" :key="payment.id"
          class="flex items-start justify-between py-4 group transition-opacity"
          :class="payment.settled ? 'opacity-45' : ''">
          <div class="flex items-start gap-3.5 flex-1 min-w-0">
            <div :class="['w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5 shadow-sm']"
              :style="payment.settled ? 'background:linear-gradient(135deg,#cbd5e1,#94a3b8)' : `background:${avatarColor(payment.paidById)}`">
              {{ friendInitial(friendName(payment.paidById)) }}
            </div>
            <div class="min-w-0 flex-1">
              <p :class="['text-sm font-semibold leading-snug truncate', payment.settled ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200']">
                {{ payment.description || 'Expense' }}
                <span v-if="payment.settled" class="ml-1 text-emerald-500 font-bold">✓</span>
              </p>
              <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">
                <span :class="['font-semibold', payment.settled ? 'text-slate-400' : 'text-teal-600 dark:text-teal-400']">{{ friendName(payment.paidById) }}</span>
                <span> paid · </span>
                <span>{{ payment.splitAmong.length === trip.state.friends.length ? 'split with everyone' : `split with ${payment.splitAmong.map(id => friendName(id)).join(', ')}` }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-4 pt-0.5">
            <span :class="['text-base font-bold tabular-nums', payment.settled ? 'text-slate-400' : 'text-slate-800 dark:text-slate-200']">
              ${{ fmt(payment.amount) }}
            </span>
            <label class="flex items-center gap-1 cursor-pointer select-none" :title="payment.settled ? 'Mark unsettled' : 'Mark settled'">
              <input type="checkbox" :checked="payment.settled"
                @change="trip.updatePayment(payment.id, { settled: !payment.settled })"
                class="w-3.5 h-3.5 rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 cursor-pointer" />
              <span :class="['text-xs font-semibold', payment.settled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400']">
                {{ payment.settled ? 'Settled' : 'Settle' }}
              </span>
            </label>
            <button @click="editPayment(payment)" aria-label="Edit expense" class="lg:opacity-0 lg:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button @click="removePayment(payment.id)" aria-label="Delete expense" class="lg:opacity-0 lg:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
