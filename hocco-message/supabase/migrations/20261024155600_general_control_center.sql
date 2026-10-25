alter table public.hm_settings
  add column if not exists video_enabled boolean not null default true,
  add column if not exists community_enabled boolean not null default true,
  add column if not exists live_enabled boolean not null default true,
  add column if not exists community_duration_hours smallint not null default 4,
  add column if not exists founder_notice text not null default '',
  add column if not exists founder_notice_active boolean not null default false,
  add column if not exists founder_notice_updated_at timestamptz;

alter table public.hm_settings
  add constraint hm_settings_community_duration_hours_check
    check (community_duration_hours between 1 and 24),
  add constraint hm_settings_founder_notice_length_check
    check (char_length(founder_notice) <= 500);

alter table public.hm_community_messages
  add column if not exists hidden_at timestamptz;

create or replace function public.hm_update_general_control(p_actor uuid, p_payload jsonb)
returns public.hm_settings
language plpgsql
set search_path to ''
as $function$
declare s public.hm_settings; sponsor_settings public.hm_sponsor_settings; notice text:=coalesce(p_payload->>'founderNotice','');
  video_prices integer[]; community_price integer; live_price integer; sponsor_price integer;
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then
    raise exception 'Acesso restrito à equipe.';
  end if;
  if jsonb_typeof(p_payload->'videoEnabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'communityEnabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'liveEnabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'sponsorsEnabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'founderNoticeActive') is distinct from 'boolean'
     or coalesce((p_payload->>'communityDurationHours')::integer,0) not between 1 and 24
     or char_length(notice)>500
     or ((p_payload->>'founderNoticeActive')::boolean and char_length(notice)=0) then
    raise exception 'Confira os controles gerais antes de salvar.';
  end if;
  if jsonb_typeof(p_payload->'videoPrices') is distinct from 'array' then
    raise exception 'Informe os preços das duas posições de vídeo.';
  end if;
  if jsonb_array_length(p_payload->'videoPrices')<>2 then
    raise exception 'Informe os preços das duas posições de vídeo.';
  end if;
  video_prices:=array[(p_payload->'videoPrices'->>0)::integer,(p_payload->'videoPrices'->>1)::integer];
  community_price:=(p_payload->>'communityPriceCents')::integer;
  live_price:=(p_payload->>'livePriceCents')::integer;
  sponsor_price:=(p_payload->>'sponsorPriceCents')::integer;
  if video_prices[1] not between 1 and 999900 or video_prices[2] not between 1 and 999900
     or community_price not between 1 and 999900 or live_price not between 1 and 999900
     or sponsor_price not between 100 and 999999 then
    raise exception 'Um dos preços está fora do limite permitido.';
  end if;

  update public.hm_settings
     set video_enabled=(p_payload->>'videoEnabled')::boolean,
         community_enabled=(p_payload->>'communityEnabled')::boolean,
         live_enabled=(p_payload->>'liveEnabled')::boolean,
         community_duration_hours=(p_payload->>'communityDurationHours')::smallint,
         prices=jsonb_build_array(video_prices[1],video_prices[2],(prices->>2)::integer,(prices->>3)::integer,(prices->>4)::integer),
         community_price_cents=community_price,
         live_price_cents=live_price,
         founder_notice=notice,
         founder_notice_active=(p_payload->>'founderNoticeActive')::boolean,
         founder_notice_updated_at=now(),
         updated_at=now()
   where id=1 returning * into s;
  if not found then raise exception 'Configuração principal não encontrada.'; end if;

  update public.hm_sponsor_settings
     set price_cents=sponsor_price, enabled=(p_payload->>'sponsorsEnabled')::boolean, updated_at=now()
   where id=1 returning * into sponsor_settings;
  if not found then raise exception 'Configuração de patrocínio não encontrada.'; end if;
  insert into public.hm_audit(actor_id,action,detail)
  values(p_actor,'general_control_update',jsonb_build_object(
    'video_enabled',s.video_enabled,
    'community_enabled',s.community_enabled,
    'live_enabled',s.live_enabled,
    'community_duration_hours',s.community_duration_hours,
    'video_prices',video_prices,
    'community_price_cents',community_price,
    'live_price_cents',live_price,
    'sponsor_price_cents',sponsor_price,
    'sponsors_enabled',(p_payload->>'sponsorsEnabled')::boolean,
    'founder_notice_active',s.founder_notice_active,
    'founder_notice_length',char_length(s.founder_notice)
  ));
  return s;
end;
$function$;

