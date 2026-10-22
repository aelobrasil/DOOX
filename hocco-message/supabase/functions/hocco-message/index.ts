import { createPreference, isApprovedPayment, paymentReference, verifyWebhookSignature } from "./mercado-pago.mjs";
import { moderateCommunityMessage } from "./moderation.mjs";
// No browser secrets. Service credentials are supplied only by the Edge runtime.
const PUBLIC_ORIGIN='https://hocco-message.vercel.app';
const LEGACY_PUBLIC_ORIGINS=['https://hocco.loyallion10.chatgpt.site','https://hocco-message-6gpcxo23w-aelobrasils-projects.vercel.app','https://hocco-message-git-codex-hocco-messa-7dcea7-aelobrasils-projects.vercel.app'];
const LEGAL_VERSION='2026-10-20.v6';
const SPONSOR_TERMS_VERSION='2026-10-19.patrocinio.v3';
const SPONSOR_CATEGORIES=['Alimentação e bebidas','Casa e construção','Educação e cultura','Moda e acessórios','Serviços','Tecnologia','Outros'];
export const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export function normalizeVideo(input,second){const u=new URL(input);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname))throw Error('Use o link HTTPS de um vídeo do YouTube.');const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.pathname==='/watch'?u.searchParams.get('v'):null;if(!/^[\w-]{11}$/.test(id||'')||!Number.isSafeInteger(second)||second<0||second>86400)throw Error('Vídeo ou instante inválido.');return `https://www.youtube.com/watch?v=${id}&t=${second}s`}
export function validateInput(b){const name=String(b.name||'').trim(),message=String(b.message||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),platform=String(b.socialPlatform||'').toLowerCase(),handle=String(b.socialHandle||'').trim().replace(/^@/,'');if(!name||name.length>40||!message||message.length>180)throw Error('Confira o nome e a mensagem de até 180 caracteres.');if(!['instagram','tiktok'].includes(platform)||!(/^[A-Za-z0-9._]{1,30}$/).test(handle))throw Error('Escolha Instagram ou TikTok e informe um @ válido.');if(!Number.isInteger(b.slot)||b.slot<1||b.slot>2)throw Error('Escolha uma das duas posições.');if(b.legalVersion!==LEGAL_VERSION||b.terms!==true||b.publication!==true||b.adult!==true)throw Error('Confirme os termos, a maioridade e a autorização de exibição.');if((b.whatsappOptIn===true||b.reminderOptIn===true)&&!(/^(?:55)?[1-9][0-9]{9,10}$/).test(phone))throw Error('Informe um WhatsApp válido para receber as mensagens autorizadas.');if(!/^[a-f0-9]{64}$/.test(b.trackingToken||''))throw Error('Identificador de envio inválido.');return{name,message,phone:(b.whatsappOptIn===true||b.reminderOptIn===true)?phone:'',optIn:b.whatsappOptIn===true,reminderOptIn:b.reminderOptIn===true,platform,handle}}

