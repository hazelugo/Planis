<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useUIStore } from '@/stores/ui'

const uiStore = useUIStore()

onMounted(() => {
  uiStore.initDarkMode()
})
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
    <RouterView />
  </div>
</template>
