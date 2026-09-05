-- IMPACTONE backend schema (Supabase/Postgres)
create extension if not exists pgcrypto;

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  source text default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null,
  page_url text,
  name text not null check (char_length(name) between 1 and 30),
  body text not null check (char_length(body) between 1 and 1000),
  parent_id uuid references public.comments(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','hidden','deleted')),
  likes integer not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_issue_status_idx on public.comments(issue_key,status,pinned desc,created_at desc);

-- Browser clients never write directly to these tables in V2.
-- Edge Functions use the service-role key, so keep public table access closed.
alter table public.subscribers enable row level security;
alter table public.comments enable row level security;

revoke all on public.subscribers from anon, authenticated;
revoke all on public.comments from anon, authenticated;
