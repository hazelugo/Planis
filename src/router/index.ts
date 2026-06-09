import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import TripView from '@/views/TripView.vue'
import AuthView from '@/views/AuthView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: TripView,
    },
    {
      path: '/auth',
      component: AuthView,
      meta: { guestOnly: true },
    },
    {
      path: '/:pathMatch(.*)*',
      component: TripView,
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => auth.loading,
        (v) => {
          if (!v) {
            stop()
            resolve()
          }
        }
      )
    })
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    const url = new URL(window.location.origin + '/')
    const trip = to.query.trip
    const edit = to.query.edit
    if (typeof trip === 'string') url.searchParams.set('trip', trip)
    if (typeof edit === 'string') url.searchParams.set('edit', edit)
    return url.pathname + url.search
  }

  return true
})

export default router
