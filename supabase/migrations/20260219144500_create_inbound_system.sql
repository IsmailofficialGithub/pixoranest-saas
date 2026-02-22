
-- 1. Inbound Numbers Table (Managed by Super Admin)
create table if not exists public.inbound_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number varchar(50) not null unique,
  country_code varchar(10) default '+1',
  label varchar(255),
  provider varchar(100), -- Twilio, Vonage, etc.
  assigned_user_id uuid, -- Reference to the client (auth.users)
  status varchar(50) default 'available', -- available, assigned, maintenance
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint inbound_numbers_assigned_user_id_fkey foreign key (assigned_user_id) references auth.users(id) on delete set null
);

-- 2. Inbound Agents Table (Configured by the assigned User)
create table if not exists public.inbound_agents (
  id uuid primary key default gen_random_uuid(),
  number_id uuid not null unique,
  owner_user_id uuid not null,
  name varchar(255) not null,
  greeting_message text,
  system_prompt text,
  voice_id varchar(100) default 'aura-helena-en',
  model varchar(50) default 'gpt-4o',
  tone varchar(50) default 'professional',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint inbound_agents_number_id_fkey foreign key (number_id) references public.inbound_numbers(id) on delete cascade,
  constraint inbound_agents_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete cascade
);

-- 3. Inbound Call Logs Table
create table if not exists public.inbound_call_logs (
  id uuid primary key default gen_random_uuid(),
  number_id uuid not null,
  owner_user_id uuid not null,
  agent_id uuid, -- Can be null if no agent was configured yet
  caller_number varchar(50),
  call_status varchar(50), -- answered, missed, failed, busy
  duration numeric default 0,
  transcript text,
  recording_url text,
  summary text,
  is_lead boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint inbound_call_logs_number_id_fkey foreign key (number_id) references public.inbound_numbers(id) on delete cascade,
  constraint inbound_call_logs_owner_user_id_fkey foreign key (owner_user_id) references auth.users(id) on delete cascade,
  constraint inbound_call_logs_agent_id_fkey foreign key (agent_id) references public.inbound_agents(id) on delete set null
);

-- Enable RLS
alter table public.inbound_numbers enable row level security;
alter table public.inbound_agents enable row level security;
alter table public.inbound_call_logs enable row level security;

-- Policies for inbound_numbers
create policy "Admins can do everything on inbound_numbers" 
  on public.inbound_numbers for all to authenticated using (true) with check (true);

-- Policies for inbound_agents
create policy "Users can manage their own agents" 
  on public.inbound_agents for all to authenticated 
  using (owner_user_id = auth.uid()) 
  with check (owner_user_id = auth.uid());

-- Policies for inbound_call_logs
create policy "Users can view their own inbound call logs" 
  on public.inbound_call_logs for select to authenticated 
  using (owner_user_id = auth.uid());

create policy "Users can delete their own inbound call logs" 
  on public.inbound_call_logs for delete to authenticated 
  using (owner_user_id = auth.uid());

-- Add updated_at triggers
create trigger set_updated_at before update on public.inbound_numbers
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.inbound_agents
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.inbound_call_logs
  for each row execute function public.update_updated_at_column();

-- Indexes for performance
create index idx_inbound_numbers_assigned_user on public.inbound_numbers(assigned_user_id);
create index idx_inbound_agents_number on public.inbound_agents(number_id);
create index idx_inbound_call_logs_owner on public.inbound_call_logs(owner_user_id);
create index idx_inbound_call_logs_number on public.inbound_call_logs(number_id);
create index idx_inbound_call_logs_created_at on public.inbound_call_logs(created_at desc);

-- Seed Inbound Service
insert into public.services (name, slug, description, category, icon_url, is_active, base_pricing_model, base_price)
values ('AI Inbound Agent', 'ai-inbound', 'AI-powered receptionist to handle all your incoming calls.', 'voice', 'phone-incoming', true, 'monthly', 0)
on conflict (slug) do update set 
  name = excluded.name,
  description = excluded.description,
  icon_url = excluded.icon_url;

