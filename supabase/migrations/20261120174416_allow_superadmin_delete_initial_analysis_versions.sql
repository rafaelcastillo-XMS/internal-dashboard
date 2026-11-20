begin;

grant delete on table public.seo_initial_analysis_versions to authenticated;

create policy "authorized superadmin can delete additional initial analysis versions"
  on public.seo_initial_analysis_versions for delete
  to authenticated
  using (
    position > 0
    and (select private.can_delete_audit_evidence())
  );

commit;
