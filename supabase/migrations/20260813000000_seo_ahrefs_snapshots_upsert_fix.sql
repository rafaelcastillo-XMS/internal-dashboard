-- Fix upsert on seo_ahrefs_snapshots: RunAhrefsCard.saveBaseline() upserts on
-- (client, domain, snapshot_date). Unique constraint on those columns already
-- exists; the on-conflict path is an UPDATE, which had no RLS policy.

create policy "anon update on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for update
  to anon using (true) with check (true);

create policy "authenticated update on seo_ahrefs_snapshots"
  on public.seo_ahrefs_snapshots for update
  to authenticated using (true) with check (true);
