import { isAdmin, clearCookie } from './_hocco-admin-auth.js';
import { hoccoSupabase } from './_hocco-supabase.js';
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body))}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function actionOf(req,b){return String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('action')||b.action||'session').trim()}
function uuid(v){const s=String(v||'').trim();if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s))throw Error('Identificador inválido.');return s}
async function rpc(name,p){return hoccoSupabase(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(p)})}
function mapOrder(p){return{...p,status:p.status_operacional,numero_exibicao:p.codigo_doox,nome:p.clientes?.nome||'',responsavel:p.clientes?.responsavel||'',empresa:p.clientes?.nome_fantasia||p.clientes?.nome||'',whatsapp:p.clientes?.whatsapp||'',email:p.clientes?.email||'',perfil:p.clientes?.perfil_site||'',segmento:p.clientes?.segmento||'',modalidade_nome:p.modalidade,episodio:p.episodios||null}}

async function list(){
 const rows=await hoccoSupabase('/rest/v1/pedidos?select=*,clientes(nome,nome_fantasia,responsavel,whatsapp,email,perfil_site,segmento),episodios(codigo,numero,titulo,status)&order=criado_em.desc&limit=500');
 const pedidos=(rows||[]).map(mapOrder);
 const i={total:pedidos.length,solicitados:0,em_analise:0,aguardando_pagamento:0,pagamento_recebido:0,material_pendente:0,material_recebido:0,em_producao:0,programados:0,publicados:0,finalizados:0,valor_solicitado:0,valor_confirmado:0,precisam_acao:0};
 for(const p of pedidos){
   i.valor_solicitado+=Number(p.valor_total||0);
   if(p.status_pagamento==='RECEBIDO')i.valor_confirmado+=Number(p.valor_total||0);
   const k=String(p.status_operacional||'').toLowerCase();if(k in i)i[k]++;
   if(p.status_pagamento==='AGUARDANDO_PAGAMENTO'||p.status_pagamento==='PENDENTE')i.aguardando_pagamento++;
   if(p.status_pagamento==='RECEBIDO')i.pagamento_recebido++;
   if(p.status_material==='PENDENTE')i.material_pendente++;
   if(p.status_material==='RECEBIDO')i.material_recebido++;
   if(p.status_operacional==='EM_PRODUCAO')i.em_producao++;
   if(p.status_operacional==='PROGRAMADO')i.programados++;
   if(p.status_operacional==='VEICULADO'||p.status_operacional==='PUBLICADO')i.publicados++;
   if(p.status_operacional==='FINALIZADO')i.finalizados++;
   if(p.status_pagamento==='AGUARDANDO_CONFIRMACAO'||p.status_material==='RECEBIDO'||p.status_operacional==='SOLICITADO')i.precisam_acao++;
 }
 const pagamentos=await hoccoSupabase('/rest/v1/pagamentos?select=id,pedido_id,status,valor,criado_em&status=eq.AGUARDANDO_CONFIRMACAO&order=criado_em.asc&limit=50');
 const materiais=await hoccoSupabase('/rest/v1/materiais?select=id,pedido_id,tipo,nome_arquivo,status,enviado_em&status=eq.RECEBIDO&order=enviado_em.asc&limit=50');
 return{ok:true,pedidos,indicadores:i,precisaAcao:{pagamentos:pagamentos||[],materiais:materiais||[]}};
}

async function episodes(){
 const eps=await hoccoSupabase('/rest/v1/episodios?select=*,momentos(id,codigo,nome,inicio_segundos,fim_segundos,capacidade,ativo,posicoes(id,numero,status,pedido_id,reservado_em,pedidos(codigo_doox,modalidade,clientes(nome,nome_fantasia))))&order=numero.desc&limit=50');
 const episodios=(eps||[]).map(e=>{
   const momentos=(e.momentos||[]).map(m=>({...m,livres:(m.posicoes||[]).filter(p=>p.status==='LIVRE').length,ocupadas:(m.posicoes||[]).filter(p=>p.status!=='LIVRE').length}));
   const programacoes=[];
   for(const m of momentos)for(const p of (m.posicoes||[])){if(p.pedido_id)programacoes.push({...p,momento_codigo:m.codigo,momento_nome:m.nome,momento_segundos:m.inicio_segundos,solicitacao:p.pedidos?{numero_exibicao:p.pedidos.codigo_doox,nome:p.pedidos.clientes?.nome_fantasia||p.pedidos.clientes?.nome,modalidade_nome:p.pedidos.modalidade}:null})}
   return{...e,momentos,programacoes};
 });
 return{ok:true,episodios};
}

