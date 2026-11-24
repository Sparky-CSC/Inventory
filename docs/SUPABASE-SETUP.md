# Setting up the shared database (Supabase)

> **Already done for this repository (24 Nov 2026):** the Supabase project
> `theatre-inventory` exists, Steps 1–2 have been run, and the address and
> public key are saved in `.env.production` (so Steps 4–5 are not needed).
> What is left: **Step 3** and **Step 7**.

Do this once to switch the app from "this device only" to **shared mode**, where
everyone signs in and sees the same inventory. Allow about 15–20 minutes.

You need:

- this repository on GitHub, with GitHub Pages already publishing it
  (README section 2), and the app's address, e.g.
  `https://sparky-csc.github.io/Inventory/`
- an email address for the Supabase account

Supabase occasionally moves its menus around. If a menu named below is not
exactly where this guide says, look for the setting's name — the names stay the same.

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com> and sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `theatre-inventory`
   - **Database password:** click *Generate a password* and save it in a safe
     place. The app never needs it; it is only for emergencies.
   - **Region:** the one closest to Missouri, e.g. *Central US* / *East US*.
   - **Plan:** Free.
3. Click **Create new project** and wait 1–2 minutes until the dashboard is ready.

## Step 2 — Create the tables and security rules

1. In the left sidebar open **SQL Editor**, then **New query**.
2. In this repository open [`supabase/schema.sql`](../supabase/schema.sql),
   click **Raw**, select everything (Ctrl/Cmd + A) and copy it.
3. Paste it into the SQL Editor and click **Run**.
4. You should see **Success. No rows returned.**
   If you see an error, copy its text and ask for help — do not edit the script.

The script is safe to run again later; it never deletes data.

## Step 3 — Two sign-in settings

Supabase's built-in email only reaches members of your Supabase team and sends
a few messages an hour, so the app should not depend on it.

1. **Authentication → Sign In / Providers → Email:** switch
   **Confirm email** **off**, then **Save**.
   (Only invited addresses can create an account — the database enforces
   that, so this does not open the app to strangers.)
2. **Authentication → URL Configuration:**
   - **Site URL:** your app's address, e.g. `https://sparky-csc.github.io/Inventory/`
   - **Redirect URLs → Add URL:** the same address. **Save.**

## Step 4 — Copy two values

Open **Project Settings** (gear icon, bottom left):

| Copy this | Where | Looks like |
|---|---|---|
| **Project URL** | *Data API* (or the **Connect** button at the top) | `https://abcdefghijk.supabase.co` |
| **Publishable key** | *API Keys* | `sb_publishable_…` (older projects: the **anon public** key, a long `eyJ…` string) |

> Never copy the **secret** / **service_role** key anywhere. The publishable
> key is designed to be public; the rules from Step 2 protect your data.

## Step 5 — Give the values to GitHub

1. In this repository: **Settings → Secrets and variables → Actions**.
2. Choose the **Variables** tab (not *Secrets*) → **New repository variable**.
3. Add two variables:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_KEY` | the publishable key |

   No spaces or quotes around the values.

## Step 6 — Rebuild the site

1. Open the **Actions** tab → **Deploy to GitHub Pages** (left side) →
   **Run workflow** → **Run workflow**.
2. Wait for the green tick (about 2 minutes).
3. Open the app. The sign-in screen should **no longer** say "This copy keeps
   its data in this browser". If it still does, close the tab, wait a minute,
   and open it again.

## Step 7 — Create the administrator and invite people

1. On the sign-in screen you will see **Set up your inventory**. Create your
   account — **the first account becomes the administrator.**
2. Go to **Administration → Users → Invite User**, enter a person's email and
   role, and click **Create Invitation**. Send them the link it shows (or press
   **Email the invitation**). They open the link and create their account with
   that same email address.

## Step 8 — Bring over your Base44 data (optional)

1. In Base44's dashboard open **Data** and download each table you use
   (CSV or JSON).
2. In the app: **Administration → Data & Backup → Import data → Choose files**,
   select all the files, check that each one shows the right data type, then
   click **Import**.
3. Click **Copy photos now** so photos stop depending on Base44.
4. Download a backup from the same screen and keep it somewhere safe.

---

## Good to know

- **Forgotten passwords:** an administrator can set a new one:
  Administration → Users → ⋮ → **Set a New Password…**. ("Forgot your
  password?" emails need your own mail server connected under
  Authentication → SMTP settings.)
- **Pausing:** free projects pause after about a week with no activity. The
  repository's *Keep database awake* workflow pings it twice a week. If the
  app ever says it can't reach the database, open the Supabase dashboard and
  click **Restore project** — no data is lost.
- **Free limits:** 500 MB of data and 1 GB of photos (several thousand photos,
  because they are shrunk on upload).
- **Locked out as the only administrator:** in SQL Editor run
  ```sql
  update public.profiles
     set role = 'admin', role_id = 'role_admin', account_status = 'active'
   where email = 'you@culver.edu';
  ```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the database" | Project paused (restore it in Supabase), or a typo in a GitHub variable — fix it and run the deploy again. |
| Still says data is stored on this device | Variables are under *Secrets* instead of *Variables*, or the deploy wasn't re-run. |
| "This email has not been invited" | Make an invitation for exactly that address, and check it hasn't expired. |
| Sign-up says "check your inbox" and nothing arrives | **Confirm email** is still on (Step 3). |
| SQL script error | Make sure you pasted the whole file into an empty query. |
