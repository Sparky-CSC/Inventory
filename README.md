# Culver-Stockton College Theatre Inventory

The theatre inventory app — costumes, props, scenery, locations and containers,
QR labels and hang tags, rentals and invoices, borrowed items, expendables and
reminders — rebuilt to run on **GitHub Pages with no Base44 account**.

It is the same app and the same screens. What changed is everything Base44 did
behind the scenes (the database, sign-in, photo uploads and the AI lookup),
which now lives in this project.

---

## Contents

1. [Two ways to run it](#1-two-ways-to-run-it)
2. [Put it on GitHub Pages](#2-put-it-on-github-pages)
3. [Shared mode: one inventory for everyone](#3-shared-mode-one-inventory-for-everyone)
4. [Bring your data over from Base44](#4-bring-your-data-over-from-base44)
5. [What is different from the Base44 version](#5-what-is-different-from-the-base44-version)
6. [Everyday notes](#6-everyday-notes)
7. [Working on the code](#7-working-on-the-code)
8. [If something goes wrong](#8-if-something-goes-wrong)

---

## 1. Two ways to run it

GitHub Pages can only hand out files — it has no database and no sign-in of its
own. So the app can keep its data in one of two places:

| | **This-device mode** (default) | **Shared mode** |
|---|---|---|
| Where the data lives | In the browser, on that one computer or phone | In a free Supabase database |
| Other accounts needed | None | A free Supabase account |
| Who sees the inventory | Only that browser on that device | Everyone who signs in, on any device |
| Sign-in | Kept on the device (a convenience, not real security) | Real accounts with passwords |
| Good for | Trying it out, or one shared shop computer | The whole department |

Both come from the same code. You start in this-device mode and switch to
shared mode by adding two settings (section 3) — nothing has to be rebuilt by hand.

> **Using it the way you used Base44 — several people, one inventory — needs
> shared mode.**

---

## 2. Put it on GitHub Pages

You do this once. After that, every change pushed to the repository publishes itself.

1. **Create a new repository** on GitHub (for example `theatre-inventory`).
   Use a *new* one rather than the repository Base44 is connected to, so the
   Base44 copy keeps working until you have finished moving.
   A **public** repository is free to publish. (A private one needs a paid
   GitHub plan for Pages. Nothing secret is stored in the code either way.)

2. **Upload this project** to it. With Git installed, from inside this folder:

   ```bash
   git init
   git add .
   git commit -m "Theatre inventory without Base44"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/theatre-inventory.git
   git push -u origin main
   ```

   (GitHub Desktop works too: *File → Add local repository*, then *Publish repository*.)

3. **Turn on Pages:** in the repository, go to **Settings → Pages** and, under
   *Build and deployment*, set **Source** to **GitHub Actions**.

4. **Wait for the first build.** Open the **Actions** tab; "Deploy to GitHub
   Pages" takes about two minutes. When it shows a green tick, the app is at

   ```
   https://YOUR-NAME.github.io/theatre-inventory/
   ```

5. **Open that address** and create the first account. That account is the
   administrator.

At this point the app is running in this-device mode.

---

## 3. Shared mode: one inventory for everyone

About fifteen minutes, once. A step-by-step version with more
detail is in [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md).

### a. Create the database

1. Sign up at [supabase.com](https://supabase.com) and create a **new project**
   (the free plan is enough). Choose a region near you and save the database
   password it asks for somewhere safe — the app itself never needs it.
2. In the project, open **SQL Editor → New query**, paste in the whole of
   [`supabase/schema.sql`](supabase/schema.sql) from this project, and press **Run**.
   It should finish with "Success". (It is safe to run again later.)

### b. Two sign-in settings

Supabase's built-in email service only delivers to members of your Supabase
team, and only two messages an hour, so:

3. Go to **Authentication → Sign In / Providers → Email** and switch
   **"Confirm email" off**. (Only people you have invited can create an account
   anyway — the database enforces that.)
4. Go to **Authentication → URL Configuration** and set **Site URL** to your
   app's address, e.g. `https://YOUR-NAME.github.io/theatre-inventory/`. Add
   the same address under **Redirect URLs**.

### c. Connect the app to it

5. In Supabase open **Project Settings → API Keys** (and **Data API** for the
   address) and copy two things:
   - the **Project URL** — looks like `https://abcdefgh.supabase.co`
   - the **publishable key** — starts with `sb_publishable_…`
     (older projects call it the **anon public** key; either works)

   Do **not** use the *secret* / *service_role* key. The publishable key is
   meant to be public; the rules in `schema.sql` are what protect your data.

6. In your GitHub repository go to **Settings → Secrets and variables →
   Actions → Variables** tab → **New repository variable**, and add:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_KEY` | the publishable key |

7. Go to **Actions → Deploy to GitHub Pages → Run workflow**. Two minutes later
   the site is in shared mode.

8. Open the app and **create the first account** — it becomes the
   administrator. Then invite everyone else from **Administration → Users →
   Invite User** and send each person the link it gives you.

> **Free-plan limits worth knowing:** 500 MB of data and 1 GB of photos
> (photos are shrunk on upload to roughly 0.2–0.5 MB each, so that is a few
> thousand photos). A free project is **paused after a week with no
> activity**. This repository includes a small job that pings the database
> twice a week to prevent that; if it ever is paused, press *Restore* in the
> Supabase dashboard — your data is kept.

### Forgotten passwords

- **An administrator can set a new password for anyone:** Administration →
  Users → ⋮ → *Set a New Password…*
- "Forgot your password?" on the sign-in screen sends a reset email. Because
  of the email limits above, that only works for everyone once you connect
  your own mail service in Supabase's **Authentication** settings, under SMTP
  (the college's mail server, or a free service such as Resend or Brevo). Until
  then, use the administrator option.

---

## 4. Bring your data over from Base44

Do this while your Base44 app still exists.

1. **Export from Base44.** In the Base44 dashboard open **Data** and download
   each table you use (inventory items, containers, locations, categories,
   subcategories, renters, rental orders, invoices, borrowed items, expendable
   items, app settings …). CSV and JSON files both work here.
2. **Import here.** Sign in as an administrator → **Administration → Data &
   Backup → Import data → Choose files**. Select all the files at once. The
   app guesses what each file contains from its name; correct any it could not
   guess, then press **Import**.
   - Record ids are kept, so containers, locations, renters and invoices stay
     linked to the right items.
   - Importing the same file twice updates records instead of duplicating them.
3. **Copy the photos.** Imported items still point at photos stored by Base44.
   On the same screen press **Copy photos now** to bring them into this app's
   own storage before the Base44 app is closed.
4. **Invite your people again.** Accounts and passwords cannot be moved, so
   re-create your roles if you had custom ones (or import the roles file) and
   send new invitations.

**QR labels you have already printed:** the scanner inside the app recognises
the old Base44 links and opens the right item or location. Scanning an old
label with a phone's ordinary camera will still try to open the Base44 address,
so reprint labels when convenient — new labels point at this site.

---

## 5. What is different from the Base44 version

**Replaced**

| Base44 did this | Now |
|---|---|
| Stored the data | This browser (this-device mode) or your Supabase database (shared mode) |
| Sign-in and user list | Email + password accounts; invitation links; roles as before |
| Photo and logo uploads | Stored with the data; photos are shrunk on upload |
| **AI** barcode / label lookup | The app reads barcodes and QR codes itself (from a photo or the live camera), reads serial and model numbers printed on a label, and looks retail barcodes up in free public product databases. It no longer *guesses* a description, period or style the way the AI did, and the product databases know far fewer theatre-specific items — expect "no product information found" more often, with the code itself still filled in. |
| QR images from an outside service | Drawn inside the app, so labels work offline |

**Works differently**

- **Reminders** are prepared automatically when a rental or borrowed item
  reaches its reminder date, and appear on the Reminders page. Pressing
  **Send** opens your own email program with the message filled in. Nothing is
  emailed without that click, because there is no server to send it. (The
  exported Base44 code only stored reminders; it contained nothing that sent them.)
- **The Administration page** is only shown to administrators, and it has a
  new **Data & Backup** tab: backup, restore, import, copy photos.
- **Default landing page** applies when you open the app; the Dashboard link
  always shows the dashboard.

**Fixed along the way** (these were not working in the code as exported)

- Colours: the theme colour classes used on almost every screen
  (`bg-base-100`, `text-primary-content` …) were not defined anywhere in the
  exported code. They are defined now, so screens show their intended colours.
- Rental editor: recalculated totals in an endless loop; a newly added renter
  was not filled into the order; "+ Rental" on an item did not carry the item over.
- Borrowed items: Edit opened an empty form; the Save button could be off-screen.
- Item details: the container never showed, and the Variants tab could crash.
- Search: links such as "view favorites" and scanned codes were ignored; the
  time-period filter never matched; typing in a filter box lost focus.
- Expendables: low-stock alerts were created twice and came back after being acknowledged.
- Settings: sidebar order and "default page" listed pages that do not exist.
- Dashboard: "Recent additions" was always 0; pages waited up to 12 seconds
  on purpose (to avoid Base44 rate limits) — they load immediately now.
- QR scanner in the item form produced a made-up code; it reads the real one now.

---

## 6. Everyday notes

- **Labels and hang tags.** *Print Labels* in the sidebar (or *Print Tags* /
  *Print Hang Tag* on items) opens the label designer: pick items, a size —
  hang tags on cardstock, Avery sticker sheets (5160, 5161, 5163, 5164, 5167,
  22806, business-card 5371/8371), label printers (DYMO, Zebra, Rollo,
  Brother, including 62 mm continuous tape), receipt printers (80 mm and
  58 mm thermal rolls — one tag per cut, or one continuous strip) or a custom size — and what goes on each label (QR code, barcode,
  name, UID, location, category, size and colour, condition, heading, logo).
  "Start at label" reuses part-used sheets; "Nudge" fixes printer alignment.
  Print with Scale 100%, no margins and headers/footers off. Label and receipt
  printers print from the browser through their own driver, so install the
  maker's driver and pick the matching paper size in the print window.
- **Back up.** Administration → Data & Backup → *Download backup* gives you one
  file with every record. In this-device mode this is essential: clearing the
  browser's data erases the inventory.
- **Install it.** On a phone, use the browser's *Add to Home Screen*; on a
  computer, the install icon in the address bar. It then opens like an app.
- **Offline.** Once opened, the app starts without a connection. In shared
  mode you can browse everything you have already loaded, and items added
  while offline are saved up and sent when the connection returns. Other
  changes need a connection.
- **Who can do what.** Any active user can add and edit inventory, as before.
  Only administrators (or a role with *manage users*) can manage people, roles
  and invitations; app name, logo and subtitles need *manage settings*. In
  shared mode the database itself enforces this.
- **Changing the app's name or logo:** Settings → App Settings.

---

## 7. Working on the code

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173 — this-device mode
npm run build      # production build in dist/
```

To develop against your shared database, copy `.env.example` to `.env.local`
and fill in the two values.

| Path | What it is |
|---|---|
| `src/pages/`, `src/components/` | The screens — largely as exported from Base44 |
| `src/api/` | **The Base44 replacement**: `entities.js` (the `InventoryItem.list()` style calls the pages use), `backends/local.js` and `backends/supabase.js` (the two storage modes), `files.js` (uploads), `dataTransfer.js` (backup / import) |
| `src/api/schemas/` | Field lists and default values for each data type |
| `src/lib/` | Sign-in state, QR drawing, barcode / label reading, reminders, theme |
| `supabase/schema.sql` | Database tables and access rules for shared mode |
| `.github/workflows/` | Publishing to GitHub Pages; keeping the database awake |
| `service-worker.template.js` | Offline support (filled in at build time) |

Addresses use a `#` (`…/#/Inventory`), which is what lets the app run from any
GitHub Pages folder with no server configuration.

---

## 8. If something goes wrong

| What you see | What to do |
|---|---|
| The Pages address shows a 404 | Settings → Pages → Source must be **GitHub Actions**, and the *Deploy* run in the Actions tab must have a green tick. |
| "Can't reach the database" | The Supabase project is probably paused: open the Supabase dashboard and press *Restore*. Also check the two repository variables for typos, then re-run the deploy. |
| "This email has not been invited" | Create an invitation for exactly that email address (Administration → Users), or check that it has not expired. |
| Sign-up says to check your inbox, but no email arrives | "Confirm email" is still on — see section 3b. |
| The site still says "data is stored on this device" after adding the variables | Variables only take effect on the next build: Actions → Deploy to GitHub Pages → Run workflow. They must be under **Variables**, not Secrets. |
| An old version keeps appearing after an update | Close every tab of the app and open it again (it keeps an offline copy of itself). |
| Locked out as the only administrator (shared mode) | In Supabase → SQL Editor run: `update public.profiles set role = 'admin', role_id = 'role_admin', account_status = 'active' where email = 'you@example.edu';` |
