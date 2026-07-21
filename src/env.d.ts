/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Canonical site URL for auth redirects, e.g. https://planis.hazelugo.com */
  readonly VITE_APP_URL?: string
  readonly VITE_PEXELS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
