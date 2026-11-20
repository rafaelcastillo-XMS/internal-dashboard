begin;

-- Remove the empty test tab created for All Star Sunrooms.
delete from public.seo_initial_analysis_versions version
where version.client = 'All Star Sunrooms'
  and lower(btrim(version.title)) in ('6 months', '6 meses')
  and version.position = 1
  and not exists (
    select 1
    from public.seo_initial_audit_items item
    where item.analysis_version_id = version.id
  );

-- Every client visible in the SEO selector receives the standard analysis tabs.
insert into public.seo_initial_analysis_versions (client, title, position)
select client.name, defaults.title, defaults.position
from public.clients client
cross join (
  values
    ('Initial Analysis'::text, 0),
    ('3 months analysis'::text, 1),
    ('6 months analysis'::text, 2),
    ('12 months analysis'::text, 3)
) as defaults(title, position)
where client.status = 'active'
  and (
    nullif(btrim(client.gsc_property), '') is not null
    or nullif(btrim(client.ga4_property_id), '') is not null
  )
on conflict (client, position) do update
set title = excluded.title,
    updated_at = now();

commit;
