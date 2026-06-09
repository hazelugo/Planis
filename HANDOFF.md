# Handoff Notes — Planis

## Current state (2026-06)

**Production:** Vue 3 + Vite + TypeScript app at [planis.hazelugo.com](https://planis.hazelugo.com). Built with `npm run build`, output in `dist/`.

**Legacy:** `index-cdn-app.html` is a backup of the original single-file CDN app — not served in production.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Pexels keys
npm run dev                    # http://localhost:5173
npm run build                  # type-check + production build
vercel --prod                  # deploy
```

---

## File layout

| Path | Purpose |
|------|---------|
| `index.html` | Vite entry — production HTML shell |
| `src/` | Vue SFCs, Pinia stores, composables |
| `index-cdn-app.html` | Archived CDN app (reference only) |
| `public/` | Static assets, `robots.txt`, `sitemap.xml` |
| `vercel.json` | SPA rewrites + photo proxy |

---

## Key architecture

- **State:** `src/stores/trips.ts` — trip JSON blob, Supabase sync, realtime, edit tokens
- **Realtime:** Subscription stays active in background tabs (do not unsubscribe on `pagehide`). If sync still fails, confirm `trips` is in Supabase → Database → Publications → `supabase_realtime`.
- **Edit access:** New trips get `?edit=<token>`. Legacy trips without a token remain open-edit until "Get private editor link" is clicked.
- **Tabs:** Overview, Itinerary, Spending, Splitter (Photos shelved)
- **Dates:** `src/utils/dates.ts` — always parse `YYYY-MM-DD` as local midnight

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_PEXELS_API_KEY` | Banner photos (optional — upload still works) |

---

## Authentication (Phase 4)

- **Magic link:** `/auth` — `signInWithOtp`; no password.
- **Anonymous trips:** `/?trip=UUID` works without signing in (no auth guard on `/`).
- **Session:** `useAuthStore` + `onAuthStateChange` in `main.ts` before mount.
- **Owner:** When signed in, `saveTrip` sets `owner_id` on the trips row.

**Supabase dashboard (required once):** Authentication → URL Configuration → add redirect URLs:
- `http://localhost:5173/`
- `https://planis.hazelugo.com/`

---

## Deploy

Vercel runs `npm run build` and serves `dist/`. SPA rewrite sends all routes except `sitemap.xml` and `robots.txt` to `index.html`.
