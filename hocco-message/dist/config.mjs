export const SUPABASE_URL='https://vebqvedmhfaebvdantiu.supabase.co';
export const PUBLISHABLE_KEY="sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz";
export const API_URL=SUPABASE_URL+'/functions/v1/hocco-message';
// Anonymous aggregate page views: only a fixed route is recorded; no URL hash, query, visitor ID or user content.
if(typeof window!=='undefined'){const path=location.pathname,route=path==='/'?'/':path==='/ir-alem/'?'/ir-alem/':path==='/cliente/'?'/cliente/':null;if(route)fetch(API_URL,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY},body:JSON.stringify({action:'analytics.track',route})}).catch(()=>{})}
export async function api(action,body={},token){const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:PUBLISHABLE_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...body})});let data;try{data=await res.json()}catch{throw Error('Não foi possível acessar o Hocco Message. Tente novamente.')}if(!res.ok)throw Object.assign(Error(data.error||'Não foi possível concluir.'),{status:res.status});return data}
export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const messageStatus=o=>o.delivery==='published'?'Veiculada':o.review==='rejected'?(o.payment==='confirmed'?'Reprovada · devolução pendente':o.payment==='refunded'?'Reprovada · devolvida':'Reprovada'):o.review==='approved'&&o.payment==='confirmed'?'Na fila de edição':o.review==='approved'?'Aguardando pagamento':'Em curadoria';
