# Cloud backups to Google Drive — setup

The app can save a full backup of the inventory into **two or more Google
Drives every night**. Each backup is one file (the same file *Administration →
Download backup* makes), and new photos are copied into a *Photos* folder next
to it. Old backups beyond the number you choose are moved to that Drive's trash.

The database side is already installed on the department's Supabase project.
What is left is a one-time step in Google, and then connecting each Drive in the
app. Allow about 15 minutes.

> **Why two Google accounts?** If one account is deleted, locked, hacked or runs
> out of space, the other still has every backup. A good pair is a department
> Google account plus a personal or second staff account.

---

## Part 1 — Create the Google app (once, about 10 minutes)

Google only lets an app write into a Drive if the app is registered with Google.
You register it once; it can then back up to any number of Google accounts.

Sign in to Google with the account that should *own* this registration (a
department account is best, so it doesn't depend on one person).

1. **Make a project.** Open <https://console.cloud.google.com/projectcreate>.
   Name it `Theatre Inventory Backups` and click **Create**. Make sure the new
   project is selected in the project picker at the top of the page.

2. **Turn on Google Drive.** Open
   <https://console.cloud.google.com/apis/library/drive.googleapis.com> and click
   **Enable**.

3. **Describe the app.** Open <https://console.cloud.google.com/auth/overview>
   and click **Get started**.
   - App name: `Theatre Inventory Backups`
   - User support email: your email
   - Audience: **External** (choose **Internal** only if *every* Drive you
     will back up to is a Culver-Stockton Google account, see the note below)
   - Contact email: your email → **Create**

4. **Branding.** In the left menu choose **Branding** and fill in:
   - Application home page: `https://sparky-csc.github.io/Inventory/`
   - Application privacy policy link: `https://sparky-csc.github.io/Inventory/privacy.html`
   - Authorized domains → **Add domain** twice:
     `sparky-csc.github.io` and `hbodfwlvsfykhewbdzpu.supabase.co`
   - Click **Save**.

5. **Publish it** (External only). In the left menu choose **Audience** and
   click **Publish app** → **Confirm**. The status should read *In production*.
   This matters: while an app is in *Testing*, Google ends its access after
   7 days and the nightly backups would stop. The app only asks for
   Google's narrowest Drive permission, so no review by Google is needed.

6. **Make the client.** In the left menu choose **Clients** → **Create client**.
   - Application type: **Web application**
   - Name: `Theatre Inventory`
   - Authorized JavaScript origins → **Add URI**: `https://sparky-csc.github.io`
   - Authorized redirect URIs → **Add URI**:
     `https://hbodfwlvsfykhewbdzpu.supabase.co/functions/v1/drive-backup`
   - Click **Create**.

7. Google now shows the **Client ID** and **Client secret**. Copy both (or click
   **Download JSON** to keep them). The secret may only be shown this once.

The app shows the two addresses from step 6 with copy buttons, so you don't
have to type them.

## Part 2 — Connect the Drives (in the app)

1. Sign in to the inventory app as an administrator.
2. Go to **Administration → Data & Backup → Cloud backups**.
3. Paste the **Client ID** and **Client secret** and click **Save**.
4. Type a name such as `Theatre office Drive` and click **Connect Google Drive**.
   Choose the Google account, click **Continue/Allow**, and you're returned to
   the app.
5. Click **Back up now** and check that it says *Backed up*. **Open folder**
   shows the backup in that Drive.
6. Repeat steps 4–5 with a **different Google account** for the second copy.

That's it. Backups now run every night (2:17 AM unless you choose another time),
and the Cloud backups panel shows whether each Drive is up to date.

## Restoring

Open any of the Drives, go into *Theatre Inventory Backups*, download the newest
`theatre-inventory-backup-….json`, then use **Administration → Data & Backup →
Restore from backup**. Photos are in the *Photos* folder of the same Drive.

## If something goes wrong

| What you see | What to do |
|---|---|
| Google says **redirect_uri_mismatch** | The redirect URI in Part 1, step 6 is not exactly `https://hbodfwlvsfykhewbdzpu.supabase.co/functions/v1/drive-backup`. Fix it under **Clients**, wait a few minutes, try again. |
| **Access blocked: app has not completed verification** or *only test users* | The app is still in *Testing*. Do Part 1, step 5. |
| **Google hasn't verified this app** | Click **Advanced → Go to Theatre Inventory Backups**. This is expected for small, unreviewed apps. |
| A college account says **access blocked by your administrator** | The college's Google admin limits outside apps. Use another account, or ask IT to allow the client ID. |
| A Drive shows **Reconnect needed** | Google access ended (password change, access removed in Google, or the app was in Testing). Click **Reconnect**; the same folder is reused. |
| **Out of date** | No backup in the last day and a half. Click **Back up now** to see the error. |

### Note on “Internal”

If the Google Cloud project belongs to the Culver-Stockton Google Workspace and
you choose **Internal** in Part 1, step 3, you can skip publishing (step 5), but
only Culver-Stockton accounts can then be connected. For a second copy outside
the college, use **External**.

## How it works (for whoever maintains this)

- `supabase/backup.sql` — tables (`backup_settings`, `backup_destinations`,
  `backup_runs`, …), administrator-only functions, and a `pg_cron` job that
  calls the edge function once per connected Drive each night.
- `supabase/functions/drive-backup/index.ts` — the edge function: Google
  sign-in, building the backup, uploading to Drive, copying new photos (up to
  about 90 seconds' worth per run; the rest follow the next night) and trashing
  old backups.
- The Google refresh tokens and the client secret are stored in tables with row
  level security and no access rules, so neither app users nor administrators can
  read them through the API.
- Deploying the function again: `supabase functions deploy drive-backup --no-verify-jwt`.
