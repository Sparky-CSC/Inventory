-- ============================================================================
--  Theatre Inventory — database setup for Supabase ("shared mode")
--
--  How to use: Supabase dashboard → SQL Editor → New query → paste this whole
--  file → Run. It is safe to run again later (for example after an update);
--  it never deletes data.
--
--  What it creates
--    • records   – every inventory item, location, rental … (one row each)
--    • profiles  – one row per person who can sign in, with their role
--    • rules so that only signed-in, active people can read and change data,
--      and only administrators can manage people, roles and invitations
--    • the first person to create an account becomes the administrator;
--      everyone after that needs an invitation
--    • a storage bucket called "uploads" for photos and logos
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.records (
  entity        text        not null,              -- e.g. 'InventoryItem'
  id            text        not null,
  data          jsonb       not null default '{}'::jsonb,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by    text,                              -- email of the creator
  primary key (entity, id)
);

create index if not exists records_entity_created_idx
  on public.records (entity, created_date desc);

create index if not exists records_data_idx
  on public.records using gin (data jsonb_path_ops);

create table if not exists public.profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  email             text        not null,
  full_name         text,
  role              text        not null default 'user'
                                check (role in ('admin', 'user')),
  role_id           text,                          -- id of a UserRole record
  account_status    text        not null default 'active'
                                check (account_status in ('active', 'expired', 'disabled')),
  role_assigned_at  timestamptz default now(),
  data              jsonb       not null default '{}'::jsonb,   -- phone, sidebar order, …
  created_date      timestamptz not null default now(),
  updated_date      timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));


-- ----------------------------------------------------------------------------
-- 2. Helper functions used by the rules below
-- ----------------------------------------------------------------------------

-- Turns text into a date, or returns nothing if the text is not a date.
create or replace function public.try_timestamptz(p_text text)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_text::timestamptz;
exception when others then
  return null;
end;
$$;

-- Is the person making this request signed in with an active account?
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

-- Does the person's role include a permission? Administrators have them all.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.records r
      on r.entity = 'UserRole' and r.id = p.role_id
    where p.id = auth.uid()
      and p.account_status = 'active'
      and (
        p.role = 'admin'
        or coalesce(r.data -> 'permissions', '[]'::jsonb) ? p_permission
      )
  );
$$;

-- Administrators: the first account, the built-in Admin role, or any role
-- that includes the "manage_users" permission.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('manage_users');
$$;

-- May the person add / change / delete records of this type?
create or replace function public.can_write_entity(p_entity text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
     and case
           when p_entity in ('UserRole', 'UserInvitation') then public.is_admin()
           when p_entity = 'AppSettings' then public.has_permission('manage_settings')
           else true
         end;
$$;


-- ----------------------------------------------------------------------------
-- 3. Access rules (row level security)
-- ----------------------------------------------------------------------------

alter table public.records  enable row level security;
alter table public.profiles enable row level security;

-- People who are not signed in get nothing.
revoke all on public.records  from anon;
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "records_select" on public.records;
create policy "records_select" on public.records
  for select to authenticated
  using (
    (select public.is_active_user())
    and (entity <> 'UserInvitation' or (select public.is_admin()))
  );

drop policy if exists "records_insert" on public.records;
create policy "records_insert" on public.records
  for insert to authenticated
  with check (public.can_write_entity(entity));

-- The activity log is append-only: anyone may add entries, but only an
-- administrator may change or remove them (for restoring a backup).
drop policy if exists "records_update" on public.records;
create policy "records_update" on public.records
  for update to authenticated
  using (public.can_write_entity(entity) and (entity <> 'ActivityLog' or (select public.is_admin())))
  with check (public.can_write_entity(entity) and (entity <> 'ActivityLog' or (select public.is_admin())));

drop policy if exists "records_delete" on public.records;
create policy "records_delete" on public.records
  for delete to authenticated
  using (public.can_write_entity(entity) and (entity <> 'ActivityLog' or (select public.is_admin())));

-- New records are stamped with the signed-in person's email, so nobody can add
-- records (or activity log entries) in someone else's name. Administrators
-- restoring a backup keep the original names.
create or replace function public.stamp_record_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_email <> '' and not public.is_admin() then
    new.created_by := v_email;
    if new.entity = 'ActivityLog' then
      new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{user_email}', to_jsonb(v_email));
      new.created_date := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists records_stamp_creator on public.records;
create trigger records_stamp_creator
  before insert on public.records
  for each row execute function public.stamp_record_creator();
revoke execute on function public.stamp_record_creator() from public, anon, authenticated;

-- Everyone can read their own profile; active people can see the staff list.
-- Profiles are only ever changed through update_profile() below.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (select public.is_active_user()));


-- ----------------------------------------------------------------------------
-- 4. Functions the app calls
-- ----------------------------------------------------------------------------

-- Change some fields of a record and keep the rest (so two people editing
-- different fields at the same time do not overwrite each other).
create or replace function public.update_record(p_entity text, p_id text, p_patch jsonb)
returns public.records
language sql
security invoker
set search_path = public
as $$
  update public.records
     set data = data || coalesce(p_patch, '{}'::jsonb),
         updated_date = now()
   where entity = p_entity
     and id = p_id
  returning *;
