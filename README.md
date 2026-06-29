# Grade 3 Planner — Phase 1 (Login + Blank Planners)

This is the very first working version of the live website. Right now it can:
- Create an account / log in
- Create a brand new, completely blank Class Planner
- See a list of planners you belong to
- Confirm a planner loaded correctly (the real timetable/weekly planner UI comes in Phase 2)

## STEP 1 — Run the database setup (one-time, in Supabase)

1. Go to your Supabase project → **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `schema.sql` (included in this folder), copy ALL of it
4. Paste it into the SQL editor and click **Run**
5. You should see "Success. No rows returned" — that means it worked

This creates all the tables and security rules. You only need to do this once.

## STEP 2 — Put this code on GitHub

1. Go to [github.com](https://github.com) and click **New repository**
2. Name it something like `grade3-planner`
3. Leave it empty (don't add a README from GitHub's side)
4. On the next screen, use **"uploading an existing file"** and drag in every file from this folder, keeping the folder structure intact (the `src` folder needs to stay a folder)
5. Commit the files

**Important:** Do NOT upload the `.env` file to GitHub — it's listed in `.gitignore` so it should be skipped automatically, but double check it's not there. Your Supabase keys go into Netlify directly instead (next step), not into the public code.

## STEP 3 — Deploy on Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Choose GitHub, then pick your `grade3-planner` repository
3. Build settings should auto-detect, but confirm:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Before clicking deploy, click **Add environment variables** and add these two (copy from your `.env` file):
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase publishable key
5. Click **Deploy**

Netlify will build and give you a live URL (something like `random-name-123.netlify.app`). That's your website.

## STEP 4 — Test it

1. Open the Netlify URL
2. Sign up with your email and a password
3. Check your email for a confirmation link (Supabase sends this automatically) and click it
4. Log in
5. Click "Create new planner" — give it a name
6. You should land on a blank planner confirmation page

If all of that works, Phase 1 is done and confirmed live.

## What's NOT here yet (Phase 2)
The actual Weekly Planner, Timetable Setup, Term View, AI planning, ability groups —
all of that still needs to be ported from the HTML version into this app. This phase
only proves the login + database + blank-planner foundation works.
