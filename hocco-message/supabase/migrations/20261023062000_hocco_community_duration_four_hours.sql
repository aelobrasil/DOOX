-- Community messages remain visible for four hours after approval and payment.
-- Applied to the production Supabase project on 2026-10-23.
do $migration$
declare fn record; body text;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('hm_confirm_community_payment','hm_community_admin_action')
  loop
    body := pg_get_functiondef(fn.oid);
    body := replace(body, 'interval ''3 hours''', 'interval ''4 hours''');
    execute body;
  end loop;
end
$migration$;