$$;

-- Change a profile. People may change their own name and preferences;
-- only administrators may change roles or account status.
create or replace function public.update_profile(
  p_id uuid,
  p_columns jsonb default '{}'::jsonb,
  p_data jsonb default '{}'::jsonb
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid    := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_columns  jsonb   := coalesce(p_columns, '{}'::jsonb);
  v_old      public.profiles;
  v_new      public.profiles;
  v_self_expiry boolean;
begin
  if v_caller is null then
    raise exception 'You are not signed in.' using errcode = '28000';
  end if;

  select * into v_old from public.profiles where id = p_id for update;
  if not found then
    raise exception 'That user was not found.' using errcode = 'P0002';
  end if;

  if p_id <> v_caller and not v_is_admin then
    raise exception 'Only an administrator can change other people''s accounts.'
      using errcode = '42501';
  end if;

  -- The app marks an account "expired" by itself when a time-limited role
  -- runs out; that one change is allowed without being an administrator.
  v_self_expiry := p_id = v_caller
               and v_old.account_status = 'active'
               and v_columns = jsonb_build_object('account_status', 'expired');

  if (v_columns ?| array['role_id', 'account_status', 'role_assigned_at', 'email'])
     and not v_is_admin
     and not v_self_expiry then
    raise exception 'Only an administrator can change roles or account status.'
      using errcode = '42501';
  end if;

  if p_id = v_caller and not v_is_admin and not v_self_expiry
     and v_old.account_status <> 'active' then
    raise exception 'This account is not active.' using errcode = '42501';
  end if;

  v_new := v_old;

  if v_columns ? 'full_name' then
    v_new.full_name := v_columns ->> 'full_name';
  end if;
  if v_columns ? 'role_id' then
    v_new.role_id := v_columns ->> 'role_id';
    -- The built-in Admin role and the administrator flag always go together.
    v_new.role := case when v_new.role_id = 'role_admin' then 'admin' else 'user' end;
    v_new.role_assigned_at := now();
  end if;
  if v_columns ? 'role_assigned_at' then
    v_new.role_assigned_at := coalesce(public.try_timestamptz(v_columns ->> 'role_assigned_at'), now());
  end if;
  if v_columns ? 'account_status' then
    v_new.account_status := v_columns ->> 'account_status';
  end if;

  v_new.data := v_old.data || coalesce(p_data, '{}'::jsonb);
  v_new.updated_date := now();

  -- Never leave the app without an active administrator.
  if v_old.role = 'admin' and v_old.account_status = 'active'
     and not (v_new.role = 'admin' and v_new.account_status = 'active') then
    if (select count(*) from public.profiles
         where role = 'admin' and account_status = 'active') <= 1 then
      raise exception 'This is the only active administrator, so it cannot be demoted or disabled.'
        using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
     set full_name        = v_new.full_name,
         role             = v_new.role,
         role_id          = v_new.role_id,
         account_status   = v_new.account_status,
         role_assigned_at = v_new.role_assigned_at,
         data             = v_new.data,
         updated_date     = v_new.updated_date
   where id = p_id
  returning * into v_new;

  return v_new;
end;
$$;

-- Lets an administrator give someone a new password (for example when they
-- have forgotten theirs and password-reset emails are not set up).
create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can set someone else''s password.'
      using errcode = '42501';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Please choose a password with at least 6 characters.'
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That user was not found.' using errcode = 'P0002';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_user_id;

  return true;
end;
$$;

-- True until the first account exists (the sign-in screen then offers
-- "create the administrator account").
create or replace function public.app_needs_setup()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles);
$$;

