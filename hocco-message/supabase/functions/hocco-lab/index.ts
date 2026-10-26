import {createScenario,transitionScenario} from './engine.mjs';
const SANDBOX='https://lssfoyzhxdfekuqxwyxy.supabase.co';
const AUTH='https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message';
const PUBLIC_KEY='sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz';
export async function handler(req,env=globalThis.Deno?.env,fetcher=fetch){
 const origin=req.headers.get('origin')||'https://hocco-message.vercel.app';
 const allowed=origin==='https://hocco-message.vercel.app'||/^https:\/\/hocco-message(?:-[a-z0-9-]+)?-aelobrasils-projects\.vercel\.app$/.test(origin);
 const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':allowed?origin:'https://hocco-message.vercel.app','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 if(!allowed)return reply({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método inválido.'},405);
 // Hard environment boundary: this function refuses to run against production.
 if(env?.get('SUPABASE_URL')!==SANDBOX)return reply({error:'Laboratório não está no projeto isolado.'},503);
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return reply({error:'Entre no controle da equipe.'},401);
 try{
  const verified=await fetcher(AUTH,{method:'POST',headers:{'content-type':'application/json',apikey:PUBLIC_KEY,Authorization:auth},body:JSON.stringify({action:'admin.lab.authorize'}),signal:AbortSignal.timeout(12000)});
  if(!verified.ok)return reply({error:'Acesso restrito à equipe HOCCO.'},verified.status===401?401:403);
  const user=await verified.json();if(!user.ok||!user.actorId)return reply({error:'Autorização inválida.'},403);
  const body=await req.text();if(body.length>3000)return reply({error:'Solicitação muito grande.'},413);const b=JSON.parse(body);
  let secret;try{secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default}catch{}secret||=env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret)return reply({error:'Laboratório indisponível.'},503);
  const dbHeaders={apikey:secret,'content-type':'application/json',Prefer:'return=representation',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  const db=async(path,method='GET',payload)=>{const r=await fetcher(SANDBOX+'/rest/v1/hm_lab_scenarios'+path,{method,headers:dbHeaders,body:payload===undefined?undefined:JSON.stringify(payload)});if(!r.ok)throw Error('Não foi possível registrar o cenário no sandbox.');return r.status===204?[]:await r.json()};
  const owner='actor_id=eq.'+encodeURIComponent(user.actorId);
  if(b.action==='lab.list')return reply({scenarios:await db('?'+owner+'&order=created_at.desc&limit=50'),environment:'sandbox',paymentIntegration:'not_verified'});
  if(b.action==='lab.clear'){if(b.confirm!==true)return reply({error:'Confirme a limpeza dos seus cenários fictícios.'},400);await db('?'+owner,'DELETE');return reply({ok:true})}
  if(b.action==='lab.create'){
   if((await db('?'+owner+'&select=id&limit=50')).length>=50)return reply({error:'Limpe seus cenários de teste antes de criar outros.'},409);
   const payload=createScenario(b.kind,b.message);const rows=await db('','POST',{actor_id:user.actorId,payload});return reply({scenario:rows[0],environment:'sandbox',simulation:true},201);
  }
  if(b.action==='lab.transition'){
   if(!/^[0-9a-f-]{36}$/i.test(b.id||''))throw Error('Cenário inválido.');
   const path='?'+owner+'&id=eq.'+encodeURIComponent(b.id),row=(await db(path))[0];if(!row)return reply({error:'Cenário não encontrado.'},404);
   const payload=transitionScenario(row.payload,b.operation),rows=await db(path+'&revision=eq.'+row.revision,'PATCH',{payload,revision:row.revision+1});
   if(!rows.length)return reply({error:'Outro teste alterou este cenário. Atualize antes de continuar.'},409);
   return reply({scenario:rows[0],environment:'sandbox',simulation:true});
  }
  return reply({error:'Ação de laboratório inválida.'},400);
 }catch(error){return reply({error:String(error.message||'Falha no laboratório.').slice(0,300)},400)}
}
if(globalThis.Deno?.serve)globalThis.Deno.serve(req=>handler(req));