revoke all on function public.hm_update_general_control(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.hm_update_general_control(uuid,jsonb) to service_role;

create or replace function public.hm_admin_edit_video_message(p_actor uuid,p_id uuid,p_message text,p_reason text)
returns public.hm_orders
language plpgsql
set search_path to ''
as $function$
declare o public.hm_orders; old_message text; clean_message text:=trim(coalesce(p_message,'')); reason text:=trim(coalesce(p_reason,''));
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  if char_length(clean_message) not between 1 and 180 or char_length(reason) not between 2 and 500 then raise exception 'Informe uma mensagem de até 180 caracteres e o motivo da correção.'; end if;
  select * into o from public.hm_orders where id=p_id and archived_at is null for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.delivery='published' then raise exception 'Uma mensagem já veiculada não pode ser alterada no pedido. O vídeo publicado também não muda.'; end if;
  old_message:=o.message;
  update public.hm_orders set message=clean_message,review='pending',reason=null,updated_at=now() where id=p_id returning * into o;
  insert into public.hm_audit(order_id,actor_id,action,detail)
  values(p_id,p_actor,'message_edited',jsonb_build_object('previous_message',old_message,'new_message',clean_message,'reason',reason,'review_reset',true));
  return o;
end;
$function$;

create or replace function public.hm_admin_archive_video_message(p_actor uuid,p_id uuid)
returns public.hm_orders
language plpgsql
set search_path to ''
as $function$
declare o public.hm_orders;
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  select * into o from public.hm_orders where id=p_id and archived_at is null for update;
  if not found then raise exception 'Pedido não encontrado ou já arquivado.'; end if;
  if o.payment='confirmed' and o.delivery<>'published' then raise exception 'Resolva a veiculação ou a devolução antes de arquivar este pedido.'; end if;
  update public.hm_orders set archived_at=now(),updated_at=now() where id=p_id and archived_at is null returning * into o;
  if not found then raise exception 'Pedido não encontrado ou já arquivado.'; end if;
  insert into public.hm_audit(order_id,actor_id,action,detail) values(p_id,p_actor,'archived',jsonb_build_object('source','control_general'));
  return o;
end;
$function$;

create or replace function public.hm_admin_edit_community_message(p_actor uuid,p_id uuid,p_message text,p_reason text)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; old_message text; reason text:=trim(coalesce(p_reason,'')); clean_message text:=trim(coalesce(p_message,''));
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  if char_length(clean_message) not between 1 and 180 or char_length(reason) not between 2 and 500 then raise exception 'Informe uma mensagem de até 180 caracteres e o motivo da correção.'; end if;
  select * into m from public.hm_community_messages where id=p_id and hidden_at is null for update;
  if not found then raise exception 'Mensagem não encontrada.'; end if;
  if m.live_status='read' then raise exception 'Uma mensagem já lida na LIVE não pode ser alterada.'; end if;
  old_message:=m.message;
  update public.hm_community_messages set message=clean_message,review='pending',published_at=null,expires_at=null,live_status=null,reason=null,updated_at=now() where id=p_id returning * into m;
  insert into public.hm_community_audit(post_id,actor_id,action,detail)
  values(p_id,p_actor,'message_edited',jsonb_build_object('previous_message',old_message,'new_message',clean_message,'reason',reason,'review_reset',true));
  return m;
end;
$function$;

create or replace function public.hm_admin_hide_community_message(p_actor uuid,p_id uuid,p_reason text)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; reason_text text:=trim(coalesce(p_reason,''));
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  if char_length(reason_text) not between 2 and 500 then raise exception 'Informe o motivo para ocultar a mensagem.'; end if;
  update public.hm_community_messages set hidden_at=now(),review='rejected',reason=reason_text,updated_at=now() where id=p_id and hidden_at is null returning * into m;
  if not found then raise exception 'Mensagem não encontrada ou já ocultada.'; end if;
  insert into public.hm_community_audit(post_id,actor_id,action,detail)
  values(p_id,p_actor,'hidden',jsonb_build_object('reason',reason_text,'payment',m.payment));
  return m;
end;
$function$;

create or replace function public.hm_admin_restore_community_message(p_actor uuid,p_id uuid)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages;
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  update public.hm_community_messages set hidden_at=null,review='pending',reason=null,updated_at=now() where id=p_id and hidden_at is not null returning * into m;
  if not found then raise exception 'Mensagem não encontrada ou já visível.'; end if;
  insert into public.hm_community_audit(post_id,actor_id,action,detail) values(p_id,p_actor,'restored',jsonb_build_object('review_reset',true));
  return m;
end;
$function$;

revoke all on function public.hm_admin_edit_video_message(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hm_admin_archive_video_message(uuid,uuid) from public,anon,authenticated;
revoke all on function public.hm_admin_edit_community_message(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hm_admin_hide_community_message(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.hm_admin_restore_community_message(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hm_admin_edit_video_message(uuid,uuid,text,text) to service_role;
grant execute on function public.hm_admin_archive_video_message(uuid,uuid) to service_role;
grant execute on function public.hm_admin_edit_community_message(uuid,uuid,text,text) to service_role;
grant execute on function public.hm_admin_hide_community_message(uuid,uuid,text) to service_role;
grant execute on function public.hm_admin_restore_community_message(uuid,uuid) to service_role;

create or replace function public.hm_confirm_community_payment(p_id uuid, p_payment_id text)
returns public.hm_community_messages
language plpgsql
security definer
set search_path to ''
as $function$
declare m public.hm_community_messages; published timestamptz; duration_hours integer;
begin
  if p_payment_id !~ '^[0-9]{1,40}$' then raise exception 'Identificador do pagamento inválido.'; end if;
  select * into m from public.hm_community_messages where id=p_id for update;
  if not found then raise exception 'Mensagem da Comunidade não encontrada.'; end if;
  if m.payment='confirmed' then
    if m.mercado_pago_payment_id=p_payment_id then return m; end if;
    raise exception 'A mensagem já possui outro pagamento confirmado.';
  end if;
  if m.payment<>'pending' or m.review='rejected' then raise exception 'A mensagem não pode receber este pagamento.'; end if;
  if m.review='approved' and m.destination='community' then
    select community_duration_hours into duration_hours from public.hm_settings where id=1;
    published:=coalesce(m.published_at,now());
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,published_at=published,expires_at=published+make_interval(hours=>coalesce(duration_hours,4)),live_status=null,updated_at=now() where id=p_id returning * into m;
  elsif m.review='approved' and m.destination='live' then
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,live_status=coalesce(live_status,'queued'),updated_at=now() where id=p_id returning * into m;
  else
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,updated_at=now() where id=p_id returning * into m;
  end if;
  insert into public.hm_community_audit(post_id,action,detail)
  values(m.id,'payment_confirmed',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id,'published_automatically',m.published_at is not null,'destination',m.destination,'queued_for_live',m.live_status='queued'));
  return m;
end;
$function$;

create or replace function public.hm_community_admin_action(p_actor uuid, p_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; reason text:=trim(coalesce(p_payload->>'reason','')); duration_hours integer;
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  select * into m from public.hm_community_messages where id=p_id for update;
  if not found then raise exception 'Mensagem da comunidade não encontrada.'; end if;
  case p_action
    when 'pay' then if m.payment<>'pending' or m.review='rejected' then raise exception 'Não é possível confirmar esse pagamento.'; end if; m.payment:='confirmed';
    when 'approve' then if m.review<>'pending' then raise exception 'A curadoria já foi concluída.'; end if; m.review:='approved';
    when 'reject' then if m.review<>'pending' or char_length(reason) not between 2 and 500 then raise exception 'Informe o motivo da recusa.'; end if; m.review:='rejected'; m.reason:=reason;
    when 'refund' then if m.review<>'rejected' or m.payment<>'confirmed' then raise exception 'Não há devolução pendente.'; end if; m.payment:='refunded';
    when 'live_read' then if m.destination<>'live' or m.payment<>'confirmed' or m.review<>'approved' or m.live_status<>'queued' then raise exception 'Esta mensagem não está na fila da LIVE.'; end if; m.live_status:='read';
    else raise exception 'Ação de curadoria inválida.';
  end case;
  if m.review='approved' and m.payment='confirmed' then
    if m.destination='community' and m.published_at is null then
      select community_duration_hours into duration_hours from public.hm_settings where id=1;
      m.published_at:=now(); m.expires_at:=m.published_at+make_interval(hours=>coalesce(duration_hours,4));
    end if;
    if m.destination='live' and m.live_status is null then m.live_status:='queued'; end if;
  end if;
  m.updated_at:=now();
  update public.hm_community_messages set review=m.review,payment=m.payment,reason=m.reason,published_at=m.published_at,expires_at=m.expires_at,live_status=m.live_status,updated_at=m.updated_at where id=m.id returning * into m;
  insert into public.hm_community_audit(post_id,actor_id,action,detail)
  values(m.id,p_actor,p_action,case when p_action='reject' then jsonb_build_object('reason',reason) else jsonb_build_object('destination',m.destination) end);
  return m;
end;
$function$;
