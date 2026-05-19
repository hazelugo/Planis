<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useTripStore } from '@/stores/trips'
import { useUIStore } from '@/stores/ui'
import { supabase } from '@/lib/supabase'
import type { Photo } from '@/types/domain'

const trip = useTripStore()
const ui = useUIStore()

const photoUploading = ref(false)
const photoError = ref('')
const photoJustUploaded = ref(false)
const lightboxPhoto = ref<Photo | null>(null)
const lightboxEl = ref<HTMLElement | null>(null)
const lightboxCloseBtn = ref<HTMLElement | null>(null)
const photoCopied = ref(false)
const canShare = typeof navigator !== 'undefined' && !!navigator.share

const lightboxIndex = computed(() =>
  lightboxPhoto.value ? trip.state.photos.findIndex(p => p.id === lightboxPhoto.value!.id) : -1
)

function genId() { return crypto.randomUUID().slice(0, 8) }

async function uploadPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(event.target as HTMLInputElement).value = ''
  if (file.size > 10 * 1024 * 1024) {
    photoError.value = 'File too large — maximum 10 MB per photo.'
    return
  }
  photoUploading.value = true
  photoError.value = ''
  try {
    const ext = file.name.split('.').pop()
    const path = `${trip.tripId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('trip-photos').upload(path, file, { cacheControl: '3600' })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(data.path)
    trip.state.photos.push({ id: genId(), url: urlData.publicUrl, path: data.path, caption: '', uploadedAt: new Date().toISOString() })
    photoJustUploaded.value = true
    setTimeout(() => { photoJustUploaded.value = false }, 2000)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    photoError.value = msg.includes('not found') || msg.includes('Bucket')
      ? 'Create a public bucket called "trip-photos" in Supabase Storage first.'
      : msg.includes('row-level security') || msg.includes('policy')
      ? 'Storage permissions not set — add INSERT/SELECT/DELETE policies for the trip-photos bucket.'
      : msg || 'Upload failed — check Supabase Storage permissions.'
  }
  photoUploading.value = false
}

async function removePhoto(photo: Photo) {
  const ok = await ui.showConfirm({ title: 'Delete this photo?', message: 'This cannot be undone.', okLabel: 'Delete' })
  if (!ok) return
  try { await supabase.storage.from('trip-photos').remove([photo.path]) } catch {}
  const idx = trip.state.photos.findIndex(p => p.id === photo.id)
  if (idx !== -1) trip.state.photos.splice(idx, 1)
  if (lightboxPhoto.value?.id === photo.id) closeLightbox()
}

function openLightbox(photo: Photo) {
  lightboxPhoto.value = photo
  nextTick(() => lightboxCloseBtn.value?.focus())
}
function closeLightbox() { lightboxPhoto.value = null }
function lightboxPrev() { const i = lightboxIndex.value; if (i > 0) lightboxPhoto.value = trip.state.photos[i - 1] }
function lightboxNext() { const i = lightboxIndex.value; if (i < trip.state.photos.length - 1) lightboxPhoto.value = trip.state.photos[i + 1] }

function photoProxyUrl(photo: Photo) { return `${window.location.origin}/photos/${photo.path}` }

async function copyPhotoUrl(photo: Photo) {
  try {
    await navigator.clipboard.writeText(photoProxyUrl(photo))
    photoCopied.value = true
    setTimeout(() => { photoCopied.value = false }, 2000)
  } catch {}
}
async function sharePhoto(photo: Photo) {
  try { await navigator.share({ title: photo.caption || 'Trip photo', url: photoProxyUrl(photo) }) } catch {}
}
</script>

<template>
  <div class="space-y-5 anim-fade-up">

    <!-- Upload card -->
    <div class="bg-surface rounded-2xl border border-slate-100 dark:border-hairline shadow-sm p-6">
      <h2 class="eyebrow mb-4">Add Photos</h2>
      <label class="block cursor-pointer">
        <div :class="['border-2 border-dashed rounded-2xl text-center transition-colors',
          photoUploading ? 'p-8 border-teal-200 bg-teal-50 dark:border-teal-800/40 dark:bg-teal-900/10' : !trip.state.photos.length ? 'py-12 px-8 border-slate-200 dark:border-hairline hover:border-teal-300 hover:bg-slate-50 dark:hover:bg-inset' : 'p-8 border-slate-200 dark:border-hairline hover:border-teal-300 hover:bg-slate-50 dark:hover:bg-inset']">
          <div v-if="photoUploading" class="flex flex-col items-center gap-2">
            <svg class="animate-spin text-teal-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <p class="text-sm text-teal-400 font-medium">Uploading…</p>
          </div>
          <div v-else-if="!trip.state.photos.length" class="flex flex-col items-center gap-3">
            <svg width="48" height="48" class="block mx-auto text-teal-500 dark:text-teal-400" aria-hidden="true"><use href="/icons.svg#i-empty-photos"/></svg>
            <div>
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Your wall is waiting</p>
              <p class="text-xs text-slate-400 mt-1">Drop the first photo from the trip — this wall is yours to fill.</p>
            </div>
            <span class="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-hairline text-xs font-medium text-slate-500 dark:text-slate-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Any image format
            </span>
          </div>
          <div v-else class="flex flex-col items-center gap-2">
            <svg class="text-slate-300" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Click to upload a photo</p>
            <p class="text-xs text-slate-300 dark:text-slate-600">Any image format</p>
          </div>
        </div>
        <input type="file" accept="image/*" class="hidden" @change="uploadPhoto" :disabled="photoUploading" />
      </label>
      <p v-if="photoError" class="text-xs text-rose-500 mt-3">{{ photoError }}</p>
      <Transition name="fade">
        <div v-if="photoJustUploaded" class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-sm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          Photo added!
        </div>
      </Transition>
    </div>

    <!-- Photo grid -->
    <TransitionGroup v-if="trip.state.photos.length" name="fade" tag="div" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="photo in trip.state.photos" :key="photo.id"
        role="button" tabindex="0"
        :aria-label="photo.caption || 'Trip photo — click to view'"
        @click="openLightbox(photo)"
        @keydown.enter.prevent="openLightbox(photo)"
        @keydown.space.prevent="openLightbox(photo)"
        class="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-inset shadow-sm cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2" style="aspect-ratio:1">
        <img :src="photo.url" loading="lazy" decoding="async"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" :alt="photo.caption || 'Trip photo'" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
          <input v-model="photo.caption" type="text" placeholder="Add caption…" @click.stop maxlength="200"
            class="text-xs text-white bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-2.5 py-1.5 placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-white/50 w-full" />
        </div>
        <button @click.stop="removePhoto(photo)"
          class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </TransitionGroup>

    <!-- Lightbox -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="lightboxPhoto" ref="lightboxEl" tabindex="-1"
          class="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center"
          @keydown.escape="closeLightbox" @keydown.arrow-left="lightboxPrev" @keydown.arrow-right="lightboxNext"
          @click.self="closeLightbox">
          <!-- Close -->
          <button ref="lightboxCloseBtn" @click="closeLightbox" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <!-- Prev -->
          <button v-if="lightboxIndex > 0" @click="lightboxPrev"
            class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <!-- Image -->
          <div class="max-w-4xl max-h-[80vh] mx-16 flex flex-col items-center gap-3">
            <img :src="lightboxPhoto.url" class="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl" :alt="lightboxPhoto.caption || 'Trip photo'" />
            <p v-if="lightboxPhoto.caption" class="text-white/80 text-sm text-center max-w-md">{{ lightboxPhoto.caption }}</p>
            <div class="flex items-center gap-3">
              <button v-if="canShare" @click="sharePhoto(lightboxPhoto)" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>
              <button @click="copyPhotoUrl(lightboxPhoto)" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {{ photoCopied ? 'Copied!' : 'Copy link' }}
              </button>
            </div>
          </div>
          <!-- Next -->
          <button v-if="lightboxIndex < trip.state.photos.length - 1" @click="lightboxNext"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
