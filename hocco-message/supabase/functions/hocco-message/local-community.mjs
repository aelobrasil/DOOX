export const BRAZIL_STATES=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export function validateLocation(input){
 const city=String(input.city||'').normalize('NFC').trim().replace(/\s+/g,' '),state=String(input.stateCode||'').trim().toUpperCase();
 if(city.length<2||city.length>80||!/^\p{L}[\p{L}\p{M} .’'()-]*$/u.test(city)||!BRAZIL_STATES.includes(state))throw Error('Informe a cidade e a UF da empresa.');
 const conditions=String(input.offerConditions||'').trim(),date=String(input.offerExpiresOn||'');
 if(conditions.length>500)throw Error('As condições da oferta devem ter até 500 caracteres.');
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('Informe uma validade real para a oferta.');
 if(input.offerEnabled&&conditions.length<5)throw Error('Descreva as condições para usar a oferta.');
 return {city,state_code:state,offer_conditions:input.offerEnabled?conditions:'',offer_expires_on:input.offerEnabled&&date?date:null};
}
export function validateProgramming(input){
 const topic=String(input.topic||'').trim(),liveTitle=String(input.liveTitle||'').trim(),liveAt=String(input.liveAt||''),capacity=Number(input.capacity);
 if(topic.length>180||liveTitle.length>120||!Number.isInteger(capacity)||capacity<1||capacity>500||typeof input.accepting!=='boolean'||liveAt&&!Number.isFinite(Date.parse(liveAt)))throw Error('Confira assunto, título, horário e capacidade da LIVE.');
 if(input.accepting&&(!liveAt||Date.parse(liveAt)<=Date.now()||liveTitle.length<2))throw Error('Defina título e data futura para abrir a fila da LIVE.');
 return {topic,liveTitle,liveAt,capacity,accepting:input.accepting};
}
