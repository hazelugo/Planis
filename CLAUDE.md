# TravelApp — Claude Code Context

## Project
Single-file Vue 3 + Tailwind + Supabase travel planning app. All code lives in `index.html`. Deploy via `vercel --prod`.

## Design Context

### Users
Any group planning a trip together — friend crews, families, couples, mixed groups of any size. They're excited, maybe a little overwhelmed, sharing the app link with people of varying tech comfort. The job: turn trip chaos into a shared, organized plan without killing the vibe.

### Brand Personality
**Fun · Vibrant · Social** — feels like the trip is already starting. Warm, optimistic, never corporate or bureaucratic.

### Aesthetic Direction
- **Reference: Notion** — structural clarity, generous whitespace, content-first. No chrome for chrome's sake.
- **Layered: playful expressiveness** — gradients, emoji, vibrant category colors, personality in micro-copy.
- **Anti-reference**: spreadsheets, enterprise travel tools, gray-on-gray, dense tables.
- Inter font. Indigo/violet primary. Category colors: blue=Transport, emerald=Lodging, amber=Food, violet=Activity.
- rounded-2xl standard. Light + dark mode both supported.

### Design Principles
1. **Excitement over anxiety** — UI choices should reduce friction and amplify excitement. Countdowns and totals feel celebratory.
2. **Clarity for everyone** — Plain English labels, helpful empty states, zero onboarding required.
3. **Social-first** — People (who paid, who's coming) are the subject. Put names/initials near data.
4. **Delight in the details** — Micro-animations, smooth transitions, emoji, gradient cards. Never skip the transition.
5. **Content hierarchy via weight, not noise** — Whitespace is structure. Use font weight/size for hierarchy over borders and fills.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**TravelApp — Vue + Vite Migration**

TravelApp is a group travel planning tool that lets friend crews, families, and mixed groups organize a trip together — itinerary, costs, splitting, and photos — from a single shared link. It currently runs as a single `index.html` (Vue 3 CDN + Tailwind CDN + Supabase) and is being migrated to a proper Vue 3 + Vite + TypeScript project to enable scaling, real user accounts, and a PWA experience.

**Core Value:** A group can plan, cost, and settle a trip together in one place — no spreadsheets, no chasing people over chat.

### Constraints

- **Compatibility**: Existing Supabase schema must not break — migration cannot require a DB migration as a prerequisite
- **Design**: All existing UI/UX must be preserved exactly — this is a structural migration, not a redesign
- **Stack**: Vue 3 Composition API + `<script setup>` + TypeScript + Vite + Tailwind CSS + Supabase JS v2
- **Deploy**: Vercel — no server-side rendering required (SPA is fine)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vue 3 | ^3.5.x | UI framework | Already in use; 3.5 is stable production release; 3.6 is beta (avoid) |
| Vite | ^6.x | Build tool + dev server | v6 is the current LTS-equivalent; v8 just released but v6 is battle-tested; use 6 for this migration |
| @vitejs/plugin-vue | ^5.x | SFC compilation | Official Vue Vite plugin; required for .vue file handling |
| TypeScript | ^5.x | Type safety | Supabase gen types output is TS; Vue 3 written in TS; required for full toolchain |
| vue-tsc | ^2.x | TS type checking | Wraps tsc with SFC awareness; used in `build` script for CI type gating |
### CSS
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | **v4.x** (^4.3) | Utility CSS | See detailed section below |
| @tailwindcss/vite | ^4.x | Vite integration | Native Vite plugin; replaces PostCSS config entirely in v4 |
- Tailwind v4.3 is current stable (May 2026)
- The `@tailwindcss/vite` plugin replaces `postcss.config.js` entirely — simpler setup
- The existing CDN app used Tailwind but has no `tailwind.config.js` — nothing to port
- The automated upgrade tool (`npx @tailwindcss/upgrade`) handles class renames, but since you are writing components from scratch during migration, this is not needed
| v3 class | v4 class | Impact |
|----------|----------|--------|
| `bg-gradient-to-r` | `bg-linear-to-r` | Any gradient cards in existing UI |
| `shadow-sm` | `shadow-xs` | Widespread — check all cards |
| `shadow` (default) | `shadow-sm` | Widespread |
| `rounded-sm` | `rounded-xs` | Per CLAUDE.md: `rounded-2xl` is standard — only affects variants |
| `outline-none` | `outline-hidden` | Form inputs |
| `flex-shrink-0` | `shrink-0` | Layout utilities |
| `overflow-ellipsis` | `text-ellipsis` | Text truncation |
| `!important` prefix | suffix | `!flex` → `flex!` |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Pinia | ^3.x | Global state | Official Vue recommendation; replaces Vuex; full TS inference out of box |
### Routing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vue Router | ^4.x | SPA routing | Official Vue 3 router; required for Auth guards and multi-view structure |
### Supabase
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @supabase/supabase-js | ^2.x | DB, Auth, Realtime | Already in use; v2 is current stable; do not upgrade to v3 during migration |
| supabase CLI | latest | Type generation | `npx supabase gen types` generates `database.types.ts` from live schema |
# One-time / on schema change
### PWA
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vite-plugin-pwa | ^1.x | Service worker, manifest | Zero-config PWA for Vite; official Vite-ecosystem plugin; supports Workbox |
### TypeScript Configuration
- `tsconfig.json` — references app and node configs
- `tsconfig.app.json` — source files with DOM lib
- `tsconfig.node.json` — vite.config.ts with Node types
### Deployment
| Technology | Config | Purpose |
|------------|--------|---------|
| Vercel | `vercel.json` | SPA routing + static deploy |
## Full Dependency List
### Production
### Dev
## Recommended Folder Structure
- `views/` are route-level only — no logic, just layout assembly
- `composables/` hold all business logic — mirrors current `reactive()` patterns
- `lib/supabase.ts` is the single import point for the typed Supabase client
- `database.types.ts` is generated, not hand-edited — checked into git
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State | Pinia | Vuex | Vuex is in maintenance mode; no first-class TS inference; officially superseded |
| CSS | Tailwind v4 | Tailwind v3 | v3 enters maintenance-only; v4 is simpler to configure with Vite; new project has no v3 lock-in |
| CSS | Tailwind v4 | UnoCSS | Tailwind v4 is already fast enough (Rust engine); UnoCSS adds complexity; brand uses Tailwind class names |
| Build | Vite 6 | Vite 8 | Vite 8 is too new for a migration; use 6, upgrade separately |
| Router | Vue Router v4 | TanStack Router | Vue Router is the standard; TanStack is React-first |
| PWA | vite-plugin-pwa | Manual service worker | vite-plugin-pwa handles Workbox integration, manifest injection, update lifecycle |
| Auth | Supabase Auth | Auth0 / Clerk | Supabase Auth is already in the stack; no additional vendor; free tier covers this app |
## Confidence Assessment
| Area | Confidence | Source |
|------|------------|--------|
| Vite version recommendation (v6) | HIGH | vite.dev releases page |
| Tailwind v4 + @tailwindcss/vite | HIGH | Official tailwindcss.com upgrade guide |
| Tailwind v4 breaking class renames | HIGH | Official tailwindcss.com upgrade guide |
| vue-tsc + @vue/tsconfig pattern | HIGH | Official vuejs.org/guide/typescript |
| Pinia over Vuex | HIGH | Vue.js official docs + Pinia.vuejs.org |
| supabase gen types CLI command | HIGH | supabase.com/docs |
| vite-plugin-pwa | HIGH | vite-pwa-org.netlify.app official docs |
| Vue Router v4 createWebHistory | HIGH | router.vuejs.org official docs |
| Vercel SPA rewrite config | HIGH | vercel.com/docs |
| Pinia 3 (Vue 3 only) | MEDIUM | Multiple sources; verify pinia.vuejs.org for v3 compat note |
## Sources
- [Vite Releases](https://vite.dev/releases)
- [Tailwind CSS v4 Official Blog Post](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Vue 3 TypeScript Overview (Official)](https://vuejs.org/guide/typescript/overview)
- [vuejs/tsconfig on GitHub](https://github.com/vuejs/tsconfig)
- [Supabase Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [Supabase CLI gen types reference](https://supabase.com/docs/reference/cli/supabase-gen-types)
- [Pinia official site](https://pinia.vuejs.org/)
- [Vue Router History Modes (Official)](https://router.vuejs.org/guide/essentials/history-mode.html)
- [vite-plugin-pwa official docs](https://vite-pwa-org.netlify.app/)
- [Vercel Vite framework docs](https://vercel.com/docs/frameworks/vite)
- [Vercel Vue.js deployment guide](https://vercel.com/kb/guide/deploying-vuejs-to-vercel)
- [Integrating Tailwind CSS v4 with Vue (Felix Astner)](https://felixastner.com/articles/integrating-tailwind-css-v4-with-vue-and-nuxt-and-differences-from-v3)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