// Rules-only baseline filter. It never stores or logs rejected message text.
export function validateCommunityInput(b){const name=String(b.name||'').trim(),username=String(b.username||'').trim().replace(/^@+/,''),message=String(b.message||'').trim(),avatar=Number(b.avatar);if(!name||name.length>40||!/^[A-Za-z0-9._]{3,24}$/.test(username))throw Error('Complete seu nome e @ no perfil antes de enviar.');if(!message||message.length>180)throw Error('Escreva uma mensagem de até 180 caracteres.');if(!Number.isInteger(avatar)||avatar<1||avatar>20)throw Error('Escolha um Figurante para o seu perfil.');if(!/^[a-f0-9]{64}$/.test(b.trackingToken||''))throw Error('Identificador de envio inválido.');return{name,username,avatar,message}}
function safeSponsor(s){const{tracking_hash,phone,email,contact_name,cnpj,legal_name,...publicFields}=s;return publicFields}
function safeCommunityMessage(m){if(!m)return m;const{tracking_hash,...post}=m;return post}
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
export async function handler(req,env=globalThis.Deno?.env,fetcher=fetch){
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
 const safe=o=>{const{tracking_hash,phone,...rest}=o;return rest};
 try{
  const text=await req.text();if(text.length>3000000)return reply({error:'Solicitação muito grande.'},413);let b={};try{b=JSON.parse(text||'{}')}catch{return reply({error:'JSON inválido.'},400)}const action=b.action;
  const requestUrl=new URL(req.url),isMpWebhook=requestUrl.searchParams.get('type')==='payment'||requestUrl.searchParams.get('topic')==='payment';
  if(isMpWebhook){
   const dataId=requestUrl.searchParams.get('data.id')||requestUrl.searchParams.get('id')||b.data?.id,requestId=req.headers.get('x-request-id'),signature=req.headers.get('x-signature'),webhookSecret=env?.get('MP_WEBHOOK_SECRET'),accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();
   if(!dataId)return reply({received:true});if(!webhookSecret||!accessToken)return reply({error:'Webhook de pagamento não configurado.'},503);
   if(!await verifyWebhookSignature({dataId,requestId,signature,secret:webhookSecret}))return reply({error:'Assinatura do webhook inválida.'},401);
   const paymentResponse=await fetcher(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,{headers:{Authorization:`Bearer ${accessToken}`}});let payment={};try{payment=await paymentResponse.json()}catch{}
   // The developer dashboard sends a signed sample notification with the fake ID 123456.
   // A genuine 404 means there is no payment to apply; acknowledge it so the test does not retry forever.
   if(paymentResponse.status===404)return reply({received:true,ignored:true});
   if(!paymentResponse.ok){const providerError=typeof payment.error==='string'?payment.error:'';const causeCodes=Array.isArray(payment.cause)?payment.cause.map((cause:any)=>typeof cause?.code==='string'?cause.code:'').filter(Boolean).slice(0,5):[];console.error('Mercado Pago webhook payment lookup failed',{status:paymentResponse.status,error:providerError,causeCodes});return reply({error:'Não foi possível consultar o pagamento.'},502);}
   const reference=String(payment.external_reference||''),match=/^hocco:(order|community|sponsor):([A-Z0-9-]{8,24})$/.exec(reference);if(!match||payment.status!=='approved')return reply({received:true});
   const [,kind,code]=match;let row,path,amount;
   if(kind==='order'){row=(await db(`hm_orders?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_orders?id=eq.${encodeURIComponent(row.id)}`}
   if(kind==='community'){row=(await db(`hm_community_messages?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_community_messages?id=eq.${encodeURIComponent(row.id)}`}
   if(kind==='sponsor'){row=(await db(`hm_sponsors?code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0];path=row&&`hm_sponsors?id=eq.${encodeURIComponent(row.id)}`}
   if(!row)return reply({received:true});amount=Number(row.price_cents);if(!isApprovedPayment(payment,reference,amount))return reply({error:'Pagamento não corresponde ao pedido.'},422);if(row.payment==='confirmed')return reply({received:true,duplicate:true});if(row.payment!=='pending')return reply({received:true});
   const updates={payment:'confirmed',payment_claimed:false,updated_at:new Date().toISOString()};
   if(kind==='sponsor'&&row.review==='approved'){
    let start=new Date();if(row.renewal_of){const parent=(await db('hm_sponsors?id=eq.'+encodeURIComponent(row.renewal_of)+'&select=expires_at&limit=1'))[0];if(parent?.expires_at&&Date.parse(parent.expires_at)>start.getTime())start=new Date(parent.expires_at)}const end=new Date(start.getTime()+7*86400000);updates.starts_at=start.toISOString();updates.expires_at=end.toISOString();updates.next_thank_at=row.thank_you_opt_in?new Date(start.getTime()+2*86400000).toISOString():null;updates.next_expiry_notice_at=row.expiry_notice_opt_in?new Date(end.getTime()-86400000).toISOString():null;updates.notification_status=(row.thank_you_opt_in||row.expiry_notice_opt_in)?'pending':'not_configured';
   }
   if(kind==='community'){const confirmed=await db('rpc/hm_confirm_community_payment','POST',{p_id:row.id,p_payment_id:String(payment.id)});return reply({received:true,updated:!!confirmed?.id,published:!!confirmed?.published_at})}const saved=await db(path,'PATCH',updates);try{if(kind==='order')await db('hm_audit','POST',{order_id:row.id,action:'pay',detail:{source:'mercado_pago',payment_id:String(payment.id)}});else await db('hm_alex_events','POST',{event_type:'system_event',detail:{object:'sponsor',action:'payment_confirmed',payment_id:String(payment.id)}})}catch{}return reply({received:true,updated:!!saved?.length});
  }
  if(!['sponsor.create','customer.reset'].includes(action)&&text.length>12000)return reply({error:'Solicitação muito grande.'},413);
  if(typeof action!=='string')return reply({error:'Ação inválida.'},400);
  // The random private tracking token authenticates order access; team actions require a verified user JWT and active membership.
  if(action==='reminders.run'){
   const cronSecret=env?.get('HM_REMINDER_CRON_SECRET'),authorization=req.headers.get('Authorization')||'';if(!cronSecret||authorization!=='Bearer '+cronSecret)return reply({error:'Acesso não autorizado.'},401);let sent=0,failed=0,sponsorSent=0,sponsorFailed=0;
   const config=waConfig(true);if(config){const due=await db('rpc/hm_claim_due_reminders','POST',{p_limit:50});for(const reminder of due){try{const payload=whatsappReminderTemplatePayload(reminder,config.template,config.language,PUBLIC_ORIGIN);const response=await fetcher(`https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.sender)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.access}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});let result={};try{result=await response.json()}catch{}if(!response.ok)throw Error(result.error?.message||'A API do WhatsApp recusou o lembrete.');await db('rpc/hm_finish_reminder','POST',{p_phone:reminder.phone,p_sent:true,p_detail:{messageId:result.messages?.[0]?.id||''}});sent++}catch(error){await db('rpc/hm_finish_reminder','POST',{p_phone:reminder.phone,p_sent:false,p_detail:{reason:String(error.message||'provider_error').slice(0,300)}});failed++}}}
   for(const kind of ['thank','expiry']){const sponsorConfig=sponsorWaConfig(kind);if(!sponsorConfig)continue;const due=await db('rpc/hm_claim_due_sponsor_notifications','POST',{p_kind:kind,p_limit:50});for(const sponsor of due){try{const payload=whatsappSponsorTemplatePayload(sponsor,kind,sponsorConfig.template,sponsorConfig.language,PUBLIC_ORIGIN);const response=await fetcher(`https://graph.facebook.com/${sponsorConfig.apiVersion}/${encodeURIComponent(sponsorConfig.sender)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${sponsorConfig.access}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});let result={};try{result=await response.json()}catch{}if(!response.ok)throw Error(result.error?.message||'A API do WhatsApp recusou o aviso.');await db('rpc/hm_finish_sponsor_notification','POST',{p_id:sponsor.id,p_kind:kind,p_sent:true,p_detail:{messageId:result.messages?.[0]?.id||''}});sponsorSent++}catch(error){await db('rpc/hm_finish_sponsor_notification','POST',{p_id:sponsor.id,p_kind:kind,p_sent:false,p_detail:{reason:String(error.message||'provider_error').slice(0,300)}});sponsorFailed++}}}
   try{await db('hm_alex_events','POST',{event_type:'reminder_run',severity:failed||sponsorFailed?'warning':'info',detail:{sent,failed,sponsorSent,sponsorFailed}})}catch{}
   return reply({sent,failed,sponsorSent,sponsorFailed})
  }
  if(action==='analytics.track'){
   const route=String(b.route||'');if(!['/','/ir-alem/','/cliente/'].includes(route))return reply({error:'Rota inválida.'},400);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';const bucket=`analytics:${await sha(ip)}:${Math.floor(Date.now()/60000)}`;if(!await db('rpc/hm_rate_limit','POST',{p_bucket:bucket,p_max:30}))return reply({ok:false},429);
   await db('hm_alex_events','POST',{event_type:'site_view',route,severity:'info',detail:{}});return reply({ok:true},202)
  }
  if(action==='customer.reset'){
   if(!Array.isArray(b.orders)||b.orders.length>500)return reply({error:'Não foi possível validar os pedidos deste aparelho.'},400);
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown',bucket=`customer-reset:${await sha(ip)}:${Math.floor(Date.now()/3600000)}`;
   if(!await db('rpc/hm_rate_limit','POST',{p_bucket:bucket,p_max:5}))return reply({error:'Limite de tentativas atingido. Tente novamente mais tarde.'},429);
   let deleted=0;const seen=new Set();
   for(const item of b.orders){const code=String(item?.code||''),trackingToken=String(item?.trackingToken||'');if(!/^HM-26-[A-F0-9]{12}$/.test(code)||! /^[a-f0-9]{64}$/.test(trackingToken)||seen.has(code))continue;seen.add(code);const hash=await sha(trackingToken),found=await db(`hm_orders?code=eq.${code}&tracking_hash=eq.${hash}&select=id&limit=1`);if(!found.length)continue;const id=found[0].id;await db(`hm_audit?order_id=eq.${encodeURIComponent(id)}`,'DELETE');await db(`hm_orders?id=eq.${encodeURIComponent(id)}&code=eq.${code}&tracking_hash=eq.${hash}`,'DELETE');deleted++}
   return reply({ok:true,deleted})
  }
  if(action.startsWith('admin.')){
   const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Entre com a conta autorizada da equipe.'},401);
   const res=await fetcher(`${url}/auth/v1/user`,{headers:{...headers,Authorization:authorization}});if(!res.ok)return reply({error:'Sessão inválida ou expirada.'},401);const user=await res.json();if(!user.id||!user.email_confirmed_at)return reply({error:'Conta não autorizada.'},403);
   const members=await db(`hm_team_members?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=user_id`);if(!members.length)return reply({error:'Acesso restrito à equipe HOCCO.'},403);
   if(action==='admin.dashboard'){const[settings,orders,trashOrders,audit,reminders,sponsorSettings,sponsors,trashSponsors,recordActions,reports,communityMessages]=await Promise.all([db('hm_settings?id=eq.1&select=*'),db('hm_orders?is_demo=eq.false&archived_at=is.null&select=*&order=created_at.desc&limit=500'),db('hm_orders?is_demo=eq.false&archived_at=not.is.null&select=*&order=archived_at.desc&limit=500'),db('hm_audit?select=*&order=created_at.desc&limit=1000'),db('hm_reminder_subscriptions?select=order_id,enabled,next_send_at,last_sent_at'),db('hm_sponsor_settings?id=eq.1&select=*'),db('hm_sponsors?archived_at=is.null&select=*&order=created_at.desc&limit=500'),db('hm_sponsors?archived_at=not.is.null&select=*&order=archived_at.desc&limit=500'),db('hm_admin_record_actions?select=*&order=created_at.desc&limit=100'),db('hm_alex_reports?select=report_date,generated_at,content,status&order=report_date.desc&limit=1'),db('hm_community_messages?select=*&order=created_at.desc&limit=500')]);const enabledOrders=new Set(reminders.filter(x=>x.enabled).map(x=>x.order_id));return reply({settings:settings[0],orders:orders.map(({tracking_hash,...o})=>({...o,reminder_active:enabledOrders.has(o.id)})),trashOrders:trashOrders.map(({tracking_hash,...o})=>({...o,reminder_active:enabledOrders.has(o.id)})),audit:audit.filter(h=>!h.order_id||orders.some(o=>o.id===h.order_id)||h.action==='settings'),sponsorSettings:sponsorSettings[0],sponsors:sponsors.map(({tracking_hash,...sponsor})=>sponsor),trashSponsors:trashSponsors.map(({tracking_hash,...sponsor})=>sponsor),communityMessages:communityMessages.map(safeCommunityMessage),recordActions,dailyReport:reports[0]||null})}
   if(action==='admin.community.mutate'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Mensagem da comunidade inválida.');
    const operation=String(b.operation||''),reason=String(b.payload?.reason||'').trim();
    if(!['approve','reject','pay','refund'].includes(operation))throw Error('Ação de curadoria inválida.');
    if(operation==='reject'&&(reason.length<2||reason.length>500))throw Error('Informe o motivo da recusa.');
    const post=await db('rpc/hm_community_admin_action','POST',{p_actor:user.id,p_id:b.id,p_action:operation,p_payload:operation==='reject'?{reason}:{}});
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
    if(op==='approve'){if(s.review!=='pending')throw Error('A curadoria já foi concluída.');updates.review='approved';if(s.payment==='confirmed'){let start=new Date();if(s.renewal_of){const parent=(await db('hm_sponsors?id=eq.'+encodeURIComponent(s.renewal_of)+'&select=expires_at&limit=1'))[0];if(parent?.expires_at&&Date.parse(parent.expires_at)>start.getTime())start=new Date(parent.expires_at)}const end=new Date(start.getTime()+7*86400000);updates.starts_at=start.toISOString();updates.expires_at=end.toISOString();updates.next_thank_at=s.thank_you_opt_in?new Date(start.getTime()+2*86400000).toISOString():null;updates.next_expiry_notice_at=s.expiry_notice_opt_in?new Date(end.getTime()-86400000).toISOString():null;updates.notification_status=(s.thank_you_opt_in||s.expiry_notice_opt_in)?'pending':'not_configured'}}
    else if(op==='reject'){const reason=String(b.payload?.reason||'').trim();if(reason.length<2||reason.length>500)throw Error('Informe o motivo da recusa.');updates.review='rejected';updates.reason=reason}
    else if(op==='pay'){if(s.review!=='approved'||s.payment!=='pending')throw Error('Aprove a empresa e confira o pagamento antes de ativar.');const now=new Date();let start=now;if(s.renewal_of){const parent=(await db('hm_sponsors?id=eq.'+encodeURIComponent(s.renewal_of)+'&select=expires_at&limit=1'))[0];if(parent?.expires_at&&Date.parse(parent.expires_at)>start.getTime())start=new Date(parent.expires_at)}const end=new Date(start.getTime()+7*86400000);updates.payment='confirmed';updates.starts_at=start.toISOString();updates.expires_at=end.toISOString();updates.next_thank_at=s.thank_you_opt_in?new Date(start.getTime()+2*86400000).toISOString():null;updates.next_expiry_notice_at=s.expiry_notice_opt_in?new Date(end.getTime()-86400000).toISOString():null;updates.notification_status=(s.thank_you_opt_in||s.expiry_notice_opt_in)?'pending':'not_configured'}
    else if(op==='refund'){if(s.payment!=='confirmed'||s.review!=='rejected')throw Error('Não há devolução registrada para esta solicitação.');updates.payment='refunded';updates.starts_at=null;updates.expires_at=null}
    else throw Error('Ação de patrocinador inválida.');
    const saved=await db('hm_sponsors?id=eq.'+encodeURIComponent(b.id),'PATCH',updates);try{await db('hm_alex_events','POST',{event_type:'system_event',severity:op==='reject'?'warning':'info',detail:{object:'sponsor',action:op,review:updates.review||s.review,payment:updates.payment||s.payment}})}catch{}return reply({sponsor:saved[0]?safeSponsor(saved[0]):safeSponsor({...s,...updates})})
   }
   if(action==='admin.sponsor.delete'){
    if(!/^[a-f0-9-]{36}$/i.test(b.id||''))throw Error('Empresa inválida.');
    const rows=await db('hm_sponsors?id=eq.'+encodeURIComponent(b.id)+'&select=id,company_name&limit=1'),s=rows[0];
    if(!s)throw Error('Empresa não encontrada.');
    if(String(b.confirmName||'').trim()!==s.company_name)throw Error('Digite o nome exato da empresa para confirmar a exclusão.');
    const deleted=await db('rpc/hm_delete_sponsor','POST',{p_actor:user.id,p_id:s.id});
    let mediaDeleted=0,mediaFailed=0;
    for(const asset of deleted.assets||[]){
     try{
      const u=new URL(asset),prefix='/storage/v1/object/public/hocco-sponsor-logos/';
      if(u.origin!==new URL(url).origin||!u.pathname.startsWith(prefix))continue;
      const path=decodeURIComponent(u.pathname.slice(prefix.length));
      if(!path||path.split('/').some(part=>!part||part==='.'||part==='..'))continue;
      const encoded=path.split('/').map(encodeURIComponent).join('/');
      const response=await fetcher(`${url}/storage/v1/object/hocco-sponsor-logos/${encoded}`,{method:'DELETE',headers});
      if(response.ok||response.status===404)mediaDeleted++;else mediaFailed++;
     }catch{mediaFailed++}
    }
    if(mediaFailed)try{await db('hm_alex_events','POST',{event_type:'system_event',severity:'warning',detail:{object:'sponsor',action:'media_cleanup_pending',count:mediaFailed}})}catch{}
    return reply({ok:true,mediaDeleted,mediaFailed})
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
    if(b.operation==='publish'){const second=Number(b.payload?.second);payload={url:normalizeVideo(String(b.payload?.url||''),second),second}}
    if(!['approve','reject','pay','refund','publish','notify'].includes(b.operation))throw Error('Ação inválida.');
    const actorAction=b.operation==='notify'?'notify-start':b.operation;
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
  if(action==='catalog'){
   const[settings,orders]=await Promise.all([db('hm_settings?id=eq.1&select=prices,episode,capacity_per_slot,version,demo_mode,pix_key,payment_url,payee_name,payee_city,bank_name,publication_deadline,display_duration_seconds'),db('hm_orders?is_demo=eq.false&archived_at=is.null&select=slot,episode,review')]);const s=settings[0],paymentsEnabled=Boolean(s&&!s.demo_mode&&s.pix_key&&s.payee_name&&s.payee_city&&s.publication_deadline&&new Date(s.publication_deadline)>new Date()&&s.display_duration_seconds);return reply({settings:s,whatsappNoticeEnabled:Boolean(waConfig()),remindersEnabled:Boolean(waConfig(true)),availability:[1,2,3,4,5].map(slot=>({slot,available:Math.max(0,s.capacity_per_slot-orders.filter(o=>o.episode===s.episode&&o.slot===slot&&o.review!=='rejected').length)})),paymentsEnabled})
  }
  if(action==='sponsor.catalog'){const[config,rows,pix]=await Promise.all([db('hm_sponsor_settings?id=eq.1&select=price_cents,enabled'),db('hm_sponsors?archived_at=is.null&select=id,company_name,category,company_description,logo_url,cover_url,destination_url,community_offer,expires_at,starts_at,renewal_of,review,payment,created_at&order=created_at.asc'),db('hm_settings?id=eq.1&select=pix_key,payee_name,payee_city,bank_name')]);const now=Date.now(),active=rows.filter(s=>s.review==='approved'&&s.payment==='confirmed'&&Date.parse(s.starts_at||0)<=now&&Date.parse(s.expires_at)>now);return reply({settings:config[0]||{price_cents:2990,enabled:true},active:active.map(s=>({id:s.id,company_name:s.company_name,category:s.category||'Outros',company_description:s.company_description||'',logo_url:s.logo_url,cover_url:s.cover_url,destination_url:s.destination_url,community_offer:s.community_offer||'',expires_at:s.expires_at})),pix:pix[0]||{}})}
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
  const bucket=`${action}:${await sha(ip)}:${Math.floor(Date.now()/60000)}`;const limit=await db('rpc/hm_rate_limit','POST',{p_bucket:bucket,p_max:['create','sponsor.create','community.create'].includes(action)?5:60});if(!limit)return reply({error:'Muitas tentativas. Aguarde um minuto.'},429);
  if(action==='payment.checkout'){
   const kind=String(b.kind||''),code=String(b.code||''),token=String(b.trackingToken||'');if(!['order','community','sponsor'].includes(kind)||!/^[a-f0-9]{64}$/.test(token))return reply({error:'Link privado de pagamento inválido.'},404);
   const validCode=kind==='order'?/^HM-26-[A-F0-9]{12}$/.test(code):kind==='community'?/^HC-CM-[A-F0-9]{12}$/.test(code):/^HC-SP-[A-F0-9]{12}$/.test(code);if(!validCode)return reply({error:'Referência de pagamento inválida.'},404);
   const hash=await sha(token);let row;if(kind==='order')row=(await db(`hm_orders?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];if(kind==='community')row=(await db(`hm_community_messages?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];if(kind==='sponsor')row=(await db(`hm_sponsors?code=eq.${encodeURIComponent(code)}&tracking_hash=eq.${hash}&select=*&limit=1`))[0];
   if(!row)return reply({error:'Pedido não encontrado.'},404);if(row.payment!=='pending'||row.review==='rejected')return reply({error:'Este pedido não está aguardando pagamento.'},409);if(kind==='community'&&row.review!=='approved')return reply({error:'A mensagem precisa passar pela verificação adicional antes do pagamento.'},409);if(kind==='sponsor'&&row.review!=='approved')return reply({error:'A empresa precisa ser aprovada pela curadoria antes do pagamento.'},409);
   const accessToken=String(env?.get('MP_ACCESS_TOKEN')||'').trim();if(!accessToken)return reply({error:'Checkout Mercado Pago ainda não configurado.'},503);
   const allowedOrigin=origin&&origins.has(origin)?origin:PUBLIC_ORIGIN,returnPath=kind==='order'?`/cliente/#acompanhar/${encodeURIComponent(code)}/${encodeURIComponent(token)}`:kind==='community'?`/#comunidade-pagamento/${encodeURIComponent(code)}/${encodeURIComponent(token)}`:`/ir-alem/#pedido/${encodeURIComponent(code)}/${encodeURIComponent(token)}`;
   const result=await createPreference({accessToken,externalReference:paymentReference(kind,code),title:kind==='order'?'Mensagem no vídeo oficial HOCCO':kind==='community'?'Mensagem na Comunidade HOCCO':'Patrocínio HOCCO',priceCents:Number(row.price_cents),origin:allowedOrigin,returnPath,notificationUrl:'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message?type=payment',payerEmail:kind==='sponsor'?row.email:undefined,environment:env?.get('MP_ENVIRONMENT')||env?.get('MP_Environment')||'production',fetcher});
   return reply({checkoutUrl:result.checkoutUrl,preferenceId:result.preferenceId,externalReference:result.externalReference});
  }
  if(action==='community.feed'){
   const now=encodeURIComponent(new Date().toISOString()),rows=await db(`hm_community_messages?review=eq.approved&payment=eq.confirmed&published_at=not.is.null&expires_at=gt.${now}&select=id,member_name,member_username,avatar_index,message,published_at,expires_at&order=published_at.desc&limit=100`);
   return reply({messages:rows})
  }
  if(action==='community.create'){
   const v=validateCommunityInput(b),moderation=moderateCommunityMessage(v.message);
   if(!moderation.approved&&!moderation.requiresReview)return reply({error:'Esta mensagem pode não seguir as regras da Comunidade. Revise o texto e os termos antes de tentar novamente.'},422);
   const trackingHash=await sha(b.trackingToken),code='HC-CM-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
   const rpc=moderation.requiresReview?'rpc/hm_create_community_message':'rpc/hm_create_community_message_auto';
   const post=await db(rpc,'POST',{p_code:code,p_tracking_hash:trackingHash,p_name:v.name,p_username:v.username,p_avatar_index:v.avatar,p_message:v.message});
   return reply({post:safeCommunityMessage(post),trackingToken:b.trackingToken,needsReview:moderation.requiresReview},201)
  }
  if(['community.lookup','community.payment_claim'].includes(action)){
   if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HC-CM-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link privado da mensagem inválido.'},404);
   const trackingHash=await sha(b.trackingToken),rows=await db(`hm_community_messages?code=eq.${encodeURIComponent(b.code)}&tracking_hash=eq.${trackingHash}&select=*&limit=1`);let post=rows[0];
   if(!post)return reply({error:'Mensagem não encontrada ou link privado incorreto.'},404);
   if(action==='community.payment_claim'){
    if(post.payment!=='pending'||post.review==='rejected')throw Error('Esta mensagem não está aguardando pagamento.');
    if(!post.payment_claimed)post=await db('rpc/hm_community_payment_claim','POST',{p_id:post.id,p_tracking_hash:trackingHash});
   }
   const history=await db(`hm_community_audit?post_id=eq.${encodeURIComponent(post.id)}&select=action,detail,created_at&order=created_at.asc`);
   const pix=(await db('hm_settings?id=eq.1&select=pix_key,payee_name,payee_city,bank_name'))[0]||{};
   return reply({post:safeCommunityMessage(post),history,pix})
  }
  if(action==='sponsor.create'){
   const sponsorConfig=(await db('hm_sponsor_settings?id=eq.1&select=enabled'))[0];if(!sponsorConfig?.enabled)return reply({error:'As inscrições de patrocinadores estão temporariamente fechadas.'},403);
   const companyName=String(b.companyName||'').trim(),legalName=String(b.legalName||'').trim(),cnpj=normalizeCnpj(b.cnpj),category=String(b.category||''),companyDescription=String(b.companyDescription||'').trim(),contactName=String(b.contactName||'').trim(),email=String(b.email||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),token=b.trackingToken;
   if(!validCnpj(cnpj)||legalName.length<2||legalName.length>160)throw Error('Informe um CNPJ válido e a razão social da empresa.');
   if(!SPONSOR_CATEGORIES.includes(category))throw Error('Escolha uma categoria válida para a empresa.');
   if(companyName.length<2||companyName.length>80||companyDescription.length<20||companyDescription.length>600||contactName.length<1||contactName.length>80||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Confira o nome, descrição da empresa (20 a 600 caracteres), contato e e-mail.');
   if((b.thankYouOptIn||b.expiryNoticeOptIn)&&!/^((55)?[1-9][0-9]{9,10})$/.test(phone))throw Error('Informe um WhatsApp válido para receber os avisos escolhidos.');
   if(b.terms!==true||b.publication!==true||b.sponsorTermsVersion!==SPONSOR_TERMS_VERSION||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Aceite as regras para patrocinadores e a autorização de exibição para continuar.');
   const destination=safeHttps(b.destinationUrl,'O destino');let communityOffer=String(b.communityOffer||'').trim();if(communityOffer.length>240)throw Error('A oferta para a comunidade deve ter até 240 caracteres.');if(b.offerEnabled===true&&communityOffer.length<5)throw Error('Descreva a oferta ou desconto que será analisado pela curadoria.');if(b.offerEnabled!==true)communityOffer='';
   const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};const parseImage=async(kind)=>{const mime=String(b[kind+'Mime']||''),encoded=String(b[kind+'Base64']||'');if(!extensions[mime]||encoded.length<12||encoded.length>1450000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Anexe logo e capa em PNG, JPG ou WebP, com até 1 MB cada.');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length>1048576)throw Error('Cada imagem deve ter até 1 MB.');const png=bytes.length>=67&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!(mime==='image/png'&&png||mime==='image/jpeg'&&jpeg||mime==='image/webp'&&webp))throw Error('O conteúdo do arquivo não corresponde a uma imagem válida.');return{mime,bytes,ext:extensions[mime]}};const logoFile=await parseImage('logo'),coverFile=await parseImage('cover');
   const hash=await sha(token),code='HC-SP-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),renewal=/^[a-f0-9-]{36}$/i.test(b.renewalOf||'')?b.renewalOf:null;
   const logoPath='sponsors/'+hash.slice(0,32)+'-logo.'+logoFile.ext,coverPath='sponsors/'+hash.slice(0,32)+'-cover.'+coverFile.ext,storageHeaders={...headers,'x-upsert':'true','cache-control':'3600'};
   for(const[file,path,kind]of[[logoFile,logoPath,'logo'],[coverFile,coverPath,'capa']]){const uploaded=await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+path,{method:'POST',headers:{...storageHeaders,'Content-Type':file.mime},body:file.bytes});if(!uploaded.ok){try{await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+logoPath,{method:'DELETE',headers});await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+coverPath,{method:'DELETE',headers})}catch{}throw Error('Não foi possível guardar o '+kind+'. Tente novamente.')}}
   const logo=url+'/storage/v1/object/public/hocco-sponsor-logos/'+logoPath,cover=url+'/storage/v1/object/public/hocco-sponsor-logos/'+coverPath;
   try{const sponsor=await db('rpc/hm_create_sponsor','POST',{p_code:code,p_tracking_hash:hash,p_company_name:companyName,p_cnpj:cnpj,p_legal_name:legalName,p_category:category,p_company_description:companyDescription,p_contact_name:contactName,p_email:email,p_phone:(b.thankYouOptIn===true||b.expiryNoticeOptIn===true)?phone:'',p_logo_url:logo,p_cover_url:cover,p_destination_url:destination,p_community_offer:communityOffer,p_sponsor_terms_version:SPONSOR_TERMS_VERSION,p_thank_you_opt_in:b.thankYouOptIn===true,p_expiry_notice_opt_in:b.expiryNoticeOptIn===true,p_renewal_of:renewal});return reply({sponsor:safeSponsor(sponsor),trackingToken:token},201)}catch(error){try{await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+logoPath,{method:'DELETE',headers});await fetcher(url+'/storage/v1/object/hocco-sponsor-logos/'+coverPath,{method:'DELETE',headers})}catch{}throw error}
  }
  if(['sponsor.lookup','sponsor.payment_claim'].includes(action)){
   if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HC-SP-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link privado de acompanhamento inválido.'},404);
   const hash=await sha(b.trackingToken),rows=await db('hm_sponsors?code=eq.'+encodeURIComponent(b.code)+'&tracking_hash=eq.'+hash+'&select=*&limit=1');let s=rows[0];if(!s)return reply({error:'Patrocínio não encontrado ou link privado incorreto.'},404);
   if(action==='sponsor.payment_claim'){if(s.payment!=='pending'||s.review==='rejected')throw Error('Esta solicitação não está aguardando pagamento.');if(!s.payment_claimed){const updated=await db('hm_sponsors?id=eq.'+encodeURIComponent(s.id),'PATCH',{payment_claimed:true,updated_at:new Date().toISOString()});s=updated[0]||{...s,payment_claimed:true}}}
   return reply({sponsor:safeSponsor(s),contact:{email:s.email,phone:s.phone,contact_name:s.contact_name,cnpj:s.cnpj,legal_name:s.legal_name}})
  }
  if(action!=='create'&&!['lookup','payment_claim','reminder_optout'].includes(action))return reply({error:'Ação inválida.'},400);
  if(action==='create'){
   const live=await db('hm_settings?id=eq.1&select=demo_mode,pix_key,payee_name,payee_city,publication_deadline,display_duration_seconds');const cfg=live[0];if(!cfg||cfg.demo_mode||!cfg.pix_key||!cfg.payee_name||!cfg.payee_city||!cfg.publication_deadline||new Date(cfg.publication_deadline)<=new Date()||!cfg.display_duration_seconds)return reply({error:'O envio de pedidos está temporariamente indisponível.'},503);
   const v=validateInput(b);if(v.optIn&&!waConfig()||v.reminderOptIn&&!waConfig(true))return reply({error:'O canal de WhatsApp escolhido está temporariamente indisponível.'},503);const hash=await sha(b.trackingToken),code='HM-26-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
   const o=await db('rpc/hm_create_order','POST',{p_code:code,p_tracking_hash:hash,p_name:v.name,p_message:v.message,p_phone:v.phone,p_opt_in:v.optIn,p_reminder_opt_in:v.reminderOptIn,p_social_platform:v.platform,p_social_handle:v.handle,p_slot:b.slot,p_legal_version:LEGAL_VERSION,p_expected_price:b.expectedPrice,p_settings_version:b.settingsVersion});
   return reply({order:safe(o),trackingToken:b.trackingToken},201)
  }
  if(!['lookup','payment_claim','reminder_optout'].includes(action))return reply({error:'Ação inválida.'},400);
  if(!/^[a-f0-9]{64}$/.test(b.trackingToken||'')||!/^HM-26-[A-F0-9]{12}$/.test(b.code||''))return reply({error:'Link de acompanhamento inválido.'},404);
  const hash=await sha(b.trackingToken);const rows=await db(`hm_orders?code=eq.${b.code}&tracking_hash=eq.${hash}&select=*&limit=1`);const o=rows[0];if(!o)return reply({error:'Pedido não encontrado ou link privado incorreto.'},404);
  if(action==='reminder_optout'){const rows=await db(`hm_reminder_subscriptions?order_id=eq.${o.id}&enabled=eq.true&select=phone`);if(rows.length){await db(`hm_reminder_subscriptions?order_id=eq.${o.id}`,'PATCH',{enabled:false,next_send_at:null,unsubscribed_at:new Date().toISOString()});await db('hm_audit','POST',{order_id:o.id,action:'reminder_optout',detail:{source:'customer'}})}const history=await db(`hm_audit?order_id=eq.${o.id}&select=action,detail,created_at&order=created_at.asc`);return reply({ok:true,history})}
  const history=await db(`hm_audit?order_id=eq.${o.id}&select=action,detail,created_at&order=created_at.asc`);
  if(action==='payment_claim'){
   if(o.review==='rejected'||o.delivery==='published')throw Error('Este pedido não está aguardando pagamento.');
   // A payment claim never changes payment to confirmed.
   if(!o.payment_claimed){await db(`hm_orders?id=eq.${o.id}`,'PATCH',{payment_claimed:true,updated_at:new Date().toISOString()});await db('hm_audit','POST',{order_id:o.id,action:'payment-claimed',detail:{source:'customer'}});o.payment_claimed=true;}
  }
  return reply({order:{...safe(o),reminder_active:(await db(`hm_reminder_subscriptions?order_id=eq.${o.id}&enabled=eq.true&select=phone`)).length>0},history:history.filter(h=>['created','approve','reject','pay','refund','publish','payment-claimed','reminder_sent','reminder_optout'].includes(h.action))})
 }catch(error){return reply({error:error instanceof SyntaxError?'Solicitação inválida.':String(error.message||'Não foi possível concluir.')},400)}
}
if(typeof Deno!=='undefined')Deno.serve(req=>handler(req));

