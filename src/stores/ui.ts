import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const darkMode = ref(false)

  function initDarkMode() {
    darkMode.value = !!localStorage.getItem('travelapp_dark')
    document.documentElement.classList.toggle('dark', darkMode.value)
  }

  function toggleDark() {
    darkMode.value = !darkMode.value
    document.documentElement.classList.toggle('dark', darkMode.value)
    localStorage.setItem('travelapp_dark', darkMode.value ? '1' : '')
  }

  return { darkMode, initDarkMode, toggleDark }
})
