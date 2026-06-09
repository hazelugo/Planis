<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUIStore()

const email = ref('')
const submitting = ref(false)
const sent = ref(false)
const error = ref<string | null>(null)

const backUrl = computed(() => {
  const url = new URL(window.location.origin + '/')
  const params = new URLSearchParams(window.location.search)
  const trip = params.get('trip')
  const edit = params.get('edit')
  if (trip) url.searchParams.set('trip', trip)
  if (edit) url.searchParams.set('edit', edit)
  return url.pathname + url.search
})

async function submit() {
  error.value = null
  const trimmed = email.value.trim()
  if (!trimmed || !trimmed.includes('@')) {
    error.value = 'Enter a valid email address.'
    return
  }
  submitting.value = true
  const { error: authError } = await auth.signInWithMagicLink(trimmed)
  submitting.value = false
  if (authError) {
    error.value = authError.message
    return
  }
  sent.value = true
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f1117]">
    <header class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-hairline bg-surface">
      <RouterLink :to="backUrl" class="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        Back to trip
      </RouterLink>
      <button type="button" @click="ui.toggleDark()" :aria-label="ui.darkMode ? 'Light mode' : 'Dark mode'"
        class="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-inset transition-colors">
        <svg v-if="ui.darkMode" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </header>

    <main class="flex-1 flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <img :src="ui.darkMode ? '/logo-dark.svg' : '/logo.svg'" alt="Planis" width="140" height="52" class="h-13 w-auto mx-auto mb-4" />
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Sign in to Planis</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
            We'll email you a magic link — no password needed. Your trip links still work without an account.
          </p>
        </div>

        <div v-if="sent" class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline p-8 text-center shadow-sm">
          <div class="text-4xl mb-4" aria-hidden="true">✉️</div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Check your inbox</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
            We sent a sign-in link to <strong class="text-slate-700 dark:text-slate-300">{{ email }}</strong>.
            Click it on this device to continue.
          </p>
          <button type="button" @click="sent = false" class="mt-6 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline">
            Use a different email
          </button>
        </div>

        <form v-else @submit.prevent="submit" class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline p-8 shadow-sm space-y-5">
          <div>
            <label for="auth-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
              class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-hairline bg-white dark:bg-inset text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-shadow"
            />
          </div>

          <p v-if="error" class="text-sm text-rose-600 dark:text-rose-400" role="alert">{{ error }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            {{ submitting ? 'Sending…' : 'Send magic link' }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>
