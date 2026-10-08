# Deploy checklist — Word Forge

Target: **https://wordforge.ashwinagilan.com**

## You do these in dashboards (agent cannot)

### A. Git remote + Vercel

1. Create a GitHub repo and push `master` (this project currently has **no git remote**).
2. [vercel.com](https://vercel.com) → Import project → set env:

```
NEXT_PUBLIC_SUPABASE_URL=https://nzklvxivpurprtysvqzw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable or anon key>
```

3. Deploy, then **Domains** → add `wordforge.ashwinagilan.com`.

### B. Porkbun

DNS for `ashwinagilan.com` → add:

- **CNAME** host `wordforge` → `cname.vercel-dns.com` (or Vercel’s shown target)
- Do **not** change apex ALIAS, `*`, MX, or SPF

### C. Supabase

1. Run [`../supabase/migrations/003_game_saves_all_modes.sql`](../supabase/migrations/003_game_saves_all_modes.sql) if cloud sync still rejects newer modes.
2. Auth → URL:
   - Site URL: `https://wordforge.ashwinagilan.com`
   - Redirect: `https://wordforge.ashwinagilan.com/auth/callback` (+ localhost + `*.vercel.app`)

## Done in repo

- README Deploy section
- `metadataBase` / Open Graph → production URL
- `.env.example` production notes
- Migrations `001`–`003` (all 10 modes in CHECK)
