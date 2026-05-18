import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Validate env vars at module load time — fail loudly instead of silently returning undefined
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '[TravelApp] VITE_SUPABASE_URL is not set. ' +
    'Create .env.local with VITE_SUPABASE_URL=https://your-project.supabase.co'
  )
}
if (!supabaseAnonKey) {
  throw new Error(
    '[TravelApp] VITE_SUPABASE_ANON_KEY is not set. ' +
    'Create .env.local with VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}

// Module-level singleton — created ONCE, exported, never re-created.
// Every other file imports `supabase` from here; no file ever calls createClient directly.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
