CREATE OR REPLACE FUNCTION public.hm_create_sponsor(p_code text, p_tracking_hash text, p_company_name text, p_cnpj text, p_legal_name text, p_category text, p_company_description text, p_contact_name text, p_email text, p_phone text, p_logo_url text, p_cover_url text, p_destination_url text, p_community_offer text, p_sponsor_terms_version text, p_thank_you_opt_in boolean, p_expiry_notice_opt_in boolean, p_renewal_of uuid DEFAULT NULL::uuid)
 RETURNS hm_sponsors
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_sponsor_settings; s public.hm_sponsors; n integer;
begin
 select * into cfg from public.hm_sponsor_settings where id=1 for update;
 if not cfg.enabled then raise exception 'As inscrições de patrocinadores estão temporariamente fechadas.'; end if;
 if p_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' or char_length(trim(coalesce(p_legal_name,''))) not between 2 and 160 then raise exception 'Informe um CNPJ válido e a razão social da empresa.'; end if;
 if p_category not in ('Alimentação e bebidas','Casa e construção','Educação e cultura','Moda e acessórios','Serviços','Tecnologia','Outros') then raise exception 'Escolha uma categoria válida para a empresa.'; end if;
 if char_length(trim(coalesce(p_company_description,''))) not between 20 and 600 then raise exception 'A descrição da empresa deve ter entre 20 e 600 caracteres.'; end if;
 if exists(select 1 from public.hm_sponsors where tracking_hash=p_tracking_hash) then select * into s from public.hm_sponsors where tracking_hash=p_tracking_hash; return s; end if;
 if p_renewal_of is not null and not exists(select 1 from public.hm_sponsors where id=p_renewal_of and archived_at is null and lower(company_name)=lower(trim(p_company_name)) and cnpj=p_cnpj and review='approved' and payment='confirmed' and starts_at<=now() and expires_at>now()) then raise exception 'A renovação só pode ser solicitada para um patrocínio ativo da mesma empresa.'; end if;
 if p_renewal_of is not null and exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and renewal_of=p_renewal_of and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))))) then raise exception 'Já existe uma renovação em análise para esta empresa.'; end if;
 select count(distinct cnpj) into n from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))));
 if p_renewal_of is null and n>=cfg.capacity then raise exception 'No momento, não há espaço disponível. Tente novamente mais tarde.'; end if;
 if exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and cnpj=p_cnpj and id is distinct from p_renewal_of and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))))) then raise exception 'Este CNPJ já tem uma solicitação ou um patrocínio ativo.'; end if;
 if exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and lower(company_name)=lower(trim(p_company_name)) and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours')))) and (p_renewal_of is null or (id<>p_renewal_of and renewal_of is distinct from p_renewal_of))) then raise exception 'Esta empresa já tem uma solicitação ou um patrocínio ativo.'; end if;
 if char_length(coalesce(p_community_offer,''))>240 then raise exception 'A oferta para a comunidade deve ter até 240 caracteres.'; end if;
 insert into public.hm_sponsors(code,tracking_hash,company_name,cnpj,legal_name,category,company_description,contact_name,email,phone,logo_url,cover_url,destination_url,community_offer,price_cents,renewal_of,thank_you_opt_in,expiry_notice_opt_in,consent)
 values(p_code,p_tracking_hash,trim(p_company_name),p_cnpj,trim(p_legal_name),p_category,trim(p_company_description),trim(p_contact_name),lower(trim(p_email)),regexp_replace(p_phone,'[^0-9]','','g'),p_logo_url,p_cover_url,p_destination_url,coalesce(trim(p_community_offer),''),cfg.price_cents,p_renewal_of,p_thank_you_opt_in,p_expiry_notice_opt_in,
 jsonb_build_object('acceptedAt',now(),'sponsorTermsVersion',p_sponsor_terms_version,'terms',true,'publication',true,'notificationsOptIn',p_thank_you_opt_in,'expiryOptIn',p_expiry_notice_opt_in,'communityOffer',coalesce(trim(p_community_offer),''),'category',p_category,'companyDescription',trim(p_company_description))) returning * into s;
 return s;
end;
$function$
 ;
create or replace function public.hm_create_sponsor_local(p_data jsonb) returns public.hm_sponsors language plpgsql security invoker set search_path='' as $$
declare s public.hm_sponsors; key text; market_status text;
begin
 if char_length(trim(coalesce(p_data->>'city',''))) not between 2 and 80 or p_data->>'state_code' not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'Informe a cidade e a UF.';end if;
 -- Retry returns the same order with its original price and location.
 select * into s from public.hm_sponsors where tracking_hash=p_data->>'p_tracking_hash';if found then return s;end if;
 key:=public.hm_city_key(p_data->>'city',p_data->>'state_code');
 select status into market_status from public.hm_city_markets where city_key=key for update;
 if market_status is distinct from 'open' then raise exception 'As inscrições ainda não estão abertas nesta cidade. Consulte as cidades disponíveis.';end if;
 perform set_config('hocco.sponsor_city_key',key,true);
 s:=public.hm_create_sponsor(p_data->>'p_code',p_data->>'p_tracking_hash',p_data->>'p_company_name',p_data->>'p_cnpj',p_data->>'p_legal_name',p_data->>'p_category',p_data->>'p_company_description',p_data->>'p_contact_name',p_data->>'p_email',p_data->>'p_phone',p_data->>'p_logo_url',p_data->>'p_cover_url',p_data->>'p_destination_url',p_data->>'p_community_offer',p_data->>'p_sponsor_terms_version',(p_data->>'p_thank_you_opt_in')::boolean,(p_data->>'p_expiry_notice_opt_in')::boolean,(p_data->>'p_renewal_of')::uuid);
 if p_data->>'expected_price' is not null and (p_data->>'expected_price')::integer is distinct from s.price_cents then raise exception 'O preço mudou. Confira o valor atualizado antes de continuar.';end if;
 update public.hm_sponsors set city=trim(p_data->>'city'),state_code=p_data->>'state_code',offer_conditions=coalesce(p_data->>'offer_conditions',''),offer_expires_on=(p_data->>'offer_expires_on')::date where id=s.id returning * into s;
 return s;
end $$;
revoke all on function public.hm_create_sponsor_local(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_sponsor_local(jsonb) to service_role;
