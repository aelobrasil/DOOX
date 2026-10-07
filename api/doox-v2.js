import postgres from 'postgres';
import crypto from 'node:crypto';
import { pixPayload, pixPublicInfo } from './_hocco-pix.js';

const DATABASE_URL=String(process.env.DOOX_DATABASE_URL||'').trim();
const db=DATABASE_URL && /^postgres(?:ql)?:\/\//i.test(DATABASE_URL) ? postgres(DATABASE_URL,{ssl:'require',prepare:false,max:2,idle_timeout:20,connect_timeout:10}) : null;

const MODE_MAP={
  'Presença no Rodapé':'RODAPE',
  'Sponsor Overlay':'SPONSOR_OVERLAY',
  'Overlay + Áudio':'OVERLAY_AUDIO',
  'Empresa Patrocinadora do Episódio':'PATROCINADOR_EPISODIO',
  'Apoiador Individual':'APOIADOR_INDIVIDUAL',
};
const RANGE_MAP={'00:30–02:00':'F1','02:00–04:00':'F2','04:00–06:30':'F3','06:30–09:00':'F4','09:00–11:00':'F5'};
const STATUS_LABELS={SOLICITADO:'SOLICITADO',EM_ANALISE:'EM ANÁLISE',AGUARDANDO_PAGAMENTO:'AGUARDANDO PAGAMENTO',PAGAMENTO_RECEBIDO:'PAGAMENTO RECEBIDO',MATERIAL_PENDENTE:'MATERIAL PENDENTE',MATERIAL_RECEBIDO:'MATERIAL RECEBIDO',EM_PRODUCAO:'EM PRODUÇÃO',PROGRAMADO:'PROGRAMADO',PUBLICADO:'PUBLICADO',FINALIZADO:'FINALIZADO',REJEITADO:'REJEITADO',CANCELADO:'CANCELADO',ARQUIVADO:'ARQUIVADO'};
const STATUS_PROGRESS={SOLICITADO:10,EM_ANALISE:20,AGUARDANDO_PAGAMENTO:35,PAGAMENTO_RECEBIDO:45,MATERIAL_PENDENTE:55,MATERIAL_RECEBIDO:65,EM_PRODUCAO:78,PROGRAMADO:88,PUBLICADO:96,FINALIZADO:100,REJEITADO:100,CANCELADO:100,ARQUIVADO:100};

function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
function bodyOf(req){if(!req.body)return{};if(typeof req.body==='object')return req.body;try{return JSON.parse(req.body);}catch{return{};}}
function actionOf(req,body){return String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('action')||body.action||'health').trim();}
function requireDb(res){if(db)return true;json(res,503,{ok:false,code:'V2_DATABASE_UNAVAILABLE',message:'Serviço temporariamente indisponível.'});return false;}
function mapType(value){const v=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[._\/-]+/g,' ').replace(/\s+/g,' ');if(['empresa','pj','pessoa juridica'].includes(v))return'EMPRESA';if(['pessoa','pessoa fisica','pf','individual','apoiador individual'].includes(v))return'PESSOA_FISICA';const raw=String(value||'').trim().toUpperCase();return ['EMPRESA','PESSOA_FISICA'].includes(raw)?raw:'';}
function mapMode(value){if(MODE_MAP[value])return MODE_MAP[value];const v=String(value||'').trim().toUpperCase();return Object.values(MODE_MAP).includes(v)?v:'';}
function mapRange(value){if(!value)return null;if(RANGE_MAP[value])return RANGE_MAP[value];const v=String(value).trim().toUpperCase();return /^F[1-5]$/.test(v)?v:null;}
function positiveInt(v,f=1){const n=parseInt(v,10);return Number.isFinite(n)&&n>0?n:f;}
function trackingSecret(){const s=String(process.env.DOOX_TRACKING_SECRET||process.env.DOOX_ADMIN_SECRET||process.env.DOOX_ADMIN_SESSION_SECRET||'').trim();if(s)return s;if(DATABASE_URL)return crypto.createHash('sha256').update(`doox-v2:${DATABASE_URL}`).digest('hex');throw new Error('Acompanhamento não configurado.');}
function sign(v){return crypto.createHmac('sha256',trackingSecret()).update(v).digest('base64url');}
function makeToken(id){const days=positiveInt(process.env.DOOX_TRACKING_TTL_DAYS,3650);const expires=Date.now()+days*86400000;const payload=`${id}.${expires}`;return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;}
function verifyToken(token){const [enc,sig]=String(token||'').split('.');if(!enc||!sig)throw new Error('Token de acompanhamento inválido.');const payload=Buffer.from(enc,'base64url').toString('utf8');const expected=sign(payload);const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Token de acompanhamento inválido.');const [id,exp]=payload.split('.');if(!id||Date.now()>Number(exp))throw new Error('Token de acompanhamento expirado.');return id;}
function cleanDigits(v){return String(v||'').replace(/\D/g,'');}
function diag(){return crypto.randomBytes(4).toString('hex').toUpperCase();}
function brl(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);}

