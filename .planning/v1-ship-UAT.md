---
status: complete
milestone: v1-ship
verified: 2026-06-09
environment: https://planis.hazelugo.com
---

# v1 Ship — UAT Results

Automated + code verification after production deploy. Interactive realtime tests marked **spot-check** (architecture verified in code).

## Summary

| Result | Count |
|--------|-------|
| PASS | 9 |
| SPOT-CHECK | 1 |
| FAIL | 0 |

## Tests

### 1. Production build health
**Expected:** `npm run type-check` and `npm run build` succeed.  
**Result:** PASS — verified 2026-06-09.

### 2. SEO static files
**Expected:** `/sitemap.xml` and `/robots.txt` return 200 with correct content types (not SPA `index.html`).  
**Result:** PASS — sitemap `application/xml` 244 bytes; robots `text/plain` with sitemap URL.

### 3. Safe load on Supabase failure
**Expected:** Network/DB error sets `loadStatus: 'error'`, shows retry UI, does **not** start save watcher or overwrite data.  
**Result:** PASS — `initialize()` returns early on `error`; `startSyncWatchers` only called on success or new trip.

### 4. Edit-token access control
**Expected:** Trips with `editToken` are view-only without `?edit=`; new trips mint token; legacy trips open-edit until protected.  
**Result:** PASS — `canEdit` / `isReadOnly` / `needsProtection` + `protectTrip()` + read-only banner in `TripView.vue`.

### 5. Local-date timezone math
**Expected:** Countdown and duration use local midnight, not UTC shift.  
**Result:** PASS — `src/utils/dates.ts` `parseLocalDate` used in store and tabs.

### 6. Sync pill accuracy
**Expected:** Shows "Not saved yet" until first successful save; "Saved" after sync.  
**Result:** PASS — `hasSynced` ref + `AppHeader` computed labels.

### 7. Dark mode FOUC
**Expected:** Hard refresh in dark mode does not flash light theme before Vue mounts.  
**Result:** PASS — blocking inline script in `index.html` + `ui.initDarkMode()` on mount.

### 8. Realtime subscription singleton
**Expected:** At most one channel per trip; tab navigation does not stack subscriptions.  
**Result:** PASS — `if (channel) return` guard in `subscribeToRealTime()`; `unsubscribeFromRealTime()` on `pagehide`.

### 9. Two-tab realtime sync
**Expected:** Edit in tab A → tab B updates within ~1s without refresh.  
**Result:** SPOT-CHECK — Supabase `postgres_changes` listener wired correctly; confirm manually with two browser tabs on a live trip.

### 10. `removeFriend` settledPairs cleanup
**Expected:** Removing a crew member clears their settlement keys.  
**Result:** PASS — `settledPairs.filter` in `removeFriend()`.

## Gaps / deferred

- Photos tab — intentionally shelved
- Server-side edit enforcement (RLS) — Phase 4 auth follow-up
- Full Lighthouse re-run post-deploy — recommended after next push
