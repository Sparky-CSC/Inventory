-- ============================================================================
-- Cloud backups to Google Drive
--
-- Run after schema.sql. Safe to run again.
--
-- Every night pg_cron calls the "drive-backup" edge function once for each
-- connected Google Drive. The function writes a full backup file (the same
-- format as Administration → "Download backup") into a "Theatre Inventory
-- Backups" folder in that Drive, copies new photos, and trashes backups older
-- than the number to keep.
--
-- Google sign-in tokens and the Google app secret live in these tables, which
-- nobody can read through the API: there are no access rules for signed-in
-- people at all. Administrators manage backups only through the functions
-- below, which never return a token or the secret.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- One row of settings.
create table if not exists public.backup_settings (
  id                   int primary key default 1 check (id = 1),
  google_client_id     text,
  google_client_secret text,
  cron_secret          text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  schedule_hour_utc    int  not null default 8 check (schedule_hour_utc between 0 and 23),
  function_url         text,
  updated_at           timestamptz not null default now()
);
insert into public.backup_settings (id) values (1) on conflict (id) do nothing;

-- Each place backups go (one per Google account, or several folders).
create table if not exists public.backup_destinations (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null default 'google_drive',
  label            text not null,
  account_email    text,
  refresh_token    text,
  folder_id        text,
  photos_folder_id text,
  keep_count       int not null default 30 check (keep_count between 1 and 365),
  include_photos   boolean not null default true,
  enabled          boolean not null default true,
  status           text not null default 'ok',          -- ok | error | needs_reconnect
  last_backup_at   timestamptz,
  last_file_name   text,
  last_error       text,
  created_at       timestamptz not null default now(),
  created_by       uuid
);

-- Which photos each destination already has a copy of.
create table if not exists public.backup_photo_uploads (
  destination_id uuid not null references public.backup_destinations(id) on delete cascade,
  object_name    text not null,
  uploaded_at    timestamptz not null default now(),
  primary key (destination_id, object_name)
);

-- A record of every backup attempt.
create table if not exists public.backup_runs (
  id                uuid primary key default gen_random_uuid(),
  destination_id    uuid references public.backup_destinations(id) on delete set null,
  destination_label text,
  trigger           text not null default 'scheduled',  -- scheduled | manual
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running',    -- running | success | failed
  file_name         text,
  bytes             bigint,
  record_count      int,
  photos_uploaded   int,
  photos_remaining  int,
  message           text
);
create index if not exists backup_runs_started_idx on public.backup_runs (started_at desc);

-- Short-lived links between "Add Google Drive" and Google's reply.
create table if not exists public.backup_oauth_states (
  state          text primary key,
  label          text,
  destination_id uuid,
  user_id        uuid,
  app_url        text,
  created_at     timestamptz not null default now()
);

alter table public.backup_settings      enable row level security;
alter table public.backup_destinations  enable row level security;
alter table public.backup_photo_uploads enable row level security;
alter table public.backup_runs          enable row level security;
alter table public.backup_oauth_states  enable row level security;
revoke all on public.backup_settings, public.backup_destinations, public.backup_photo_uploads,
              public.backup_runs, public.backup_oauth_states from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Functions for administrators
-- ----------------------------------------------------------------------------

create or replace function public.backup_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can manage cloud backups.' using errcode = '42501';
  end if;
end;
$$;

-- Everything the backup screen shows (never the tokens or the secret).
create or replace function public.backup_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.backup_settings;
begin
  perform public.backup_require_admin();
  select * into v_settings from public.backup_settings where id = 1;
  return jsonb_build_object(
    'configured', coalesce(v_settings.google_client_id, '') <> '' and coalesce(v_settings.google_client_secret, '') <> '',
    'client_id', v_settings.google_client_id,
    'schedule_hour_utc', v_settings.schedule_hour_utc,
    'redirect_uri', v_settings.function_url,
    'destinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'label', d.label, 'account_email', d.account_email, 'folder_id', d.folder_id,
        'keep_count', d.keep_count, 'include_photos', d.include_photos, 'enabled', d.enabled,
        'status', d.status, 'last_backup_at', d.last_backup_at, 'last_file_name', d.last_file_name,
        'last_error', d.last_error, 'connected', d.refresh_token is not null, 'created_at', d.created_at,
        'photos_copied', (select count(*) from public.backup_photo_uploads p where p.destination_id = d.id)
      ) order by d.created_at)
      from public.backup_destinations d), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.started_at desc)
      from (select * from public.backup_runs order by started_at desc limit 30) r), '[]'::jsonb)
  );
