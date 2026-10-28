-- Create your admin user in Supabase Authentication first, then replace the
-- UUID below with that user's Auth user ID before running this script.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = 'REPLACE_WITH_ADMIN_USER_UUID'::uuid
$$;

grant execute on function public.is_site_admin() to authenticated;
revoke all on function public.is_site_admin() from public, anon;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text unique,
  kind text not null check (kind in ('video', 'image', 'sale')),
  title text not null,
  description text not null default '',
  category text not null default '',
  media_url text not null default '',
  thumbnail_url text not null default '',
  link_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_content
add column if not exists thumbnail_url text not null default '';

alter table public.site_content enable row level security;

create policy "Public can read site content"
on public.site_content for select
to anon, authenticated
using (true);

create policy "Only the site admin can insert content"
on public.site_content for insert
to authenticated
with check (public.is_site_admin());

create policy "Only the site admin can update content"
on public.site_content for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

create policy "Only the site admin can delete content"
on public.site_content for delete
to authenticated
using (public.is_site_admin());

create table if not exists public.site_content_state (
  kind text primary key check (kind in ('video', 'image')),
  managed boolean not null default true
);

alter table public.site_content_state enable row level security;

create policy "Public can read site content state"
on public.site_content_state for select
to anon, authenticated
using (true);

create policy "Only the site admin can manage site content state"
on public.site_content_state for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

create table if not exists public.daily_visitors (
  visitor_id uuid not null,
  visited_on date not null,
  created_at timestamptz not null default now(),
  primary key (visitor_id, visited_on)
);

alter table public.daily_visitors enable row level security;

create policy "Visitors can record today's anonymous visit"
on public.daily_visitors for insert
to anon, authenticated
with check (visited_on = (now() at time zone 'utc')::date);

create policy "Only the site admin can read visitor statistics"
on public.daily_visitors for select
to authenticated
using (public.is_site_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view site media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'site-media');

create policy "Only the site admin can upload site media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-media' and public.is_site_admin());

create policy "Only the site admin can update site media"
on storage.objects for update
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin())
with check (bucket_id = 'site-media' and public.is_site_admin());

create policy "Only the site admin can delete site media"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin());
