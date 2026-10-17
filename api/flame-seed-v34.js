import crypto from 'node:crypto';
export const config={api:{bodyParser:false}};
const BUCKET='doox-v2-arquivos';
const OBJECT_PATH='system/flame/flame-standard-v34.mp4';
const EXPECTED_SHA='8c6be049da7cde0d8b09f3f5fb44f56ca12f20d69ba59e278a7a92e5b8e23d7a';
const EXPECTED_SIZE=403291;
const SUPABASE_URL=String(process.env.SUPABASE_URL||'https://txbowobtfiiqqatqjfpd.supabase.co').replace(/\/$/,'');
const SERVICE_ROLE_KEY=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));}
async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return Buffer.concat(chunks);}
export default async function handler(req,res){
 if(req.method!=='PUT')return json(res,405,{ok:false,message:'Método não permitido.'});
 if(!SUPABASE_URL||!SERVICE_ROLE_KEY)return json(res,503,{ok:false,message:'Storage indisponível.'});
 try{
  const buf=await raw(req);
  if(buf.length!==EXPECTED_SIZE)return json(res,400,{ok:false,message:'Arquivo inesperado.'});
  const sha=crypto.createHash('sha256').update(buf).digest('hex');
  if(sha!==EXPECTED_SHA)return json(res,400,{ok:false,message:'Conteúdo inválido.'});
  const path=OBJECT_PATH.split('/').map(encodeURIComponent).join('/');
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${SERVICE_ROLE_KEY}`,apikey:SERVICE_ROLE_KEY,'Content-Type':'video/mp4','x-upsert':'true'},body:buf});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.message||d.error||`Storage ${r.status}`);
  return json(res,200,{ok:true,path:OBJECT_PATH,size:buf.length,sha256:sha});
 }catch(e){console.error('DOOX Flame seed',e);return json(res,500,{ok:false,message:'Falha ao armazenar Flame padrão.'});}
}
