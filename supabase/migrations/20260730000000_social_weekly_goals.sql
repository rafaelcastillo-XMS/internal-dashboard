-- Weekly publishing goals for the Social module.
-- Meta Business Suite shows a weekly plan but exposes no Graph API endpoint for
-- it, so the targets are set here and progress is measured against the posts
-- the Graph API does return.
create table if not exists public.social_weekly_goals (
  id         bigint generated always as identity primary key,
  client_id  text    not null,
  metric     text    not null,
  target     integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint social_weekly_goals_uq unique (client_id, metric),
  constraint social_weekly_goals_metric_ck check (metric in ('posts', 'videos', 'shares')),
  constraint social_weekly_goals_target_ck check (target >= 0)
);

alter table public.social_weekly_goals enable row level security;

create policy "Service role full access"
  on public.social_weekly_goals
  using (true)
  with check (true);

insert into public.social_weekly_goals (client_id, metric, target)
values ('xms-ai', 'posts', 3), ('xms-ai', 'videos', 1), ('xms-ai', 'shares', 5)
on conflict (client_id, metric) do nothing;
