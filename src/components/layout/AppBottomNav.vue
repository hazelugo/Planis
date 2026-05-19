<script setup lang="ts">
const props = defineProps<{ currentTab: string }>()
const emit = defineEmits<{ (e: 'tab', id: string): void }>()

const tabs = [
  { id: 'overview',   label: 'Overview',  icon: 'i-overview'  },
  { id: 'itinerary',  label: 'Itinerary', icon: 'i-itinerary' },
  { id: 'analytics',  label: 'Spending',  icon: 'i-spending'  },
  { id: 'splitter',   label: 'Splitter',  icon: 'i-splitter'  },
  { id: 'photos',     label: 'Photos',    icon: 'i-photos'    },
]
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-slate-100 dark:border-hairline flex z-40 pb-[env(safe-area-inset-bottom)]">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="emit('tab', tab.id)"
      :class="[
        'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
        currentTab === tab.id
          ? 'text-teal-600 dark:text-[#2dd4bf]'
          : 'text-slate-400 dark:text-slate-500'
      ]"
    >
      <svg width="20" height="20" aria-hidden="true"><use :href="`/icons.svg#${tab.icon}`"/></svg>
      {{ tab.label }}
    </button>
  </nav>
</template>
