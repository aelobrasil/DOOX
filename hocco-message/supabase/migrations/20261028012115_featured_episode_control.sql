alter table public.hm_settings
 add column featured_episode_title text not null default '',
 add column featured_episode_url text not null default '',
 add column featured_episode_updated_at timestamptz,
 add constraint hm_featured_episode_valid check (
  length(featured_episode_title)<=120 and
  ((featured_episode_title='' and featured_episode_url='') or
   (length(trim(featured_episode_title))>0 and featured_episode_url ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$'))
 );

create or replace function public.hm_set_featured_episode(p_actor uuid,p_title text,p_url text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare previous jsonb; saved public.hm_settings; title text:=trim(coalesce(p_title,'')); link text:=trim(coalesce(p_url,''));
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active=true) then raise exception 'Acesso restrito à equipe HOCCO.'; end if;
 if length(title)>120 or (title='')<>(link='') or (link<>'' and link !~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$') then raise exception 'Título ou link de episódio inválido.'; end if;
 select jsonb_build_object('title',featured_episode_title,'url',featured_episode_url) into previous from public.hm_settings where id=1 for update;
 if not found then raise exception 'Configuração da HOCCO indisponível.'; end if;
 update public.hm_settings set featured_episode_title=title,featured_episode_url=link,featured_episode_updated_at=now() where id=1 returning * into saved;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'featured_episode_update',jsonb_build_object('before',previous,'after',jsonb_build_object('title',title,'url',link)));
 return jsonb_build_object('title',saved.featured_episode_title,'url',saved.featured_episode_url,'updatedAt',saved.featured_episode_updated_at);
end;
$$;
revoke all on function public.hm_set_featured_episode(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hm_set_featured_episode(uuid,text,text) to service_role;
notify pgrst,'reload schema';
