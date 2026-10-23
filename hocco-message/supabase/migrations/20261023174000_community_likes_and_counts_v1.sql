alter table public.hm_community_messages
  add column if not exists likes_count integer not null default 0
  check (likes_count >= 0);

create table if not exists public.hm_community_likes (
  message_id uuid not null references public.hm_community_messages(id) on delete cascade,
  voter_hash text not null check (voter_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (message_id, voter_hash)
);

alter table public.hm_community_likes enable row level security;
revoke all on public.hm_community_likes from public, anon, authenticated;
grant all on public.hm_community_likes to service_role;

create or replace function public.hm_community_set_like(
  p_message_id uuid,
  p_voter_hash text,
  p_liked boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  m public.hm_community_messages;
  affected integer := 0;
begin
  if p_voter_hash !~ '^[a-f0-9]{64}$' or p_liked is null then
    raise exception 'Curtida inválida.';
  end if;

  select * into m
  from public.hm_community_messages
  where id = p_message_id
    and destination = 'community'
    and review = 'approved'
    and payment = 'confirmed'
    and published_at is not null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Esta mensagem não está mais ativa na Comunidade.';
  end if;

  if p_liked then
    insert into public.hm_community_likes(message_id, voter_hash)
    values (p_message_id, p_voter_hash)
    on conflict (message_id, voter_hash) do nothing;
    get diagnostics affected = row_count;
    if affected = 1 then
      update public.hm_community_messages
      set likes_count = likes_count + 1
      where id = p_message_id
      returning * into m;
    end if;
  else
    delete from public.hm_community_likes
    where message_id = p_message_id and voter_hash = p_voter_hash;
    get diagnostics affected = row_count;
    if affected = 1 then
      update public.hm_community_messages
      set likes_count = greatest(0, likes_count - 1)
      where id = p_message_id
      returning * into m;
    end if;
  end if;

  return jsonb_build_object('likesCount', m.likes_count, 'liked', p_liked);
end;
$function$;

revoke all on function public.hm_community_set_like(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.hm_community_set_like(uuid, text, boolean) to service_role;
