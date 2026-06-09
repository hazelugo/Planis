<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { storeToRefs } from 'pinia'

const ui = useUIStore()
const { confirm } = storeToRefs(ui)
const { confirmOk, confirmCancel } = ui
</script>

<template>
  <RouterView />

  <!-- Confirm dialog -->
  <Teleport to="body">
    <div v-if="confirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div class="bg-surface rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 border border-slate-100 dark:border-hairline">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{{ confirm.title }}</h2>
        <p v-if="confirm.message" class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ confirm.message }}</p>
        <div class="flex gap-3 justify-end">
          <button @click="confirmCancel" class="px-4 py-2 text-sm rounded-xl bg-slate-100 dark:bg-lift text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2a3347] transition-colors">Cancel</button>
          <button @click="confirmOk" :class="['px-4 py-2 text-sm rounded-xl text-white font-medium transition-colors', confirm.okClass ?? 'bg-rose-500 hover:bg-rose-600']">{{ confirm.okLabel ?? 'Delete' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