async function detail(id){
 const p=(await hoccoSupabase(`/rest/v1/pedidos?select=*,clientes(nome,nome_fantasia,responsavel,whatsapp,email,perfil_site,segmento),episodios(codigo,numero,titulo,status)&id=eq.${id}&limit=1`))?.[0];
 if(!p)throw Error('Solicitação não encontrada.');
 const[pagamentos,materiais,historico,posicoes]=await Promise.all([
   hoccoSupabase(`/rest/v1/pagamentos?select=*&pedido_id=eq.${id}&order=criado_em.desc`),
   hoccoSupabase(`/rest/v1/materiais?select=*&pedido_id=eq.${id}&order=enviado_em.desc`),
   hoccoSupabase(`/rest/v1/historico_status?select=*&pedido_id=eq.${id}&order=criado_em.desc&limit=200`),
   hoccoSupabase(`/rest/v1/posicoes?select=id,numero,status,reservado_em,ocupado_em,veiculado_em,momentos(codigo,nome,inicio_segundos,fim_segundos)&pedido_id=eq.${id}&order=numero.asc`)
 ]);
 return{ok:true,solicitacao:mapOrder(p),pagamentos:pagamentos||[],materiais:materiais||[],posicoes:posicoes||[],historico:(historico||[]).map(h=>({...h,evento:h.campo,status_anterior:h.valor_anterior,status_novo:h.valor_novo}))};
}

async function clients(){
 const [cs,ps]=await Promise.all([
   hoccoSupabase('/rest/v1/clientes?select=*&order=criado_em.desc&limit=500'),
   hoccoSupabase('/rest/v1/pedidos?select=id,cliente_id,valor_total,status_pagamento,criado_em&order=criado_em.desc&limit=2000')
 ]);
 return{ok:true,clientes:(cs||[]).map(c=>{const own=(ps||[]).filter(p=>p.cliente_id===c.id);return{...c,pedidos:own.length,valor_total:own.reduce((a,p)=>a+Number(p.valor_total||0),0),valor_pago:own.filter(p=>p.status_pagamento==='RECEBIDO').reduce((a,p)=>a+Number(p.valor_total||0),0),ultimo_pedido:own[0]?.criado_em||null}})};
}

async function finance(){
 const rows=await hoccoSupabase('/rest/v1/pagamentos?select=*,pedidos(codigo_doox,modalidade,valor_total,clientes(nome,nome_fantasia))&order=criado_em.desc&limit=1000');
 const pagamentos=rows||[];
 return{ok:true,pagamentos,resumo:{total:pagamentos.reduce((a,p)=>a+Number(p.valor||0),0),recebido:pagamentos.filter(p=>p.status==='RECEBIDO').reduce((a,p)=>a+Number(p.valor||0),0),pendente:pagamentos.filter(p=>p.status!=='RECEBIDO').reduce((a,p)=>a+Number(p.valor||0),0),aguardando_confirmacao:pagamentos.filter(p=>p.status==='AGUARDANDO_CONFIRMACAO').length}};
}

async function materials(){
 const rows=await hoccoSupabase('/rest/v1/materiais?select=*,pedidos(codigo_doox,modalidade,clientes(nome,nome_fantasia))&order=enviado_em.desc&limit=1000');
 return{ok:true,materiais:rows||[]};
}

async function settings(){
 const [mods,prices,faixas,required,trans]=await Promise.all([
   hoccoSupabase('/rest/v1/modalidades?select=*&order=ordem_exibicao.asc'),
   hoccoSupabase('/rest/v1/precos?select=*&ativo=eq.true&order=criado_em.asc'),
   hoccoSupabase('/rest/v1/faixas?select=*&order=inicio_segundos.asc'),
   hoccoSupabase('/rest/v1/materiais_obrigatorios?select=*&ativo=eq.true'),
   hoccoSupabase('/rest/v1/transicoes_status?select=entidade,status_anterior,status_novo,permitido&entidade=eq.PEDIDO&permitido=eq.true')
 ]);
 return{ok:true,modalidades:mods||[],precos:prices||[],faixas:faixas||[],materiais_obrigatorios:required||[],transicoes:trans||[]};
}