-- Can this email address create an account right now?
create or replace function public.check_invitation(p_email text)
returns table (allowed boolean, first_user boolean, role_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.records;
begin
  if not exists (select 1 from public.profiles) then
    return query select true, true, 'Admin'::text;
    return;
  end if;

  select * into v_invite
    from public.records r
   where r.entity = 'UserInvitation'
     and lower(r.data ->> 'email') = lower(trim(p_email))
     and coalesce(r.data ->> 'status', 'pending') = 'pending'
     and (r.data ->> 'expires_at' is null
          or coalesce(public.try_timestamptz(r.data ->> 'expires_at'), now() + interval '1 day') > now())
   order by r.created_date desc
   limit 1;

  if found then
    return query select true, false, (v_invite.data ->> 'role_name')::text;
  else
    return query select false, false, null::text;
  end if;
end;
$$;

-- The app's name and logo for the sign-in screen (readable before signing in).
create or replace function public.public_app_info()
returns table (app_name text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select r.data ->> 'appName', r.data ->> 'logoUrl'
    from public.records r
   where r.entity = 'AppSettings'
   order by r.created_date asc
   limit 1;
$$;


-- ----------------------------------------------------------------------------
-- 5. New accounts: first person = administrator, everyone else by invitation
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
  v_invite   public.records;
  v_role_id  text;
  v_name     text;
begin
  -- One sign-up at a time, so two people cannot both become "the first".
  perform pg_advisory_xact_lock(hashtext('theatre_inventory_signup'));

  v_is_first := not exists (select 1 from public.profiles);
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  if v_is_first then
    v_role_id := 'role_admin';
  else
    select * into v_invite
      from public.records r
     where r.entity = 'UserInvitation'
       and lower(r.data ->> 'email') = lower(new.email)
       and coalesce(r.data ->> 'status', 'pending') = 'pending'
       and (r.data ->> 'expires_at' is null
            or coalesce(public.try_timestamptz(r.data ->> 'expires_at'), now() + interval '1 day') > now())
     order by r.created_date desc
     limit 1;

    if not found then
      raise exception 'This email address has not been invited.' using errcode = 'P0001';
    end if;

    v_role_id := coalesce(nullif(v_invite.data ->> 'role_id', ''), 'role_user');

    update public.records
       set data = data || jsonb_build_object('status', 'accepted', 'accepted_at', to_jsonb(now())),
           updated_date = now()
     where entity = 'UserInvitation'
       and id = v_invite.id;
  end if;

  insert into public.profiles (id, email, full_name, role, role_id, account_status, role_assigned_at)
  values (
    new.id,
    lower(new.email),
    coalesce(v_name, split_part(new.email, '@', 1)),
    case when v_role_id = 'role_admin' then 'admin' else 'user' end,
    v_role_id,
    'active',
    now()
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 6. Who may call which function
-- ----------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.update_record(text, text, jsonb) from public, anon;
revoke all on function public.update_profile(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.update_record(text, text, jsonb) to authenticated;
grant execute on function public.update_profile(uuid, jsonb, jsonb) to authenticated;

grant execute on function public.try_timestamptz(text)      to anon, authenticated;
grant execute on function public.is_active_user()           to anon, authenticated;
grant execute on function public.has_permission(text)       to anon, authenticated;
grant execute on function public.is_admin()                 to anon, authenticated;
grant execute on function public.can_write_entity(text)     to anon, authenticated;
grant execute on function public.app_needs_setup()          to anon, authenticated;
grant execute on function public.check_invitation(text)     to anon, authenticated;
grant execute on function public.public_app_info()          to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 7. The two built-in roles
-- ----------------------------------------------------------------------------

insert into public.records (entity, id, data, created_by)
values
  (
    'UserRole', 'role_admin',
    jsonb_build_object(
      'name', 'Admin',
      'description', 'Full access to everything, including users, roles and settings.',
      'permissions', jsonb_build_array(
        'manage_users', 'manage_settings', 'create_items', 'edit_items', 'delete_items',
        'view_items', 'manage_categories', 'manage_locations', 'manage_containers',
        'manage_borrowed_items', 'print_labels', 'manage_expendables',
        'manage_rentals', 'delete_rentals'
      ),
      'is_system_role', true,
      'is_active', true,
      'duration_days', 0
    ),
    'system'
  ),
  (
    'UserRole', 'role_user',
    jsonb_build_object(
      'name', 'User',
      'description', 'Basic user role with standard permissions',
      'permissions', jsonb_build_array('view_items', 'create_items', 'edit_items', 'print_labels'),
      'is_system_role', true,
      'is_active', true,
      'duration_days', 0
    ),
    'system'
  )
on conflict (entity, id) do nothing;

-- Remove permissions left over from features the app no longer has
-- (voice channels, messages, call board, front of house, box office,
-- productions, reports) from any role that still lists them.
update public.records
set data = jsonb_set(
  data, '{permissions}',
  coalesce((
    select jsonb_agg(p)
    from jsonb_array_elements_text(data->'permissions') as p
    where p in (
      'manage_users', 'manage_settings', 'create_items', 'edit_items', 'delete_items',
      'view_items', 'manage_categories', 'manage_locations', 'manage_containers',
      'manage_borrowed_items', 'print_labels', 'manage_expendables',
      'manage_rentals', 'delete_rentals'
    )
  ), '[]'::jsonb)
)
where entity = 'UserRole'
  and jsonb_typeof(data->'permissions') = 'array'
  and exists (
    select 1 from jsonb_array_elements_text(data->'permissions') as p
    where p not in (
      'manage_users', 'manage_settings', 'create_items', 'edit_items', 'delete_items',
      'view_items', 'manage_categories', 'manage_locations', 'manage_containers',
      'manage_borrowed_items', 'print_labels', 'manage_expendables',
      'manage_rentals', 'delete_rentals'
    )
  );


-- ----------------------------------------------------------------------------
-- 8. Storage for photos and logos
--
--    The bucket is "public": anyone who has a photo's exact web address can
--    view it (the addresses are long and random). Only signed-in, active
--    people can upload, and only pictures up to 15 MB are accepted.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads', 'uploads', true, 15728640,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "uploads_insert" on storage.objects;
create policy "uploads_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (select public.is_active_user()));

-- Tell the API layer to pick up the new tables and functions right away.
notify pgrst, 'reload schema';

-- Done. Open the app: the first account you create becomes the administrator.
