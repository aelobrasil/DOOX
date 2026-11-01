-- Nationwide sponsor registration; keep location, capacity, payment and curation checks.
create or replace function public.hm_create_sponsor_local(p_data jsonb) returns public.hm_sponsors language plpgsql security invoker set search_path='' as $$
declare s public.hm_sponsors; key text;
begin
 if char_length(trim(coalesce(p_data->>'city',''))) not between 2 and 80 or p_data->>'state_code' not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'Informe a cidade e a UF.';end if;
 -- Retry returns the same order with its original price and location.
 select * into s from public.hm_sponsors where tracking_hash=p_data->>'p_tracking_hash';if found then return s;end if;
 key:=public.hm_city_key(p_data->>'city',p_data->>'state_code');
 perform set_config('hocco.sponsor_city_key',key,true);
 s:=public.hm_create_sponsor(p_data->>'p_code',p_data->>'p_tracking_hash',p_data->>'p_company_name',p_data->>'p_cnpj',p_data->>'p_legal_name',p_data->>'p_category',p_data->>'p_company_description',p_data->>'p_contact_name',p_data->>'p_email',p_data->>'p_phone',p_data->>'p_logo_url',p_data->>'p_cover_url',p_data->>'p_destination_url',p_data->>'p_community_offer',p_data->>'p_sponsor_terms_version',(p_data->>'p_thank_you_opt_in')::boolean,(p_data->>'p_expiry_notice_opt_in')::boolean,(p_data->>'p_renewal_of')::uuid);
 if p_data->>'expected_price' is not null and (p_data->>'expected_price')::integer is distinct from s.price_cents then raise exception 'O preço mudou. Confira o valor atualizado antes de continuar.';end if;
 update public.hm_sponsors set city=trim(p_data->>'city'),state_code=p_data->>'state_code',offer_conditions=coalesce(p_data->>'offer_conditions',''),offer_expires_on=(p_data->>'offer_expires_on')::date where id=s.id returning * into s;
 return s;
end $$;
revoke all on function public.hm_create_sponsor_local(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_sponsor_local(jsonb) to service_role;
