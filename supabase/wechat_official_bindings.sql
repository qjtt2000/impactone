-- Execute once in Supabase SQL Editor. This is separate from website subscriptions.
create table if not exists public.wechat_official_bindings (
  client_id text primary key,
  official_openid text not null,
  updated_at timestamptz not null default now()
);
create index if not exists wechat_official_bindings_openid_idx on public.wechat_official_bindings(official_openid);
alter table public.wechat_official_bindings enable row level security;
revoke all on public.wechat_official_bindings from anon, authenticated;
