import {validateManualNotice} from './control-content.mjs';
import {validateDeviceToken,validatePushSubscription,publicPushConfig,defaultPushSender,dispatchAppPush} from './push-reactivation.mjs';
import {validateSenderIdentity} from './sender-identity.mjs';
import {readAll} from './read-all.mjs';
import {createSponsorPix,createRealitySponsorPix} from './pix-checkout.mjs';
import {readJsonBody} from './request-body.mjs';
import {checkoutBlock,isUnpaidCommentExpired,paymentExpiresAt} from './purchase-lifecycle.mjs';
import {validateLocation,validateProgramming} from './local-community.mjs';
import { verifiedPaymentEvent } from "./payment-verification.mjs";
import { classifyMercadoPagoNotification, createPreference, isApprovedPayment, paymentReference, refundApprovedPayment, verifyWebhookSignature } from "./mercado-pago.mjs";
import { moderateCommunityMessage } from "./moderation.mjs";
import { validateCommunityPricing } from "./pricing.mjs";
// No browser secrets. Service credentials are supplied only by the Edge runtime.
const PUBLIC_ORIGIN='https://hocco-message.vercel.app';
const LEGACY_PUBLIC_ORIGINS=['https://hocco.loyallion10.chatgpt.site','https://hocco-message-6gpcxo23w-aelobrasils-projects.vercel.app','https://hocco-message-git-codex-hocco-messa-7dcea7-aelobrasils-projects.vercel.app'];
const LEGAL_VERSION='2026-11-03.v13';
const SPONSOR_TERMS_VERSION='2026-11-03.patrocinio.v4';
const SPONSOR_CATEGORIES=['Alimentação e bebidas','Casa e construção','Educação e cultura','Moda e acessórios','Serviços','Tecnologia','Outros'];
export const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export function normalizeVideo(input,second){const u=new URL(input);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname))throw Error('Use o link HTTPS de um vídeo do YouTube.');const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname==='/watch'?u.searchParams.get('v'):null;if(!/^[\w-]{11}$/.test(id||'')||!Number.isSafeInteger(second)||second<0||second>86400)throw Error('Vídeo ou instante inválido.');return `https://www.youtube.com/watch?v=${id}&t=${second}s`}
export function normalizeSocialProfile(platform,value){const raw=String(value??'').trim();if(!raw)return'';let handle=raw.replace(/^@+/,'');if(/^(?:https?:\/\/|www\.|instagram\.com\/|tiktok\.com\/)/i.test(raw)){let url;try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw)}catch{throw Error('Cole um link válido do seu perfil do Instagram ou TikTok.')}const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.port||url.username||url.password)throw Error('Use o link HTTPS direto do seu perfil.');if(platform==='instagram'&&['instagram.com','www.instagram.com'].includes(host)){const match=url.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);if(!match)throw Error('Cole o link direto do perfil do Instagram, não de uma publicação.');handle=match[1]}else if(platform==='tiktok'&&['tiktok.com','www.tiktok.com'].includes(host)){const match=url.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);if(!match)throw Error('Cole o link direto do perfil do TikTok, não de um vídeo.');handle=match[1]}else throw Error('O link informado não corresponde à rede social selecionada.')}else if(/[\/:?#\s]/.test(handle))throw Error('Informe somente o @ ou cole o link completo do perfil.');const valid=platform==='instagram'?/^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?$/.test(handle):platform==='tiktok'?/^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,22}[A-Za-z0-9_])?$/.test(handle):false;if(!valid)throw Error(platform==='instagram'?'O @ do Instagram deve ter até 30 caracteres e usar apenas letras, números, pontos ou underline.':'O @ do TikTok deve ter até 24 caracteres e usar apenas letras, números, pontos ou underline.');return handle}
export function validateInput(b){const name=String(b.name||'').trim(),message=String(b.message||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),platform=String(b.socialPlatform||'').toLowerCase(),handle=normalizeSocialProfile(platform,b.socialHandle);if(!name||name.length>40||!message||message.length>180)throw Error('Confira o nome e a mensagem de até 180 caracteres.');if(!['instagram','tiktok'].includes(platform)||!(/^[A-Za-z0-9._]{1,30}$/).test(handle))throw Error('Escolha Instagram ou TikTok e informe um @ válido.');if(!Number.isInteger(b.slot)||b.slot<1||b.slot>2)throw Error('Escolha uma das duas posições.');if(b.legalVersion!==LEGAL_VERSION||b.terms!==true||b.publication!==true||b.adult!==true)throw Error('Confirme os termos, a maioridade e a autorização de exibição.');if((b.whatsappOptIn===true||b.reminderOptIn===true)&&!(/^(?:55)?[1-9][0-9]{9,10}$/).test(phone))throw Error('Informe um WhatsApp válido para receber as mensagens autorizadas.');if(!/^[a-f0-9]{64}$/.test(b.trackingToken||''))throw Error('Identificador de envio inválido.');return{name,message,phone:(b.whatsappOptIn===true||b.reminderOptIn===true)?phone:'',optIn:b.whatsappOptIn===true,reminderOptIn:b.reminderOptIn===true,platform,handle}}

// Rules-only baseline filter. It never stores or logs rejected message text.
export function validateCommunityInput(b){const name=String(b.name||'').trim(),username=String(b.username||'').trim().replace(/^@+/,'').toLowerCase(),message=String(b.message||'').trim(),avatar=Number(b.avatar),destination=String(b.destination||'community'),socialPlatform=String(b.socialPlatform||'none').trim().toLowerCase(),socialHandle=normalizeSocialProfile(socialPlatform,b.socialHandle);if(!name||name.length>40||!/^[A-Za-z0-9._]{3,24}$/.test(username))throw Error('Complete seu nome e @ no perfil antes de enviar.');if(!message||message.length>180)throw Error('Escreva uma mensagem de até 180 caracteres.');if(!Number.isInteger(avatar)||avatar<1||avatar>20)throw Error('Escolha um Figurante para o seu perfil.');if(!['community','live'].includes(destination))throw Error('Escolha Comunidade ou LIVE.');if(!['none','instagram','tiktok'].includes(socialPlatform))throw Error('Rede social inválida.');const handlePattern=/^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?$/;const tiktokPattern=/^[A-Za-z0-9_](?:[A-Za-z0-9._]{0,22}[A-Za-z0-9_])?$/;if(socialPlatform==='none'&&socialHandle)throw Error('Não informe um @ sem escolher uma rede social.');if(socialPlatform==='instagram'&&!handlePattern.test(socialHandle))throw Error('Informe apenas um @ válido do Instagram.');if(socialPlatform==='tiktok'&&!tiktokPattern.test(socialHandle))throw Error('Informe apenas um @ válido do TikTok.');if(!/^[a-f0-9]{64}$/.test(b.trackingToken||''))throw Error('Identificador de envio inválido.');const socialUrl=socialPlatform==='instagram'?'https://www.instagram.com/'+socialHandle+'/':socialPlatform==='tiktok'?'https://www.tiktok.com/@'+socialHandle+'/':null;return{name,username,avatar,message,destination,socialUrl}}export function validateCommunityLikeInput(b){const messageId=String(b.messageId||''),voterToken=String(b.voterToken||'');if(!/^[0-9a-f-]{36}$/i.test(messageId)||!/^[a-f0-9]{64}$/.test(voterToken)||typeof b.liked!=='boolean')throw Error('Curtida inválida. Atualize a página e tente novamente.');return{messageId,voterToken,liked:b.liked}}
function safeSponsor(s){const{tracking_hash,phone,email,contact_name,cnpj,legal_name,mercado_pago_payment_id,...publicFields}=s;return publicFields}
function safeCommunityMessage(m){if(!m)return m;const{tracking_hash,mercado_pago_payment_id,...post}=m;return {...post,payment_expires_at:paymentExpiresAt(post,'community')}}
export const normalizeCnpj=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,14);
export function validCnpj(value){const cnpj=normalizeCnpj(value);if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)||/^(.)\1{13}$/.test(cnpj))return false;const nums=[...cnpj].map(c=>c.charCodeAt(0)-48),digit=(chars,weights)=>{const rest=chars.reduce((sum,n,i)=>sum+n*weights[i],0)%11;return rest<2?0:11-rest};return nums[12]===digit(nums.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])&&nums[13]===digit(nums.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])}
export function safeHttps(value,label='O link'){
 const u=new URL(String(value||'')),host=u.hostname.toLowerCase().replace(/\.$/,'');
 const ipLiteral=/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.includes(':');
 const localHost=host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.example')||!host.includes('.');
 const shorteners=new Set(['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','cutt.ly','rb.gy','shorturl.at','lnkd.in']);
 if(u.protocol!=='https:'||u.username||u.password||u.href.length>2048||ipLiteral||localHost||shorteners.has(host)||host.split('.').some(x=>!x||x.length>63||x.startsWith('xn--')))throw Error(label+' deve ser um link HTTPS público, com domínio visível e sem encurtador.');
 return u.href
}
export function whatsappTemplatePayload(order,template,language){const phone='55'+String(order.phone||'').replace(/\D/g,'').replace(/^55/,'');if(!order.whatsapp_opt_in||!/^55[1-9][0-9]{9,10}$/.test(phone)||!order.video_url)throw Error('Pedido sem autorização ou dados de WhatsApp.');return{messaging_product:'whatsapp',to:phone,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:order.name},{type:'text',text:order.code},{type:'text',text:order.video_url}]}]}}}
export function whatsappReminderTemplatePayload(reminder,template,language,origin=PUBLIC_ORIGIN){const phone='55'+String(reminder.phone||'').replace(/\D/g,'').replace(/^55/,'');if(!/^55[1-9][0-9]{9,10}$/.test(phone)||!reminder.name)throw Error('Lembrete sem número ou nome válidos.');return{messaging_product:'whatsapp',to:phone,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:reminder.name},{type:'text',text:origin}]}]}}}
export function whatsappSponsorTemplatePayload(sponsor,kind,template,language,origin=PUBLIC_ORIGIN){const phone='55'+String(sponsor.phone||'').replace(/\D/g,'').replace(/^55/,'');if(!/^55[1-9][0-9]{9,10}$/.test(phone)||!sponsor.company_name||!['thank','expiry'].includes(kind))throw Error('Aviso de patrocinador sem consentimento ou dados válidos.');return{messaging_product:'whatsapp',to:phone,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:sponsor.company_name},{type:'text',text:origin+'/ir-alem/'}]}]}}}
export async function handler(req,env=globalThis.Deno?.env,fetcher=fetch,pushSender=defaultPushSender){
 const origin=req.headers.get('origin');
 const origins=new Set([PUBLIC_ORIGIN,...LEGACY_PUBLIC_ORIGINS,'http://terminal.local:4173',...(env?.get('HM_PUBLIC_ORIGIN')||'').split(',').filter(Boolean),...(env?.get('HM_ALLOWED_ORIGINS')||'').split(',').filter(Boolean)]);
 const isTrustedPreviewOrigin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&/^hocco-message(?:-[a-z0-9-]+)?-aelobrasils-projects\.vercel\.app$/i.test(u.hostname)}catch{return false}};
 const originAllowed=value=>!value||origins.has(value)||isTrustedPreviewOrigin(value);
 const cors={'Access-Control-Allow-Origin':origin&&originAllowed(origin)?origin:PUBLIC_ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 const waConfig=(reminders=false)=>{const access=env?.get('WHATSAPP_ACCESS_TOKEN'),sender=env?.get('WHATSAPP_PHONE_NUMBER_ID'),template=env?.get(reminders?'WHATSAPP_REMINDER_TEMPLATE_NAME':'WHATSAPP_TEMPLATE_NAME'),language=env?.get(reminders?'WHATSAPP_REMINDER_TEMPLATE_LANGUAGE':'WHATSAPP_TEMPLATE_LANGUAGE'),apiVersion=env?.get('WHATSAPP_GRAPH_API_VERSION');return access&&sender&&template&&language&&/^v\d+\.\d+$/.test(apiVersion||'')?{access,sender,template,language,apiVersion}:null};
 const sponsorWaConfig=(kind)=>{const access=env?.get('WHATSAPP_ACCESS_TOKEN'),sender=env?.get('WHATSAPP_PHONE_NUMBER_ID'),suffix=kind==='thank'?'THANK':'EXPIRY',template=env?.get('WHATSAPP_SPONSOR_'+suffix+'_TEMPLATE_NAME'),language=env?.get('WHATSAPP_SPONSOR_'+suffix+'_TEMPLATE_LANGUAGE'),apiVersion=env?.get('WHATSAPP_GRAPH_API_VERSION');return access&&sender&&template&&language&&/^v\d+\.\d+$/.test(apiVersion||'')?{access,sender,template,language,apiVersion}:null};
 if(origin&&!originAllowed(origin))return reply({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405);
 const url=env?.get('SUPABASE_URL');let secret;try{secret=JSON.parse(env?.get('SUPABASE_SECRET_KEYS')||'{}').default}catch{}secret||=env?.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)return reply({error:'Serviço indisponível.'},503);
 const headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:`Bearer ${secret}`}:{})};
 const db=async(path,method='GET',body)=>{const res=await fetcher(`${url}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data;try{data=JSON.parse(text)}catch{data={}}if(!res.ok)throw Error(data.message||'Não foi possível concluir a operação.');return data};
 const expiredPurchase=async(kind,code,hash)=>{const rows=await db('hm_expired_purchases?kind=eq.'+encodeURIComponent(kind)+'&code=eq.'+encodeURIComponent(code)+(hash?'&tracking_hash=eq.'+hash:'')+'&select=*&limit=1');return rows[0]?{...rows[0],id:rows[0].order_id,payment:'pending',expired_purchase:true}:null};
 const expiredReply=()=>reply({expired:true,error:'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem. Se você já pagou, não pague novamente e procure o suporte com o código do pedido.'},410);
 const applyPayment=async(payment,kind,row)=>{
  const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();
  const accountResponse=await fetcher('https://api.mercadopago.com/users/me',{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(12000)});
  if(!accountResponse.ok)throw Error('Não foi possível verificar a conta recebedora.');
  const account=await accountResponse.json(),mode=String(env?.get('MP_ENVIRONMENT')||env?.get('MP_Environment')||'production').toLowerCase();
  const event=verifiedPaymentEvent(payment,{kind,code:row.code,priceCents:Number(row.price_cents),collectorId:account.id,production:!['test','sandbox','testing'].includes(mode)});
  if(kind==='reality_sponsor')return event?await db('rpc/hm_reality_sponsor_apply_payment','POST',{p_code:row.code,p_payment_id:event.p_payment_id,p_amount_cents:event.p_amount_cents,p_status:event.p_status,p_updated_at:event.p_updated_at}):{received:true,ignored:true};
  return event?await db('rpc/hm_apply_verified_payment','POST',event):{received:true,ignored:true};
 };
 const safe=o=>{const{tracking_hash,phone,mercado_pago_payment_id,...rest}=o;return {...rest,payment_expires_at:paymentExpiresAt(rest,'order')}};
 try{
  let bodySize=0;const b=await readJsonBody(req,undefined,size=>{bodySize=size}),action=b?.action;
  const requestUrl=new URL(req.url),notificationType=requestUrl.searchParams.get('type')||String(b.type||''),notificationTopic=requestUrl.searchParams.get('topic')||'',isMpWebhook=notificationType==='payment'||notificationTopic==='payment'||notificationTopic==='merchant_order';
  if(isMpWebhook){
   const dataId=requestUrl.searchParams.get('data.id')||b.data?.id||'',requestId=req.headers.get('x-request-id')||'',signature=req.headers.get('x-signature')||'',classification=classifyMercadoPagoNotification({topic:notificationTopic,type:notificationType,dataId,requestId,signature});
   if(classification==='ignore')return reply({received:true,ignored:true});
   const webhookSecret=env?.get('MP_WEBHOOK_SECRET'),accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!webhookSecret||!accessToken)return reply({error:'Webhook de pagamento não configurado.'},503);
   if(!await verifyWebhookSignature({dataId,requestId,signature,secret:webhookSecret}))return reply({error:'Assinatura do webhook inválida.'},401);
   const paymentResponse=await fetcher(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,{headers:{Authorization:`Bearer ${accessToken}`}});let payment={};try{payment=await paymentResponse.json()}catch{}
   // The developer dashboard sends a signed sample notification with the fake ID 123456.
   // A genuine 404 means there is no payment to apply; acknowledge it so the test does not retry forever.
   if(paymentResponse.status===404)return reply({received:true,ignored:true});
   if(!paymentResponse.ok){const providerError=typeof payment.error==='string'?payment.error:'';const causeCodes=Array.isArray(payment.cause)?payment.cause.map((cause:any)=>typeof cause?.code==='string'?cause.code:'').filter(Boolean).slice(0,5):[];console.error('Mercado Pago webhook payment lookup failed',{status:paymentResponse.status,error:providerError,causeCodes});return reply({error:'Não foi possível consultar o pagamento.'},502);}
   const reference=String(payment.external_reference||''),match=/^hocco:(order|community|sponsor|reality_sponsor):([A-Z0-9-]{8,24})$/.exec(reference);if(!match||!['approved','refunded','charged_back','in_mediation'].includes(payment.status))return reply({received:true});
   const [,kind,code]=match;let row,path,amount;
   if(kind==='order'){row=(await db(`hm_orders?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_orders?id=eq.${encodeURIComponent(row.id)}`}
   if(kind==='community'){row=(await db(`hm_community_messages?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_community_messages?id=eq.${encodeURIComponent(row.id)}`}
   if(kind==='sponsor'){row=(await db(`hm_sponsors?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_sponsors?id=eq.${encodeURIComponent(row.id)}`}
   if(kind==='reality_sponsor')row=(await db(`hm_reality_sponsor_orders?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];
   if(!row&&kind!=='sponsor'&&kind!=='reality_sponsor')row=await expiredPurchase(kind,code);
   if(!row)return reply({received:true});return reply(await applyPayment(payment,kind,row));
  }
  if(!['sponsor.create','customer.reset','reality_sponsor.create'].includes(action)&&bodySize>12000)return reply({error:'Solicitação muito grande.'},413);if(action==='reality_sponsor.create'&&bodySize>1500000)return reply({error:'A imagem deve ter até 1 MB.'},413);
  if(typeof action!=='string')return reply({error:'Ação inválida.'},400);
  // The random private tracking token authenticates order access; team actions require a verified user JWT and active membership.
  if(action==='push.run'){
   const rows=await db('rpc/get_push_runtime_secrets','POST',{}),secrets=Array.isArray(rows)?rows[0]:rows;
   if(!secrets?.cron_secret||req.headers.get('x-hocco-cron')!==secrets.cron_secret)return reply({error:'Acesso não autorizado.'},401);
   const config=await publicPushConfig(db);if(!config.enabled||!secrets.vapid_private_key)return reply({error:'Notificações indisponíveis.'},503);
   const manual=await dispatchAppPush({db,send:pushSender,config,privateKey:secrets.vapid_private_key,origin:PUBLIC_ORIGIN,manual:true}),automatic=await dispatchAppPush({db,send:pushSender,config,privateKey:secrets.vapid_private_key,origin:PUBLIC_ORIGIN});return reply({...automatic,manual});
  }
  if(action==='reminders.run'){
   const cronSecret=env?.get('HM_REMINDER_CRON_SECRET'),authorization=req.headers.get('Authorization')||'';if(!cronSecret||authorization!=='Bearer '+cronSecret)return reply({error:'Acesso não autorizado.'},401);let sent=0,failed=0,sponsorSent=0,sponsorFailed=0;
   await db('rpc/hm_reality_sponsor_expire_due','POST',{});
   for(const kind of ['thank','expiry']){const sponsorConfig=sponsorWaConfig(kind);if(!sponsorConfig)continue;const due=await db('rpc/hm_claim_due_sponsor_notifications','POST',{p_kind:kind,p_limit:50});for(const sponsor of due){try{const payload=whatsappSponsorTemplatePayload(sponsor,kind,sponsorConfig.template,sponsorConfig.language,PUBLIC_ORIGIN);const response=await fetcher(`https://graph.facebook.com/${sponsorConfig.apiVersion}/${encodeURIComponent(sponsorConfig.sender)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${sponsorConfig.access}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});let result={};try{result=await response.json()}catch{}if(!response.ok)throw Error(result.error?.message||'A API do WhatsApp recusou o aviso.');await db('rpc/hm_finish_sponsor_notification','POST',{p_id:sponsor.id,p_kind:kind,p_sent:true,p_detail:{messageId:result.messages?.[0]?.id||''}});sponsorSent++}catch(error){await db('rpc/hm_finish_sponsor_notification','POST',{p_id:sponsor.id,p_kind:kind,p_sent:false,p_detail:{reason:String(error.message||'provider_error').slice(0,300)}});sponsorFailed++}}}
   let realitySponsorSent=0,realitySponsorFailed=0;
   try{
    const due=await db('rpc/hm_reality_sponsor_claim_due','POST',{});
    if(due.length){
     const config=await publicPushConfig(db),secretRows=await db('rpc/get_push_runtime_secrets','POST',{}),secrets=Array.isArray(secretRows)?secretRows[0]:secretRows;
     let cursor=0;
     const sendWorker=async()=>{while(cursor<due.length){
      const sponsor=due[cursor++];
      try{
       if(!config.enabled||!secrets?.vapid_private_key||!sponsor.device_hash)throw Error('Notificações push indisponíveis.');
       const device=(await db('hm_push_devices?device_hash=eq.'+encodeURIComponent(sponsor.device_hash)+'&enabled=eq.true&select=endpoint,p256dh,auth_key&limit=1'))[0];
       if(!device)throw Error('Aparelho sem notificações ativas.');
       const notificationId=crypto.randomUUID(),dispatchId=crypto.randomUUID(),title='Seu período na HOCCO termina amanhã',body='Deseja renovar sua presença como Patrocinador Oficial por mais 7 dias?';
       const payload=JSON.stringify({id:notificationId,title,body,url:'/patrocinadores/#renovar',tag:'hocco-sponsor-renewal'});
       await pushSender({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth_key}},payload,{vapidDetails:{subject:PUBLIC_ORIGIN,publicKey:config.publicKey,privateKey:secrets.vapid_private_key},TTL:3600,urgency:'normal',topic:'hocco-sponsor-renewal',signal:AbortSignal.timeout(10000)});
       await db('hm_push_inbox','POST',{id:notificationId,device_hash:sponsor.device_hash,variant:'sponsor_renewal',title,body,url:'/patrocinadores/#renovar',status:'sent',sent_at:new Date().toISOString(),dispatch_id:dispatchId});
       await db('rpc/hm_reality_sponsor_finish_notice','POST',{p_id:sponsor.id,p_sent:true,p_error:''});
       realitySponsorSent++;
      }catch(error){
       await db('rpc/hm_reality_sponsor_finish_notice','POST',{p_id:sponsor.id,p_sent:false,p_error:String(error.message||'push_error').slice(0,300)});
       realitySponsorFailed++;
      }
     }};
     await Promise.all(Array.from({length:Math.min(10,due.length)},sendWorker));
    }
   }catch(error){realitySponsorFailed++}
   try{await db('hm_alex_events','POST',{event_type:'reminder_run',severity:failed||sponsorFailed||realitySponsorFailed?'warning':'info',detail:{sent,failed,sponsorSent,sponsorFailed,realitySponsorSent,realitySponsorFailed}})}catch{}
   return reply({sent,failed,sponsorSent,sponsorFailed,realitySponsorSent,realitySponsorFailed})
  }
  if(action==='analytics.event'){
   const event=String(b.event||'');if(!['participation_open','compose_video','compose_community','compose_live','company_registration','company_review','checkout_open','checkout_error','channel_open','company_directory','order_lookup'].includes(event))return reply({error:'Evento inválido.'},400);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
   if(!await db('rpc/hm_rate_limit','POST',{p_bucket:`experience:${await sha(ip)}:${Math.floor(Date.now()/60000)}`,p_max:30}))return reply({ok:false},429);
   await db('rpc/hm_count_experience','POST',{p_event:event});return reply({ok:true},202);
  }
  if(action==='analytics.track'){
   const route=String(b.route||'');if(!['/','/ir-alem/','/cliente/'].includes(route))return reply({error:'Rota inválida.'},400);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';const bucket=`analytics:${await sha(ip)}:${Math.floor(Date.now()/60000)}`;if(!await db('rpc/hm_rate_limit','POST',{p_bucket:bucket,p_max:30}))return reply({ok:false},429);
   await db('hm_alex_events','POST',{event_type:'site_view',route,severity:'info',detail:{}});return reply({ok:true},202)
  }
  if(['payment_claim','community.payment_claim','sponsor.payment_claim'].includes(action))return reply({error:'A confirmação é automática pelo Mercado Pago. Atualize o acompanhamento.'},409);
  if(action==='customer.reset'){
   // Reset is local-only. Old clients must not erase orders or financial audit records.
   return reply({error:'Atualize o app para limpar somente os dados deste aparelho. Seus pedidos continuam preservados.'},409)
  }
  if(action==='maintenance.reconcile'){
   const authHash=await sha((req.headers.get('authorization')||'').replace(/^Bearer /,''));
   if(!await db('rpc/hm_server_authorize','POST',{p_auth_hash:authHash}))return reply({error:'Acesso não autorizado.'},401);
   await db('rpc/hm_refresh_city_markets','POST',{});
   const jobs=await db('rpc/hm_claim_reconciliation','POST',{p_limit:10});let completed=0,waiting=0,failed=0;
   for(const job of jobs){
    try{
     const table=job.kind==='order'?'hm_orders':job.kind==='sponsor'?'hm_sponsors':'hm_community_messages';
     let row=(await db(table+'?code=eq.'+encodeURIComponent(job.code)+'&select=*&limit=1'))[0];if(!row&&job.kind!=='sponsor')row=await expiredPurchase(job.kind,job.code);
     if(!row||row.payment!=='pending'){await db('rpc/hm_finish_reconciliation','POST',{p_kind:job.kind,p_code:job.code,p_lease:job.lease,p_done:true,p_error:''});completed++;continue}
     const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)throw Error('Provedor de pagamento não configurado.');
     const response=await fetcher('https://api.mercadopago.com/v1/payments/search?external_reference='+encodeURIComponent(paymentReference(job.kind,job.code))+'&sort=date_created&criteria=desc&limit=10',{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(10000)});
     if(!response.ok)throw Error('Consulta ao provedor indisponível.');
     const result=await response.json();for(const payment of result.results||[])if(['approved','refunded','charged_back','in_mediation'].includes(payment.status))await applyPayment(payment,job.kind,row);
     const current=(await db(table+'?code=eq.'+encodeURIComponent(job.code)+'&select=payment&limit=1'))[0];
     const tombPayment=row.expired_purchase?await db('hm_payments?kind=eq.'+encodeURIComponent(job.kind)+'&code=eq.'+encodeURIComponent(job.code)+'&select=provider_status&limit=1'):[];const done=Boolean(current&&current.payment!=='pending'||tombPayment.length);await db('rpc/hm_finish_reconciliation','POST',{p_kind:job.kind,p_code:job.code,p_lease:job.lease,p_done:done,p_error:''});if(done)completed++;else waiting++;
    }catch{failed++;await db('rpc/hm_finish_reconciliation','POST',{p_kind:job.kind,p_code:job.code,p_lease:job.lease,p_done:false,p_error:'Não foi possível verificar o pagamento nesta tentativa.'})}
   }
   return reply({ok:true,completed,waiting,failed});
  }
  if(action==='geo.record'){
   const authHash=await sha((req.headers.get('authorization')||'').replace(/^Bearer /,''));
   const input=validateLocation({city:b.city,stateCode:b.uf});
   if(!/^\d{4}-\d{2}-\d{2}$/.test(b.day||'')||!/^[a-f0-9]{64}$/.test(b.visitorHash||''))return reply({error:'Métrica inválida.'},400);
   return reply(await db('rpc/hm_geo_record','POST',{p_auth_hash:authHash,p_city:input.city,p_uf:input.state_code,p_day:b.day,p_visitor_hash:b.visitorHash}));
  }
  if(action.startsWith('admin.')){
   const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Entre com a conta autorizada da equipe.'},401);
   const res=await fetcher(`${url}/auth/v1/user`,{headers:{...headers,Authorization:authorization}});if(!res.ok)return reply({error:'Sessão inválida ou expirada.'},401);const user=await res.json();if(!user.id||!user.email_confirmed_at)return reply({error:'Conta não autorizada.'},403);
   const members=await db(`hm_team_members?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=user_id`);if(!members.length)return reply({error:'Acesso restrito à equipe HOCCO.'},403);
   if(action==='admin.content.update'){
    const p=b.payload||{},title=String(p.episodeTitle||'').trim(),raw=String(p.episodeUrl||'').trim();if((!title)!==(!raw)||title.length>120||raw.length>500)throw Error('Confira o título e o link do vídeo em destaque.');
    const episodeUrl=raw?normalizeVideo(raw,0).replace('&t=0s',''):'';return reply(await db('rpc/hm_update_content_controls','POST',{p_actor:user.id,p_title:title,p_url:episodeUrl,p_programming:validateProgramming(p)}));
   }
   if(action==='admin.notices.history')return reply({campaigns:await db('rpc/hm_notice_history','POST',{p_actor:user.id}),channelReady:(await publicPushConfig(db)).enabled});
   if(action==='admin.notices.preview'){const p=validateManualNotice(b.payload||{});return reply(await db('rpc/hm_notice_preview','POST',{p_actor:user.id,p_audience:p.audience}))}
   if(action==='admin.notices.enqueue'){const p=validateManualNotice(b.payload||{});if(b.confirmed!==true||!(/^[a-f0-9-]{36}$/i).test(b.requestKey||'')||!Number.isInteger(b.expectedCount)||b.expectedCount<1)throw Error('Confira a prévia e confirme o aviso antes de enviá-lo.');return reply(await db('rpc/hm_notice_enqueue','POST',{p_actor:user.id,p_key:b.requestKey,p_payload:p,p_expected:b.expectedCount}))}
   if(action==='admin.notices.cancel'){if(!(/^[a-f0-9-]{36}$/i).test(b.id||'')||b.confirmed!==true)throw Error('Confirme a interrupção do aviso.');return reply(await db('rpc/hm_notice_cancel','POST',{p_actor:user.id,p_id:b.id}))}
   if(action==='admin.episode.update'){
    const title=String(b.payload?.title||'').trim(),raw=String(b.payload?.url||'').trim();
    if((!title)!==(!raw)||title.length>120||raw.length>500)throw Error('Informe o título de até 120 caracteres e o link do episódio, ou deixe ambos vazios para retirar o destaque.');
    const videoUrl=raw?normalizeVideo(raw,0).replace('&t=0s',''):'';
    const episode=await db('rpc/hm_set_featured_episode','POST',{p_actor:user.id,p_title:title,p_url:videoUrl});return reply({ok:true,episode});
   }
   if(action==='admin.reconciliation')return reply({jobs:await db('hm_reconciliation_jobs?status=neq.done&select=kind,code,attempts,status,next_attempt_at,last_error,updated_at&order=updated_at.desc&limit=100')});
   if(action==='admin.geo'){await db('rpc/hm_refresh_city_markets','POST',{});return reply({cities:await db('rpc/hm_city_dashboard','POST',{})})}
   if(action==='admin.geo.mutate'){
    const input=validateLocation({city:b.city,stateCode:b.uf}),status=String(b.status||'');if(!['observing','review','open','paused'].includes(status))throw Error('Situação de cidade inválida.');
    const result=await db('rpc/hm_admin_city_market','POST',{p_actor:user.id,p_city:input.city,p_uf:input.state_code,p_status:status});return reply({city:result});
   }
   if(action==='admin.sponsor.metrics'){const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);return reply({metrics:await db('hm_sponsor_daily_metrics?day=gte.'+since+'&select=day,sponsor_id,event,city,state_code,category,total&order=day.desc&limit=5000')})}
   if(action==='admin.sender.list')return reply(await db('rpc/hm_list_sender_evidence','POST',{p_actor:user.id,p_search:String(b.search||'').slice(0,120),p_offset:Math.max(0,Math.min(1000000,Math.trunc(Number(b.offset)||0)))}));
   if(action==='admin.reactivation')return reply({...await db('rpc/hm_push_dashboard','POST',{p_actor:user.id,p_offset:Math.max(0,Math.min(1000000,Math.trunc(Number(b.offset)||0)))}),channelReady:(await publicPushConfig(db)).enabled,channel:'push'});
   if(action==='admin.sender.lookup'){if(!['order','community'].includes(b.kind)||!(/^(?:HM-26-|HC-CM-)[A-F0-9]{12}$/).test(b.code||''))throw Error('Código de mensagem inválido.');return reply({sender:await db('rpc/hm_read_sender_evidence','POST',{p_actor:user.id,p_kind:b.kind,p_code:b.code,p_reason:String(b.reason||'').trim()})})}
   if(action==='admin.lab.authorize')return reply({ok:true,actorId:user.id});
   if(action==='admin.programming.update')return reply({programming:await db('rpc/hm_update_programming','POST',{p_actor:user.id,p_payload:validateProgramming(b.payload||{})})});
   if(action==='admin.programming')return reply({programming:(await db('hm_programming?id=eq.1&select=*'))[0]});
   if(action==='admin.finance'){const rows=await readAll(db,'hm_payments?select=*&order=updated_at.desc');return reply({payments:rows})}
   if(action==='admin.data.status')return reply(await db('rpc/hm_data_cleanup_status','POST',{p_actor:user.id}));
   if(action==='admin.data.preferences'){if(typeof b.enabled!=='boolean')throw Error('Escolha a opção de limpeza automática.');return reply(await db('rpc/hm_update_cleanup_preferences','POST',{p_actor:user.id,p_enabled:b.enabled}))}
   if(action==='admin.data.cleanup'){if(b.confirmExpired!==true)throw Error('Confira os vencidos e confirme a limpeza.');return reply(await db('rpc/hm_run_expired_cleanup','POST',{p_actor:user.id}))}
   if(action==='admin.cleanup'){
    const scope=String(b.scope||''),ids=b.ids||[];
    if(!['orders','sponsors','community','live','trash','reports','visits'].includes(scope)||!Array.isArray(ids)||ids.length>1000||ids.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id)))||typeof b.execute!=='boolean')throw Error('Confira a área e os registros da limpeza.');
    const result=await db('rpc/hm_cleanup_records','POST',{p_actor:user.id,p_scope:scope,p_ids:ids,p_execute:b.execute});
    let filesRemoved=0,filesPending=0;
    if(b.execute){const queue=await db('hm_asset_cleanup_queue?select=path&order=created_at.asc&limit=50');for(const asset of queue){
     const path=String(asset.path||'');if(!/^sponsors\/[a-f0-9]{32}-(logo|cover)\.(png|jpg|webp)$/.test(path)){filesPending++;continue}
     try{const references=await db('hm_sponsors?or=(logo_url.like.*'+encodeURIComponent(path)+',cover_url.like.*'+encodeURIComponent(path)+')&select=id&limit=1');
      if(!references.length){const response=await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'DELETE',headers});if(!response.ok&&response.status!==404){filesPending++;continue}filesRemoved++}
      await db('hm_asset_cleanup_queue?path=eq.'+encodeURIComponent(path),'DELETE');
     }catch{filesPending++}
    }const remaining=await db('hm_asset_cleanup_queue?select=path&limit=1');if(remaining.length)filesPending=Math.max(1,filesPending)}
    return reply({...result,filesRemoved,filesPending});
   }
   if(action==='admin.dashboard'){const[settings,orders,trashOrders,audit,reminders,sponsorSettings,sponsors,trashSponsors,recordActions,reports,communityMessages,sponsorPaymentEvents,payments,experience]=await Promise.all([db('hm_settings?id=eq.1&select=*'),readAll(db,'hm_orders?is_demo=eq.false&archived_at=is.null&select=*&order=created_at.desc&limit=500'),readAll(db,'hm_orders?is_demo=eq.false&archived_at=not.is.null&select=*&order=archived_at.desc&limit=500'),db('hm_audit?select=*&order=created_at.desc&limit=1000'),db('hm_reminder_subscriptions?select=order_id,enabled,next_send_at,last_sent_at'),db('hm_sponsor_settings?id=eq.1&select=*'),readAll(db,'hm_sponsors?archived_at=is.null&select=*&order=created_at.desc&limit=500'),readAll(db,'hm_sponsors?archived_at=not.is.null&select=*&order=archived_at.desc&limit=500'),db('hm_admin_record_actions?select=*&order=created_at.desc&limit=100'),db('hm_alex_reports?select=report_date,generated_at,content,status&order=report_date.desc&limit=2'),readAll(db,'hm_community_messages?content_removed_at=is.null&select=*&order=created_at.desc&limit=500'),db('hm_alex_events?event_type=eq.system_event&select=detail&order=created_at.desc&limit=2000'),readAll(db,'hm_payments?select=provider_payment_id,kind,code,amount_cents,provider_status,needs_attention,created_at,updated_at&order=updated_at.desc&limit=200'),db('hm_experience_daily?event_day=gte.'+new Date(Date.now()-6*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})+'&select=event_day,event_name,total&order=event_day.desc&limit=100')]);const enabledOrders=new Set(reminders.filter(x=>x.enabled).map(x=>x.order_id)),paidSponsorIds=new Set(sponsorPaymentEvents.filter(e=>e.detail?.object==='sponsor'&&e.detail?.action==='payment_confirmed'&&e.detail?.payment_id).map(e=>e.detail.sponsor_id).filter(Boolean)),mpOrderIds=new Set(audit.filter(h=>h.action==='pay'&&h.detail?.payment_id).map(h=>h.order_id).filter(Boolean));return reply({settings:settings[0],orders:orders.map(({tracking_hash,...o})=>({...o,reminder_active:enabledOrders.has(o.id),online_payment_recorded:Boolean(o.mercado_pago_payment_id)||mpOrderIds.has(o.id)})),trashOrders:trashOrders.map(({tracking_hash,...o})=>({...o,reminder_active:enabledOrders.has(o.id)})),audit:audit.filter(h=>!h.order_id||orders.some(o=>o.id===h.order_id)||h.action==='settings'),sponsorSettings:sponsorSettings[0],sponsors:sponsors.map(({tracking_hash,...sponsor})=>({...sponsor,online_payment_recorded:Boolean(sponsor.mercado_pago_payment_id)||paidSponsorIds.has(sponsor.id)})),trashSponsors:trashSponsors.map(({tracking_hash,...sponsor})=>sponsor),communityMessages:communityMessages.map(post=>({...safeCommunityMessage(post),refund_online_available:Boolean(post.mercado_pago_payment_id)})),recordActions,dailyReport:reports[0]||null,recentReports:reports,payments,experience})}
   if(action==='admin.community.mutate'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Mensagem da comunidade inválida.');
    const operation=String(b.operation||''),reason=String(b.payload?.reason||'').trim();
    if(!['approve','reject','refund','refund_manual','live_read','edit','hide','restore'].includes(operation))throw Error('Ação de curadoria inválida.');
    if(['restore','edit','approve','live_read'].includes(operation)){const target=(await db('hm_community_messages?id=eq.'+encodeURIComponent(b.id)+'&select=content_removed_at&limit=1'))[0];if(target?.content_removed_at)return reply({error:'O conteúdo desta mensagem já foi excluído. O registro financeiro permanece disponível.'},409)}
    if(operation==='reject'&&(reason.length<2||reason.length>500))throw Error('Informe o motivo da recusa.');
    if(operation==='hide'&&(reason.length<2||reason.length>500))throw Error('Informe o motivo para ocultar a mensagem.');
    if(operation==='edit'){
     const message=String(b.payload?.message||'').trim(),editReason=reason,moderation=moderateCommunityMessage(message);
     if(message.length<1||message.length>180||editReason.length<2||editReason.length>500)throw Error('Informe uma mensagem de até 180 caracteres e o motivo da correção.');
     if(!moderation.approved&&!moderation.requiresReview)throw Error('O texto corrigido viola as regras da Comunidade.');
     const post=await db('rpc/hm_admin_edit_community_message','POST',{p_actor:user.id,p_id:b.id,p_message:message,p_reason:editReason});
     return reply({post:safeCommunityMessage(post),needsReview:moderation.requiresReview});
    }
    if(operation==='hide'){
     const post=await db('rpc/hm_admin_hide_community_message','POST',{p_actor:user.id,p_id:b.id,p_reason:reason});
     return reply({post:safeCommunityMessage(post)});
    }
    if(operation==='restore'){
     const post=await db('rpc/hm_admin_restore_community_message','POST',{p_actor:user.id,p_id:b.id});
     return reply({post:safeCommunityMessage(post)});
    }
    let paymentId='';
    if(operation==='refund'||operation==='refund_manual'){
     const current=(await db('hm_community_messages?id=eq.'+encodeURIComponent(b.id)+'&select=id,code,price_cents,review,payment,mercado_pago_payment_id&limit=1'))[0];if(!current)throw Error('Mensagem da comunidade não encontrada.');
     if(current.review!=='rejected'||current.payment!=='confirmed')throw Error('A mensagem não tem uma devolução pendente.');
     paymentId=String(current.mercado_pago_payment_id||'');
     if(operation==='refund'){
      if(!paymentId)throw Error('Este pagamento antigo não tem identificador do Mercado Pago. Faça a devolução no painel e use “Registrar devolução manual”.');
      await refundApprovedPayment({accessToken:String(env?.get('MP_ACCESS_TOKEN')||'').trim(),paymentId,externalReference:paymentReference('community',current.code),priceCents:Number(current.price_cents),fetcher});
     }else{
      if(b.payload?.confirmed!==true)throw Error('Confirme que a devolução integral já foi realizada no Mercado Pago.');
      if(paymentId)throw Error('Este pagamento permite devolução automática; use “Devolver pelo Mercado Pago”.');
     }
    }
    const rpcAction=operation==='refund_manual'?'refund':operation,post=await db('rpc/hm_community_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:rpcAction,p_payload:rpcAction==='reject'?{reason}:{}});
    try{await db('hm_alex_events','POST',{event_type:'system_event',severity:operation==='reject'?'warning':'info',detail:{object:'community_message',action:operation,payment:post.payment,review:post.review}})}catch{}
    return reply({post:safeCommunityMessage(post)})
   }
   if(action==='admin.records.archive'){return reply(await db('rpc/hm_archive_records','POST',{p_actor:user.id}))}
   if(action==='admin.records.restore'){if(!/^[a-f0-9-]{36}$/i.test(b.id||'')||!['order','sponsor'].includes(b.type))throw Error('Registro inválido.');return reply(await db('rpc/hm_restore_record','POST',{p_actor:user.id,p_type:b.type,p_id:b.id}))}
   if(action==='admin.sponsor.settings'){const p=b.payload||{};if(!Number.isInteger(p.priceCents)||p.priceCents<100||p.priceCents>999999||p.capacity!==50||typeof p.enabled!=='boolean')throw Error('Configure o preço, mantenha o limite de 50 empresas e escolha se as inscrições ficam abertas.');await db('hm_sponsor_settings?id=eq.1','PATCH',{price_cents:p.priceCents,capacity:p.capacity,enabled:p.enabled,updated_at:new Date().toISOString()});try{await db('hm_alex_events','POST',{event_type:'system_event',detail:{object:'sponsor_settings',action:'updated'}})}catch{}return reply({ok:true})}
   if(action==='admin.sponsor.mutate'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Solicitação de patrocinador inválida.');
    const rows=await db('hm_sponsors?id=eq.'+encodeURIComponent(b.id)+'&select=*&limit=1'),s=rows[0];if(!s)throw Error('Solicitação de patrocinador não encontrada.');
    const op=b.operation,updates={updated_at:new Date().toISOString()};
    if(op==='approve'){if(s.payment_hold)throw Error('Resolva a revisão financeira antes da aprovação.');if(s.review!=='pending')throw Error('A curadoria já foi concluída.');updates.review='approved';if(s.payment==='confirmed'){let start=new Date();if(s.renewal_of){const parent=(await db('hm_sponsors?id=eq.'+encodeURIComponent(s.renewal_of)+'&select=expires_at&limit=1'))[0];if(parent?.expires_at&&Date.parse(parent.expires_at)>start.getTime())start=new Date(parent.expires_at)}const end=new Date(start.getTime()+7*86400000);updates.starts_at=start.toISOString();updates.expires_at=end.toISOString();updates.next_thank_at=s.thank_you_opt_in?new Date(start.getTime()+2*86400000).toISOString():null;updates.next_expiry_notice_at=s.expiry_notice_opt_in?new Date(end.getTime()-86400000).toISOString():null;updates.notification_status=(s.thank_you_opt_in||s.expiry_notice_opt_in)?'pending':'not_configured'}}
    else if(op==='reject'){if(s.payment_hold)throw Error('Resolva a revisão financeira antes da recusa.');const reason=String(b.payload?.reason||'').trim();if(reason.length<2||reason.length>500)throw Error('Informe o motivo da recusa.');updates.review='rejected';updates.reason=reason;const events=await db('hm_alex_events?event_type=eq.system_event&detail->>sponsor_id=eq.'+encodeURIComponent(s.id)+'&select=detail&order=created_at.desc'),paymentEvent=events.find(e=>e.detail?.object==='sponsor'&&e.detail?.action==='payment_confirmed'&&e.detail?.sponsor_id===s.id&&e.detail?.code===s.code&&e.detail?.payment_id),paymentId=String(s.mercado_pago_payment_id||paymentEvent?.detail?.payment_id||'');if(paymentId&&s.payment==='confirmed'){await refundApprovedPayment({accessToken:String(env?.get('MP_ACCESS_TOKEN')||'').trim(),paymentId,externalReference:paymentReference('sponsor',s.code),priceCents:Number(s.price_cents),fetcher});updates.payment='refunded';updates.starts_at=null;updates.expires_at=null}}
    else if(op==='pay'){throw Error('O pagamento só pode ser confirmado automaticamente pelo Mercado Pago.')}
    else if(op==='refund'){if(s.payment!=='confirmed'||s.review!=='rejected')throw Error('A devolução online só está disponível para um patrocínio pago e recusado.');const events=await db('hm_alex_events?event_type=eq.system_event&detail->>sponsor_id=eq.'+encodeURIComponent(s.id)+'&select=detail&order=created_at.desc'),paymentEvent=events.find(e=>e.detail?.object==='sponsor'&&e.detail?.action==='payment_confirmed'&&e.detail?.sponsor_id===s.id&&e.detail?.code===s.code&&e.detail?.payment_id),paymentId=String(s.mercado_pago_payment_id||paymentEvent?.detail?.payment_id||'');if(!paymentId)throw Error('Não há identificador Mercado Pago associado a este pagamento antigo. Faça a devolução no painel do Mercado Pago e use “Registrar devolução manual”.');await refundApprovedPayment({accessToken:String(env?.get('MP_ACCESS_TOKEN')||'').trim(),paymentId,externalReference:paymentReference('sponsor',s.code),priceCents:Number(s.price_cents),fetcher});updates.payment='refunded';updates.starts_at=null;updates.expires_at=null}
    else if(op==='refund_manual'){if(s.payment!=='confirmed'||s.review!=='rejected'||b.payload?.confirmed!==true)throw Error('Confirme que a devolução foi concluída no Mercado Pago antes de registrar.');const events=await db('hm_alex_events?event_type=eq.system_event&select=detail&order=created_at.desc&limit=2000'),hasProviderId=events.some(e=>e.detail?.object==='sponsor'&&e.detail?.action==='payment_confirmed'&&e.detail?.sponsor_id===s.id&&e.detail?.code===s.code&&e.detail?.payment_id);if(s.mercado_pago_payment_id||hasProviderId)throw Error('Este pagamento permite devolução automática pelo controle; use “Devolver pelo Mercado Pago”.');updates.payment='refunded';updates.starts_at=null;updates.expires_at=null}
    else throw Error('Ação de patrocinador inválida.');
    const saved=await db('hm_sponsors?id=eq.'+encodeURIComponent(b.id),'PATCH',updates);try{await db('hm_alex_events','POST',{event_type:'system_event',severity:op==='reject'?'warning':'info',detail:{object:'sponsor',action:op==='refund_manual'?'refund_recorded_manually':op,review:updates.review||s.review,payment:updates.payment||s.payment}})}catch{}return reply({sponsor:saved[0]?safeSponsor(saved[0]):safeSponsor({...s,...updates})})
   }
   if(action==='admin.sponsor.delete')return reply({error:'Exclusão definitiva desativada. Atualize o controle e envie o registro para a lixeira.'},409);
   if(action==='admin.records.archive_one'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||'')||!['order','sponsor'].includes(b.type))throw Error('Registro inválido.');
    const reason=String(b.reason||'Limpeza administrativa solicitada pela equipe.').trim().slice(0,500)||'Limpeza administrativa solicitada pela equipe.';
    return reply(await db('rpc/hm_archive_record','POST',{p_actor:user.id,p_type:b.type,p_id:b.id,p_reason:reason}));
   }
   if(action==='admin.general.update'){
    const p=b.payload||{},notice=String(p.founderNotice||'').trim(),hours=Number(p.communityDurationHours);
    const validPrice=value=>Number.isInteger(value)&&value>=1&&value<=999900;
    if(!Array.isArray(p.videoPrices)||p.videoPrices.length!==2||!p.videoPrices.every(validPrice)||!validPrice(p.communityPriceCents)||!validPrice(p.livePriceCents)||!Number.isInteger(p.sponsorPriceCents)||p.sponsorPriceCents<100||p.sponsorPriceCents>999999||typeof p.videoEnabled!=='boolean'||typeof p.communityEnabled!=='boolean'||typeof p.liveEnabled!=='boolean'||typeof p.sponsorsEnabled!=='boolean'||typeof p.founderNoticeActive!=='boolean'||!Number.isInteger(hours)||hours<1||hours>24||notice.length>500||p.founderNoticeActive&&notice.length===0)throw Error('Confira preços, disponibilidade e controles gerais. A mensagem oficial pode ter até 500 caracteres e a duração deve ficar entre 1 e 24 horas.');
    const settings=await db('rpc/hm_update_general_control','POST',{p_actor:user.id,p_payload:{...p,founderNotice:notice,communityDurationHours:hours}});
    try{await db('hm_alex_events','POST',{event_type:'system_event',detail:{object:'general_control',action:'updated'}})}catch{}
    return reply({ok:true,settings});
   }
   if(action==='admin.community.pricing'){
    const pricing=validateCommunityPricing(b.payload||{}),now=new Date().toISOString();
    const updated=await db('hm_settings?id=eq.1','PATCH',{community_price_cents:pricing.communityPriceCents,live_price_cents:pricing.livePriceCents,updated_at:now});
    await db('hm_audit','POST',{actor_id:user.id,action:'community_pricing',detail:{community_price_cents:pricing.communityPriceCents,live_price_cents:pricing.livePriceCents}});
    return reply({ok:true,settings:updated[0]||null});
   }
   if(action==='admin.settings'){
    const p=b.payload||{};if(!Array.isArray(p.prices)||p.prices.length!==5||p.prices.some(x=>!Number.isInteger(x)||x<1||x>999900))throw Error('Cada preço deve ser de pelo menos R$ 0,01.');
    if(p.paymentUrl){const u=new URL(p.paymentUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Use um link de pagamento HTTPS.');}
    if(p.pixKey&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.pixKey))throw Error('Informe a chave PIX aleatória emitida pelo seu banco.');
    if([p.paymentUrl,p.pixKey,p.payeeName,p.payeeCity,p.bankName].some(x=>typeof x!=='string'||x.length>500))throw Error('Configuração inválida.');
    if(typeof p.publicationDeadline!=='string'||!Number.isFinite(Date.parse(p.publicationDeadline))||Date.parse(p.publicationDeadline)<=Date.now())throw Error('Informe uma data futura para a publicação.');
    if(!Number.isInteger(p.displayDurationSeconds)||p.displayDurationSeconds<1||p.displayDurationSeconds>60)throw Error('A duração da mensagem deve ficar entre 1 e 60 segundos.');
    const data=await db('rpc/hm_admin_action','POST',{p_actor:user.id,p_id:null,p_action:'settings',p_payload:p});try{await db('hm_alex_events','POST',{event_type:'system_event',detail:{object:'settings',action:'updated'}})}catch{}return reply({settings:data})
   }
   if(action==='admin.mutate'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Pedido inválido.');let payload={};
    if(b.operation==='reject')payload={reason:String(b.payload?.reason||'').trim()};
    if(b.operation==='edit'){
     const message=String(b.payload?.message||'').trim(),reason=String(b.payload?.reason||'').trim(),moderation=moderateCommunityMessage(message);
     if(message.length<1||message.length>180||reason.length<2||reason.length>500)throw Error('Informe uma mensagem de até 180 caracteres e o motivo da correção.');
     if(!moderation.approved&&!moderation.requiresReview)throw Error('O texto corrigido viola as regras da Comunidade.');
     const order=await db('rpc/hm_admin_edit_video_message','POST',{p_actor:user.id,p_id:b.id,p_message:message,p_reason:reason});return reply({order,needsReview:moderation.requiresReview});
    }
    if(b.operation==='archive'){const order=await db('rpc/hm_admin_archive_video_message','POST',{p_actor:user.id,p_id:b.id});return reply({order})}
    if(b.operation==='publish'){const second=Number(b.payload?.second);payload={url:normalizeVideo(String(b.payload?.url||''),second),second}}
    if(!['approve','reject','refund','refund_manual','publish','notify','edit','archive'].includes(b.operation))throw Error('Ação inválida.');
    if(b.operation==='refund'||b.operation==='refund_manual'){
     const current=(await db('hm_orders?id=eq.'+encodeURIComponent(b.id)+'&select=id,code,price_cents,review,payment,mercado_pago_payment_id&limit=1'))[0];if(!current)throw Error('Pedido não encontrado.');
     if(current.review!=='rejected'||current.payment!=='confirmed')throw Error('O pedido não tem uma devolução pendente.');
     const events=await db('hm_audit?order_id=eq.'+encodeURIComponent(b.id)+'&select=detail&order=created_at.desc&limit=50'),paymentEvent=events.find(e=>e.detail?.source==='mercado_pago'&&e.detail?.payment_id),paymentId=String(current.mercado_pago_payment_id||paymentEvent?.detail?.payment_id||'');
     if(b.operation==='refund'){
      if(!paymentId)throw Error('Este pagamento antigo não tem identificador do Mercado Pago. Faça a devolução no painel e use “Registrar devolução manual”.');
      await refundApprovedPayment({accessToken:String(env?.get('MP_ACCESS_TOKEN')||'').trim(),paymentId,externalReference:paymentReference('order',current.code),priceCents:Number(current.price_cents),fetcher});
     }else{
      if(b.payload?.confirmed!==true)throw Error('Confirme que a devolução integral já foi realizada no Mercado Pago.');
      if(paymentId)throw Error('Este pagamento permite devolução automática; use “Devolver pelo Mercado Pago”.');
     }
    }
    const actorAction=b.operation==='notify'?'notify-start':b.operation==='refund_manual'?'refund':b.operation;
    let order=await db('rpc/hm_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:actorAction,p_payload:payload});
    if(b.operation==='publish'||b.operation==='notify'){
     if(b.operation==='publish'&&order.notification!=='pending')return reply({order});
     if(b.operation==='publish')order=await db('rpc/hm_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:'notify-start',p_payload:{}});
     try{
      const config=waConfig();if(!config)throw Error('A configuração protegida da API do WhatsApp está incompleta.');
      const payload=whatsappTemplatePayload(order,config.template,config.language);
      const response=await fetcher(`https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.sender)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.access}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      let result={};try{result=await response.json()}catch{}
      if(!response.ok)throw Error(result.error?.message||'A API do WhatsApp recusou o envio.');
      order=await db('rpc/hm_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:'notify-sent',p_payload:{messageId:result.messages?.[0]?.id||''}});
     }catch(error){
      try{order=await db('rpc/hm_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:'notify-failed',p_payload:{reason:String(error.message||'provider_error').slice(0,300)}})}catch{}
      return reply({order,notificationError:String(error.message||'Não foi possível enviar o aviso pelo WhatsApp.')},200)
     }
    }
    return reply({order})
   }
   return reply({error:'Ação inválida.'},400);
  }
  if(action==='series.episode'){const rows=await db('hm_settings?id=eq.1&select=featured_episode_title,featured_episode_url,featured_episode_updated_at&limit=1'),s=rows[0],updated=Date.parse(s?.featured_episode_updated_at||0),active=Number.isFinite(updated)&&Date.now()-updated<=72*60*60*1000;return reply({episode:active&&s?.featured_episode_title&&s?.featured_episode_url?{title:s.featured_episode_title,url:s.featured_episode_url,updatedAt:s.featured_episode_updated_at}:null})}
  if(action==='catalog'){
   const settings=await db('hm_settings?id=eq.1&select=prices,community_price_cents,live_price_cents,community_enabled,live_enabled,video_enabled,community_duration_hours,founder_notice,founder_notice_active,episode,capacity_per_slot,version,demo_mode,pix_key,payment_url,payee_name,payee_city,bank_name,publication_deadline,display_duration_seconds');const s=settings[0],paymentsEnabled=Boolean(s&&!s.demo_mode&&s.video_enabled!==false&&s.pix_key&&s.payee_name&&s.payee_city&&s.publication_deadline&&new Date(s.publication_deadline)>new Date()&&s.display_duration_seconds);return reply({settings:s,whatsappNoticeEnabled:Boolean(waConfig()),remindersEnabled:false,pushEnabled:(await publicPushConfig(db)).enabled,availability:[1,2].map(slot=>({slot,available:null,unlimited:true})),paymentsEnabled})
  }
  if(action==='programming'){const cfg=(await db('hm_programming?id=eq.1&select=topic,next_live_title,next_live_at,next_live_url,live_accepting,updated_at'))[0];return reply({programming:cfg?{...cfg,next_live_at:Date.parse(cfg.next_live_at)>Date.now()?cfg.next_live_at:null,available:null,unlimited:true}:null})}
  if(action==='reality_sponsor.catalog'){
   const catalogIp=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
   if(!await db('rpc/hm_rate_limit','POST',{p_bucket:`reality-sponsor-catalog:${await sha(catalogIp)}:${Math.floor(Date.now()/60000)}`,p_max:60}))return reply({error:'Muitas consultas. Aguarde um minuto.'},429);
   await db('rpc/hm_reality_sponsor_expire_due','POST',{});
   const now=encodeURIComponent(new Date().toISOString());
   const[settings,slots,active]=await Promise.all([
    db('hm_reality_sponsor_settings?id=eq.1&select=price_cents,capacity,duration_days,enabled'),
    db('hm_reality_sponsor_slots?select=slot_no,active_sponsor_id,reserved_order_id,reserved_until'),
    readAll(db,'hm_reality_sponsors?status=eq.active&expires_at=gt.'+now+'&select=id,sponsor_type,display_name,username,segment,logo_url,expires_at,slot_no&order=slot_no.asc&limit=50')
   ]);
   const held=slots.filter(x=>x.active_sponsor_id||(x.reserved_order_id&&Date.parse(x.reserved_until)>Date.now())).length;
   return reply({settings:settings[0]||{price_cents:3990,capacity:50,duration_days:7,enabled:false},available:Math.max(0,50-held),active:active.map(s=>({type:s.sponsor_type,name:s.display_name,username:s.username,segment:s.segment,logo_url:s.logo_url,expires_at:s.expires_at,slot_no:s.slot_no}))});
  }
  if(['reality_sponsor.create','reality_sponsor.lookup','reality_sponsor.renew','reality_sponsor.optout','reality_sponsor.pix','reality_sponsor.refresh'].includes(action)){
   const realityIp=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
   const realityMax=['reality_sponsor.create','reality_sponsor.renew'].includes(action)?5:30;
   if(!await db('rpc/hm_rate_limit','POST',{p_bucket:`reality-sponsor:${action}:${await sha(realityIp)}:${Math.floor(Date.now()/60000)}`,p_max:realityMax}))return reply({error:'Muitas tentativas. Aguarde um minuto.'},429);
   if(action==='reality_sponsor.create'){
    const type=String(b.type||''),name=String(b.name||'').trim(),username=String(b.username||'').trim().replace(/^@+/,'').toLowerCase(),segment=String(b.segment||'').trim(),email=String(b.email||'').trim(),phone='',token=String(b.trackingToken||''),deviceToken=validateDeviceToken(b.deviceToken||'');
    if(!['person','company'].includes(type)||name.length<2||name.length>80||!/^[A-Za-z0-9._]{3,24}$/.test(username)||segment.length<2||segment.length>60||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Confira nome, @, segmento e e-mail.');
    if(b.terms!==true||b.termsVersion!=='2026-11-11.reality-sponsor.v1'||!/^[a-f0-9]{64}$/.test(token))throw Error('Aceite os termos de Patrocinador Oficial para continuar.');
    if(/(?:https?:\\x2f\\x2f|www\\.|wa\\.me|t\\.me|instagram\\.com|tiktok\\.com)/i.test(name+' '+segment))throw Error('Não informe links, sites, telefones ou destinos externos nos campos públicos.');
    const sponsorModeration=moderateCommunityMessage(name+' '+username+' '+segment);if(!sponsorModeration.approved&&!sponsorModeration.requiresReview)return reply({error:'Os dados públicos contêm conteúdo que não pode ser exibido. Revise o nome e o segmento.'},422);
    const deviceHash=await sha(deviceToken),device=(await db('hm_push_devices?device_hash=eq.'+deviceHash+'&enabled=eq.true&select=device_hash&limit=1'))[0];
    if(!device)return reply({error:'Ative as notificações do HOCCO neste aparelho para receber o aviso de renovação 24 horas antes do fim do período.'},409);
    const cfg=(await db('hm_reality_sponsor_settings?id=eq.1&select=price_cents,enabled'))[0];if(!cfg?.enabled)return reply({error:'As vagas estão temporariamente fechadas.'},403);
    const hash=await sha(token),existing=(await db('hm_reality_sponsor_orders?tracking_hash=eq.'+hash+'&select=code&limit=1'))[0];
    if(existing)return reply({code:existing.code,trackingToken:token},200);
    let logoUrl=null;
    if(type==='company'){
     const mime=String(b.logoMime||''),encoded=String(b.logoBase64||''),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime];
     if(!ext||encoded.length<12||encoded.length>1400000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Anexe o logo da empresa em PNG, JPG ou WebP, com até 1 MB.');
     const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length>1048576)throw Error('O logo deve ter até 1 MB.');
     const validImage=mime==='image/png'&&bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||mime==='image/jpeg'&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||mime==='image/webp'&&bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
     if(!validImage)throw Error('O arquivo enviado não é uma imagem válida.');
     const code='HC-RS-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),path='reality-sponsors/'+code.toLowerCase()+'.'+ext;
     const uploaded=await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'POST',headers:{...headers,'x-upsert':'false','Content-Type':mime,'cache-control':'3600'},body:bytes});
     if(!uploaded.ok)throw Error('Não foi possível armazenar o logo. Tente novamente.');
     logoUrl=url+'/storage/v1/object/public/hocco-sponsor-logos/'+path;
     let result;
     try{result=await db('rpc/hm_reality_sponsor_create','POST',{p_code:code,p_tracking_hash:hash,p_type:type,p_name:name,p_username:username,p_segment:segment,p_email:email,p_phone:phone,p_logo_url:logoUrl,p_device_hash:deviceHash,p_price_cents:Number(cfg.price_cents),p_consent:{terms_version:b.termsVersion,accepted_at:new Date().toISOString()}})}
     catch(error){try{await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'DELETE',headers})}catch{}throw error}
     return reply({code,trackingToken:token,slot:result.slot_no,reservedUntil:result.reserved_until,priceCents:Number(cfg.price_cents)},201);
    }
    const code='HC-RS-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
    const result=await db('rpc/hm_reality_sponsor_create','POST',{p_code:code,p_tracking_hash:hash,p_type:type,p_name:name,p_username:username,p_segment:segment,p_email:email,p_phone:phone,p_logo_url:null,p_device_hash:deviceHash,p_price_cents:Number(cfg.price_cents),p_consent:{terms_version:b.termsVersion,accepted_at:new Date().toISOString()}});
    return reply({code,trackingToken:token,slot:result.slot_no,reservedUntil:result.reserved_until,priceCents:Number(cfg.price_cents)},201);
   }
   if(action==='reality_sponsor.lookup'||action==='reality_sponsor.pix'||action==='reality_sponsor.refresh'){
    const code=String(b.code||''),token=String(b.trackingToken||'');if(!/^HC-RS-[A-F0-9]{12}$/.test(code)||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Link privado de acompanhamento inválido.'},404);
    const hash=await sha(token),order=(await db('hm_reality_sponsor_orders?code=eq.'+code+'&tracking_hash=eq.'+hash+'&select=*&limit=1'))[0];if(!order)return reply({error:'Pedido de patrocínio não encontrado.'},404);
    const sponsor=(await db('hm_reality_sponsors?id=eq.'+order.sponsor_id+'&select=id,sponsor_type,display_name,username,segment,logo_url,status,slot_no,starts_at,expires_at,renewal_opt_out,email&limit=1'))[0];if(!sponsor)return reply({error:'Cadastro de patrocinador não encontrado.'},404);
    if(action==='reality_sponsor.lookup')return reply({order:{code:order.code,status:order.status,purpose:order.purpose,price_cents:order.price_cents,reserved_until:order.reserved_until,needs_attention:order.needs_attention},sponsor:{id:sponsor.id,type:sponsor.sponsor_type,name:sponsor.display_name,username:sponsor.username,segment:sponsor.segment,logo_url:sponsor.logo_url,status:sponsor.status,slot_no:sponsor.slot_no,starts_at:sponsor.starts_at,expires_at:sponsor.expires_at,renewal_opt_out:sponsor.renewal_opt_out}});
    if(action==='reality_sponsor.pix'){
     if(order.status!=='pending'||Date.parse(order.reserved_until)<=Date.now())return reply({error:'A reserva de 10 minutos terminou. Consulte as vagas e inicie uma nova inscrição ou renovação.'},409);
     const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)return reply({error:'Pix Mercado Pago temporariamente indisponível.'},503);
     const pix=await createRealitySponsorPix({accessToken,code,priceCents:Number(order.price_cents),email:sponsor.email,notificationUrl:'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment',fetcher});return reply({pix});
    }
    const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)return reply({error:'Consulta de pagamento temporariamente indisponível.'},503);
    const found=await fetcher('https://api.mercadopago.com/v1/payments/search?external_reference='+encodeURIComponent(paymentReference('reality_sponsor',code))+'&sort=date_created&criteria=desc&limit=10',{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(12000)});
    if(!found.ok)return reply({error:'Não foi possível consultar o pagamento agora.'},502);
    const data=await found.json();for(const payment of data.results||[])if(['approved','refunded','charged_back','in_mediation'].includes(payment.status))await applyPayment(payment,'reality_sponsor',order);
    return reply({ok:true});
   }
   if(action==='reality_sponsor.renew'){
    const sponsorId=String(b.sponsorId||''),token=String(b.trackingToken||'');if(!/^[0-9a-f-]{36}$/i.test(sponsorId)||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Identificação privada inválida.'},404);
    const hash=await sha(token),initial=(await db('hm_reality_sponsor_orders?sponsor_id=eq.'+sponsorId+'&tracking_hash=eq.'+hash+'&purpose=eq.initial&status=eq.confirmed&select=id&limit=1'))[0];if(!initial)return reply({error:'Patrocínio não encontrado para renovação.'},404);
    const cfg=(await db('hm_reality_sponsor_settings?id=eq.1&select=price_cents,enabled'))[0];if(!cfg?.enabled)return reply({error:'Renovações temporariamente indisponíveis.'},403);
    const code='HC-RS-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),renewToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''),renewHash=await sha(renewToken);
    try{const result=await db('rpc/hm_reality_sponsor_renew','POST',{p_sponsor_id:sponsorId,p_tracking_hash:hash,p_code:code,p_new_tracking_hash:renewHash,p_price_cents:Number(cfg.price_cents)});return reply({code,trackingToken:renewToken,slot:result.slot_no,reservedUntil:result.reserved_until,priceCents:Number(cfg.price_cents)},201)}catch(error){return reply({error:String(error.message||'Não foi possível reservar a vaga.')},409)}
   }
   if(action==='reality_sponsor.optout'){
    const sponsorId=String(b.sponsorId||''),token=String(b.trackingToken||'');if(!/^[0-9a-f-]{36}$/i.test(sponsorId)||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Identificação privada inválida.'},404);
    const hash=await sha(token),initial=(await db('hm_reality_sponsor_orders?sponsor_id=eq.'+sponsorId+'&tracking_hash=eq.'+hash+'&purpose=eq.initial&status=eq.confirmed&select=id&limit=1'))[0];if(!initial)return reply({error:'Patrocínio não encontrado.'},404);
    const ok=await db('rpc/hm_reality_sponsor_optout','POST',{p_sponsor_id:sponsorId,p_tracking_hash:hash});return reply({ok:Boolean(ok)});
   }
  }
  if(action==='sponsor.catalog'){const[config,rows,pix]=await Promise.all([db('hm_sponsor_settings?id=eq.1&select=price_cents,enabled'),readAll(db,'hm_sponsors?archived_at=is.null&select=id,company_name,category,city,state_code,offer_conditions,offer_expires_on,company_description,logo_url,cover_url,destination_url,community_offer,expires_at,starts_at,renewal_of,review,payment,payment_hold,created_at&order=created_at.asc'),db('hm_settings?id=eq.1&select=pix_key,payee_name,payee_city,bank_name')]);const now=Date.now(),active=rows.filter(s=>s.review==='approved'&&s.payment==='confirmed'&&!s.payment_hold&&Date.parse(s.starts_at||0)<=now&&Date.parse(s.expires_at)>now);return reply({cities:await db('hm_city_markets?status=eq.open&select=city,state_code&order=city.asc&limit=1000'),settings:config[0]||{price_cents:6990,enabled:true},active:active.map(s=>({id:s.id,company_name:s.company_name,category:s.category||'Outros',city:s.city||'',state_code:s.state_code||'',offer_conditions:s.offer_conditions||'',offer_expires_on:s.offer_expires_on,company_description:s.company_description||'',logo_url:s.logo_url,cover_url:s.cover_url,destination_url:s.destination_url,community_offer:s.community_offer||'',expires_at:s.expires_at})),pix:pix[0]||{}})}
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
  const bucket=`${action}:${await sha(ip)}:${Math.floor(Date.now()/60000)}`;const limit=await db('rpc/hm_rate_limit','POST',{p_bucket:bucket,p_max:action==='community.like'?120:['create','sponsor.create','reality_sponsor.create','reality_sponsor.renew','community.create','push.subscribe'].includes(action)?5:60});if(!limit)return reply({error:'Muitas tentativas. Aguarde um minuto.'},429);
  if(action==='push.config')return reply(await publicPushConfig(db));
  if(['push.subscribe','push.activity','push.disable','push.inbox','push.read'].includes(action)){
   const deviceHash=await sha(validateDeviceToken(b.deviceToken));
   if(action==='push.subscribe'){
    if(b.consent!==true||b.noticeVersion!=='2026-11-03.push.v1')throw Error('Confirme a ativação das notificações deste app.');
    const subscription=validatePushSubscription(b.subscription),config=await publicPushConfig(db);
    if(!config.enabled||b.version!==config.version)return reply({error:'Atualize o app e tente ativar as notificações novamente.'},409);
    await db('rpc/hm_push_register','POST',{p_hash:deviceHash,p_subscription:subscription,p_version:config.version});return reply({ok:true});
   }
   if(action==='push.activity'||action==='push.disable'){
    const notification=b.notificationId&&/^[a-f0-9-]{36}$/i.test(b.notificationId)?b.notificationId:null;
    await db('rpc/hm_push_activity','POST',{p_hash:deviceHash,p_composing:b.composing===true,p_disable:action==='push.disable',p_notification:notification});return reply({ok:true});
   }
   if(action==='push.read'){if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Notificação inválida.');await db('rpc/hm_push_read','POST',{p_hash:deviceHash,p_id:b.id});return reply({ok:true})}
   const devices=await db('hm_push_devices?device_hash=eq.'+deviceHash+'&select=enabled,failure_count&limit=1'),items=devices.length?await db('hm_push_inbox?device_hash=eq.'+deviceHash+'&select=id,title,body,url,created_at,read_at&order=created_at.desc&limit=50'):[];
   return reply({enabled:Boolean(devices[0]?.enabled),paused:(devices[0]?.failure_count||0)>=3,items});
  }
  if(action==='customer.activity'){
   if(!Array.isArray(b.tokens)||b.tokens.length>100||b.tokens.some(t=>!(/^[a-f0-9]{64}$/).test(t)))throw Error('Identificadores de atividade inválidos.');
   await db('rpc/hm_reactivation_activity','POST',{p_hashes:await Promise.all(b.tokens.map(sha)),p_disable:b.disable===true});return reply({ok:true});
  }
  if(action==='customer.sync'){
   if(!Array.isArray(b.items)||b.items.length>100)throw Error('Consulta de histórico inválida.');
   const items=await Promise.all(b.items.map(async item=>{if(!['order','community'].includes(item.kind)||!(/^[a-f0-9]{64}$/).test(item.trackingToken||'')||!(item.kind==='order'?/^HM-26-[A-F0-9]{12}$/:/^HC-CM-[A-F0-9]{12}$/).test(item.code||''))throw Error('Link privado inválido.');return{kind:item.kind,code:item.code,hash:await sha(item.trackingToken)}}));
   const entries=[];
   for(const kind of ['order','community']){const group=items.filter(item=>item.kind===kind);if(!group.length)continue;const codes=[...new Set(group.map(item=>item.code))].join(','),table=kind==='order'?'hm_orders':'hm_community_messages',rows=await db(table+'?code=in.('+codes+')&select=*'),expired=await db('hm_expired_purchases?kind=eq.'+kind+'&code=in.('+codes+')&select=code,tracking_hash');
    for(const item of group){const row=rows.find(row=>row.code===item.code&&row.tracking_hash===item.hash),gone=expired.some(row=>row.code===item.code&&row.tracking_hash===item.hash);entries.push(row?{kind,code:item.code,record:kind==='order'?safe(row):safeCommunityMessage(row)}:gone?{kind,code:item.code,expired:true}:{kind,code:item.code,unavailable:true});}
   }
   return reply({entries});
  }
  if(['payment.checkout','payment.refresh','payment.pix'].includes(action)){
   if(action==='payment.pix'&&b.kind!=='sponsor')return reply({error:'Pix direto disponível para patrocínios.'},400);
   const kind=String(b.kind||''),code=String(b.code||''),token=String(b.trackingToken||'');if(!['order','community','sponsor'].includes(kind)||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Link privado de pagamento inválido.'},404);
   const validCode=kind==='order'?/^HM-26-[A-F0-9]{12}$/.test(code):kind==='community'?/^HC-CM-[A-F0-9]{12}$/.test(code):/^HC-SP-[A-F0-9]{12}$/.test(code);if(!validCode)return reply({error:'Referência de pagamento inválida.'},404);
   const hash=await sha(token);let row;if(kind==='order')row=(await db(`hm_orders?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];if(kind==='community')row=(await db(`hm_community_messages?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];if(kind==='sponsor')row=(await db(`hm_sponsors?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];
   if(!row&&kind!=='sponsor')row=await expiredPurchase(kind,code,hash);
   if(!row)return reply({error:'Pedido não encontrado.'},404);
   if(['payment.checkout','payment.pix'].includes(action)){const blocked=checkoutBlock(row,kind);if(blocked)return reply({...blocked,expired:blocked.status===410},blocked.status)}
   if(action==='payment.refresh'){
    const permitted=await db('rpc/hm_rate_limit','POST',{p_bucket:`payment-reconcile:${kind}:${row.id}:${Math.floor(Date.now()/30000)}`,p_max:1});
    if(!permitted)return reply({ok:true,deferred:true});
    const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)return reply({ok:false},503);
    const response=await fetcher('https://api.mercadopago.com/v1/payments/search?external_reference='+encodeURIComponent(paymentReference(kind,code))+'&sort=date_created&criteria=desc&limit=10',{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(12000)});
    if(!response.ok)return reply({error:'Confirmação temporariamente indisponível. Seu pedido está salvo.'},502);
    const found=await response.json();for(const payment of found.results||[])if(['approved','refunded','charged_back','in_mediation'].includes(payment.status))await applyPayment(payment,kind,row);
    return reply({ok:true});
   }
   if(row.payment_hold)return reply({error:'Este pedido está em revisão financeira. Consulte o acompanhamento.'},409);

if(kind==='sponsor'&&row.payment==='pending'&&Date.parse(row.created_at||0)<Date.now()-48*3600000)return reply({error:'A reserva deste pedido expirou. Faça um novo cadastro para conferir preço e disponibilidade.'},409);if(row.payment!=='pending'||row.review==='rejected')return reply({error:'Este pedido não está aguardando pagamento.'},409);if(['community','sponsor'].includes(kind)&&row.review!=='approved')return reply({error:'A mensagem precisa passar pela verificação adicional antes do pagamento.'},409);
   const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)return reply({error:'Checkout Mercado Pago ainda não configurado.'},503);
   if(action==='payment.pix'){const pix=await createSponsorPix({accessToken,code,priceCents:Number(row.price_cents),email:row.email,cnpj:row.cnpj,createdAt:row.created_at,notificationUrl:'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment',fetcher});return reply({pix})}
   const allowedOrigin=origin&&origins.has(origin)?origin:PUBLIC_ORIGIN,returnPath=kind==='order'?`/cliente/#acompanhar/${encodeURIComponent(code)}/${encodeURIComponent(token)}`:kind==='community'?`/#comunidade-pagamento/${encodeURIComponent(code)}/${encodeURIComponent(token)}`:`/ir-alem/#pedido/${encodeURIComponent(code)}/${encodeURIComponent(token)}`;
   const result=await createPreference({accessToken,externalReference:paymentReference(kind,code),title:kind==='order'?'Mensagem no vídeo oficial HOCCO':kind==='community'?(row.destination==='live'?'Mensagem para a LIVE HOCCO':'Mensagem na Comunidade HOCCO'):'Patrocínio HOCCO',priceCents:Number(row.price_cents),expiresAt:paymentExpiresAt(row,kind),validFrom:row.created_at,origin:allowedOrigin,returnPath,notificationUrl:'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment',payerEmail:kind==='sponsor'?row.email:undefined,environment:env?.get('MP_ENVIRONMENT')||env?.get('MP_Environment')||'production',fetcher});
   return reply({checkoutUrl:result.checkoutUrl,preferenceId:result.preferenceId,externalReference:result.externalReference});
  }
  if(action==='sponsor.event'){if(!/^[a-f0-9-]{36}$/i.test(b.id||'')||!['profile','click'].includes(b.event))throw Error('Evento inválido.');await db('rpc/hm_count_sponsor_event','POST',{p_id:b.id,p_event:b.event});return reply({ok:true},202)}
  if(action==='community.feed'){
   const now=encodeURIComponent(new Date().toISOString()),rows=await readAll(db,`hm_community_messages?destination=eq.community&content_removed_at=is.null&review=eq.approved&payment=eq.confirmed&payment_hold=eq.false&hidden_at=is.null&published_at=not.is.null&expires_at=gt.${now}&select=id,member_name,member_username,avatar_index,message,published_at,expires_at,likes_count&order=published_at.desc&limit=100`);
   return reply({messages:rows})
  }
  if(action==='community.like'){
   const input=validateCommunityLikeInput(b),voterHash=await sha(input.voterToken),result=await db('rpc/hm_community_set_like','POST',{p_message_id:input.messageId,p_voter_hash:voterHash,p_liked:input.liked});
   return reply({likesCount:Number(result?.likesCount)||0,liked:Boolean(result?.liked)})
  }
  if(action==='community.live_feed'){
   const rows=await readAll(db,'hm_community_messages?content_removed_at=is.null&destination=eq.live&live_status=eq.queued&review=eq.approved&payment=eq.confirmed&payment_hold=eq.false&hidden_at=is.null&select=id,member_name,member_username,avatar_index,message,live_scheduled_at,live_title,created_at&order=created_at.asc&limit=50');
   return reply({messages:rows})
  }
  if(action==='community.create'){
   if(b.terms!==true||b.legalVersion!==LEGAL_VERSION)return reply({error:'Atualize o app e confirme os termos e a autorização da mensagem.'},409);
   if(b.pushDeviceToken)validateDeviceToken(b.pushDeviceToken);
   const identity=validateSenderIdentity(b,req.headers),v=validateCommunityInput({...b,socialUrl:undefined}),moderation=moderateCommunityMessage(v.message);
   const controls=(await db('hm_settings?id=eq.1&select=community_enabled,live_enabled'))[0];if(!controls)throw Error('Os controles da Comunidade estão indisponíveis.');if(v.destination==='community'&&controls.community_enabled===false)return reply({error:'O envio para a Comunidade está temporariamente pausado.'},503);if(v.destination==='live'&&controls.live_enabled===false)return reply({error:'O envio para a LIVE está temporariamente pausado.'},503);
   if(!moderation.approved&&!moderation.requiresReview)return reply({error:'Esta mensagem pode não seguir as regras da Comunidade. Revise o texto e os termos antes de tentar novamente.'},422);
   if(v.destination==='live'&&b.liveScheduledAt){const cfg=(await db('hm_programming?id=eq.1&select=next_live_at'))[0];if(!cfg?.next_live_at||Date.parse(cfg.next_live_at)!==Date.parse(b.liveScheduledAt))return reply({error:'A programação da LIVE mudou. Abra novamente o envio para conferir a data.'},409)}
   const trackingHash=await sha(b.trackingToken),code='HC-CM-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
   const post=await db('rpc/hm_create_identified_message','POST',{p_kind:'community',p_identity:identity,p_data:{code,tracking_hash:trackingHash,name:v.name,username:v.username,avatar:v.avatar,message:v.message,destination:v.destination,requires_review:moderation.requiresReview,expected_price:b.expectedPrice,legal_version:b.legalVersion,terms:b.terms,live_scheduled_at:b.liveScheduledAt||null,social_url:v.socialUrl}});
   if(b.pushDeviceToken)await db('rpc/hm_push_bind_purchase','POST',{p_hash:await sha(validateDeviceToken(b.pushDeviceToken)),p_kind:'community',p_code:post.code});
   return reply({post:safeCommunityMessage(post),trackingToken:b.trackingToken,needsReview:moderation.requiresReview},201)
  }
  if(['community.lookup','community.payment_claim'].includes(action)){
   if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HC-CM-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link privado da mensagem inválido.'},404);
   const trackingHash=await sha(b.trackingToken),rows=await db(`hm_community_messages?code=eq.${encodeURIComponent(b.code)}&tracking_hash=eq.${trackingHash}&select=*&limit=1`);let post=rows[0];
   if(!post){if(await expiredPurchase('community',b.code,trackingHash))return expiredReply();return reply({error:'Mensagem não encontrada ou link privado incorreto.'},404)}
   if(isUnpaidCommentExpired(post,'community')){await db('rpc/hm_expire_unpaid_comments','POST',{});return expiredReply()}
   if(action==='community.payment_claim'){
    if(post.payment!=='pending'||post.review==='rejected')throw Error('Esta mensagem não está aguardando pagamento.');
    if(!post.payment_claimed)post=await db('rpc/hm_community_payment_claim','POST',{p_id:post.id,p_tracking_hash:trackingHash});
   }
   const history=await db(`hm_community_audit?post_id=eq.${encodeURIComponent(post.id)}&select=action,detail,created_at&order=created_at.asc`);
   const pix=(await db('hm_settings?id=eq.1&select=pix_key,payee_name,payee_city,bank_name'))[0]||{};
   return reply({post:safeCommunityMessage(post),history,pix})
  }
  if(action==='sponsor.create'){
   if(/^[a-f0-9]{64}$/.test(b.trackingToken||'')){const previous=(await db('hm_sponsors?tracking_hash=eq.'+await sha(b.trackingToken)+'&select=*&limit=1'))[0];if(previous)return reply({sponsor:safeSponsor(previous),trackingToken:b.trackingToken},200)}
   const sponsorConfig=(await db('hm_sponsor_settings?id=eq.1&select=enabled,price_cents'))[0];if(!sponsorConfig?.enabled)return reply({error:'As inscrições de patrocinadores estão temporariamente fechadas.'},403);
   if(b.expectedPrice!==undefined&&Number(b.expectedPrice)!==Number(sponsorConfig.price_cents))return reply({error:'O preço do patrocínio mudou. Atualize a página para conferir o valor antes de continuar.'},409);
   const location=validateLocation(b);
   const companyName=String(b.companyName||'').trim(),legalName=String(b.legalName||'').trim(),cnpj=normalizeCnpj(b.cnpj),category=String(b.category||''),companyDescription=String(b.companyDescription||'').trim(),contactName=String(b.contactName||'').trim(),email=String(b.email||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),token=b.trackingToken;
   const sponsorTextModeration=moderateCommunityMessage([companyName,legalName,companyDescription,String(b.communityOffer||'')].filter(Boolean).join(' '));if(!sponsorTextModeration.approved&&!sponsorTextModeration.requiresReview)return reply({error:'Os dados enviados contêm conteúdo que não pode ser publicado. Revise as regras para patrocinadores.'},422);
   if(!validCnpj(cnpj)||legalName.length<2||legalName.length>160)throw Error('Informe um CNPJ válido e a razão social da empresa.');
   if(!SPONSOR_CATEGORIES.includes(category))throw Error('Escolha uma categoria válida para a empresa.');
   if(companyName.length<2||companyName.length>80||companyDescription.length<20||companyDescription.length>600||contactName.length<1||contactName.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Confira o nome, descrição da empresa (20 a 600 caracteres), contato e e-mail.');
   if((b.thankYouOptIn||b.expiryNoticeOptIn)&&!/^((55)?[1-9][0-9]{9,10})$/.test(phone))throw Error('Informe um WhatsApp válido para receber os avisos escolhidos.');
   if(b.terms!==true||b.publication!==true||b.sponsorTermsVersion!==SPONSOR_TERMS_VERSION||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Aceite as regras para patrocinadores e a autorização de exibição para continuar.');
   const socialPlatform=String(b.socialPlatform||'').toLowerCase(),socialHandle=String(b.socialHandle||'').trim().replace(/^@/,'');
   if(!['instagram','tiktok'].includes(socialPlatform)||!((socialPlatform==='instagram'&&/^[A-Za-z0-9._]{1,30}$/.test(socialHandle)&&!socialHandle.endsWith('.'))||(socialPlatform==='tiktok'&&/^[A-Za-z0-9._]{2,24}$/.test(socialHandle))))throw Error('Informe apenas um @ válido do Instagram ou TikTok, usando letras latinas, números, ponto ou sublinhado.');
   const destination=socialPlatform==='instagram'?'https://www.instagram.com/'+socialHandle+'/':'https://www.tiktok.com/@'+socialHandle;let communityOffer=String(b.communityOffer||'').trim();if(communityOffer.length>240)throw Error('A oferta para a comunidade deve ter até 240 caracteres.');if(b.offerEnabled===true&&communityOffer.length<5)throw Error('Descreva a oferta ou desconto que será analisado pela curadoria.');if(b.offerEnabled!==true)communityOffer='';
   const hash=await sha(token);
   const existingSponsor=async()=> (await db('hm_sponsors?tracking_hash=eq.'+hash+'&select=*&limit=1'))[0];
   const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};const parseImage=async(kind)=>{const mime=String(b[kind+'Mime']||''),encoded=String(b[kind+'Base64']||'');if(!extensions[mime]||encoded.length<12||encoded.length>1450000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Anexe logo e capa em PNG, JPG ou WebP, com até 1 MB cada.');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length>1048576)throw Error('Cada imagem deve ter até 1 MB.');const png=bytes.length>=67&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!(mime==='image/png'&&png||mime==='image/jpeg'&&jpeg||mime==='image/webp'&&webp))throw Error('O conteúdo do arquivo não corresponde a uma imagem válida.');return{mime,bytes,ext:extensions[mime]}};const logoFile=await parseImage('logo'),coverFile=await parseImage('cover');
   const code='HC-SP-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),renewal=/^[a-f0-9-]{36}$/i.test(b.renewalOf||'')?b.renewalOf:null;
   // A competing request never writes or deletes another attempt's assets.
   const attempt=crypto.randomUUID(),logoPath='sponsors/'+hash.slice(0,32)+'-'+attempt+'-logo.'+logoFile.ext,coverPath='sponsors/'+hash.slice(0,32)+'-'+attempt+'-cover.'+coverFile.ext,storageHeaders={...headers,'x-upsert':'false','cache-control':'3600'};
   const uploadedPaths=[];
   const cleanUnlinked=async()=>{for(const path of uploadedPaths){try{const asset=url+'/storage/v1/object/public/hocco-sponsor-logos/'+path;
    const refs=await db('hm_sponsors?or=(logo_url.eq.'+encodeURIComponent(asset)+',cover_url.eq.'+encodeURIComponent(asset)+')&select=id&limit=1');
    if(!refs.length)await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'DELETE',headers});
   }catch{/* Uncertain ownership must preserve the file. */}}};
   try{
    for(const[file,path,kind]of[[logoFile,logoPath,'logo'],[coverFile,coverPath,'capa']]){const uploaded=await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'POST',headers:{...storageHeaders,'Content-Type':file.mime},body:file.bytes});if(!uploaded.ok)throw Error('Não foi possível guardar o '+kind+'. Tente novamente.');uploadedPaths.push(path)}
    const logo=url+'/storage/v1/object/public/hocco-sponsor-logos/'+logoPath,cover=url+'/storage/v1/object/public/hocco-sponsor-logos/'+coverPath;
    const sponsor=await db('rpc/hm_create_sponsor_local','POST',{p_data:{...location,expected_price:b.expectedPrice,p_code:code,p_tracking_hash:hash,p_company_name:companyName,p_cnpj:cnpj,p_legal_name:legalName,p_category:category,p_company_description:companyDescription,p_contact_name:contactName,p_email:email,p_phone:(b.thankYouOptIn===true||b.expiryNoticeOptIn===true)?phone:'',p_logo_url:logo,p_cover_url:cover,p_destination_url:destination,p_community_offer:communityOffer,p_sponsor_terms_version:SPONSOR_TERMS_VERSION,p_thank_you_opt_in:b.thankYouOptIn===true,p_expiry_notice_opt_in:b.expiryNoticeOptIn===true,p_renewal_of:renewal}});
    if(sponsor.logo_url!==logo||sponsor.cover_url!==cover)await cleanUnlinked();
    return reply({sponsor:safeSponsor(sponsor),trackingToken:token},201);
   }catch(error){
    // A lost RPC response may already have committed. Recover before cleaning.
    try{const recovered=await existingSponsor();if(recovered){await cleanUnlinked();return reply({sponsor:safeSponsor(recovered),trackingToken:token},200)}}catch{throw error}
    await cleanUnlinked();throw error;
   }
  }
  if(['sponsor.lookup','sponsor.payment_claim'].includes(action)){
   if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HC-SP-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link privado de acompanhamento inválido.'},404);
   const hash=await sha(b.trackingToken),rows=await db('hm_sponsors?code=eq.'+encodeURIComponent(b.code)+'&tracking_hash=eq.'+hash+'&select=*&limit=1');let s=rows[0];if(!s)return reply({error:'Patrocínio não encontrado ou link privado incorreto.'},404);
   if(action==='sponsor.payment_claim'){if(s.payment!=='pending'||s.review==='rejected')throw Error('Esta solicitação não está aguardando pagamento.');if(!s.payment_claimed){const updated=await db('hm_sponsors?id=eq.'+encodeURIComponent(s.id),'PATCH',{payment_claimed:true,updated_at:new Date().toISOString()});s=updated[0]||{...s,payment_claimed:true}}}
   return reply({sponsor:safeSponsor(s),contact:{email:s.email,phone:s.phone,contact_name:s.contact_name,cnpj:s.cnpj,legal_name:s.legal_name}})
  }
  if(action!=='create'&&!['lookup','payment_claim','reminder_optout'].includes(action))return reply({error:'Ação inválida.'},400);
  if(action==='create'){
   b.reminderOptIn=false;if(b.pushDeviceToken)validateDeviceToken(b.pushDeviceToken);
   const live=await db('hm_settings?id=eq.1&select=demo_mode,video_enabled,pix_key,payee_name,payee_city,publication_deadline,display_duration_seconds');const cfg=live[0];if(!cfg||cfg.demo_mode||cfg.video_enabled===false||!cfg.pix_key||!cfg.payee_name||!cfg.payee_city||!cfg.publication_deadline||new Date(cfg.publication_deadline)<=new Date()||!cfg.display_duration_seconds)return reply({error:'O envio de pedidos está temporariamente indisponível.'},503);
   const identity=validateSenderIdentity(b,req.headers),v=validateInput(b),messageModeration=moderateCommunityMessage(v.message);if(!messageModeration.approved&&!messageModeration.requiresReview)return reply({error:'A mensagem contém conteúdo que não pode ser publicado. Revise as regras da HOCCO e tente novamente.'},422);if(v.optIn&&!waConfig())return reply({error:'O canal de WhatsApp escolhido está temporariamente indisponível.'},503);const hash=await sha(b.trackingToken),code='HM-26-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
   const o=await db('rpc/hm_create_identified_message','POST',{p_kind:'order',p_identity:identity,p_data:{code,tracking_hash:hash,name:v.name,message:v.message,phone:v.phone?identity.phone:'',opt_in:v.optIn,reminder_opt_in:false,social_platform:v.platform,social_handle:v.handle,slot:b.slot,legal_version:b.legalVersion,expected_price:b.expectedPrice,settings_version:b.settingsVersion}});
   if(b.pushDeviceToken)await db('rpc/hm_push_bind_purchase','POST',{p_hash:await sha(validateDeviceToken(b.pushDeviceToken)),p_kind:'order',p_code:o.code});
   return reply({order:safe(o),trackingToken:b.trackingToken},201)
  }
  if(!['lookup','payment_claim','reminder_optout'].includes(action))return reply({error:'Ação inválida.'},400);
  if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HM-26-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link de acompanhamento inválido.'},404);
  const hash=await sha(b.trackingToken);const rows=await db(`hm_orders?code=eq.${b.code}&tracking_hash=eq.${hash}&select=*&limit=1`);const o=rows[0];if(!o){if(await expiredPurchase('order',b.code,hash))return expiredReply();return reply({error:'Pedido não encontrado ou link privado incorreto.'},404)}
  if(isUnpaidCommentExpired(o,'order')){await db('rpc/hm_expire_unpaid_comments','POST',{});return expiredReply()}
  if(action==='reminder_optout'){await db('rpc/hm_reactivation_activity','POST',{p_hashes:[hash],p_disable:true});const rows=await db(`hm_reminder_subscriptions?order_id=eq.${o.id}&enabled=eq.true&select=phone`);if(rows.length){await db(`hm_reminder_subscriptions?order_id=eq.${o.id}`,'PATCH',{enabled:false,next_send_at:null,unsubscribed_at:new Date().toISOString()});await db('hm_audit','POST',{order_id:o.id,action:'reminder_optout',detail:{source:'customer'}})}const history=await db(`hm_audit?order_id=eq.${o.id}&select=action,detail,created_at&order=created_at.asc`);return reply({ok:true,history})}
  const history=await db(`hm_audit?order_id=eq.${o.id}&select=action,detail,created_at&order=created_at.asc`);
  if(action==='payment_claim'){
   if(o.review==='rejected'||o.delivery==='published')throw Error('Este pedido não está aguardando pagamento.');
   // A payment claim never changes payment to confirmed.
   if(!o.payment_claimed){await db(`hm_orders?id=eq.${o.id}`,'PATCH',{payment_claimed:true,updated_at:new Date().toISOString()});await db('hm_audit','POST',{order_id:o.id,action:'payment-claimed',detail:{source:'customer'}});o.payment_claimed=true;}
  }
  return reply({order:{...safe(o),reminder_active:(await db(`hm_reminder_subscriptions?order_id=eq.${o.id}&enabled=eq.true&select=phone`)).length>0},history:history.filter(h=>['created','approve','reject','pay','refund','publish','payment-claimed','reminder_sent','reminder_optout'].includes(h.action))})
 }catch(error){return reply({error:error instanceof SyntaxError?'Solicitação inválida.':String(error.message||'Não foi possível concluir.')},error.status===413?413:400)}
}
if(typeof Deno!=='undefined')Deno.serve(req=>handler(req));
