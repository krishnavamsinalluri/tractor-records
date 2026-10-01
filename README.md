# Tractor Records / ట్రాక్టర్ లెక్కలు

A private, mobile-friendly Next.js app for recording tractor work, customer balances, and individual payments. It uses Supabase Authentication and PostgreSQL with row-level security.

## Connect Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste all of [`supabase/setup.sql`](supabase/setup.sql), and run it once.
3. Open **Authentication > Users > Add user**. Create the single email/password login for the app owner. Disable public sign-ups under **Authentication > Providers > Email** if they are enabled. The app itself has no sign-up screen.
4. In **Project Settings > API**, copy the Project URL and the anon/publishable key.
5. Duplicate `.env.example` as `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
NEXT_PUBLIC_SITE_URL=https://tractor-records-xi.vercel.app
```

The browser key is intentionally public and is restricted by RLS. Never put a Supabase `service_role` key in this project or in a `NEXT_PUBLIC_` variable.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with the account created above, and add a work record. Work types can be enabled, hidden, or added in the **Work types** tab.

For a Supabase project created before configurable work-type rates were added, run [`supabase/add_work_type_rates.sql`](supabase/add_work_type_rates.sql) once in the SQL Editor. Then set each work type's acre and hourly rates from the **Work types** tab. New work records default to per-acre billing and automatically use the configured rate; existing records retain their saved billing unit and rate.

For an existing project, also run [`supabase/add_customer_payment_rpc.sql`](supabase/add_customer_payment_rpc.sql) once in the SQL Editor. It adds the authenticated `record_customer_payment` RPC used to allocate one customer payment across pending work atomically, oldest first. Existing payment rows remain unchanged.

After applying it, [`supabase/verify_customer_payment_rpc.sql`](supabase/verify_customer_payment_rpc.sql) can be run in the SQL Editor to exercise partial allocation, full allocation, overpayment rejection, and duplicate-request handling. The verification transaction rolls back all of its fixture data.

## Deploy to Vercel

1. Push the repository to a Git provider and import it into Vercel.
2. In the Vercel project, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL=https://tractor-records-xi.vercel.app` under **Settings > Environment Variables** for Production (and Preview if needed).
3. Deploy. Vercel detects Next.js and runs `npm run build` automatically.
4. On a phone, sign in and test **WhatsApp** and **SMS**. Both buttons open the relevant app with a prepared receipt; the user still taps Send. Saving has already completed before the share sheet appears.

## Supabase password recovery URLs

Open **Supabase → Authentication → URL Configuration** and configure:

- **Site URL:** `https://tractor-records-xi.vercel.app`
- **Redirect URLs:**
  - `http://localhost:3000/reset-password`
  - `https://tractor-records-xi.vercel.app/reset-password`

Keep the production Site URL in place and retain localhost only as an additional redirect URL. The application sends the reset-password URL as `redirectTo`, so it must match this allowlist exactly. If the recovery email template was customized, keep `{{ .ConfirmationURL }}` as its link target; do not replace it with `{{ .SiteURL }}`.

Password recovery uses the existing browser Supabase client, publishable key, and user session. It does not use a service-role key, create a new account, or store passwords in application tables or browser storage.

## Data protection

Every application table has RLS enabled and a policy requiring `auth.uid() = user_id`. Database triggers also reject cross-user relations, overpayments, and work edits that would make the total lower than payments already received. Payments remain separate rows for a clear history.
