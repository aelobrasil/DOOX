import postgres from 'postgres';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { pixPayload, pixPublicInfo } from './_hocco-pix.js';

const DATABASE_URL=String(process.env.DOOX_DATABASE_URL||'').trim();
const db=DATABASE_URL&&/^postgres(?:ql)?:\/\//i.test(DATABASE_URL)?postgres(DATABASE_URL,{ssl:'require',prepare:false,max:3,idle_timeout:20,connect_timeout:10}):null;
const MODES=new Set(['RODAPE','SPONSOR_OVERLAY','OVERLAY_AUDIO','PATROCINADOR_EPISODIO']);
const RANGE_MAP={'00:30–02:00':'F1','02:00–04:00':'F2','04:00–06:30':'F3','06:30–09:00':'F4','09:00–11:00':'F5'};
const ACTIVE_LABEL={SOLICITADO:'Em fila',EM_ANALISE:'Recebido',AGUARDANDO_PAGAMENTO:'Recebido',PAGAMENTO_RECEBIDO:'Recebido',MATERIAL_PENDENTE:'Recebido',MATERIAL_RECEBIDO:'Recebido',EM_PRODUCAO:'Gerenciado',PROGRAMADO:'Gerenciado',PUBLICADO:'Veiculado',FINALIZADO:'Finalizado',REJEITADO:'Não aprovado',CANCELADO:'Cancelado',ARQUIVADO:'Arquivado'};

