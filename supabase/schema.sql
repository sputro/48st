-- =========================================================
-- 48ST FAN HUB — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  wallet_balance numeric(12,2) not null default 0,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);

create policy "Profiles are editable by owner"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- 2. NEWS (public read-only, written only by service_role)
-- ---------------------------------------------------------
create table if not exists public.news (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  excerpt text,
  content text,
  image_url text,
  category text default 'Pengumuman',
  source_url text unique,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.news enable row level security;
create policy "News is public read" on public.news for select using (true);

-- ---------------------------------------------------------
-- 3. SCHEDULES (public read-only)
-- ---------------------------------------------------------
create table if not exists public.schedules (
  id uuid primary key default uuid_generate_v4(),
  show_title text not null,
  setlist text,
  show_date date not null,
  show_time time not null,
  venue text default 'JKT48 Theater',
  poster_url text,
  ticket_status text default 'Belum Tersedia',
  ticket_url text,
  created_at timestamptz not null default now()
);
alter table public.schedules enable row level security;
create policy "Schedules is public read" on public.schedules for select using (true);

-- ---------------------------------------------------------
-- 4. STREAMS (metadata public, stream_url only usable via Edge Function)
-- ---------------------------------------------------------
create table if not exists public.streams (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  tags text[] default '{}',
  poster_url text,
  stream_url text,      -- PATH inside the private storage bucket, not a public URL
  status text not null default 'upcoming', -- live | upcoming | replay
  viewers_count int not null default 0,
  show_date date,
  show_time time,
  price numeric(12,2) default 0,
  created_at timestamptz not null default now()
);
alter table public.streams enable row level security;
create policy "Stream metadata public read" on public.streams for select using (true);

-- ---------------------------------------------------------
-- 5. TICKETS (purchased access)
-- ---------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid not null references public.streams(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  unique (user_id, stream_id)
);
alter table public.tickets enable row level security;
create policy "Users can view their own tickets"
  on public.tickets for select using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 6. WALLET TRANSACTIONS
-- ---------------------------------------------------------
create table if not exists public.wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  type text not null, -- topup | purchase | refund
  description text,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create policy "Users can view their own transactions"
  on public.wallet_transactions for select using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- 7. Secure RPC: purchase a stream ticket
-- ---------------------------------------------------------
create or replace function public.purchase_stream(p_stream_id uuid)
returns json as $$
declare
  v_price numeric;
  v_balance numeric;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select price into v_price from public.streams where id = p_stream_id;
  if v_price is null then raise exception 'Stream not found'; end if;

  select wallet_balance into v_balance from public.profiles where id = v_uid for update;
  if v_balance < v_price then raise exception 'Insufficient balance'; end if;

  update public.profiles set wallet_balance = wallet_balance - v_price where id = v_uid;

  insert into public.tickets (user_id, stream_id) values (v_uid, p_stream_id)
    on conflict do nothing;

  insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_uid, -v_price, 'purchase', 'Ticket purchase for stream ' || p_stream_id);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

revoke all on function public.purchase_stream(uuid) from public;
grant execute on function public.purchase_stream(uuid) to authenticated;

-- ---------------------------------------------------------
-- 8. ACCESS TOKENS (token-only login, invisible to clients)
-- ---------------------------------------------------------
create table if not exists public.access_tokens (
  id uuid primary key default uuid_generate_v4(),
  token_hash text unique not null,
  label text,
  scope text not null default 'all', -- 'all' or 'stream'
  stream_id uuid references public.streams(id) on delete cascade,
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.access_tokens enable row level security;
-- No policies at all -> table is invisible to anon/authenticated clients.

-- ---------------------------------------------------------
-- 9. ACCESS GRANTS
-- ---------------------------------------------------------
create table if not exists public.access_grants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'all',
  stream_id uuid references public.streams(id) on delete cascade,
  source_token_id uuid references public.access_tokens(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.access_grants enable row level security;
create policy "Users can view their own access grants"
  on public.access_grants for select using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- HOW TO GENERATE A NEW ACCESS TOKEN (run manually as admin):
-- insert into public.access_tokens (token_hash, label, scope, max_uses, expires_at)
-- values (encode(digest('KODE-TOKEN-RAHASIA', 'sha256'), 'hex'),
--         'Paket All Access', 'all', 1, now() + interval '30 days');
-- ---------------------------------------------------------

-- ---------------------------------------------------------
-- 10. TOPUP REQUESTS — tracks DOKU QRIS top-up transactions.
--    Created by create-topup Edge Function, updated by doku-webhook
--    (or check-topup-status polling) when payment is confirmed.
--    Client can only ever READ its own rows — status changes and the
--    wallet_balance increment both happen server-side only.
-- ---------------------------------------------------------
create table if not exists public.topup_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_reference_no text unique not null,  -- our own transaction id, sent to DOKU
  doku_reference_no text,                     -- DOKU's referenceNo from generate response
  amount numeric(12,2) not null,
  qr_content text,                            -- raw QRIS string, rendered as QR code client-side
  status text not null default 'pending',     -- pending | paid | expired | failed | cancelled
  approval_code text,                         -- DOKU's approvalCode once paid, used for refund reference
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.topup_requests enable row level security;

create policy "Users can view their own topup requests"
  on public.topup_requests for select
  using (auth.uid() = user_id);
-- No insert/update policy -> only service_role (Edge Functions) can write.

-- ---------------------------------------------------------
-- 11. Secure RPC: confirm a topup (called only by doku-webhook / check-topup-status
--     with the service_role key, never directly by the client)
-- ---------------------------------------------------------
create or replace function public.confirm_topup(p_partner_reference_no text, p_doku_reference_no text, p_approval_code text)
returns json as $$
declare
  v_req record;
begin
  select * into v_req from public.topup_requests where partner_reference_no = p_partner_reference_no for update;

  if v_req is null then
    raise exception 'Topup request not found';
  end if;

  if v_req.status = 'paid' then
    return json_build_object('success', true, 'already_processed', true);
  end if;

  update public.topup_requests
    set status = 'paid', paid_at = now(), doku_reference_no = p_doku_reference_no, approval_code = p_approval_code
    where id = v_req.id;

  update public.profiles set wallet_balance = wallet_balance + v_req.amount where id = v_req.user_id;

  insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_req.user_id, v_req.amount, 'topup', 'QRIS top up via DOKU (' || p_partner_reference_no || ')');

  return json_build_object('success', true, 'already_processed', false);
end;
$$ language plpgsql security definer;

revoke all on function public.confirm_topup(text, text, text) from public;
grant execute on function public.confirm_topup(text, text, text) to service_role;
-- Intentionally NOT granted to `authenticated` — only callable via service_role
-- (i.e. from inside an Edge Function), so a client can never self-credit its wallet.
