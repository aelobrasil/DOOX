-- DOOX V2 — BASE TRANSACIONAL
-- Projeto: HOCCO / DOOX Studios
-- Data: 2026-10-01
-- Regra: não remove nem altera o schema legado. Cria um novo núcleo versionado no mesmo Supabase.

begin;

create extension if not exists pgcrypto;
create schema if not exists doox_v2;

revoke all on schema doox_v2 from anon, authenticated;

create sequence if not exists doox_v2.codigo_pedido_seq start with 1 increment by 1;

create or replace function doox_v2.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create table if not exists doox_v2.modalidades (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  exige_faixa boolean not null default false,
  exige_logo boolean not null default false,
  exige_audio boolean not null default false,
  exclusivo_pessoa_fisica boolean not null default false,
  capacidade_padrao integer not null default 10 check (capacidade_padrao > 0),
  quantidade_minima integer not null default 1 check (quantidade_minima > 0),
  quantidade_maxima integer not null default 10 check (quantidade_maxima >= quantidade_minima),
  preco_base numeric(12,2),
  ordem integer not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists doox_v2.faixas (
  id uuid primary key default gen_random_uuid(),
  modalidade_id uuid not null references doox_v2.modalidades(id) on delete cascade,
  codigo text not null,
  nome text not null,
  inicio_segundos integer,
  fim_segundos integer,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  ativo boolean not null default true,
  ordem integer not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (modalidade_id, codigo)
);

create table if not exists doox_v2.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('EMPRESA','PESSOA_FISICA')),
  nome text not null,
  empresa text,
  whatsapp text,
  email text,
  perfil text,
  segmento text,
  origem text not null default 'SITE_HOCCO',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists clientes_email_idx on doox_v2.clientes (lower(email));
create index if not exists clientes_whatsapp_idx on doox_v2.clientes (whatsapp);
create index if not exists clientes_empresa_idx on doox_v2.clientes (lower(empresa));

create table if not exists doox_v2.episodios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  numero integer,
  titulo text,
  descricao text,
  status text not null default 'PLANEJADO' check (status in ('PLANEJADO','ABERTO','FECHADO','EM_PRODUCAO','PUBLICADO','FINALIZADO','CANCELADO')),
  capacidade_total integer,
  publicado_em timestamptz,
  finalizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists doox_v2.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('doox_v2.codigo_pedido_seq'),
  codigo_doox text not null unique,
  idempotency_key text not null unique,
  cliente_id uuid not null references doox_v2.clientes(id),
  modalidade_id uuid not null references doox_v2.modalidades(id),
  faixa_id uuid references doox_v2.faixas(id),
  episodio_id uuid references doox_v2.episodios(id),
  tipo_participacao text not null check (tipo_participacao in ('EMPRESA','PESSOA_FISICA')),
  modalidade_codigo text not null,
  modalidade_nome text not null,
  faixa_codigo text,
  faixa_nome text,
  quantidade integer not null check (quantidade > 0),
  valor_unitario numeric(12,2) not null check (valor_unitario >= 0),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  beneficio jsonb,
  observacoes text,
  origem text not null default 'SITE_HOCCO',
  status_operacional text not null default 'SOLICITADO' check (status_operacional in (
    'SOLICITADO','EM_ANALISE','AGUARDANDO_PAGAMENTO','PAGAMENTO_RECEBIDO','MATERIAL_PENDENTE',
    'MATERIAL_RECEBIDO','EM_PRODUCAO','PROGRAMADO','PUBLICADO','FINALIZADO','REJEITADO','CANCELADO','ARQUIVADO'
  )),
  status_pagamento text not null default 'AGUARDANDO_PAGAMENTO' check (status_pagamento in ('AGUARDANDO_PAGAMENTO','RECEBIDO','ISENTO','ESTORNADO','CANCELADO')),
  status_material text not null default 'PENDENTE' check (status_material in ('NAO_EXIGIDO','PENDENTE','PARCIAL','RECEBIDO','APROVADO','REPROVADO')),
  status_producao text not null default 'NAO_INICIADA' check (status_producao in ('NAO_INICIADA','EM_PRODUCAO','CONCLUIDA','CANCELADA')),
  status_veiculacao text not null default 'NAO_PROGRAMADA' check (status_veiculacao in ('NAO_PROGRAMADA','PROGRAMADA','PUBLICADA','FINALIZADA','CANCELADA')),
  rejeicao_motivo text,
  mensagem_cliente text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  finalizado_em timestamptz
);

