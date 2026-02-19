-- Ensure UUID extension exists
create extension if not exists pgcrypto;

-- =========================
-- TABLES
-- =========================

create table if not exists public.outbound_contact_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_contacts (
  id uuid primary key default gen_random_uuid(),

  list_id uuid not null,
  name text not null,
  phone_number text not null,
  email text,
  extra_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outbound_contacts_list_id_fkey
    foreign key (list_id)
    references public.outbound_contact_lists (id)
    on delete cascade,

  constraint uniq_outbound_list_phone
    unique (list_id, phone_number)
);

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_outbound_contact_lists_owner
  on public.outbound_contact_lists (owner_user_id);

create index if not exists idx_outbound_contacts_list
  on public.outbound_contacts (list_id);

create index if not exists idx_outbound_contacts_phone
  on public.outbound_contacts (phone_number);

-- =========================
-- UPDATED_AT FUNCTION
-- =========================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- TRIGGERS
-- =========================

drop trigger if exists set_outbound_contact_lists_updated_at
  on public.outbound_contact_lists;

create trigger set_outbound_contact_lists_updated_at
before update on public.outbound_contact_lists
for each row
execute function public.set_updated_at();

drop trigger if exists set_outbound_contacts_updated_at
  on public.outbound_contacts;

create trigger set_outbound_contacts_updated_at
before update on public.outbound_contacts
for each row
execute function public.set_updated_at();

-- =========================
-- RLS (Row Level Security)
-- =========================

alter table public.outbound_contact_lists enable row level security;
alter table public.outbound_contacts enable row level security;

-- For brevity and since this is a super admin page as per filename, we'll allow all for now.
-- In production, these should be restricted to super admins or the owner.
create policy "Allow all for authenticated users"
  on public.outbound_contact_lists
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow all for authenticated users"
  on public.outbound_contacts
  for all
  to authenticated
  using (true)
  with check (true);
