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
```

The browser key is intentionally public and is restricted by RLS. Never put a Supabase `service_role` key in this project or in a `NEXT_PUBLIC_` variable.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with the account created above, and add a work record. Work types can be enabled, hidden, or added in the **Work types** tab.

## Deploy to Vercel

1. Push the repository to a Git provider and import it into Vercel.
2. In the Vercel project, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Settings > Environment Variables** for Production (and Preview if needed).
3. Deploy. Vercel detects Next.js and runs `npm run build` automatically.
4. On a phone, sign in and test **WhatsApp** and **SMS**. Both buttons open the relevant app with a prepared receipt; the user still taps Send. Saving has already completed before the share sheet appears.

## Data protection

Every application table has RLS enabled and a policy requiring `auth.uid() = user_id`. Database triggers also reject cross-user relations, overpayments, and work edits that would make the total lower than payments already received. Payments remain separate rows for a clear history.
