-- WeWorkWeekend schema (Track 3 owns this; see lib/types.ts for the TS mirror)

create extension if not exists pgcrypto;

-- Offices --------------------------------------------------------------
create table public.offices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  crew_size   int  not null default 1,
  dirt_score  int  not null default 0 check (dirt_score between 0 and 10),
  status      text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  photo_urls  text[] not null default '{}',           -- landlord's "before" scan photos
  created_at  timestamptz not null default now()
);

-- Tasks ----------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  office_id     uuid not null references public.offices(id) on delete cascade,
  room          text not null,
  title         text not null,
  category      text not null check (category in ('toilet','kitchen','bins','floor','desks','furniture_reset')),
  credit_hours  numeric(4,1) not null,
  before_url    text not null,                          -- the photo this task was found in
  status        text not null default 'open' check (status in ('open','claimed','done')),
  claimed_by    text,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index tasks_office_idx on public.tasks(office_id);
create index tasks_claimed_by_idx on public.tasks(claimed_by);

-- Verifications (one per after-photo attempt) ---------------------------
create table public.verifications (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks(id) on delete cascade,
  founder           text,
  after_url         text not null,
  passed            boolean not null,
  confidence        numeric(4,3) not null default 0,
  reasons           text[] not null default '{}',
  remaining_issues  text[] not null default '{}',
  same_place        boolean,
  model             text not null,
  model_call_id     uuid,
  review            text not null default 'pending' check (review in ('pending','approved','overturned')),
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index verifications_task_idx on public.verifications(task_id);
create index verifications_review_idx on public.verifications(review);

-- Credits (the ledger) -------------------------------------------------
create table public.credits (
  id                   uuid primary key default gen_random_uuid(),
  founder              text not null,
  hours                numeric(4,1) not null,
  verification_id      uuid not null unique references public.verifications(id) on delete cascade,
  supervisor_approved  boolean not null default false,
  created_at           timestamptz not null default now()
);
create index credits_founder_idx on public.credits(founder);

-- Desk bookings (spending credit hours) --------------------------------
create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  founder     text not null,
  office_id   uuid not null references public.offices(id) on delete cascade,
  hours       numeric(4,1) not null check (hours > 0),
  date        date not null,
  created_at  timestamptz not null default now()
);
create index bookings_founder_idx on public.bookings(founder);

-- Model call log (server-only) ------------------------------------------
create table public.model_calls (
  id          uuid primary key default gen_random_uuid(),
  route       text not null,
  model       text not null,
  request     jsonb,
  response    jsonb,
  raw         text,
  latency_ms  int,
  error       text,
  created_at  timestamptz not null default now()
);

-- Atomic claim: returns the row only if it was still open ---------------
create or replace function public.claim_task(p_task_id uuid, p_founder text)
returns setof public.tasks
language sql
security definer
set search_path = public
as $$
  update public.tasks
     set status = 'claimed', claimed_by = p_founder, claimed_at = now()
   where id = p_task_id and status = 'open'
  returning *;
$$;

-- Balance per founder ----------------------------------------------------
create or replace function public.founder_balance(p_founder text)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((select sum(hours) from public.credits  where founder = p_founder), 0)
       - coalesce((select sum(hours) from public.bookings where founder = p_founder), 0);
$$;

-- RLS: no auth in this hackathon, so anon may read/write app tables.
-- Credits/verifications are written only by the server (service role).
alter table public.offices       enable row level security;
alter table public.tasks         enable row level security;
alter table public.verifications enable row level security;
alter table public.credits       enable row level security;
alter table public.bookings      enable row level security;
alter table public.model_calls   enable row level security;

create policy "anon all offices"  on public.offices  for all to anon, authenticated using (true) with check (true);
create policy "anon all tasks"    on public.tasks    for all to anon, authenticated using (true) with check (true);
create policy "anon all bookings" on public.bookings for all to anon, authenticated using (true) with check (true);
create policy "anon read verifications" on public.verifications for select to anon, authenticated using (true);
create policy "anon read credits"       on public.credits       for select to anon, authenticated using (true);
-- model_calls: no policy -> service role only.

grant execute on function public.claim_task(uuid, text)   to anon, authenticated;
grant execute on function public.founder_balance(text)    to anon, authenticated;

-- Storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

create policy "photos public read"  on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "photos anon upload"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'photos');
