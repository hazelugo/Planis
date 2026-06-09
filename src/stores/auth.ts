import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  let initialized = false

  /** Call once from main.ts before app.mount(). */
  function initialize(): Promise<void> {
    if (initialized) return Promise.resolve()
    initialized = true

    return new Promise((resolve) => {
      supabase.auth.getSession().then(({ data }) => {
        session.value = data.session
        user.value = data.session?.user ?? null
        loading.value = false
        resolve()
      })

      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
        loading.value = false
      })
    })
  }

  function buildRedirectUrl(): string {
    const url = new URL(window.location.origin + '/')
    const params = new URLSearchParams(window.location.search)
    const trip = params.get('trip')
    const edit = params.get('edit')
    if (trip) url.searchParams.set('trip', trip)
    if (edit) url.searchParams.set('edit', edit)
    return url.toString()
  }

  async function signInWithMagicLink(email: string) {
    return supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildRedirectUrl() },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return {
    user,
    session,
    loading,
    isAuthenticated,
    initialize,
    signInWithMagicLink,
    signOut,
  }
})
