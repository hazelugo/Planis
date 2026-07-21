import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { buildAppUrl } from '@/lib/appUrl'
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  let initialized = false

  /** Call once from main.ts before app.mount(). */
  async function initialize(): Promise<void> {
    if (initialized) return
    initialized = true

    // Magic link (PKCE) returns ?code=… — exchange before reading the session.
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      params.delete('code')
      const rest = params.toString()
      const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`
      window.history.replaceState({}, '', cleanUrl)
      if (error) console.error('[Planis] Magic link sign-in failed:', error.message)
    }

    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      loading.value = false
    })
  }

  function buildRedirectUrl(): string {
    const params = new URLSearchParams(window.location.search)
    return buildAppUrl('/', {
      trip: params.get('trip'),
      edit: params.get('edit'),
    })
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
