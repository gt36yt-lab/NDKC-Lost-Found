create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  student_id text not null unique check (length(trim(student_id)) between 3 and 32),
  created_at timestamptz not null default now()
);

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
  status text not null default 'pending' check (status in ('pending', 'approved', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

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

  insert into public.profiles (id, full_name, student_id)
  values (new.id, profile_name, profile_student_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

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
  using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke all on public.reports from anon, authenticated;
grant insert, select on public.reports to authenticated;

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
