-- HabitaBull · crew backend
--
-- Run this once in the Supabase SQL editor. It is the whole server side.
--
-- Two rules shape every table here, and they come from the research rather than
-- from convenience:
--
--   1. A check-in records THAT you trained, never WHAT you lifted. The 2023
--      leaderboard ranked people by load and would have shamed exactly the
--      beginner the deck was written for. There is deliberately no weight, no
--      volume and no rep column in this schema. It cannot leak what it does not
--      store.
--
--   2. Identity is a device key, not an account. No email, no password, no
--      profile. The only personal thing stored is a display name someone types
--      for themselves, and a photo they explicitly choose to share.

create extension if not exists "pgcrypto";

-- ── crews ────────────────────────────────────────────────────────────────────
create table if not exists crews (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (char_length(code) = 6),
  created_at  timestamptz not null default now()
);

-- ── members ──────────────────────────────────────────────────────────────────
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null references crews(id) on delete cascade,
  device_id   text not null,
  name        text not null default 'Someone' check (char_length(name) <= 40),
  joined_at   timestamptz not null default now(),
  unique (crew_id, device_id)
);
create index if not exists members_crew on members(crew_id);

-- ── check-ins ────────────────────────────────────────────────────────────────
-- One row per member per day. No load, no reps, on purpose.
create table if not exists checkins (
  member_id   uuid not null references members(id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (member_id, day)
);
create index if not exists checkins_day on checkins(day);

-- ── shared photos ────────────────────────────────────────────────────────────
-- Only rows that exist here are shared; everything else stays in IndexedDB on
-- the device and never reaches this server.
create table if not exists photos (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  day         date not null,
  path        text not null,               -- object path in the `crew-photos` bucket
  caption     text check (char_length(caption) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists photos_day on photos(day);

-- ── reactions ────────────────────────────────────────────────────────────────
-- A like, or a short reply. Nothing threaded: a gym app does not need a forum.
create table if not exists reactions (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references photos(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  kind        text not null check (kind in ('like', 'reply')),
  body        text check (char_length(body) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists reactions_photo on reactions(photo_id);

-- One like per person per photo. A partial index rather than a table-level
-- unique: replies are deliberately unconstrained, and `nulls not distinct`
-- would tie this file to Postgres 15.
create unique index if not exists reactions_one_like
  on reactions(photo_id, member_id) where kind = 'like';

-- ── storage ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('crew-photos', 'crew-photos', false)
on conflict (id) do nothing;

-- ── access ───────────────────────────────────────────────────────────────────
-- Every write goes through the app's own API routes, which hold the service
-- key server-side and check crew membership before touching a row. The anon
-- key therefore gets no direct table access at all: RLS is on and no policy
-- grants it. This is the simplest arrangement that cannot leak one crew's
-- photos to another.
alter table crews      enable row level security;
alter table members    enable row level security;
alter table checkins   enable row level security;
alter table photos     enable row level security;
alter table reactions  enable row level security;
