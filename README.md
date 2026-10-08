# Word Forge

Browser-first English word-building idle game (solo MVP, ages 13+). Local save by default; optional Supabase magic-link sync. PWA install for offline play.

**Production URL:** [https://wordforge.ashwinagilan.com](https://wordforge.ashwinagilan.com)

## Run

```bash
npm install
cp .env.example .env.local   # optional — fill keys for cloud sync
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # uses webpack so Serwist can emit /sw.js
npm start
```

## Deploy (Vercel + Porkbun)

### 1. Supabase

Project: `nzklvxivpurprtysvqzw` → `https://nzklvxivpurprtysvqzw.supabase.co`

1. SQL Editor — run in order if not already applied:
   - [`supabase/migrations/001_profiles_game_saves.sql`](supabase/migrations/001_profiles_game_saves.sql)
   - [`supabase/migrations/002_game_saves_per_mode.sql`](supabase/migrations/002_game_saves_per_mode.sql)
   - [`supabase/migrations/003_game_saves_all_modes.sql`](supabase/migrations/003_game_saves_all_modes.sql)  
     (required if an older `002` only allowed four modes)
2. Auth → enable **Email** magic link.
3. Auth → URL configuration:
   - **Site URL:** `https://wordforge.ashwinagilan.com`
   - **Redirect URLs:**
     - `https://wordforge.ashwinagilan.com/auth/callback`
     - `https://*.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

### 2. Vercel

1. Push this repo to GitHub (or GitLab), then **Import** in [Vercel](https://vercel.com).
2. Framework: Next.js. Build command is already `next build --webpack` (needed for Serwist `/sw.js`).
3. Environment variables (Production **and** Preview):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nzklvxivpurprtysvqzw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → API → publishable/anon key |

Never set `service_role` in Vercel.

4. Deploy once on the default `*.vercel.app` URL and confirm the app + service worker load.
5. Project → **Domains** → add `wordforge.ashwinagilan.com`. Copy the CNAME target Vercel shows (usually `cname.vercel-dns.com`).

### 3. Porkbun DNS (`ashwinagilan.com`)

Leave apex ALIAS, wildcard `*`, MX, and SPF as-is. Add:

| Type | Host | Answer | TTL |
|------|------|--------|-----|
| CNAME | `wordforge` | `cname.vercel-dns.com` (or the exact target Vercel shows) | 600 |

Wait until Vercel marks the domain **Valid** (HTTPS issued). Then open [https://wordforge.ashwinagilan.com](https://wordforge.ashwinagilan.com).

### 4. Smoke checklist

- Mode picker + Settings / Lexicon from bottom nav
- Lexicon loads; `/sw.js` present; offline play after first load
- Guest progress survives refresh
- Magic link → `/auth/callback` → sync (try **Echo**)
- Theme toggle; offline banner when network is off

## Modes

| Mode | Twist |
|------|--------|
| **Word Forge** | Classic idle craft; shop letters & generators |
| **Keystone** | Bonus letter focus |
| **Blitz Rack** | Timed 6-letter scramble |
| **Dawn Glyph** | Daily UTC Keystone board |
| **Cipher Clue** | Build the word from the definition |
| **Rung Rush** | Climb 3→8 letter lengths |
| **Affix Arc** | Prefix/suffix locked |
| **Rarefire** | Must include a rare letter |
| **Heat Wave** | 90s — push combo as high as you can |
| **Echo** | Next word starts with the previous word’s last letter |

Progress is **saved per mode**. Bottom nav (Play / Lexicon / Settings, plus Shop when the mode has one) works from the mode picker. Theme: **system / light / dark** (Settings).

## Supabase (local)

1. Copy `.env.example` → `.env.local`
2. Dashboard → **Project Settings → API** → paste the **publishable** or **anon** public key  
   Never put the **service_role** key in the client or commit it.
3. Apply migrations (see Deploy §1).
4. Auth redirect: `http://localhost:3000/auth/callback`
5. In Settings, send a magic link. Guests without env/session stay **local-only**. Sync is **last-write-wins per mode**.

## Stack

- Next.js App Router + TypeScript
- MUI 9 (`@mui/material` 9.x) + Emotion
- Zustand + persist (versioned local save, `SAVE_VERSION` 5)
- Serwist PWA (manifest + production service worker; lexicon CacheFirst)
- Supabase JS (optional auth + cloud save)

## Key paths

| Path | Role |
|------|------|
| `src/app/page.tsx` | App entry |
| `src/components/GameShell.tsx` | Shell + bottom nav (picker + in-mode) |
| `src/components/StartScreen.tsx` | Mode picker + per-mode setup |
| `src/game/store.ts` | Zustand game state + per-mode persist |
| `src/dictionary/LanguageWorld.ts` | Multi-language seam |
| `src/dictionary/english/` | English world + word list |
| `src/theme/theme.ts` | Light / dark MUI themes |
| `src/lib/supabase/` | Browser client + sync |
| `supabase/migrations/` | SQL for profiles / game_saves |

## Rebuild dictionary / icons

```bash
npm run dict:build    # may download a large word list cache
npm run icons:build   # writes public/icons/icon-192.png & icon-512.png
```
