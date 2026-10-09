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

1. SQL Editor — run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) once on a fresh database (profiles with player `progress`, per-mode `game_saves`, RLS, signup trigger).

   **Reset (pre-launch only).** The migration uses plain `create`, so to apply a changed `001_init.sql` to a database that already has the tables, drop them first (this deletes all saves), then run the file again:

   ```sql
   drop trigger if exists on_auth_user_created on auth.users;
   drop function if exists public.handle_new_user() cascade;
   drop table if exists public.game_saves cascade;
   drop table if exists public.profiles cascade;
   ```
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → API → publishable key |

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
2. Dashboard → **Project Settings → API** → paste the **publishable** key  
   Never put the **service_role** key in the client or commit it.
3. Apply `supabase/migrations/001_init.sql` (see Deploy §1).
4. Auth redirect: add `http://localhost:3000/auth/callback` under **Auth → URL Configuration → Redirect URLs**. If it's missing, Supabase falls back to the Site URL and the magic link lands on production instead of localhost.
5. In Settings, send a magic link. Guests without env/session stay **local-only**.

Sync merges per mode. Within the same run (`runId`), discovered words from every device are combined and the higher total score is kept; other run state (coins, letters, generators) comes from the newer save. A new game or "Reset all saves" starts a new run and deletes the matching cloud rows, so old words don't come back. Only modes that changed are pushed.

Player-wide progress (daily streak days, achievements, hint-free clue solves) lives in `profiles.progress`. Devices merge it as a union: all days, the earliest unlock per achievement, the larger counter. "Reset all saves" keeps it.

## Daily, hints, and rarity

- **Completed dailies:** Daily Lock and Daily Wordle complete when the puzzle ends; Dawn Glyph completes at 40 words (`DAILY_GOAL`), and you can keep playing it. A completed card shows the time until the next board and a spoiler-free **Share** result. Any completed daily counts toward the streak.
- **Clue and Thread hints:** no coins. The hint ladder reveals a letter, another letter, then the word. That target then scores 67%, 33%, or 0% (word shown, combo resets). Register Hunt's first hint picks an unfound tagged word.
- **Rarity tiers** (built by `dict:build` from web word frequency):

| Tier | Colour | Rule | Score bonus |
|------|--------|------|-------------|
| Common | grey | frequency rank up to 20,000 | 0 |
| Uncommon | green | rank 20,001–60,000 | +5 |
| Rare | blue | rank 60,001–150,000 | +15 |
| Epic | purple | rank below 150,000, or not in the list and 7+ letters | +30 |
| Legendary | gold | not in the list and 6 letters or fewer | +50 |

## Stack

- Next.js App Router + TypeScript
- MUI 9 (`@mui/material` 9.x) + Emotion
- Zustand + persist to IndexedDB via `idb-keyval` (`SAVE_VERSION` 1; a save from any other version is discarded, not upgraded)
- `react-virtuoso` for the Lexicon (A–Z groups, sticky headers, A–Z rail as the scrollbar)
- Points display compactly (`999`, `1k`, `10k`, `1m` … capped at `999m`); tap a value to see it in full
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
npm run dict:build    # needs scripts/kaikki.org-dictionary-English.jsonl (kaikki.org English extract, ~3.1GB) and scripts/count_1w.txt (https://norvig.com/ngrams/count_1w.txt, ~5MB), both gitignored; writes public/dictionary/english-words.json.gz
npm run icons:build   # writes public/icons/icon-192.png & icon-512.png
```

After every dictionary rebuild, bump the lexicon cache name in `src/app/sw.ts` (`word-forge-lexicon-vN`). The cache is CacheFirst, so installed players otherwise keep the old file for up to 45 days.
