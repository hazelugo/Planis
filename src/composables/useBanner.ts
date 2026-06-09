import { ref, watch } from 'vue'
import { useTripStore } from '@/stores/trips'
import { supabase } from '@/lib/supabase'

const PEXELS_KEY = import.meta.env.VITE_PEXELS_API_KEY

interface PexelsPhoto {
  src: { large2x: string; large: string }
  photographer: string
  photographer_url: string
}

export function useBanner() {
  const trip = useTripStore()
  const loading = ref(false)
  const pexelsConfigured = !!PEXELS_KEY
  const pageOffset = ref(0)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  watch(
    () => trip.state.trip.destination,
    (dest, prev) => {
      if (dest !== prev) pageOffset.value = 0
      clearTimeout(debounceTimer)
      // Skip auto-fetch if a banner is already set (preserves user choice)
      if (!dest || trip.state.trip.bannerUrl || !trip.canEdit) return
      debounceTimer = setTimeout(() => _fetch(dest, 0), 800)
    }
  )

  async function _fetch(destination: string, page: number): Promise<number> {
    if (!destination || !PEXELS_KEY || !trip.canEdit) return 0
    loading.value = true
    try {
      const searchTerm = destination.split(',')[0].trim()
      const q = encodeURIComponent(`${searchTerm} travel landscape`)
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${q}&per_page=5&orientation=landscape&page=${page + 1}`,
        { headers: { Authorization: PEXELS_KEY } }
      )
      if (!res.ok) return 0
      const data = await res.json() as { photos: PexelsPhoto[]; total_results: number }
      const photo = data.photos?.[0]
      if (!photo?.src?.large2x && !photo?.src?.large) return 0
      trip.state.trip.bannerUrl = photo.src.large2x || photo.src.large
      trip.state.trip.bannerPhotographer = photo.photographer
      trip.state.trip.bannerPhotographerUrl = photo.photographer_url
      trip.state.trip.bannerPosition = '50% 50%'
      return data.total_results ?? 0
    } catch (e) {
      console.error('Failed to fetch Pexels photo:', e)
      return 0
    } finally {
      loading.value = false
    }
  }

  // Explicitly bypass the skip condition and load the next Pexels result
  async function tryAnother() {
    if (!trip.canEdit) return
    const dest = trip.state.trip.destination
    if (!dest) return
    pageOffset.value += 1
    const total = await _fetch(dest, pageOffset.value)
    // If we've gone past available results, wrap back to page 0
    if (total > 0 && (pageOffset.value + 1) * 5 >= total) {
      pageOffset.value = 0
    }
  }

  function setPosition(x: number, y: number) {
    if (!trip.canEdit) return
    trip.state.trip.bannerPosition = `${Math.round(x)}% ${Math.round(y)}%`
  }

  async function uploadBanner(file: File) {
    if (!trip.canEdit) return
    if (file.size > 10 * 1024 * 1024) return
    loading.value = true
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `banners/${trip.tripId}/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('trip-photos')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(data.path)
      trip.state.trip.bannerUrl = urlData.publicUrl
      trip.state.trip.bannerPosition = '50% 50%'
      // No Pexels attribution for custom uploads
      trip.state.trip.bannerPhotographer = undefined
      trip.state.trip.bannerPhotographerUrl = undefined
    } catch (e) {
      console.error('Banner upload failed', e)
    }
    loading.value = false
  }

  return { loading, pexelsConfigured, tryAnother, setPosition, uploadBanner }
}
