<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
const uiStore = useUIStore()
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
    <h1 class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
      TravelApp scaffold works
    </h1>
    <p class="text-gray-500 dark:text-gray-400">Phase 1 scaffold — Vite + Vue 3 + TypeScript</p>
    <button
      class="px-4 py-2 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      @click="uiStore.toggleDark()"
    >
      Toggle dark mode (currently: {{ uiStore.darkMode ? 'dark' : 'light' }})
    </button>
  </div>
</template>
