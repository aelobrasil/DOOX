import postgres from 'postgres';
import crypto from 'node:crypto';

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

async function catalog(){
  const modes=await db`select id,codigo,nome,descricao,exige_faixa,exige_logo,exige_audio,exclusivo_pessoa_fisica,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem from doox_v2.modalidades where ativo=true order by ordem,nome`;
  const ranges=await db`select f.id,f.modalidade_id,f.codigo,f.nome,f.inicio_segundos,f.fim_segundos,f.preco_unitario,f.ordem from doox_v2.faixas f join doox_v2.modalidades m on m.id=f.modalidade_id where f.ativo=true and m.ativo=true order by m.ordem,f.ordem`;
  return {ok:true,modalidades:modes.map(m=>({...m,faixas:ranges.filter(f=>String(f.modalidade_id)===String(m.id))}))};
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
    observacoes:String(body.observation||body.observacoes||'').trim()||null,origem:'SITE_HOCCO',beneficio:benefit,
    aceites:{termos_uso:true,regras_participacao:true,termo_empresa:type==='EMPRESA',versao_termos:'V2-2026-10-01',versao_regras:'V2-2026-10-01',versao_termo_empresa:type==='EMPRESA'?String(body.companyTermsVersion||'1.0-2026-09-20'):null,identificacao_assinatura:`ACEITE DIGITAL — ${name}`,user_agent:String(req.headers['user-agent']||'').slice(0,500)}
  };
  const rows=await db`select doox_v2.criar_pedido(${JSON.stringify(payload)}::jsonb) as data`;
  const data=rows?.[0]?.data;
  if(!data?.ok||!data.pedido_id||!data.codigo_doox)throw new Error('O banco não retornou a identificação do pedido.');
  const token=makeToken(data.pedido_id);
  const base=String(process.env.DOOX_PUBLIC_BASE_URL||`https://${req.headers.host||'doox-omega.vercel.app'}`).replace(/\/$/,'');
  return {ok:true,code:data.codigo_doox,codigoDoox:data.codigo_doox,technicalId:data.pedido_id,pedidoId:data.pedido_id,id:data.pedido_id,modality:data.modalidade_nome||data.modalidade,modalityCode:data.modalidade,quantity:Number(data.quantidade||1),unitPrice:Number(data.valor_unitario||0),total:Number(data.valor_total||0),status:data.status||'SOLICITADO',paymentStatus:data.status_pagamento||'AGUARDANDO_PAGAMENTO',trackingToken:token,trackingUrl:`${base}/?token=${encodeURIComponent(token)}`,requestId:idempotency};
}

async function tracking(token){
  const id=verifyToken(token);
  const rows=await db`select * from doox_v2.v_pedidos where id=${id}::uuid limit 1`;
  const p=rows?.[0];if(!p)throw new Error('Pedido não encontrado.');
  const mats=await db`select id,tipo,nome_original,mime_type,tamanho_bytes,status,enviado_em,aprovado_em from doox_v2.materiais where pedido_id=${id}::uuid order by enviado_em desc`;
  const payRows=await db`select status,valor,metodo,confirmado_em from doox_v2.pagamentos where pedido_id=${id}::uuid order by criado_em desc limit 1`;
  const pay=payRows?.[0]||{};
  return {ok:true,code:p.codigo_doox,status:p.status_operacional,statusLabel:STATUS_LABELS[p.status_operacional]||p.status_operacional,progressPercent:STATUS_PROGRESS[p.status_operacional]??10,updatedAt:p.atualizado_em,rejectionReason:p.rejeicao_motivo||'',observationClient:p.mensagem_cliente||'',discount:0,coupon:'',payment:{available:false,status:pay.status||p.status_pagamento,amountLabel:`Valor do pedido: R$ ${Number(p.valor_total||0).toFixed(2).replace('.',',')}`,pixPayload:''},materials:mats,materialReady:['NAO_EXIGIDO','RECEBIDO','APROVADO'].includes(p.status_material),receipt:{eligible:p.status_operacional==='FINALIZADO'||p.status_veiculacao==='FINALIZADA'}};
}

async function informPayment(token){
  const id=verifyToken(token);
  await db`insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem) values(${id}::uuid,'PAGAMENTO_INFORMADO','aviso_cliente','INFORMADO_PELO_CLIENTE','O participante informou que realizou o pagamento. A confirmação depende da DOOX.','SITE_HOCCO')`;
  return {ok:true,message:'Pagamento informado. A confirmação depende da conferência da DOOX.'};
}

function publicMessage(error){const raw=String(error?.message||'');const allow=[/Nome, WhatsApp e E-mail/i,/Modalidade inválida/i,/Tipo de participação inválido/i,/Nome da empresa/i,/Termos de Uso/i,/Regras de Participação/i,/Termo de Participação Empresarial/i,/faixa/i,/Quantidade inválida/i,/Pessoa física/i,/exclusiva para pessoa física/i,/Token de acompanhamento/i,/Pedido não encontrado/i,/Preço não configurado/i];return allow.some(r=>r.test(raw))?raw:'Não foi possível concluir a solicitação agora.';}

export default async function handler(req,res){
  const body=bodyOf(req);const action=actionOf(req,body);
  if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});
  if(action==='health'){if(!db)return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:false,schemaReady:false,version:'2.0.0'});try{const h=await db`select to_regclass('doox_v2.pedidos') is not null as ready`;return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:true,schemaReady:Boolean(h?.[0]?.ready),version:'2.0.0'});}catch(e){return json(res,200,{ok:true,service:'DOOX V2',databaseConfigured:true,schemaReady:false,version:'2.0.0'});}}
  if(!requireDb(res))return;
  try{
    if(action==='catalog')return json(res,200,await catalog());
    if(action==='registerRequest'&&req.method==='POST')return json(res,200,await registerRequest(req,body));
    if(action==='pedido')return json(res,200,await tracking(String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('token')||body.token||'')));
    if(action==='informarPagamento'&&req.method==='POST')return json(res,200,await informPayment(String(body.token||'')));
    return json(res,400,{ok:false,message:'Ação inválida.'});
  }catch(error){const ref=diag();console.error(`DOOX V2 ${action} [${ref}]`,error);return json(res,400,{ok:false,message:publicMessage(error),reference:ref});}
}
