export const normalizeCity=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function cityOffers(rows,{city,uf,category=''}={},now=Date.now()){
 if(!normalizeCity(city)||!/^[A-Z]{2}$/.test(uf||''))return [];
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 return rows.filter(s=>normalizeCity(s.city)===normalizeCity(city)&&s.state_code===uf&&(!category||s.category===category)&&String(s.community_offer||'').trim().length>0&&(!s.offer_expires_on||/^\d{4}-\d{2}-\d{2}$/.test(s.offer_expires_on)&&s.offer_expires_on>=day));
}

/**
 * Public sponsor gallery. The server returns only paid, approved and active
 * sponsors. Unlike cityOffers(), the national view must not require a city.
 * Optional city / UF filters work independently so selecting only UF is useful.
 * Brand visibility is independent of having a promotional benefit; the API
 * is the sole authority for paid/approved/active status.
 */
export function publicOffers(rows,{city='',uf='',category=''}={},now=Date.now()){
 const normalizedCity=normalizeCity(city),state=String(uf||'').trim().toUpperCase();
 return (Array.isArray(rows)?rows:[]).filter(s=>
  (!normalizedCity||normalizeCity(s.city)===normalizedCity)&&
  (!state||s.state_code===state)&&
  (!category||s.category===category)
 );
}

export function publicBenefit(s,now=Date.now()){
 if(!String(s?.community_offer||'').trim())return '';
 if(!s.offer_expires_on)return String(s.community_offer);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 return /^\d{4}-\d{2}-\d{2}$/.test(s.offer_expires_on)&&s.offer_expires_on>=day?String(s.community_offer):'';
}
