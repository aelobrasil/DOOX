import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { pixPayload, pixPublicInfo } from './_hocco-pix.js';
import { HOCCO_API_VERSION, HOCCO_SOURCE_TAG, HOCCO_PUBLIC_BASE_URL, hoccoConfigOk, hoccoKeyType, hoccoProjectRef, hoccoSupabase, HOCCO_SUPABASE_SECRET_KEY } from './_hocco-supabase.js';

const MODE={ 'Presença no Rodapé':'RODAPE','Sponsor Overlay':'SPONSOR_OVERLAY','Overlay + Áudio':'OVERLAY_AUDIO','Empresa Patrocinadora do Episódio':'PATROCINADOR_EPISODIO','Apoiador Individual':'APOIADOR_INDIVIDUAL' };
const NAME=Object.fromEntries(Object.entries(MODE).map(([k,v])=>[v,k]));
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function actionOf(req,b){return String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('action')||b.action||'health').trim().toLowerCase()}
function clean(v,n=300){return String(v??'').trim().slice(0,n)}
function email(v){const s=clean(v,180).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:''}
function phone(v){return clean(v,30).replace(/\D/g,'').slice(0,15)}
function tokenFor(id){return crypto.createHmac('sha256',HOCCO_SUPABASE_SECRET_KEY).update('track:'+id).digest('base64url')}
function tokenOk(id,t){const a=Buffer.from(clean(t,100)),b=Buffer.from(tokenFor(id));return a.length===b.length&&crypto.timingSafeEqual(a,b)}
async function health(){const diagnostic={keyType:hoccoKeyType(),projectRef:hoccoProjectRef()};if(!hoccoConfigOk())return{ok:false,service:'HOCCO API',configured:false,database:false,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,diagnostic};try{const rows=await hoccoSupabase('/rest/v1/modalidades?select=id&ativo=eq.true&limit=1');return{ok:true,service:'HOCCO API',configured:true,database:Array.isArray(rows),version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,diagnostic}}catch(e){console.error('HOCCO HEALTH',e);return{ok:false,service:'HOCCO API',configured:true,database:false,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,error:'DATABASE_UNAVAILABLE',diagnostic}}}
async function catalog(){const [mods,prices,faixas]=await Promise.all([hoccoSupabase('/rest/v1/modalidades?select=id,codigo,nome,descricao,tipo_participacao&ativo=eq.true'),hoccoSupabase('/rest/v1/precos?select=modalidade_id,faixa_id,valor&ativo=eq.true&or=(fim_vigencia.is.null,fim_vigencia.gt.now())'),hoccoSupabase('/rest/v1/faixas?select=id,modalidade_id,codigo,nome,inicio_segundos,fim_segundos&ativo=eq.true')]);return{ok:true,modalidades:mods,precos:prices,faixas,version:HOCCO_API_VERSION}}
async function insertClient(p){
 const tipo=p.type==='PESSOA_FISICA'?'PESSOA_FISICA':'EMPRESA',nome=clean(p.name,160),whatsapp=phone(p.whatsapp),mail=email(p.email),segmento=clean(p.segment,160);
 if(!nome)throw Error('Nome obrigatório.');if(whatsapp.length<10)throw Error('WhatsApp obrigatório.');if(!mail)throw Error('E-mail obrigatório.');if(tipo==='EMPRESA'&&!segmento)throw Error('Segmento da empresa obrigatório.');
 const rows=await hoccoSupabase('/rest/v1/clientes?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({tipo,nome,whatsapp,email:mail,perfil_site:clean(p.profile,250)||null,segmento:segmento||null})});
 if(!rows?.[0]?.id)throw Error('Não foi possível registrar o cliente.');return rows[0].id;
}
async function registerRequest(req,p){
 if(p.website)throw Error('Solicitação inválida.');
 const tipo=p.type==='PESSOA_FISICA'?'PESSOA_FISICA':'EMPRESA',modalidade=MODE[clean(p.modality)]||clean(p.modality).toUpperCase(),faixa=clean(p.moment,10).toUpperCase()||null,qty=Math.max(1,Math.min(50,Number(p.quantity)||1));
 if(tipo==='PESSOA_FISICA'&&modalidade!=='APOIADOR_INDIVIDUAL')throw Error('Pessoa física participa somente como Apoiador Individual.');
 if(tipo==='EMPRESA'&&modalidade==='APOIADOR_INDIVIDUAL')throw Error('Apoiador Individual é exclusivo para pessoa física.');
 if(!p.termsAccepted||!p.rulesAccepted)throw Error('Aceite os Termos de Uso e as Regras de Participação.');
 if(tipo==='EMPRESA'&&!p.companyTermsAccepted)throw Error('Aceite o Termo Empresarial.');
 const idem=clean(p.clientRequestId||p.idempotency_key,100)||crypto.randomUUID();
 let existing=await hoccoSupabase(`/rest/v1/pedidos?select=*&idempotency_key=eq.${encodeURIComponent(idem)}&limit=1`);
 let row=existing?.[0],duplicate=Boolean(row);
 if(!row){
   const cliente=await insertClient(p);
   const rows=await hoccoSupabase('/rest/v1/rpc/criar_pedido',{method:'POST',body:JSON.stringify({p_cliente_id:cliente,p_modalidade:modalidade,p_faixa:faixa,p_quantidade:qty,p_observacao:clean(p.observation,1500)||null,p_idempotency_key:idem,p_origem:'SITE_1',p_criado_por:'SITE_PUBLICO'})});
   row=rows?.[0]; if(!row?.pedido_id)throw Error('O banco não retornou a identificação completa do pedido.');
   await hoccoSupabase('/rest/v1/aceites',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({pedido_id:row.pedido_id,termos_uso:true,regras_participacao:true,termo_empresa:tipo==='EMPRESA',versao_termos:'2026-09',versao_regras:'2026-09',versao_termo_empresa:tipo==='EMPRESA'?(clean(p.companyTermsVersion,50)||'1.0-2026-09-20'):null,identificacao_assinatura:clean(p.name,160),aceito_em:new Date().toISOString(),user_agent:clean(req.headers['user-agent'],500)})});
 } else row={pedido_id:row.id,codigo_doox:row.codigo_doox,modalidade:row.modalidade,faixa:row.faixa,quantidade:row.quantidade,valor_unitario:row.valor_unitario,valor_total:row.valor_total,status_operacional:row.status_operacional,status_pagamento:row.status_pagamento};
 const id=row.pedido_id,code=row.codigo_doox,tok=tokenFor(id),base=HOCCO_PUBLIC_BASE_URL||`https://${req.headers.host||''}`,trackingUrl=`${base}/?codigo=${encodeURIComponent(code)}&token=${encodeURIComponent(tok)}#acompanhar`;
 return{ok:true,duplicate,technicalId:id,id,pedidoId:id,codigo_doox:code,numeroExibicao:code,trackingToken:tok,trackingUrl,modalidade:row.modalidade,modalidadeNome:NAME[row.modalidade]||row.modalidade,faixa:row.faixa,quantidade:Number(row.quantidade||1),unitPrice:Number(row.valor_unitario||0),valorUnitario:Number(row.valor_unitario||0),total:Number(row.valor_total||0),valorTotal:Number(row.valor_total||0),status:row.status_operacional,statusPagamento:row.status_pagamento,requestId:idem};
}
async function track(req,b){const u=new URL(req.url,`https://${req.headers.host||'localhost'}`),code=clean(u.searchParams.get('codigo')||b.codigo||b.code,40).toUpperCase(),tok=clean(u.searchParams.get('token')||b.token,100);if(!code)return{ok:false,erro:'CODIGO_INVALIDO'};const rows=await hoccoSupabase(`/rest/v1/pedidos?select=id,codigo_doox,modalidade,faixa,quantidade,valor_unitario,valor_total,status_operacional,status_pagamento,status_material,status_producao,status_veiculacao,criado_em&codigo_doox=eq.${encodeURIComponent(code)}&limit=1`),p=rows?.[0];if(!p||!tokenOk(p.id,tok))return{ok:false,erro:'DADOS_DE_ACOMPANHAMENTO_INVALIDOS'};const data={ok:true,codigo_doox:p.codigo_doox,modalidade:NAME[p.modalidade]||p.modalidade,faixa:p.faixa,quantidade:p.quantidade,valor_unitario:p.valor_unitario,valor_total:p.valor_total,status:p.status_operacional,status_operacional:p.status_operacional,status_pagamento:p.status_pagamento,status_material:p.status_material,status_producao:p.status_producao,status_veiculacao:p.status_veiculacao,criado_em:p.criado_em};if(p.status_pagamento==='AGUARDANDO_PAGAMENTO'){const payload=pixPayload({amount:Number(p.valor_total||0),txid:String(p.codigo_doox).replace(/[^A-Z0-9]/gi,'').slice(0,25)});data.pagamento_pix={...pixPublicInfo,payload,qrDataUrl:await QRCode.toDataURL(payload,{width:320,margin:2,errorCorrectionLevel:'M'})}}return data}
function publicMessage(e){const raw=String(e?.message||'');const allow=[/obrigat/i,/Modalidade/i,/Quantidade/i,/Faixa/i,/Pessoa física/i,/Apoiador Individual/i,/Termos/i,/Termo Empresarial/i,/Preço não configurado/i,/Solicitação inválida/i,/indispon/i];return allow.some(x=>x.test(raw))?raw:'Não foi possível concluir a solicitação agora.'}
export default async function handler(req,res){const b=bodyOf(req),a=actionOf(req,b);if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,message:'Método não permitido.'});try{if(a==='health')return send(res,200,await health());if(a==='catalog')return send(res,200,await catalog());if(a==='registerrequest'&&req.method==='POST')return send(res,200,await registerRequest(req,b));if(a==='track')return send(res,200,await track(req,b));return send(res,400,{ok:false,message:'Ação inválida.'})}catch(e){console.error('HOCCO API',a,e);return send(res,400,{ok:false,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,message:publicMessage(e),reference:crypto.randomUUID().slice(0,8).toUpperCase()})}}
