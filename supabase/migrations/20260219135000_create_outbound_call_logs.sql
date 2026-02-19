-- =========================
-- TABLES
-- =========================

-- Create a table for scheduled calls first as it's referenced
create table if not exists public.outbound_scheduled_calls (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid references public.outboundagents(id) on delete set null,
  list_id uuid references public.outbound_contact_lists(id) on delete set null,
  scheduled_at timestamptz not null,
  status text default 'pending', -- pending, completed, cancelled
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- The main requested table
create table if not exists public.outbound_call_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  bot_id uuid null,
  scheduled_call_id uuid null,
  contact_id uuid null,
  name varchar(255) null,
  phone varchar(50) not null,
  call_url varchar(500) null,
  agent varchar(255) null,
  call_type varchar(50) null,
  call_status varchar(50) null,
  transcript text null,
  duration numeric null,
  end_reason text null,
  started_at timestamptz null,
  ended_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_lead boolean null,
  list_id uuid null,
  scheduled_list_id uuid null,

  constraint outbound_call_logs_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete cascade,
  constraint outbound_call_logs_bot_id_fkey foreign key (bot_id) references public.outboundagents(id) on delete set null,
  constraint outbound_call_logs_scheduled_call_id_fkey foreign key (scheduled_call_id) references public.outbound_scheduled_calls(id) on delete set null,
  constraint outbound_call_logs_contact_id_fkey foreign key (contact_id) references public.outbound_contacts(id) on delete set null,
  constraint outbound_call_logs_list_id_fkey foreign key (list_id) references public.outbound_contact_lists(id) on delete set null,
  constraint outbound_call_logs_scheduled_list_id_fkey foreign key (scheduled_list_id) references public.outbound_scheduled_calls(id) on update cascade on delete set null
);

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_outbound_call_logs_owner on public.outbound_call_logs (owner_user_id);
create index if not exists idx_outbound_call_logs_bot on public.outbound_call_logs (bot_id);
create index if not exists idx_outbound_call_logs_phone on public.outbound_call_logs (phone);
create index if not exists idx_outbound_call_logs_agent on public.outbound_call_logs (agent);
create index if not exists idx_outbound_call_logs_created_at on public.outbound_call_logs (created_at desc);
create index if not exists idx_outbound_call_logs_updated_at on public.outbound_call_logs (updated_at desc);
create index if not exists idx_outbound_call_logs_status on public.outbound_call_logs (call_status);
create index if not exists idx_outbound_call_logs_type on public.outbound_call_logs (call_type);
create index if not exists idx_outbound_call_logs_scheduled_call on public.outbound_call_logs (scheduled_call_id);
create index if not exists idx_outbound_call_logs_contact on public.outbound_call_logs (contact_id);

-- =========================
-- TRIGGER
-- =========================

drop trigger if exists trigger_update_outbound_call_logs_updated_at on public.outbound_call_logs;

create trigger trigger_update_outbound_call_logs_updated_at
before update on public.outbound_call_logs
for each row
execute function public.set_updated_at();

-- =========================
-- RLS
-- =========================

alter table public.outbound_call_logs enable row level security;
alter table public.outbound_scheduled_calls enable row level security;

create policy "Allow all for authenticated users" 
  on public.outbound_call_logs for all to authenticated using (true) with check (true);

create policy "Allow all for authenticated users" 
  on public.outbound_scheduled_calls for all to authenticated using (true) with check (true);