end;
$$;

-- Save the Google app's client ID and secret (an empty secret keeps the old one).
create or replace function public.backup_save_google(p_client_id text, p_client_secret text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.backup_require_admin();
  update public.backup_settings
     set google_client_id = nullif(trim(p_client_id), ''),
         google_client_secret = coalesce(nullif(trim(p_client_secret), ''), google_client_secret),
         updated_at = now()
   where id = 1;
end;
$$;

create or replace function public.backup_update_destination(
  p_id uuid, p_label text, p_keep_count int, p_include_photos boolean, p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.backup_require_admin();
  update public.backup_destinations
     set label = coalesce(nullif(trim(p_label), ''), label),
         keep_count = greatest(1, least(365, coalesce(p_keep_count, keep_count))),
         include_photos = coalesce(p_include_photos, include_photos),
         enabled = coalesce(p_enabled, enabled)
   where id = p_id;
end;
$$;

-- Stop backing up to a destination. Files already in that Drive stay there.
create or replace function public.backup_delete_destination(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.backup_require_admin();
  delete from public.backup_destinations where id = p_id;
end;
$$;

-- Send one request per connected destination to the edge function.
create or replace function public.backup_dispatch()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.backup_settings;
  v_dest record;
  v_count int := 0;
begin
  select * into v_settings from public.backup_settings where id = 1;
  if coalesce(v_settings.function_url, '') = '' then
    return 0;
  end if;
  for v_dest in
    select id from public.backup_destinations where enabled and refresh_token is not null
  loop
    perform net.http_post(
      url := v_settings.function_url,
      body := jsonb_build_object('action', 'scheduled', 'destination_id', v_dest.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-backup-secret', v_settings.cron_secret),
      timeout_milliseconds := 300000
    );
    v_count := v_count + 1;
  end loop;
  -- Old sign-in attempts and run records are not needed forever.
  delete from public.backup_oauth_states where created_at < now() - interval '1 day';
  delete from public.backup_runs where started_at < now() - interval '180 days';
  return v_count;
end;
$$;

-- Choose the hour (UTC) the nightly backup runs.
create or replace function public.backup_set_schedule(p_hour_utc int)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.backup_require_admin();
  if p_hour_utc is null or p_hour_utc < 0 or p_hour_utc > 23 then
    raise exception 'The hour must be between 0 and 23.';
  end if;
  update public.backup_settings set schedule_hour_utc = p_hour_utc, updated_at = now() where id = 1;
  perform cron.schedule('theatre-inventory-backup', format('17 %s * * *', p_hour_utc), 'select public.backup_dispatch()');
end;
$$;

revoke execute on function public.backup_dispatch() from public, anon, authenticated;
revoke execute on function public.backup_require_admin() from public, anon;
revoke execute on function public.backup_overview() from public, anon;
revoke execute on function public.backup_save_google(text, text) from public, anon;
revoke execute on function public.backup_update_destination(uuid, text, int, boolean, boolean) from public, anon;
revoke execute on function public.backup_delete_destination(uuid) from public, anon;
revoke execute on function public.backup_set_schedule(int) from public, anon;
grant execute on function public.backup_overview() to authenticated;
grant execute on function public.backup_save_google(text, text) to authenticated;
grant execute on function public.backup_update_destination(uuid, text, int, boolean, boolean) to authenticated;
grant execute on function public.backup_delete_destination(uuid) to authenticated;
grant execute on function public.backup_set_schedule(int) to authenticated;
grant execute on function public.backup_require_admin() to authenticated;

-- The edge function's address for this project (use your own project's
-- address if you set the app up on a different Supabase project).
update public.backup_settings
   set function_url = 'https://hbodfwlvsfykhewbdzpu.supabase.co/functions/v1/drive-backup'
 where id = 1 and function_url is null;

-- Nightly at 2:17 AM US Central (08:17 UTC); change it on the backup screen.
select cron.schedule('theatre-inventory-backup', '17 8 * * *', 'select public.backup_dispatch()');

notify pgrst, 'reload schema';
