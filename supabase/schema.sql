-- IMPACTONE backend schema (Supabase/Postgres) — V3.1
create extension if not exists pgcrypto;

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  source text default 'daily',
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscribers_unsubscribe_token_idx on public.subscribers(unsubscribe_token);

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

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null,
  client_id text not null,
  page_url text,
  created_at timestamptz not null default now(),
  unique(issue_key, client_id)
);
create index if not exists favorites_issue_idx on public.favorites(issue_key,created_at desc);

alter table public.subscribers enable row level security;
alter table public.comments enable row level security;
alter table public.favorites enable row level security;
revoke all on public.subscribers from anon, authenticated;
revoke all on public.comments from anon, authenticated;
revoke all on public.favorites from anon, authenticated;
