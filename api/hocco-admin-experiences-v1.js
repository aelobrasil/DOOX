import { isAdmin } from './_hocco-admin-auth.js';
import { hoccoSupabase } from './_hocco-supabase.js';
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function uuid(v){const s=String(v||'').trim();if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s))throw Error('Identificador inválido.');return s}
async function rpc(name,p){return hoccoSupabase(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(p)})}
export default async function handler(req,res){
 if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,message:'Método não permitido.'});
 if(!isAdmin(req))return json(res,401,{ok:false,message:'Autorização administrativa necessária.'});
 try{
   const b=bodyOf(req),u=new URL(req.url,`https://${req.headers.host||'localhost'}`),action=String(u.searchParams.get('action')||b.action||'list');
   if(action==='list'){
     const rows=await hoccoSupabase('/rest/v1/experiencias_empresa?select=*&order=criado_em.desc&limit=500');
     return json(res,200,{ok:true,experiencias:rows||[]});
   }
   if(action==='status'){
     await rpc('atualizar_experiencia_status',{p_id:uuid(b.id),p_status:String(b.status||'').toUpperCase()});
     return json(res,200,{ok:true});
   }
   return json(res,400,{ok:false,message:'Ação inválida.'});
 }catch(e){console.error('HOCCO ADMIN EXPERIENCES',e);return json(res,400,{ok:false,message:e?.message||'Operação não concluída.'})}
}
