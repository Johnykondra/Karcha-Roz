# accounting-app

A Next.js accounting dashboard with sample AED bookkeeping data.

## Supabase setup

1. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
   `.env.local` (the workspace `.env` uses `SUPABASE_PROJECT_URL` and
   `SUPABASE_PUBLIC_KEY`).
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL
   Editor. It creates the three tables, balanced-entry RPC, read policies,
   sample accounts, and 10 sample journal entries.
3. Restart Next.js after changing `.env.local`.

Accounts and posted entries are loaded from Supabase. Posting calls the
`post_journal_entry` function, which rejects entries unless their debit and
credit totals match.

**Public demo access:** the SQL allows anyone with the project URL and public
key to read the chart and journal data and post balanced entries. Use only
non-sensitive demo data. Add Supabase Auth and user-scoped row-level security
before storing real financial records.

## Deploy on Vercel

Connect the GitHub repository to a Vercel project and set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production,
Preview, and Development. Pushes to the connected production branch trigger a
deployment. These `NEXT_PUBLIC_` values are included in browser code, so use
only the public Supabase key and non-sensitive demo data.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Next.js (usually http://localhost:3000).

## Pages

- `/` — Dashboard and recent activity
- `/chart-of-accounts` — Accounts grouped by type
- `/journal-entries` — Journal entries, search, and balanced entry posting
- `/trial-balance` — Closing balances and debit/credit totals
- `/reports` — Date-filtered income statement, balance sheet, cash flow, trial balance, financial ratios, and PDF export