async function currentEpisode(){
  const rows=await db`select id,codigo,numero,titulo,status from doox_v2.episodios where status in ('ABERTO','PLANEJADO') order by case when status='ABERTO' then 0 else 1 end,numero nulls last,criado_em limit 1`;
  return rows?.[0]||null;
}

async function catalog(){
  const episode=await currentEpisode();
  const episodeId=episode?.id||null;
  const [modes,ranges,usage,queue]=await Promise.all([
    db`select id,codigo,nome,descricao,exige_faixa,exige_logo,exige_audio,exclusivo_pessoa_fisica,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem from doox_v2.modalidades where ativo=true order by ordem,nome`,
    db`select f.id,f.modalidade_id,f.codigo,f.nome,f.inicio_segundos,f.fim_segundos,f.preco_unitario,f.ordem from doox_v2.faixas f join doox_v2.modalidades m on m.id=f.modalidade_id where f.ativo=true and m.ativo=true order by m.ordem,f.ordem`,
    db`select m.id as modalidade_id,coalesce(ec.capacidade,m.capacidade_padrao) as capacidade,coalesce(sum(r.quantidade) filter(where r.status in ('RESERVADA','OCUPADA') and (r.expira_em is null or r.expira_em>now())),0)::int as reservado from doox_v2.modalidades m left join doox_v2.episodio_capacidades ec on ec.modalidade_id=m.id and ec.episodio_id=${episodeId}::uuid and ec.ativo=true left join doox_v2.reservas r on r.modalidade_id=m.id and r.episodio_id is not distinct from ${episodeId}::uuid where m.ativo=true group by m.id,ec.capacidade,m.capacidade_padrao`,
    db`select modalidade_id,count(*)::int as total from doox_v2.fila_espera where episodio_id is not distinct from ${episodeId}::uuid and status in ('AGUARDANDO','ELEGIVEL') group by modalidade_id`
  ]);
  const usageMap=new Map(usage.map(x=>[String(x.modalidade_id),x]));
  const queueMap=new Map(queue.map(x=>[String(x.modalidade_id),Number(x.total||0)]));
  return {ok:true,episode:episode?{id:episode.id,code:episode.codigo,number:episode.numero,title:episode.titulo,status:episode.status}:null,modalidades:modes.map(m=>{const u=usageMap.get(String(m.id))||{capacidade:m.capacidade_padrao,reservado:0};const capacity=Number(u.capacidade||m.capacidade_padrao||0),reserved=Number(u.reservado||0);return {...m,capacity,reserved,available:Math.max(capacity-reserved,0),queueCount:queueMap.get(String(m.id))||0,faixas:ranges.filter(f=>String(f.modalidade_id)===String(m.id))};})};
}

