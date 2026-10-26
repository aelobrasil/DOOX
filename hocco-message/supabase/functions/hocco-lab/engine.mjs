import {moderateCommunityMessage} from './moderation.mjs';
import {verifiedPaymentEvent} from './payment-verification.mjs';
export function createScenario(kind,message,now=Date.now()){
 if(!['community','live','video','sponsor'].includes(kind))throw Error('Cenário inválido.');
 message=String(message||'Teste da comunidade HOCCO').trim();if(!message||message.length>180)throw Error('Use uma mensagem fictícia de até 180 caracteres.');
 const m=moderateCommunityMessage(message);
 return {kind,message,member_name:'Participante de teste',member_username:'teste_hocco',avatar_index:1,price_cents:kind==='sponsor'?3990:kind==='live'?550:kind==='video'?500:350,payment:'pending',review:!m.approved?'pending':kind==='sponsor'?'pending':'approved',blocked:!m.approved&&!m.requiresReview,requires_review:m.requiresReview||kind==='sponsor',published_at:null,expires_at:null,delivery:'pending',created_at:new Date(now).toISOString(),simulation:true,engine_version:'2026-10-26.local-v1'};
}
export function transitionScenario(current,action,now=Date.now()){
 const s=structuredClone(current),stamp=new Date(now).toISOString();
 if(s.simulation!==true)throw Error('Registro fora do laboratório.');
 if(action==='approve'){
  if(s.blocked)throw Error('Conteúdo bloqueado não pode ser aprovado neste teste.');
  if(s.kind==='sponsor'&&s.payment!=='confirmed')throw Error('A curadoria de empresa começa após pagamento.');
  s.review='approved';
 }else if(action==='pay'){
  if(s.blocked||s.kind!=='sponsor'&&s.review!=='approved')throw Error('A verificação deve liberar o conteúdo antes do pagamento.');
  if(s.payment==='refunded')throw Error('Este cenário já foi devolvido.');
  verifiedPaymentEvent({id:123456789,status:'approved',currency_id:'BRL',external_reference:'hocco:community:HC-CM-ABCDEF123456',transaction_amount:s.price_cents/100,collector_id:42,live_mode:false,date_last_updated:stamp},{kind:'community',code:'HC-CM-ABCDEF123456',priceCents:s.price_cents,collectorId:42,production:false});
  s.payment='confirmed';
 }else if(action==='refund'){if(s.payment!=='confirmed')throw Error('Não existe pagamento confirmado.');s.payment='refunded';s.published_at=null;s.expires_at=null;s.live_status=null;return s;
 }else if(action==='read'){if(s.kind!=='live'||s.payment!=='confirmed'||s.review!=='approved')throw Error('Não há leitura liberada.');s.live_status='read';
 }else if(action==='publish_video'){if(s.kind!=='video'||s.payment!=='confirmed'||s.review!=='approved')throw Error('Não há veiculação liberada.');s.delivery='published';
 }else throw Error('Ação de teste inválida.');
 if(s.payment==='confirmed'&&s.review==='approved'&&!s.published_at&&s.kind!=='video'){
  s.published_at=stamp;s.expires_at=new Date(now+(s.kind==='sponsor'?168:s.kind==='live'?24:4)*3600000).toISOString();if(s.kind==='live')s.live_status='queued';
 }
 return s;
}
