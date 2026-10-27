create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  student_id text not null unique check (length(trim(student_id)) between 3 and 32),
  email text not null default '',
  course_dept text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists course_dept text not null default '';
alter table public.profiles add column if not exists is_admin boolean not null default false;

create unique index if not exists profiles_student_id_lower_idx
  on public.profiles (lower(student_id));

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_type text not null check (report_type in ('lost', 'found')),
  full_name text not null,
  student_id text not null,
  course_dept text not null default '',
  year_section text not null default '',
  contact_number text not null,
  email text not null default '',
  item_name text not null,
  category text not null,
  brand text not null default '',
  color text not null default '',
  description text not null,
  image_url text,
  event_date date not null,
  building_area text not null,
  approx_time text not null default '',
  specific_location text not null default '',
  remarks text not null default '',
  agreed_to_contact boolean not null default false,
  certified_true boolean not null default false check (certified_true),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports add column if not exists updated_at timestamptz not null default now();
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'approved', 'claimed', 'resolved', 'rejected'));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_type_created_at_idx on public.reports (report_type, created_at desc);
create index if not exists reports_category_idx on public.reports (category);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  profile_student_id text := lower(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')));
begin
  if profile_name = '' or profile_student_id !~ '^[a-z0-9-]{3,32}$' then
    raise exception 'Valid full_name and student_id metadata are required';
  end if;

  insert into public.profiles (id, full_name, student_id, email, course_dept)
  values (
    new.id,
    profile_name,
    profile_student_id,
    lower(trim(coalesce(new.raw_user_meta_data ->> 'contact_email', ''))),
    trim(coalesce(new.raw_user_meta_data ->> 'course_dept', ''))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.profiles as profile
set email = lower(trim(coalesce(auth_user.raw_user_meta_data ->> 'contact_email', ''))),
    course_dept = trim(coalesce(auth_user.raw_user_meta_data ->> 'course_dept', ''))
from auth.users as auth_user
where profile.id = auth_user.id
  and (profile.email = '' or profile.course_dept = '');

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() and (
    new.is_admin is distinct from old.is_admin
    or new.id is distinct from old.id
    or new.student_id is distinct from old.student_id
    or new.email is distinct from old.email
    or new.course_dept is distinct from old.course_dept
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only administrators can change administrator access';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin_flag on public.profiles;
create trigger protect_profile_admin_flag
  before update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

create or replace function public.notify_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_message text;
begin
  if new.status is distinct from old.status then
    status_message := case new.status
      when 'claimed' then 'Your item was marked as claimed.'
      when 'resolved' then 'Your item was marked as resolved.'
      when 'approved' then 'Your report was approved.'
      when 'rejected' then 'Your report was rejected.'
      else 'Your report status changed to ' || new.status || '.'
    end;
    insert into public.notifications (user_id, report_id, message)
    values (new.user_id, new.id, status_message);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists report_status_notification on public.reports;
create trigger report_status_notification
  before update on public.reports
  for each row execute function public.notify_report_status_change();

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "Users can submit their own reports" on public.reports;
create policy "Users can submit their own reports"
  on public.reports for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and certified_true = true
    and status = 'pending'
  );

drop policy if exists "Users can read their own reports" on public.reports;
create policy "Users can read their own reports"
  on public.reports for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Owners and admins can update reports" on public.reports;
create policy "Owners and admins can update reports"
  on public.reports for update to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()))
  with check ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Owners and admins can delete reports" on public.reports;
create policy "Owners and admins can delete reports"
  on public.reports for delete to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.profiles from anon, authenticated;
grant select, update, delete on public.profiles to authenticated;
revoke all on public.reports from anon, authenticated;
grant insert, select, update, delete on public.reports to authenticated;
revoke all on public.notifications from anon, authenticated;
grant select, update (read_at) on public.notifications to authenticated;

-- This intentionally exposes only non-contact fields to the community feed.
create or replace view public.public_reports
with (security_barrier = true)
as
  select id, report_type, item_name, category, description, image_url,
         event_date, building_area, specific_location, status, created_at
  from public.reports
  where status in ('pending', 'approved');

revoke all on public.public_reports from public, anon, authenticated;
grant select on public.public_reports to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view report photos" on storage.objects;
create policy "Anyone can view report photos"
  on storage.objects for select to public
  using (bucket_id = 'item-photos');

drop policy if exists "Signed-in users upload photos to their folder" on storage.objects;
create policy "Signed-in users upload photos to their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Signed-in users delete photos from their folder" on storage.objects;
create policy "Signed-in users delete photos from their folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Admins delete report photos" on storage.objects;
create policy "Admins delete report photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and (select public.is_admin())
  );
