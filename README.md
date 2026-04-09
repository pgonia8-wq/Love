# H Love

Premium dating mini app for World App — verified humans only (World ID Orb).

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- World ID Orb verification via MiniKit
- Supabase (Postgres, Storage, Realtime, Edge Functions)
- Payments in WLD & USDC
- Framer Motion animations

## Setup

```bash
npm install
cp .env.example .env  # fill in your credentials
npm run dev
```

## Supabase Setup

1. Run `sql/schema.sql` in your Supabase SQL Editor
2. Deploy Edge Functions: `supabase functions deploy`
3. Set `SUPABASE_SERVICE_ROLE_KEY` in Edge Function env vars

## Deploy to Vercel

1. Import repo in Vercel
2. Set env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_WORLD_APP_ID
3. Deploy

## World Developer Portal

Register action `hlove-verify-human` with Orb verification level.
