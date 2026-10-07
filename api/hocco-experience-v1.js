import { hoccoSupabase } from './_hocco-supabase.js';
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function clean(v,n=300){return String(v??'').trim().slice(0,n)}
function email(v){const s=clean(v,180).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:''}
function phone(v){return clean(v,30).replace(/\D/g,'').slice(0,15)}
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,405,{ok:false,message:'Método não permitido.'});
 try{
   const b=bodyOf(req);if(b.website)return send(res,400,{ok:false,message:'Solicitação inválida.'});
   const empresa=clean(b.empresa,180),responsavel=clean(b.responsavel,160),whatsapp=phone(b.whatsapp),mail=email(b.email),segmento=clean(b.segmento,160);
   if(!empresa||!responsavel||whatsapp.length<10||!mail||!segmento)return send(res,400,{ok:false,message:'Preencha empresa, responsável, WhatsApp, e-mail e segmento.'});
   const rows=await hoccoSupabase('/rest/v1/experiencias_empresa?select=id,status,criado_em',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({empresa,responsavel,whatsapp,email:mail,perfil_site:clean(b.perfil_site,250)||null,segmento,cidade:clean(b.cidade,160)||null,proposta:clean(b.proposta,1500)||null})});
   const row=rows?.[0];if(!row?.id)throw Error('Não foi possível registrar o interesse.');
   return send(res,200,{ok:true,id:row.id,status:row.status,criado_em:row.criado_em,message:'Interesse registrado. A equipe HOCCO poderá avaliar a experiência sem vínculo com compra de publicidade.'});
 }catch(e){console.error('HOCCO EXPERIENCE',e);return send(res,400,{ok:false,message:e?.message||'Não foi possível registrar o interesse agora.'})}
}
