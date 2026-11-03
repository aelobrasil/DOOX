export function validateDeviceToken(token){if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Identificador privado deste aparelho inválido.');return token}
function decodeKey(value,length){if(typeof value!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(value)||value.length>128)throw Error('Chave de notificação inválida.');let decoded;try{decoded=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}catch{throw Error('Chave de notificação inválida.')}if(decoded.length!==length||length===65&&decoded[0]!==4)throw Error('Chave de notificação inválida.');return value}
export function validatePushSubscription(input){
 let u;try{u=new URL(input?.endpoint)}catch{throw Error('Endereço de notificação inválido.')}
 const providers=u.hostname==='fcm.googleapis.com'&&/^\/(?:fcm\/send|wp)\//.test(u.pathname)||u.hostname==='updates.push.services.mozilla.com'&&u.pathname.startsWith('/wpush/')||u.hostname==='web.push.apple.com'&&u.pathname.startsWith('/')||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname)&&u.pathname.startsWith('/');
 if(!providers||u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||u.href.length>2048)throw Error('Serviço de notificações não reconhecido.');
 return{endpoint:u.href,keys:{p256dh:decodeKey(input?.keys?.p256dh,65),auth:decodeKey(input?.keys?.auth,16)}};
}
export async function publicPushConfig(db){const rows=await db('hocco_push_config?id=eq.true&select=enabled,vapid_public_key,vapid_version&limit=1'),c=rows[0];return{enabled:Boolean(c?.enabled&&c.vapid_public_key),publicKey:c?.vapid_public_key||'',version:c?.vapid_version||0}}
export async function defaultPushSender(subscription,payload,options){const{sendNotification}=await import('npm:web-push-neo@0.1.2');return sendNotification(subscription,payload,options)}
export async function dispatchAppPush({db,send,config,privateKey,origin}){
 const due=await db('rpc/hm_push_claim','POST',{p_limit:50});let sent=0,failed=0,skipped=0,cursor=0;
 async function worker(){while(cursor<due.length){const item=due[cursor++];try{
 if(!await db('rpc/hm_push_dispatch_valid','POST',{p_hash:item.deviceHash,p_dispatch:item.dispatchId})){skipped++;continue}
 await send({endpoint:item.endpoint,keys:item.keys},JSON.stringify({id:item.notificationId,title:item.title,body:item.body,url:'/?hocco_return='+encodeURIComponent(item.notificationId)+'#inicio',tag:'hocco-reality-return'}),{vapidDetails:{subject:origin,publicKey:config.publicKey,privateKey},TTL:3600,urgency:'normal',topic:'hocco-reality-return',signal:AbortSignal.timeout(10000)});
 await db('rpc/hm_push_finish','POST',{p_hash:item.deviceHash,p_dispatch:item.dispatchId,p_sent:true,p_gone:false,p_error:''});sent++;
 }catch(error){const status=Number(error?.statusCode||error?.status||0);await db('rpc/hm_push_finish','POST',{p_hash:item.deviceHash,p_dispatch:item.dispatchId,p_sent:false,p_gone:status===404||status===410,p_error:status?'Serviço push: HTTP '+status:'Falha temporária no envio push'});failed++}
 }}
 await Promise.all(Array.from({length:Math.min(10,due.length)},worker));return{sent,failed,skipped};
}
