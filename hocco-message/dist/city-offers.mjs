export const normalizeCity=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function cityOffers(rows,{city,uf,category=''}={},now=Date.now()){
 if(!normalizeCity(city)||!/^[A-Z]{2}$/.test(uf||''))return [];
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 return rows.filter(s=>normalizeCity(s.city)===normalizeCity(city)&&s.state_code===uf&&(!category||s.category===category)&&String(s.community_offer||'').trim().length>0&&(!s.offer_expires_on||/^\d{4}-\d{2}-\d{2}$/.test(s.offer_expires_on)&&s.offer_expires_on>=day));
}
