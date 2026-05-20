-- Prompts table
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Guidelines table
create table if not exists public.guidelines (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.prompts enable row level security;
alter table public.guidelines enable row level security;

-- Policies: any authenticated user can read and write
create policy "authenticated_all" on public.prompts
  for all to authenticated using (true) with check (true);

create policy "authenticated_all" on public.guidelines
  for all to authenticated using (true) with check (true);