function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
function bodyOf(req){if(!req.body)return{};if(typeof req.body==='object')return req.body;try{return JSON.parse(req.body);}catch{return{}}}
function actionOf(req,b){return String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('action')||b.action||'health').trim();}
function requireDb(res){if(db)return true;json(res,503,{ok:false,message:'Serviço temporariamente indisponível.'});return false;}
function clean(v){return String(v??'').trim();}
function digits(v){return String(v||'').replace(/\D/g,'');}
function positiveInt(v,f=1){const n=parseInt(v,10);return Number.isFinite(n)&&n>0?n:f;}
function rangeCode(v){if(!v)return null;if(RANGE_MAP[v])return RANGE_MAP[v];const s=clean(v).toUpperCase();return /^F[1-5]$/.test(s)?s:null;}
function trackingSecret(){const s=String(process.env.DOOX_TRACKING_SECRET||process.env.DOOX_ADMIN_SECRET||process.env.DOOX_ADMIN_SESSION_SECRET||'').trim();if(s)return s;if(DATABASE_URL)return crypto.createHash('sha256').update(`doox-v2:${DATABASE_URL}`).digest('hex');throw new Error('Acompanhamento não configurado.');}
function sign(v){return crypto.createHmac('sha256',trackingSecret()).update(v).digest('base64url');}
function makeToken(id){const expires=Date.now()+positiveInt(process.env.DOOX_TRACKING_TTL_DAYS,3650)*86400000;const payload=`${id}.${expires}`;return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;}
function verifyToken(token){const [enc,sig]=clean(token).split('.');if(!enc||!sig)throw new Error('Token de acompanhamento inválido.');const payload=Buffer.from(enc,'base64url').toString('utf8');const expected=sign(payload);const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Token de acompanhamento inválido.');const [id,exp]=payload.split('.');if(!id||Date.now()>Number(exp))throw new Error('Token de acompanhamento expirado.');return id;}
function publicError(e){const raw=String(e?.message||'');const ok=[/obrigatório/i,/inválid/i,/Selecione/i,/Termos/i,/Regras/i,/empresa/i,/Token/i,/não encontrado/i,/Preço/i,/Quantidade/i];return ok.some(r=>r.test(raw))?raw:'Não foi possível concluir a solicitação agora.';}

async function catalog(){
  const modes=await db`select id,codigo,nome,descricao,exige_faixa,exige_logo,exige_audio,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem from doox_v2.modalidades where ativo=true and codigo in ('RODAPE','SPONSOR_OVERLAY','OVERLAY_AUDIO','PATROCINADOR_EPISODIO') order by ordem`;
  const ranges=await db`select f.id,f.modalidade_id,f.codigo,f.nome,f.inicio_segundos,f.fim_segundos,f.preco_unitario,f.ordem from doox_v2.faixas f join doox_v2.modalidades m on m.id=f.modalidade_id where f.ativo=true and m.ativo=true and m.codigo in ('SPONSOR_OVERLAY','OVERLAY_AUDIO') order by m.ordem,f.ordem`;
  return {ok:true,modalidades:modes.map(m=>({...m,faixas:ranges.filter(f=>String(f.modalidade_id)===String(m.id))})),appSponsor:{price:149.90,slots:10,periodDays:30}};
}

async function sponsors(){
  const rows=await db`select empresa,perfil,segmento,criado_em from doox_v2.v_pedidos where modalidade_codigo='PATROCINIO_APP' and status_pagamento='RECEBIDO' and criado_em >= now()-interval '30 days' and status_operacional not in ('REJEITADO','CANCELADO','ARQUIVADO') order by criado_em desc limit 10`;
  return {ok:true,price:149.90,slots:10,active:rows};
}

async function ensureSponsorMode(){
  await db`insert into doox_v2.modalidades(codigo,nome,descricao,ativo,exige_faixa,exige_logo,exige_audio,exclusivo_pessoa_fisica,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem)
    values('PATROCINIO_APP','Patrocínio do App','Patrocínio mensal da área de empresas apoiadoras do app HOCCO.',true,false,true,false,false,10,1,1,149.90,90)
    on conflict(codigo) do update set nome=excluded.nome,descricao=excluded.descricao,ativo=true,capacidade_padrao=10,quantidade_minima=1,quantidade_maxima=1,preco_base=149.90`;
}

async function createQueuedRequest(req,b,{sponsor=false}={}){
  if(b.website)throw new Error('Solicitação recusada.');
  if(sponsor)await ensureSponsorMode();
  const mode=sponsor?'PATROCINIO_APP':clean(b.modality||b.modalidade).toUpperCase();
  if(!sponsor&&!MODES.has(mode))throw new Error('Modalidade inválida.');
  const name=clean(b.name||b.nome);const company=clean(b.company||b.empresa);const email=clean(b.email).toLowerCase();const whatsapp=digits(b.whatsapp);
  if(!name||!company||!email||!whatsapp)throw new Error('Empresa, responsável, WhatsApp e e-mail são obrigatórios.');
  if(b.termsAccepted!==true||b.rulesAccepted!==true||b.companyTermsAccepted!==true)throw new Error('Os termos e as regras de participação precisam ser aceitos.');
  const payload={idempotency_key:clean(b.clientRequestId||crypto.randomUUID()),tipo_participacao:'EMPRESA',modalidade:mode,faixa:sponsor?null:rangeCode(b.moment||b.faixa),quantidade:sponsor?1:positiveInt(b.quantity||b.quantidade,1),nome:name,empresa:company,whatsapp,email,perfil:clean(b.profile||b.perfil)||null,segmento:clean(b.segment||b.segmento)||null,observacoes:clean(b.observation||b.observacoes)||null,origem:sponsor?'SITE_PATROCINIO_APP':'SITE_HOCCO_V3',beneficio:clean(b.benefit)?{tipo:'BENEFICIO',codigo:clean(b.coupon)||null,descricao:clean(b.benefit)}:null,aceites:{termos_uso:true,regras_participacao:true,termo_empresa:true,versao_termos:'V3-2026-10-17',versao_regras:'V3-2026-10-17',versao_termo_empresa:'V3-2026-10-17',identificacao_assinatura:`ACEITE DIGITAL — ${name}`,user_agent:String(req.headers['user-agent']||'').slice(0,500)}};
  const r=await db`select doox_v2.criar_pedido(${JSON.stringify(payload)}::jsonb) as data`;const d=r?.[0]?.data;if(!d?.pedido_id)throw new Error('O banco não retornou a identificação da solicitação.');
  await db.begin(async sql=>{
    await sql`update doox_v2.pedidos set status_operacional='SOLICITADO',status_pagamento='CANCELADO',mensagem_cliente='Solicitação em fila. A participação ainda não foi confirmada pela DOOX Studios.' where id=${d.pedido_id}::uuid`;
    await sql`update doox_v2.pagamentos set status='CANCELADO',observacao='Cobrança não liberada: solicitação permanece em fila.' where pedido_id=${d.pedido_id}::uuid and status='AGUARDANDO_PAGAMENTO'`;
    await sql`insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem) values(${d.pedido_id}::uuid,'ENTROU_NA_FILA','fase_comercial','EM_FILA','A participação ainda depende de confirmação da DOOX Studios.','DOOX_V3')`;
  });
  const token=makeToken(d.pedido_id);const base=String(process.env.DOOX_PUBLIC_BASE_URL||`https://${req.headers.host||'doox-omega.vercel.app'}`).replace(/\/$/,'');
  return {ok:true,queued:true,code:d.codigo_doox,pedidoId:d.pedido_id,trackingToken:token,trackingUrl:`${base}/acompanhar?token=${encodeURIComponent(token)}`,modalityCode:mode,modality:d.modalidade_nome||mode,total:Number(d.valor_total||0),status:'SOLICITADO',publicStatus:'EM_FILA',message:'Solicitação recebida e adicionada à fila. Nenhuma veiculação ou cobrança foi confirmada.'};
}

function stageFor(p){
  const s=p.status_operacional;
  if(s==='SOLICITADO')return{key:'EM_FILA',label:'Em fila',index:0,confirmed:false};
  if(['REJEITADO','CANCELADO','ARQUIVADO'].includes(s))return{key:s,label:ACTIVE_LABEL[s],index:0,confirmed:false};
  if(['EM_ANALISE','AGUARDANDO_PAGAMENTO','PAGAMENTO_RECEBIDO','MATERIAL_PENDENTE','MATERIAL_RECEBIDO'].includes(s))return{key:'RECEBIDO',label:'Recebido',index:1,confirmed:true};
  if(['EM_PRODUCAO','PROGRAMADO'].includes(s))return{key:'GERENCIADO',label:'Gerenciado',index:2,confirmed:true};
  if(s==='PUBLICADO')return{key:'VEICULADO',label:'Veiculado',index:3,confirmed:true};
  if(s==='FINALIZADO')return{key:'FINALIZADO',label:'Finalizado',index:4,confirmed:true};
  return{key:s,label:ACTIVE_LABEL[s]||s,index:1,confirmed:true};
}

async function tracking(token){
  const id=verifyToken(token);const p=(await db`select * from doox_v2.v_pedidos where id=${id}::uuid limit 1`)[0];if(!p)throw new Error('Solicitação não encontrada.');
  const [mats,pays,hist]=await Promise.all([db`select id,tipo,nome_original,mime_type,tamanho_bytes,status,observacao,enviado_em,aprovado_em from doox_v2.materiais where pedido_id=${id}::uuid and status<>'EXCLUIDO' order by enviado_em desc`,db`select status,valor,metodo,confirmado_em,observacao from doox_v2.pagamentos where pedido_id=${id}::uuid order by criado_em desc limit 1`,db`select evento,status_anterior,status_novo,campo,valor_novo,observacao,criado_em from doox_v2.historico_status where pedido_id=${id}::uuid order by criado_em desc limit 30`]);
  const stage=stageFor(p),pay=pays[0]||{};let payment={available:false,status:pay.status||p.status_pagamento,amount:Number(p.valor_total||0),pixPayload:'',qrDataUrl:'',publicInfo:null};
  if(stage.confirmed&&p.status_pagamento==='AGUARDANDO_PAGAMENTO'){
    const payload=pixPayload({amount:Number(p.valor_total||0),txid:String(p.codigo_doox||'').replace(/[^A-Za-z0-9]/g,'').slice(-25)});payment={...payment,available:true,pixPayload:payload,qrDataUrl:await QRCode.toDataURL(payload,{width:280,margin:1}),publicInfo:pixPublicInfo};
  }
  return {ok:true,code:p.codigo_doox,technicalId:p.id,stage,rawStatus:p.status_operacional,modality:p.modalidade_nome,modalityCode:p.modalidade_codigo,range:p.faixa_nome,quantity:Number(p.quantidade||1),unitPrice:Number(p.valor_unitario||0),total:Number(p.valor_total||0),company:p.empresa,name:p.nome,profile:p.perfil,segment:p.segmento,episode:p.episodio_codigo?{code:p.episodio_codigo,number:p.episodio_numero,title:p.episodio_titulo}:null,payment,materials:mats,history:hist,message:p.mensagem_cliente||'',materialUploadAvailable:stage.confirmed&&!['FINALIZADO','REJEITADO','CANCELADO','ARQUIVADO'].includes(p.status_operacional),updatedAt:p.atualizado_em};
}

async function informPayment(token){const id=verifyToken(token);const p=(await db`select status_operacional,status_pagamento from doox_v2.pedidos where id=${id}::uuid limit 1`)[0];if(!p)throw new Error('Solicitação não encontrada.');if(p.status_operacional==='SOLICITADO')throw new Error('A participação ainda está em fila e não possui cobrança liberada.');await db`insert into doox_v2.historico_status(pedido_id,evento,campo,valor_novo,observacao,origem) values(${id}::uuid,'PAGAMENTO_INFORMADO','aviso_cliente','INFORMADO','O cliente informou pagamento. A confirmação depende da DOOX.','SITE_HOCCO_V3')`;return{ok:true,message:'Pagamento informado. A DOOX fará a conferência.'};}

export default async function handler(req,res){
  const b=bodyOf(req),a=actionOf(req,b);if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});
  if(a==='health'){if(!db)return json(res,200,{ok:true,service:'DOOX V3',databaseConfigured:false});try{const h=await db`select to_regclass('doox_v2.pedidos') is not null as ready`;return json(res,200,{ok:true,service:'DOOX V3',databaseConfigured:true,schemaReady:Boolean(h?.[0]?.ready),version:'3.0.0'});}catch{return json(res,200,{ok:true,service:'DOOX V3',databaseConfigured:true,schemaReady:false,version:'3.0.0'});}}
  if(!requireDb(res))return;
  try{
    if(a==='catalog')return json(res,200,await catalog());
    if(a==='sponsors')return json(res,200,await sponsors());
    if(a==='registerRequest'&&req.method==='POST')return json(res,200,await createQueuedRequest(req,b));
    if(a==='sponsorRequest'&&req.method==='POST')return json(res,200,await createQueuedRequest(req,b,{sponsor:true}));
    if(a==='tracking')return json(res,200,await tracking(clean(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('token')||b.token)));
    if(a==='informPayment'&&req.method==='POST')return json(res,200,await informPayment(clean(b.token)));
    return json(res,400,{ok:false,message:'Ação inválida.'});
  }catch(e){const ref=crypto.randomBytes(4).toString('hex').toUpperCase();console.error(`DOOX V3 ${a} [${ref}]`,e);return json(res,400,{ok:false,message:publicError(e),reference:ref});}
}