create index if not exists pedidos_codigo_idx on doox_v2.pedidos (codigo_doox);
create index if not exists pedidos_cliente_idx on doox_v2.pedidos (cliente_id);
create index if not exists pedidos_status_idx on doox_v2.pedidos (status_operacional, criado_em desc);
create index if not exists pedidos_modalidade_idx on doox_v2.pedidos (modalidade_codigo, criado_em desc);
create index if not exists pedidos_episodio_idx on doox_v2.pedidos (episodio_id);

create table if not exists doox_v2.aceites (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references doox_v2.pedidos(id) on delete cascade,
  termos_uso boolean not null default false,
  regras_participacao boolean not null default false,
  termo_empresa boolean not null default false,
  versao_termos text,
  versao_regras text,
  versao_termo_empresa text,
  identificacao_assinatura text,
  user_agent text,
  aceito_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table if not exists doox_v2.pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references doox_v2.pedidos(id) on delete cascade,
  valor numeric(12,2) not null check (valor >= 0),
  status text not null default 'AGUARDANDO_PAGAMENTO' check (status in ('AGUARDANDO_PAGAMENTO','RECEBIDO','ISENTO','ESTORNADO','CANCELADO')),
  metodo text,
  referencia_externa text,
  comprovante_storage_path text,
  confirmado_em timestamptz,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pagamentos_pedido_idx on doox_v2.pagamentos (pedido_id, criado_em desc);

create table if not exists doox_v2.materiais (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references doox_v2.pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('LOGO','AUDIO','IMAGEM','OUTRO')),
  nome_original text not null,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  bucket text not null default 'doox-v2-arquivos',
  storage_path text not null unique,
  checksum text,
  status text not null default 'RECEBIDO' check (status in ('RECEBIDO','APROVADO','REPROVADO','SUBSTITUIDO','EXCLUIDO')),
  observacao text,
  enviado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists materiais_pedido_idx on doox_v2.materiais (pedido_id, enviado_em desc);

create table if not exists doox_v2.historico_status (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references doox_v2.pedidos(id) on delete cascade,
  evento text not null,
  status_anterior text,
  status_novo text,
  campo text,
  valor_anterior text,
  valor_novo text,
  observacao text,
  origem text not null default 'SISTEMA',
  alterado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists historico_pedido_idx on doox_v2.historico_status (pedido_id, criado_em desc);

create table if not exists doox_v2.programacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references doox_v2.pedidos(id) on delete cascade,
  episodio_id uuid references doox_v2.episodios(id),
  momento_codigo text,
  posicao_numero integer,
  programado_para timestamptz,
  publicado_em timestamptz,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists doox_v2.transicoes_status (
  status_atual text not null,
  proximo_status text not null,
  ativo boolean not null default true,
  primary key (status_atual, proximo_status)
);

-- Triggers de atualização
create or replace trigger modalidades_touch before update on doox_v2.modalidades for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger faixas_touch before update on doox_v2.faixas for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger clientes_touch before update on doox_v2.clientes for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger episodios_touch before update on doox_v2.episodios for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger pedidos_touch before update on doox_v2.pedidos for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger pagamentos_touch before update on doox_v2.pagamentos for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger materiais_touch before update on doox_v2.materiais for each row execute function doox_v2.touch_atualizado_em();
create or replace trigger programacoes_touch before update on doox_v2.programacoes for each row execute function doox_v2.touch_atualizado_em();

-- Catálogo inicial — espelha a configuração atualmente exibida no site.
insert into doox_v2.modalidades (codigo,nome,descricao,exige_faixa,exige_logo,exige_audio,exclusivo_pessoa_fisica,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem)
values
 ('RODAPE','Presença no Rodapé','Bloco coletivo com presença de empresas em faixa horizontal.',false,true,false,false,50,1,50,29.90,10),
 ('SPONSOR_OVERLAY','Sponsor Overlay','Inserção visual exclusiva integrada à cena.',true,true,false,false,10,1,10,null,20),
 ('OVERLAY_AUDIO','Overlay + Áudio','Inserção visual exclusiva integrada à cena com CTA em áudio.',true,true,true,false,10,1,10,null,30),
 ('PATROCINADOR_EPISODIO','Empresa Patrocinadora do Episódio','Modalidade institucional com entrada própria no episódio.',false,true,false,false,1,1,1,89.90,40),
 ('APOIADOR_INDIVIDUAL','Apoiador Individual','Participação individual apresentada nos créditos.',false,false,false,true,50,1,50,9.90,50)
on conflict (codigo) do update set
  nome=excluded.nome,
  descricao=excluded.descricao,
  exige_faixa=excluded.exige_faixa,
  exige_logo=excluded.exige_logo,
  exige_audio=excluded.exige_audio,
  exclusivo_pessoa_fisica=excluded.exclusivo_pessoa_fisica,
  capacidade_padrao=excluded.capacidade_padrao,
  quantidade_minima=excluded.quantidade_minima,
  quantidade_maxima=excluded.quantidade_maxima,
  preco_base=excluded.preco_base,
  ordem=excluded.ordem,
  ativo=true;

with m as (select id,codigo from doox_v2.modalidades where codigo='SPONSOR_OVERLAY')
insert into doox_v2.faixas (modalidade_id,codigo,nome,inicio_segundos,fim_segundos,preco_unitario,ordem)
select id,'F1','00:30–02:00',30,120,39.90,10 from m union all
select id,'F2','02:00–04:00',120,240,49.90,20 from m union all
select id,'F3','04:00–06:30',240,390,59.90,30 from m union all
select id,'F4','06:30–09:00',390,540,69.90,40 from m union all
select id,'F5','09:00–11:00',540,660,79.90,50 from m
on conflict (modalidade_id,codigo) do update set nome=excluded.nome,inicio_segundos=excluded.inicio_segundos,fim_segundos=excluded.fim_segundos,preco_unitario=excluded.preco_unitario,ordem=excluded.ordem,ativo=true;

with m as (select id,codigo from doox_v2.modalidades where codigo='OVERLAY_AUDIO')
insert into doox_v2.faixas (modalidade_id,codigo,nome,inicio_segundos,fim_segundos,preco_unitario,ordem)
select id,'F1','00:30–02:00',30,120,49.90,10 from m union all
select id,'F2','02:00–04:00',120,240,59.90,20 from m union all
select id,'F3','04:00–06:30',240,390,69.90,30 from m union all
select id,'F4','06:30–09:00',390,540,79.90,40 from m union all
select id,'F5','09:00–11:00',540,660,89.90,50 from m
on conflict (modalidade_id,codigo) do update set nome=excluded.nome,inicio_segundos=excluded.inicio_segundos,fim_segundos=excluded.fim_segundos,preco_unitario=excluded.preco_unitario,ordem=excluded.ordem,ativo=true;

insert into doox_v2.transicoes_status(status_atual,proximo_status) values
 ('SOLICITADO','EM_ANALISE'),('SOLICITADO','REJEITADO'),('SOLICITADO','CANCELADO'),
 ('EM_ANALISE','AGUARDANDO_PAGAMENTO'),('EM_ANALISE','REJEITADO'),('EM_ANALISE','CANCELADO'),
 ('AGUARDANDO_PAGAMENTO','PAGAMENTO_RECEBIDO'),('AGUARDANDO_PAGAMENTO','CANCELADO'),
 ('PAGAMENTO_RECEBIDO','MATERIAL_PENDENTE'),('PAGAMENTO_RECEBIDO','MATERIAL_RECEBIDO'),('PAGAMENTO_RECEBIDO','CANCELADO'),
 ('MATERIAL_PENDENTE','MATERIAL_RECEBIDO'),('MATERIAL_PENDENTE','CANCELADO'),
 ('MATERIAL_RECEBIDO','EM_PRODUCAO'),('MATERIAL_RECEBIDO','CANCELADO'),
 ('EM_PRODUCAO','PROGRAMADO'),('EM_PRODUCAO','CANCELADO'),
 ('PROGRAMADO','PUBLICADO'),('PROGRAMADO','CANCELADO'),
 ('PUBLICADO','FINALIZADO'),
 ('REJEITADO','ARQUIVADO'),('CANCELADO','ARQUIVADO'),('FINALIZADO','ARQUIVADO')
on conflict do nothing;

-- Gera código estável e independente do episódio. O código nunca muda quando o pedido é programado.
create or replace function doox_v2.codigo_para_numero(p_numero bigint, p_data timestamptz default now())
returns text
language sql
stable
as $$
  select 'DOOX-' || to_char(p_data,'YY') || '-' || lpad(p_numero::text,6,'0');
$$;

create or replace function doox_v2.recalcular_status_material(p_pedido_id uuid)
returns text
language plpgsql
as $$
declare
  v_modalidade doox_v2.modalidades%rowtype;
  v_logo int := 0;
  v_audio int := 0;
  v_total int := 0;
  v_reprovado int := 0;
  v_status text;
begin
  select m.* into v_modalidade
  from doox_v2.pedidos p
  join doox_v2.modalidades m on m.id=p.modalidade_id
  where p.id=p_pedido_id;

  if not found then raise exception 'Pedido não encontrado.'; end if;

  if not v_modalidade.exige_logo and not v_modalidade.exige_audio then
    v_status := 'NAO_EXIGIDO';
  else
    select
      count(*) filter(where tipo='LOGO' and status not in ('SUBSTITUIDO','EXCLUIDO')),
      count(*) filter(where tipo='AUDIO' and status not in ('SUBSTITUIDO','EXCLUIDO')),
      count(*) filter(where status not in ('SUBSTITUIDO','EXCLUIDO')),
      count(*) filter(where status='REPROVADO')
    into v_logo,v_audio,v_total,v_reprovado
    from doox_v2.materiais where pedido_id=p_pedido_id;

    if v_reprovado > 0 then
      v_status := 'REPROVADO';
    elsif (not v_modalidade.exige_logo or v_logo>0) and (not v_modalidade.exige_audio or v_audio>0) then
      v_status := 'RECEBIDO';
    elsif v_total > 0 then
      v_status := 'PARCIAL';
    else
      v_status := 'PENDENTE';
    end if;
  end if;

  update doox_v2.pedidos set status_material=v_status where id=p_pedido_id;
  return v_status;
end;
$$;

create or replace function doox_v2.criar_pedido(p jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_idempotency text := nullif(trim(p->>'idempotency_key'),'');
  v_tipo text := upper(trim(coalesce(p->>'tipo_participacao','')));
  v_modalidade_codigo text := upper(trim(coalesce(p->>'modalidade','')));
  v_faixa_codigo text := nullif(upper(trim(coalesce(p->>'faixa',''))),'');
  v_quantidade integer := greatest(1,coalesce((p->>'quantidade')::integer,1));
  v_nome text := nullif(trim(p->>'nome'),'');
  v_empresa text := nullif(trim(p->>'empresa'),'');
  v_whatsapp text := nullif(regexp_replace(coalesce(p->>'whatsapp',''),'\D','','g'),'');
  v_email text := nullif(lower(trim(p->>'email')),'');
  v_perfil text := nullif(trim(p->>'perfil'),'');
  v_segmento text := nullif(trim(p->>'segmento'),'');
  v_observacoes text := nullif(trim(p->>'observacoes'),'');
  v_origem text := coalesce(nullif(trim(p->>'origem'),''),'SITE_HOCCO');
  v_modalidade doox_v2.modalidades%rowtype;
  v_faixa doox_v2.faixas%rowtype;
  v_cliente_id uuid;
  v_pedido doox_v2.pedidos%rowtype;
  v_numero bigint;
  v_unit numeric(12,2);
  v_total numeric(12,2);
  v_material_status text;
  v_terms boolean := coalesce((p#>>'{aceites,termos_uso}')::boolean,false);
  v_rules boolean := coalesce((p#>>'{aceites,regras_participacao}')::boolean,false);
  v_company_terms boolean := coalesce((p#>>'{aceites,termo_empresa}')::boolean,false);
begin
  if v_idempotency is null then raise exception 'idempotency_key é obrigatório.'; end if;

  select * into v_pedido from doox_v2.pedidos where idempotency_key=v_idempotency limit 1;
  if found then
    return jsonb_build_object(
      'ok',true,'duplicate',true,'pedido_id',v_pedido.id,'codigo_doox',v_pedido.codigo_doox,
      'modalidade',v_pedido.modalidade_codigo,'quantidade',v_pedido.quantidade,
      'valor_unitario',v_pedido.valor_unitario,'valor_total',v_pedido.valor_total,
      'status',v_pedido.status_operacional,'status_pagamento',v_pedido.status_pagamento
    );
  end if;

  if v_tipo not in ('EMPRESA','PESSOA_FISICA') then raise exception 'Tipo de participação inválido.'; end if;
  if v_nome is null or v_email is null or v_whatsapp is null then raise exception 'Nome, WhatsApp e E-mail são obrigatórios.'; end if;
  if not v_terms or not v_rules then raise exception 'Os Termos de Uso e as Regras de Participação precisam ser aceitos.'; end if;
  if v_tipo='EMPRESA' and not v_company_terms then raise exception 'O Termo de Participação Empresarial precisa ser aceito.'; end if;
  if v_tipo='EMPRESA' and v_empresa is null then raise exception 'Nome da empresa é obrigatório.'; end if;

  select * into v_modalidade from doox_v2.modalidades where codigo=v_modalidade_codigo and ativo=true;
  if not found then raise exception 'Modalidade inválida.'; end if;
  if v_modalidade.exclusivo_pessoa_fisica and v_tipo <> 'PESSOA_FISICA' then raise exception 'Esta modalidade é exclusiva para pessoa física.'; end if;
  if not v_modalidade.exclusivo_pessoa_fisica and v_tipo='PESSOA_FISICA' then raise exception 'Pessoa física participa somente como Apoiador Individual.'; end if;
  if v_quantidade < v_modalidade.quantidade_minima or v_quantidade > v_modalidade.quantidade_maxima then
    raise exception 'Quantidade inválida para esta modalidade.';
  end if;

  if v_modalidade.exige_faixa then
    if v_faixa_codigo is null then raise exception 'Selecione o momento/faixa da participação.'; end if;
    select * into v_faixa from doox_v2.faixas where modalidade_id=v_modalidade.id and codigo=v_faixa_codigo and ativo=true;
    if not found then raise exception 'Faixa comercial inválida para esta modalidade.'; end if;
    v_unit := v_faixa.preco_unitario;
  else
    v_faixa_codigo := null;
    v_unit := v_modalidade.preco_base;
  end if;
  if v_unit is null then raise exception 'Preço não configurado para esta modalidade.'; end if;
  v_total := round(v_unit * v_quantidade,2);

  select id into v_cliente_id
  from doox_v2.clientes
  where tipo=v_tipo and (
    (v_email is not null and lower(email)=v_email) or
    (v_whatsapp is not null and whatsapp=v_whatsapp)
  )
  order by atualizado_em desc
  limit 1;

  if v_cliente_id is null then
    insert into doox_v2.clientes(tipo,nome,empresa,whatsapp,email,perfil,segmento,origem)
    values(v_tipo,v_nome,v_empresa,v_whatsapp,v_email,v_perfil,v_segmento,v_origem)
    returning id into v_cliente_id;
  else
    update doox_v2.clientes set nome=v_nome,empresa=v_empresa,whatsapp=v_whatsapp,email=v_email,perfil=v_perfil,segmento=v_segmento,origem=v_origem
    where id=v_cliente_id;
  end if;

  v_material_status := case when v_modalidade.exige_logo or v_modalidade.exige_audio then 'PENDENTE' else 'NAO_EXIGIDO' end;

  v_numero := nextval('doox_v2.codigo_pedido_seq');
  insert into doox_v2.pedidos(
    numero,codigo_doox,idempotency_key,cliente_id,modalidade_id,faixa_id,tipo_participacao,
    modalidade_codigo,modalidade_nome,faixa_codigo,faixa_nome,quantidade,valor_unitario,valor_total,
    beneficio,observacoes,origem,status_material
  ) values (
    v_numero,doox_v2.codigo_para_numero(v_numero,now()),v_idempotency,v_cliente_id,v_modalidade.id,case when v_modalidade.exige_faixa then v_faixa.id else null end,v_tipo,
    v_modalidade.codigo,v_modalidade.nome,v_faixa_codigo,case when v_modalidade.exige_faixa then v_faixa.nome else null end,
    v_quantidade,v_unit,v_total,p->'beneficio',v_observacoes,v_origem,v_material_status
  ) returning * into v_pedido;

  insert into doox_v2.aceites(
    pedido_id,termos_uso,regras_participacao,termo_empresa,versao_termos,versao_regras,versao_termo_empresa,
    identificacao_assinatura,user_agent
  ) values (
    v_pedido.id,v_terms,v_rules,v_company_terms,nullif(p#>>'{aceites,versao_termos}',''),nullif(p#>>'{aceites,versao_regras}',''),
    nullif(p#>>'{aceites,versao_termo_empresa}',''),nullif(p#>>'{aceites,identificacao_assinatura}',''),nullif(p#>>'{aceites,user_agent}','')
  );

  insert into doox_v2.pagamentos(pedido_id,valor,status) values(v_pedido.id,v_total,'AGUARDANDO_PAGAMENTO');
  insert into doox_v2.historico_status(pedido_id,evento,status_novo,observacao,origem)
  values(v_pedido.id,'PEDIDO_CRIADO','SOLICITADO','Solicitação criada pelo site HOCCO.',v_origem);

  return jsonb_build_object(
    'ok',true,'duplicate',false,'pedido_id',v_pedido.id,'codigo_doox',v_pedido.codigo_doox,
    'modalidade',v_pedido.modalidade_codigo,'modalidade_nome',v_pedido.modalidade_nome,
    'faixa',v_pedido.faixa_codigo,'faixa_nome',v_pedido.faixa_nome,
    'quantidade',v_pedido.quantidade,'valor_unitario',v_pedido.valor_unitario,'valor_total',v_pedido.valor_total,
    'status',v_pedido.status_operacional,'status_pagamento',v_pedido.status_pagamento,'status_material',v_pedido.status_material
  );
end;
$$;

create or replace function doox_v2.registrar_material(
  p_pedido_id uuid,
  p_tipo text,
  p_nome_original text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_storage_path text,
  p_checksum text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_tipo text := upper(trim(coalesce(p_tipo,'')));
  v_material doox_v2.materiais%rowtype;
  v_status text;
begin
  if v_tipo not in ('LOGO','AUDIO','IMAGEM','OUTRO') then raise exception 'Tipo de material inválido.'; end if;
  if not exists(select 1 from doox_v2.pedidos where id=p_pedido_id) then raise exception 'Pedido não encontrado.'; end if;
  if p_tamanho_bytes is null or p_tamanho_bytes<=0 then raise exception 'Tamanho do material inválido.'; end if;
  if nullif(trim(p_storage_path),'') is null then raise exception 'Caminho de armazenamento inválido.'; end if;

  -- Ao receber uma nova versão do mesmo tipo, a anterior deixa de ser a versão operacional.
  update doox_v2.materiais
  set status='SUBSTITUIDO', observacao=coalesce(observacao,'') || case when coalesce(observacao,'')='' then '' else ' | ' end || 'Substituído por novo envio.'
  where pedido_id=p_pedido_id and tipo=v_tipo and status not in ('SUBSTITUIDO','EXCLUIDO');

  insert into doox_v2.materiais(pedido_id,tipo,nome_original,mime_type,tamanho_bytes,storage_path,checksum)
  values(p_pedido_id,v_tipo,p_nome_original,p_mime_type,p_tamanho_bytes,p_storage_path,p_checksum)
  returning * into v_material;

  v_status := doox_v2.recalcular_status_material(p_pedido_id);
  insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem)
  values(p_pedido_id,'MATERIAL_RECEBIDO','status_material',v_status,v_tipo||' recebido.','SITE_HOCCO');

  return jsonb_build_object('ok',true,'id',v_material.id,'pedido_id',p_pedido_id,'tipo',v_tipo,'status',v_material.status,'status_material',v_status);
end;
$$;

create or replace function doox_v2.alterar_status(p_pedido_id uuid,p_novo_status text,p_observacao text default null,p_actor text default 'DOOX CORE V2')
returns jsonb
language plpgsql
as $$
declare
  v_atual text;
  v_novo text := upper(trim(coalesce(p_novo_status,'')));
begin
  select status_operacional into v_atual from doox_v2.pedidos where id=p_pedido_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_novo=v_atual then return jsonb_build_object('ok',true,'status',v_atual,'unchanged',true); end if;
  if not exists(select 1 from doox_v2.transicoes_status where status_atual=v_atual and proximo_status=v_novo and ativo=true) then
    raise exception 'Transição de status não permitida: % → %.',v_atual,v_novo;
  end if;

  update doox_v2.pedidos
  set status_operacional=v_novo,
      status_producao=case when v_novo='EM_PRODUCAO' then 'EM_PRODUCAO' when v_novo='FINALIZADO' then 'CONCLUIDA' else status_producao end,
      status_veiculacao=case when v_novo='PROGRAMADO' then 'PROGRAMADA' when v_novo='PUBLICADO' then 'PUBLICADA' when v_novo='FINALIZADO' then 'FINALIZADA' else status_veiculacao end,
      finalizado_em=case when v_novo='FINALIZADO' then now() else finalizado_em end
  where id=p_pedido_id;

  insert into doox_v2.historico_status(pedido_id,evento,status_anterior,status_novo,observacao,origem,alterado_por)
  values(p_pedido_id,'STATUS_ALTERADO',v_atual,v_novo,p_observacao,'DOOX_CORE',p_actor);
  return jsonb_build_object('ok',true,'status_anterior',v_atual,'status',v_novo);
end;
$$;

create or replace function doox_v2.confirmar_pagamento(p_pedido_id uuid,p_valor numeric,p_referencia text default null,p_metodo text default null,p_observacao text default null)
returns jsonb
language plpgsql
as $$
declare
  v_total numeric(12,2);
  v_atual text;
begin
  select valor_total,status_operacional into v_total,v_atual from doox_v2.pedidos where id=p_pedido_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if p_valor is null or p_valor<0 then p_valor:=v_total; end if;

  update doox_v2.pagamentos set status='RECEBIDO',valor=p_valor,referencia_externa=p_referencia,metodo=p_metodo,confirmado_em=now(),observacao=p_observacao
  where id=(select id from doox_v2.pagamentos where pedido_id=p_pedido_id order by criado_em desc limit 1);
  update doox_v2.pedidos set status_pagamento='RECEBIDO' where id=p_pedido_id;

  insert into doox_v2.historico_status(pedido_id,evento,campo,valor_anterior,valor_novo,observacao,origem)
  values(p_pedido_id,'PAGAMENTO_CONFIRMADO','status_pagamento','AGUARDANDO_PAGAMENTO','RECEBIDO',p_observacao,'DOOX_CORE');

  if v_atual='AGUARDANDO_PAGAMENTO' then perform doox_v2.alterar_status(p_pedido_id,'PAGAMENTO_RECEBIDO','Pagamento confirmado.','DOOX CORE V2'); end if;
  return jsonb_build_object('ok',true,'pedido_id',p_pedido_id,'status_pagamento','RECEBIDO','valor',p_valor);
end;
$$;

create or replace function doox_v2.aprovar_material(p_material_id uuid,p_aprovado boolean,p_motivo text default null)
returns jsonb
language plpgsql
as $$
declare
  v_pedido_id uuid;
  v_status text;
  v_all_ok boolean;
begin
  update doox_v2.materiais
  set status=case when p_aprovado then 'APROVADO' else 'REPROVADO' end,
      observacao=p_motivo,
      aprovado_em=case when p_aprovado then now() else null end
  where id=p_material_id returning pedido_id into v_pedido_id;
  if v_pedido_id is null then raise exception 'Material não encontrado.'; end if;

  v_status := doox_v2.recalcular_status_material(v_pedido_id);
  if p_aprovado then
    select bool_and(status='APROVADO') into v_all_ok from doox_v2.materiais where pedido_id=v_pedido_id and status not in ('SUBSTITUIDO','EXCLUIDO');
    if coalesce(v_all_ok,false) then update doox_v2.pedidos set status_material='APROVADO' where id=v_pedido_id; v_status:='APROVADO'; end if;
  end if;

  insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem)
  values(v_pedido_id,'MATERIAL_ANALISADO','status_material',v_status,p_motivo,'DOOX_CORE');
  return jsonb_build_object('ok',true,'pedido_id',v_pedido_id,'material_id',p_material_id,'status_material',v_status);
end;
$$;

create or replace function doox_v2.programar_pedido(p_pedido_id uuid,p_episodio_id uuid,p_momento_codigo text default null,p_posicao integer default null,p_programado_para timestamptz default null,p_observacao text default null)
returns jsonb
language plpgsql
as $$
begin
  if not exists(select 1 from doox_v2.pedidos where id=p_pedido_id) then raise exception 'Pedido não encontrado.'; end if;
  if p_episodio_id is not null and not exists(select 1 from doox_v2.episodios where id=p_episodio_id) then raise exception 'Episódio não encontrado.'; end if;

  insert into doox_v2.programacoes(pedido_id,episodio_id,momento_codigo,posicao_numero,programado_para,observacao)
  values(p_pedido_id,p_episodio_id,nullif(trim(p_momento_codigo),''),p_posicao,p_programado_para,p_observacao)
  on conflict(pedido_id) do update set episodio_id=excluded.episodio_id,momento_codigo=excluded.momento_codigo,posicao_numero=excluded.posicao_numero,programado_para=excluded.programado_para,observacao=excluded.observacao;
  update doox_v2.pedidos set episodio_id=p_episodio_id where id=p_pedido_id;
  return jsonb_build_object('ok',true,'pedido_id',p_pedido_id,'episodio_id',p_episodio_id,'momento_codigo',p_momento_codigo,'posicao_numero',p_posicao,'programado_para',p_programado_para);
end;
$$;

create or replace view doox_v2.v_pedidos as
select
  p.id,p.numero,p.codigo_doox,p.idempotency_key,p.tipo_participacao,
  c.nome,c.empresa,c.whatsapp,c.email,c.perfil,c.segmento,
  p.modalidade_codigo,p.modalidade_nome,p.faixa_codigo,p.faixa_nome,p.quantidade,p.valor_unitario,p.valor_total,
  p.status_operacional,p.status_pagamento,p.status_material,p.status_producao,p.status_veiculacao,
  p.rejeicao_motivo,p.mensagem_cliente,p.observacoes,p.origem,
  e.id as episodio_id,e.codigo as episodio_codigo,e.numero as episodio_numero,e.titulo as episodio_titulo,
  pr.momento_codigo,pr.posicao_numero,pr.programado_para,pr.publicado_em,
  p.criado_em,p.atualizado_em,p.finalizado_em
from doox_v2.pedidos p
join doox_v2.clientes c on c.id=p.cliente_id
left join doox_v2.episodios e on e.id=p.episodio_id
left join doox_v2.programacoes pr on pr.pedido_id=p.id;

create or replace view doox_v2.v_dashboard as
select
  count(*) filter(where status_operacional='SOLICITADO')::bigint as novos,
  count(*) filter(where status_operacional='EM_ANALISE')::bigint as em_analise,
  count(*) filter(where status_pagamento='AGUARDANDO_PAGAMENTO')::bigint as aguardando_pagamento,
  count(*) filter(where status_material in ('PENDENTE','PARCIAL','REPROVADO'))::bigint as material_pendente,
  count(*) filter(where status_producao='EM_PRODUCAO')::bigint as em_producao,
  count(*) filter(where status_veiculacao='PROGRAMADA')::bigint as programados,
  count(*) filter(where status_veiculacao='PUBLICADA')::bigint as publicados,
  count(*) filter(where status_operacional='FINALIZADO')::bigint as finalizados,
  coalesce(sum(valor_total) filter(where status_pagamento='RECEBIDO'),0)::numeric(12,2) as valor_recebido,
  coalesce(sum(valor_total),0)::numeric(12,2) as valor_solicitado
from doox_v2.pedidos;

-- Bucket de materiais V2. O upload é feito exclusivamente por URL assinada gerada pelo servidor.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'doox-v2-arquivos','doox-v2-arquivos',false,15728640,
  array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave']::text[]
)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- O schema V2 não deve ser acessado diretamente por anon/authenticated.
revoke all on all tables in schema doox_v2 from anon, authenticated;
revoke all on all sequences in schema doox_v2 from anon, authenticated;
revoke all on all functions in schema doox_v2 from anon, authenticated;
alter default privileges in schema doox_v2 revoke all on tables from anon, authenticated;
alter default privileges in schema doox_v2 revoke all on sequences from anon, authenticated;
alter default privileges in schema doox_v2 revoke all on functions from anon, authenticated;

commit;

-- Verificação após execução:
-- select * from doox_v2.modalidades order by ordem;
-- select * from doox_v2.faixas order by modalidade_id,ordem;
-- select * from doox_v2.v_dashboard;
