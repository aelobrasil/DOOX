import postgres from 'postgres';
import { isAdmin, clearCookie } from './_doox-v2-auth.js';
const DATABASE_URL=String(process.env.DOOX_DATABASE_URL||'').trim();
const db=DATABASE_URL&&/^postgres(?:ql)?:\/\//i.test(DATABASE_URL)?postgres(DATABASE_URL,{ssl:'require',prepare:false,max:2,idle_timeout:20,connect_timeout:10}):null;
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{};}catch{return{};}}
function actionOf(req,b){return String(new URL(req.url,`https://${req.headers.host||'localhost'}`).searchParams.get('action')||b.action||'session').trim();}
function needDb(res){if(db)return true;json(res,503,{ok:false,message:'DOOX_DATABASE_URL não configurada.'});return false;}
function uuid(v){const s=String(v||'').trim();if(!/^[0-9a-f-]{36}$/i.test(s))throw new Error('Identificador inválido.');return s;}
async function dashboard(){const [metrics,pedidos,episodios,mods]=await Promise.all([db`select * from doox_v2.v_dashboard`,db`select * from doox_v2.v_pedidos order by criado_em desc limit 250`,db`select * from doox_v2.episodios order by coalesce(numero,999999),criado_em desc`,db`select * from doox_v2.modalidades order by ordem`]);return{ok:true,indicadores:metrics[0]||{},pedidos,episodios,modalidades:mods};}
async function detail(id){const p=(await db`select * from doox_v2.v_pedidos where id=${id}::uuid limit 1`)[0];if(!p)throw new Error('Pedido não encontrado.');const [mats,pays,hist,aceite,prog]=await Promise.all([db`select * from doox_v2.materiais where pedido_id=${id}::uuid order by enviado_em desc`,db`select * from doox_v2.pagamentos where pedido_id=${id}::uuid order by criado_em desc`,db`select * from doox_v2.historico_status where pedido_id=${id}::uuid order by criado_em desc limit 200`,db`select * from doox_v2.aceites where pedido_id=${id}::uuid limit 1`,db`select * from doox_v2.programacoes where pedido_id=${id}::uuid limit 1`]);return{ok:true,pedido:p,materiais:mats,pagamentos:pays,historico:hist,aceite:aceite[0]||null,programacao:prog[0]||null};}
export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});const b=bodyOf(req),a=actionOf(req,b);
  if(a==='session')return json(res,200,{ok:true,authenticated:isAdmin(req)});
  if(a==='logout'){res.setHeader('Set-Cookie',clearCookie(req));return json(res,200,{ok:true});}
  if(!isAdmin(req))return json(res,401,{ok:false,message:'Autorização administrativa necessária.'});
  if(!needDb(res))return;
  try{
    if(a==='dashboard')return json(res,200,await dashboard());
    if(a==='listarPedidos'){const limit=Math.min(Math.max(Number(b.limit)||200,1),500);return json(res,200,{ok:true,pedidos:await db`select * from doox_v2.v_pedidos order by criado_em desc limit ${limit}`});}
    if(a==='pedidoDetalhe')return json(res,200,await detail(uuid(b.pedidoId||b.pedido_id)));
    if(a==='alterarStatus'){const id=uuid(b.pedidoId);const rows=await db`select doox_v2.alterar_status(${id}::uuid,${String(b.status||'').toUpperCase()},${b.observacao||null},'DOOX CORE V2') as data`;return json(res,200,rows[0]?.data||{ok:true});}
    if(a==='confirmarPagamento'){const id=uuid(b.pedidoId);const val=Number(b.valor);const rows=await db`select doox_v2.confirmar_pagamento(${id}::uuid,${Number.isFinite(val)?val:null},${b.referencia||null},${b.metodo||'PIX'},${b.observacao||null}) as data`;return json(res,200,rows[0]?.data||{ok:true});}
    if(a==='aprovarMaterial'){const mid=uuid(b.materialId);const rows=await db`select doox_v2.aprovar_material(${mid}::uuid,${b.aprovado===true},${b.motivo||null}) as data`;return json(res,200,rows[0]?.data||{ok:true});}
    if(a==='criarEpisodio'){const numero=Number(b.numero)||null;let codigo=String(b.codigo||'').trim().toUpperCase();if(!codigo){const n=numero||(Number((await db`select coalesce(max(numero),0)+1 as n from doox_v2.episodios`)[0]?.n)||1);codigo=`EP-${String(new Date().getFullYear()).slice(-2)}-${String(n).padStart(2,'0')}`;}const rows=await db`insert into doox_v2.episodios(codigo,numero,titulo,descricao,status,capacidade_total) values(${codigo},${numero},${b.titulo||null},${b.descricao||null},${String(b.status||'ABERTO').toUpperCase()},${Number(b.capacidade_total)||null}) returning *`;return json(res,200,{ok:true,episodio:rows[0]});}
    if(a==='programarPedido'){const id=uuid(b.pedidoId),ep=b.episodioId?uuid(b.episodioId):null;const rows=await db`select doox_v2.programar_pedido(${id}::uuid,${ep}::uuid,${b.momento_codigo||null},${Number(b.posicao_numero)||null},${b.programado_para||null}::timestamptz,${b.observacao||null}) as data`;return json(res,200,rows[0]?.data||{ok:true});}
    if(a==='listarCatalogo'){const mods=await db`select * from doox_v2.modalidades order by ordem`;const faixas=await db`select f.*,m.codigo as modalidade_codigo,m.nome as modalidade_nome from doox_v2.faixas f join doox_v2.modalidades m on m.id=f.modalidade_id order by m.ordem,f.ordem`;return json(res,200,{ok:true,modalidades:mods,faixas});}
    if(a==='atualizarPrecoModalidade'){const codigo=String(b.codigo||'').toUpperCase();const preco=Number(b.preco);if(!codigo||!Number.isFinite(preco)||preco<0)throw new Error('Código e preço válidos são obrigatórios.');const rows=await db`update doox_v2.modalidades set preco_base=${preco} where codigo=${codigo} returning *`;if(!rows.length)throw new Error('Modalidade não encontrada.');return json(res,200,{ok:true,modalidade:rows[0]});}
    if(a==='atualizarPrecoFaixa'){const id=uuid(b.faixaId);const preco=Number(b.preco);if(!Number.isFinite(preco)||preco<0)throw new Error('Preço inválido.');const rows=await db`update doox_v2.faixas set preco_unitario=${preco} where id=${id}::uuid returning *`;if(!rows.length)throw new Error('Faixa não encontrada.');return json(res,200,{ok:true,faixa:rows[0]});}
    return json(res,400,{ok:false,message:'Ação administrativa inválida.'});
  }catch(e){console.error('DOOX V2 admin',e);return json(res,400,{ok:false,message:e?.message||'Operação não concluída.'});}
}
