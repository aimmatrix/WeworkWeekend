-- Door scans and check-outs, so the landlord's Grok Bot feed sees them from any device.
-- Before this they only lived in the founder's (or door person's) localStorage.

create table if not exists public.visits (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid not null references public.offices(id) on delete cascade,
  founder    text not null,
  kind       text not null check (kind in ('arrived', 'left')),
  at         timestamptz not null default now()
);
create index if not exists visits_office_idx on public.visits(office_id, at);

alter table public.visits enable row level security;
create policy "anon all visits" on public.visits for all to anon, authenticated using (true) with check (true);