async function registerRequest(req,body){
  if(body.website) throw new Error('Solicitação recusada.');
  const mode=mapMode(body.modality||body.modalidade);
  const type=mapType(body.type||body.tipo_participacao||body.audience)||(mode==='APOIADOR_INDIVIDUAL'?'PESSOA_FISICA':'EMPRESA');
  const range=mapRange(body.moment||body.faixa);
  const name=String(body.name||body.nome||'').trim();
  const company=String(body.company||body.empresa||'').trim();
  const email=String(body.email||'').trim().toLowerCase();
  const whatsapp=cleanDigits(body.whatsapp);
  if(!name||!email||!whatsapp)throw new Error('Nome, WhatsApp e E-mail são obrigatórios.');
  if(!mode)throw new Error('Modalidade inválida.');
  if(!['EMPRESA','PESSOA_FISICA'].includes(type))throw new Error('Tipo de participação inválido.');
  if(type==='EMPRESA'&&!company)throw new Error('Nome da empresa é obrigatório.');
  if(body.termsAccepted!==true||body.rulesAccepted!==true)throw new Error('Os Termos de Uso e as Regras de Participação precisam ser aceitos.');
  if(type==='EMPRESA'&&body.companyTermsAccepted!==true)throw new Error('O Termo de Participação Empresarial precisa ser aceito.');

  const idempotency=String(body.clientRequestId||body.idempotency_key||crypto.randomUUID()).trim();
  const benefit=Number(body.discount||0)>0?{tipo:'CONDICAO',codigo:String(body.coupon||'').trim()||null,descricao:String(body.benefit||'').trim()||`${Number(body.discount)}% de desconto para quem vier pela HOCCO`}:null;
  const payload={
    idempotency_key:idempotency,tipo_participacao:type,modalidade:mode,faixa:range,quantidade:positiveInt(body.quantity??body.quantidade,1),
    nome:name,empresa:company||null,whatsapp,email,perfil:String(body.profile||body.perfil||'').trim()||null,segmento:String(body.segment||body.segmento||'').trim()||null,
    observacoes:String(body.observation||body.observacoes||'').trim()||null,origem:'SITE_HOCCO_V108',beneficio:benefit,
    aceites:{termos_uso:true,regras_participacao:true,termo_empresa:type==='EMPRESA',versao_termos:'V108-2026-10-06',versao_regras:'V108-2026-10-06',versao_termo_empresa:type==='EMPRESA'?String(body.companyTermsVersion||'V108-2026-10-06'):null,identificacao_assinatura:`ACEITE DIGITAL — ${name}`,user_agent:String(req.headers['user-agent']||'').slice(0,500)}
  };
  const rows=await db`select doox_v2.criar_pedido(${JSON.stringify(payload)}::jsonb) as data`;
  const data=rows?.[0]?.data;
  if(!data?.ok||!data.pedido_id||!data.codigo_doox)throw new Error('O banco não retornou a identificação do pedido.');
  const [reservationRows,queueRows]=await Promise.all([
    db`select id,status,episodio_id,quantidade,reservado_em,expira_em from doox_v2.reservas where pedido_id=${data.pedido_id}::uuid limit 1`,
    db`select id,status,episodio_id,quantidade,ordem_fila,entrou_em from doox_v2.fila_espera where pedido_id=${data.pedido_id}::uuid limit 1`
  ]);
  const reservation=reservationRows?.[0]||null,wait=queueRows?.[0]||null;
  const token=makeToken(data.pedido_id);
  const base=String(process.env.DOOX_PUBLIC_BASE_URL||`https://${req.headers.host||'doox-omega.vercel.app'}`).replace(/\/$/,'');
  return {ok:true,code:data.codigo_doox,codigoDoox:data.codigo_doox,technicalId:data.pedido_id,pedidoId:data.pedido_id,id:data.pedido_id,modality:data.modalidade_nome||data.modalidade,modalityCode:data.modalidade,range:data.faixa||null,rangeName:data.faixa_nome||null,quantity:Number(data.quantidade||1),unitPrice:Number(data.valor_unitario||0),total:Number(data.valor_total||0),status:data.status||'SOLICITADO',paymentStatus:data.status_pagamento||'AGUARDANDO_PAGAMENTO',availability:reservation?'RESERVADA':wait?'FILA':'PENDENTE',queuePosition:wait?Number(wait.ordem_fila||0):null,trackingToken:token,trackingUrl:`${base}/acompanhar?token=${encodeURIComponent(token)}`,orderUrl:`${base}/pedido?token=${encodeURIComponent(token)}`,paymentUrl:`${base}/pagamento?token=${encodeURIComponent(token)}`,requestId:idempotency};
}

