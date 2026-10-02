import crypto from 'node:crypto';
import {
  HOCCO_API_VERSION, HOCCO_SOURCE_TAG, HOCCO_SUPABASE_URL,
  HOCCO_SUPABASE_SECRET_KEY, hoccoSupabase
} from './_hocco-supabase.js';

const LIMITS={LOGO:5*1024*1024,AUDIO:15*1024*1024,AUDIO_CTA:15*1024*1024};
const MIME={LOGO:['image/jpeg','image/png','image/webp'],
  AUDIO_CTA:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave']};
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.end(JSON.stringify(body));}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return {}}}
function clean(v){return String(v??'').trim()}
function mapType(v){const t=clean(v).toUpperCase();if(t==='AUDIO'||t==='AUDIO_CTA')return 'AUDIO_CTA';if(t==='LOGO')return 'LOGO';return ''}
function bucketFor(t){if(t==='LOGO')return 'hocco-logos';if(t==='AUDIO_CTA')return 'hocco-audios';return ''}
function safeName(name){return (clean(name).split(/[\\/]/).pop()||'arquivo').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'').slice(0,120)||'arquivo'}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/')}
function validate(type,mime,size){if(!type||!LIMITS[type])throw new Error('Tipo de material inválido.');if(!Number.isFinite(size)||size<=0)throw new Error('Tamanho do material inválido.');if(size>LIMITS[type])throw new Error('Arquivo excede o limite permitido.');if(!MIME[type].includes(mime))throw new Error('Formato não permitido.')}
async function verifySolicitacao(id,token){
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(token))throw new Error('Identificação da solicitação inválida.');
  const rows=await hoccoSupabase(`/rest/v1/solicitacoes?select=id,numero&id=eq.${encodeURIComponent(id)}&token_acompanhamento=eq.${encodeURIComponent(token)}&limit=1`);
  if(!Array.isArray(rows)||!rows[0])throw new Error('Solicitação não encontrada.');return rows[0];
}
async function signedUpload(bucket,path){
  const data=await hoccoSupabase(`/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`,{method:'POST',body:JSON.stringify({upsert:false})});
  const signed=data?.signedUrl||data?.signedURL||data?.url;if(!signed)throw new Error('Storage não retornou URL de upload.');
  return String(signed).startsWith('http')?String(signed):`${HOCCO_SUPABASE_URL}/storage/v1${signed}`;
}
async function objectInfo(bucket,path){
  const response=await fetch(`${HOCCO_SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`,{method:'HEAD',headers:{
    apikey:HOCCO_SUPABASE_SECRET_KEY,'User-Agent':`HOCCO-Backend/${HOCCO_API_VERSION}`,'X-Client-Info':`hocco-api-v${HOCCO_API_VERSION}`}});
  if(!response.ok){const err=new Error('Arquivo não encontrado no Storage.');err.status=response.status;throw err}
  return {size:Number(response.headers.get('content-length')||0),mime:clean(response.headers.get('content-type')).toLowerCase()};
}
async function registerMaterial(id,type,bucket,name,path,mime,size){
  return await hoccoSupabase('/rest/v1/rpc/registrar_material',{method:'POST',body:JSON.stringify({
    p_solicitacao_id:id,p_tipo:type,p_bucket:bucket,p_nome_original:name,p_storage_path:path,p_mime_type:mime,p_tamanho_bytes:size
  })});
}
export default async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{ok:false,message:'Método não permitido.'});
  try{
    const body=bodyOf(req),url=new URL(req.url,`https://${req.headers.host||'localhost'}`);
    const action=clean(url.searchParams.get('action')||body.action).toLowerCase();
    const id=clean(body.solicitacaoId||body.pedidoId||body.technicalId||body.id),token=clean(body.trackingToken||body.token);
    await verifySolicitacao(id,token);
    const type=mapType(body.materialType||body.tipo||body.type),bucket=bucketFor(type);
    const name=clean(body.fileName||body.originalName||'arquivo'),mime=clean(body.mimeType||body.mime).toLowerCase(),size=Number(body.size||0);
    validate(type,mime,size);
    if(action==='prepare_upload'){
      const file=`${crypto.randomUUID()}-${safeName(name)}`,path=`solicitacoes/${id}/${type}/${file}`,signedUrl=await signedUpload(bucket,path);
      return send(res,200,{ok:true,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,upload:{
        solicitacao_id:id,tipo:type,bucket,nome_original:name,mime_type:mime,tamanho_bytes:size,storage_path:path,signed_url:signedUrl,expires_in:7200}});
    }
    if(action==='register'){
      const path=clean(body.storagePath||body.path);
      if(!path.startsWith(`solicitacoes/${id}/${type}/`))throw new Error('Caminho de armazenamento inválido.');
      const info=await objectInfo(bucket,path);
      if(info.size&&info.size!==size)throw new Error('Tamanho do arquivo armazenado não corresponde ao informado.');
      if(info.mime&&!MIME[type].includes(info.mime.split(';')[0]))throw new Error('Formato armazenado não permitido.');
      const data=await registerMaterial(id,type,bucket,name,path,mime,size);
      return send(res,200,{ok:true,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,material:data});
    }
    return send(res,400,{ok:false,message:'Ação de materiais inválida.'});
  }catch(error){
    console.error('HOCCO MATERIALS V1',error);const raw=String(error?.message||'');
    const allowed=[/Tipo de material/i,/Tamanho do material/i,/Arquivo excede/i,/Formato não permitido/i,/Identificação da solicitação/i,/Solicitação não encontrada/i,/Caminho de armazenamento/i,/arquivo armazenado/i,/URL de upload/i];
    return send(res,400,{ok:false,version:HOCCO_API_VERSION,sourceTag:HOCCO_SOURCE_TAG,message:allowed.some(rx=>rx.test(raw))?raw:'Não foi possível concluir o envio do material agora.'});
  }
}