async function saveMode(b){
 const id=uuid(b.modalidadeId),cap=Math.max(0,Math.min(500,Number(b.capacidade)||0)),ativo=Boolean(b.ativo),valor=Number(b.valor);
 if(!Number.isFinite(valor)||valor<0)throw Error('Valor inválido.');
 await hoccoSupabase(`/rest/v1/modalidades?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({ativo,capacidade_padrao:cap,atualizado_em:new Date().toISOString()})});
 await hoccoSupabase(`/rest/v1/precos?modalidade_id=eq.${id}&ativo=eq.true`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({valor})});
 return{ok:true};
}

async function move(id,status,obs){await rpc('alterar_status_pedido',{p_pedido_id:id,p_novo_status:String(status||''),p_observacao:obs||null,p_alterado_por:null});return{ok:true}}
async function pay(id,obs){
 const pg=(await hoccoSupabase(`/rest/v1/pagamentos?select=id&pedido_id=eq.${id}&order=criado_em.desc&limit=1`))?.[0];if(!pg)throw Error('Pagamento não encontrado.');
 const r=await rpc('confirmar_pagamento',{p_pagamento_id:pg.id,p_observacao:obs||null});
 let reserva=null;try{reserva=await rpc('reservar_posicao',{p_pedido_id:id})}catch(e){if(!/elegível|elegivel/i.test(String(e?.message||'')))console.warn('RESERVA PÓS PAGAMENTO',e?.message||e)}
 return{ok:true,result:r,reserva};
}
async function materialAction(id,status,obs){
 const materialId=uuid(id),novo=String(status||'').toUpperCase();if(!['APROVADO','RECUSADO','EM_ANALISE'].includes(novo))throw Error('Status de material inválido.');
 const mat=(await hoccoSupabase(`/rest/v1/materiais?select=id,pedido_id,tipo&id=eq.${materialId}&limit=1`))?.[0];if(!mat)throw Error('Material não encontrado.');
 await hoccoSupabase(`/rest/v1/materiais?id=eq.${materialId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:novo,observacao:obs||null,atualizado_em:new Date().toISOString()})});
 if(novo==='APROVADO')try{await rpc('reservar_posicao',{p_pedido_id:mat.pedido_id})}catch(e){if(!/elegível|elegivel/i.test(String(e?.message||'')))console.warn('RESERVA PÓS MATERIAL',e?.message||e)}
 return{ok:true};
}

export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});
 const b=bodyOf(req),a=actionOf(req,b);
 if(a==='session')return json(res,200,{ok:true,authenticated:isAdmin(req)});
 if(a==='logout'){res.setHeader('Set-Cookie',clearCookie(req));return json(res,200,{ok:true})}
 if(!isAdmin(req))return json(res,401,{ok:false,message:'Autorização administrativa necessária.'});
 try{
   if(a==='dashboard')return json(res,200,await list());
   if(a==='episodios')return json(res,200,await episodes());
   if(a==='detalhe')return json(res,200,await detail(uuid(b.solicitacaoId)));
   if(a==='clientes')return json(res,200,await clients());
   if(a==='financeiro')return json(res,200,await finance());
   if(a==='materiais')return json(res,200,await materials());
   if(a==='configuracoes')return json(res,200,await settings());
   if(a==='salvarModalidade')return json(res,200,await saveMode(b));
   if(a==='alterarStatus')return json(res,200,await move(uuid(b.solicitacaoId),b.status,b.observacao));
   if(a==='confirmarPagamento')return json(res,200,await pay(uuid(b.solicitacaoId),b.observacao||b.referencia));
   if(a==='materialStatus')return json(res,200,await materialAction(b.materialId,b.status,b.observacao));
   return json(res,400,{ok:false,message:'Ação administrativa inválida.'});
 }catch(e){console.error('HOCCO ADMIN',a,e);return json(res,400,{ok:false,message:e?.message||'Operação não concluída.'})}
}