async function tracking(token){
  const id=verifyToken(token);
  const p=(await db`select * from doox_v2.v_pedidos where id=${id}::uuid limit 1`)?.[0];
  if(!p)throw new Error('Pedido não encontrado.');
  const [mats,payRows,hist,reservationRows,queueRows]=await Promise.all([
    db`select id,tipo,nome_original,mime_type,tamanho_bytes,status,enviado_em,aprovado_em,observacao from doox_v2.materiais where pedido_id=${id}::uuid and status not in ('SUBSTITUIDO','EXCLUIDO') order by enviado_em desc`,
    db`select status,valor,metodo,confirmado_em,observacao from doox_v2.pagamentos where pedido_id=${id}::uuid order by criado_em desc limit 1`,
    db`select evento,status_anterior,status_novo,campo,valor_anterior,valor_novo,observacao,origem,criado_em from doox_v2.historico_status where pedido_id=${id}::uuid order by criado_em asc limit 250`,
    db`select status,quantidade,reservado_em,expira_em from doox_v2.reservas where pedido_id=${id}::uuid limit 1`,
    db`select status,quantidade,ordem_fila,entrou_em from doox_v2.fila_espera where pedido_id=${id}::uuid limit 1`
  ]);
  const pay=payRows?.[0]||{},reservation=reservationRows?.[0]||null,wait=queueRows?.[0]||null;
  const amount=Number(pay.valor??p.valor_total??0),paymentOpen=!['RECEBIDO','ISENTO','CANCELADO','ESTORNADO'].includes(String(pay.status||p.status_pagamento));
  const txid=String(p.codigo_doox||'HOCCO').replace(/[^A-Za-z0-9]/g,'').slice(0,25)||'HOCCO';
  return {ok:true,technicalId:id,code:p.codigo_doox,client:{name:p.nome||'',company:p.empresa||'',profile:p.perfil||''},modality:p.modalidade_nome,modalityCode:p.modalidade_codigo,range:p.faixa_nome||'',rangeCode:p.faixa_codigo||'',quantity:Number(p.quantidade||1),unitPrice:Number(p.valor_unitario||0),total:Number(p.valor_total||0),status:p.status_operacional,statusLabel:STATUS_LABELS[p.status_operacional]||p.status_operacional,progressPercent:STATUS_PROGRESS[p.status_operacional]??10,updatedAt:p.atualizado_em,rejectionReason:p.rejeicao_motivo||'',observationClient:p.mensagem_cliente||'',availability:reservation?'RESERVADA':wait?'FILA':'PENDENTE',queuePosition:wait?Number(wait.ordem_fila||0):null,payment:{available:paymentOpen,status:pay.status||p.status_pagamento,amount,amountLabel:brl(amount),pixPayload:paymentOpen?pixPayload({amount,txid}):'',pixKey:paymentOpen?pixPublicInfo.key:'',merchantName:paymentOpen?pixPublicInfo.merchantName:'',merchantCity:paymentOpen?pixPublicInfo.merchantCity:''},materials:mats,materialReady:['NAO_EXIGIDO','RECEBIDO','APROVADO'].includes(p.status_material),materialStatus:p.status_material,productionStatus:p.status_producao,publicationStatus:p.status_veiculacao,episode:p.episodio_id?{id:p.episodio_id,code:p.episodio_codigo,number:p.episodio_numero,title:p.episodio_titulo,slot:p.momento_codigo,position:p.posicao_numero,scheduledAt:p.programado_para,publishedAt:p.publicado_em}:null,history:hist,receipt:{eligible:p.status_operacional==='FINALIZADO'||p.status_veiculacao==='FINALIZADA'}};
}

async function informPayment(token){
  const id=verifyToken(token);
  await db`insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem) values(${id}::uuid,'PAGAMENTO_INFORMADO','aviso_cliente','INFORMADO_PELO_CLIENTE','O participante informou que realizou o pagamento. A confirmação depende da DOOX.','SITE_HOCCO_V108')`;
  return {ok:true,message:'Pagamento informado. A confirmação depende da conferência da DOOX.'};
}

function publicMessage(error){const raw=String(error?.message||'');const allow=[/Nome, WhatsApp e E-mail/i,/Modalidade inválida/i,/Tipo de participação inválido/i,/Nome da empresa/i,/Termos de Uso/i,/Regras de Participação/i,/Termo de Participação Empresarial/i,/faixa/i,/Quantidade inválida/i,/Pessoa física/i,/exclusiva para pessoa física/i,/Token de acompanhamento/i,/Pedido não encontrado/i,/Preço não configurado/i];return allow.some(r=>r.test(raw))?raw:'Não foi possível concluir a solicitação agora.';}

export default async function handler(req,res){
  const body=bodyOf(req);const action=actionOf(req,body);
  if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});
  if(action==='health'){if(!db)return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:false,schemaReady:false,version:'2.1.0'});try{const h=await db`select to_regclass('doox_v2.pedidos') is not null as ready`;return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:true,schemaReady:Boolean(h?.[0]?.ready),version:'2.1.0'});}catch{return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:true,schemaReady:false,version:'2.1.0'});}}
  if(!requireDb(res))return;
  try{
    if(action==='catalog')return json(res,200,await catalog());
    if(action==='registerRequest'&&req.method==='POST')return json(res,200,await registerRequest(req,body));
    if(action==='pedido')return json(res,200,await tracking(String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('token')||body.token||'')));
    if(action==='informarPagamento'&&req.method==='POST')return json(res,200,await informPayment(String(body.token||'')));
    return json(res,400,{ok:false,message:'Ação inválida.'});
  }catch(error){const ref=diag();console.error(`DOOX V2 ${action} [${ref}]`,error);return json(res,400,{ok:false,message:publicMessage(error),reference:ref});}
}
