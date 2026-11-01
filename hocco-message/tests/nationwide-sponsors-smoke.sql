begin;
do $test$
declare uf text; payload jsonb; s public.hm_sponsors; retry public.hm_sponsors; count_ok integer:=0; price integer;
begin
 select price_cents into price from public.hm_sponsor_settings where id=1;
 foreach uf in array array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] loop
 payload:=jsonb_build_object('city','Teste Nacional Isolado','state_code',uf,'expected_price',price,'p_code','HC-SP-'||upper(substr(md5('national-smoke-'||uf),1,12)),'p_tracking_hash',md5('national1-'||uf)||md5('national2-'||uf),'p_company_name','Teste Nacional Isolado','p_cnpj','11222333000181','p_legal_name','Teste Nacional Isolado Ltda','p_category','Tecnologia','p_company_description','Empresa de teste isolado com rollback integral.','p_contact_name','Teste','p_email','teste@example.com','p_phone','','p_logo_url','https://example.com/logo.png','p_cover_url','https://example.com/cover.png','p_destination_url','https://example.com','p_community_offer','','p_sponsor_terms_version','2026-10-19.patrocinio.v3','p_thank_you_opt_in',false,'p_expiry_notice_opt_in',false,'p_renewal_of',null);
 s:=public.hm_create_sponsor_local(payload);
 assert s.state_code=uf and s.city='Teste Nacional Isolado' and s.payment='pending' and s.review='pending' and s.price_cents=price and s.starts_at is null,'National signup must preserve location, price and unpaid curation';
 retry:=public.hm_create_sponsor_local(payload);assert retry.id=s.id,'Retry must return original purchase';
 count_ok:=count_ok+1;
 end loop;
 assert count_ok=27;
 assert not has_function_privilege('anon','public.hm_create_sponsor_local(jsonb)','execute');
 assert not has_function_privilege('authenticated','public.hm_create_sponsor_local(jsonb)','execute');
end $test$;
select '27 UFs accepted; retry, payment, curation and permissions preserved; all test data rolled back' as verification;
rollback;
