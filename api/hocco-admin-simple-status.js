import { hoccoSupabase } from './_hocco-supabase.js';

function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body))}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function uuid(v){const s=String(v||'').trim();if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s))throw Error('Identificador inválido.');return s}
async function rpc(name,p){return hoccoSupabase(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(p)})}

const FLOW=['SOLICITADO','EM_ANALISE','AGUARDANDO_PAGAMENTO','RESERVADO','EM_PRODUCAO','PROGRAMADO','VEICULADO','FINALIZADO'];
const TARGET={RECEBIDO:'EM_ANALISE',GERENCIADO:'EM_PRODUCAO',VEICULADO:'VEICULADO',FINALIZADO:'FINALIZADO'};
const LABEL={RECEBIDO:'Recebido',GERENCIADO:'Gerenciado',VEICULADO:'Veiculado',FINALIZADO:'Finalizado'};

async function applySimpleStatus(id,command){
  const cmd=String(command||'').trim().toUpperCase();
  const target=TARGET[cmd];
  if(!target)throw Error('Comando operacional inválido.');
  const row=(await hoccoSupabase(`/rest/v1/pedidos?select=id,codigo_doox,status_operacional&id=eq.${id}&limit=1`))?.[0];
  if(!row)throw Error('Pedido não encontrado.');
  const current=String(row.status_operacional||'');
  if(['REJEITADO','CANCELADO','ARQUIVADO'].includes(current))throw Error('Este pedido está encerrado e não pode avançar.');
  const from=FLOW.indexOf(current),to=FLOW.indexOf(target);
  if(from<0||to<0)throw Error('Status operacional não reconhecido.');
  if(from>to)throw Error('O pedido já está em uma etapa posterior.');
  for(let i=from+1;i<=to;i++){
    await rpc('alterar_status_pedido',{p_pedido_id:id,p_novo_status:FLOW[i],p_observacao:`DOOX Control · ${LABEL[cmd]}`,p_alterado_por:null});
  }
  return {ok:true,command:cmd,label:LABEL[cmd],status_operacional:target,codigo_doox:row.codigo_doox};
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,message:'Método não permitido.'});
  try{const b=bodyOf(req);return json(res,200,await applySimpleStatus(uuid(b.solicitacaoId),b.command));}
  catch(e){console.error('DOOX SIMPLE STATUS',e);return json(res,400,{ok:false,message:e?.message||'Não foi possível atualizar o pedido.'});}
}
