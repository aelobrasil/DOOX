export const reactivationCopy={
 '1':'O HOCCO continua acontecendo. Volte ao Reality e acompanhe a experiência oficial.',
 '2':'Você ainda pode participar do HOCCO. Entre novamente, acompanhe o Reality e envie sua participação.',
 '3':'O HOCCO continua. Entre novamente e acompanhe o Reality.',
 participant:'Você já participou do HOCCO. Entre novamente e acompanhe as próximas participações.',
 abandoned:'Você começou sua participação no HOCCO. Volte para acompanhar ou iniciar um novo envio se o prazo de pagamento terminou.'
};
export function reactivationConfig(env){
 const access=env?.get('WHATSAPP_ACCESS_TOKEN'),sender=env?.get('WHATSAPP_PHONE_NUMBER_ID'),language=env?.get('WHATSAPP_REMINDER_TEMPLATE_LANGUAGE'),apiVersion=env?.get('WHATSAPP_GRAPH_API_VERSION');
 const templates=Object.fromEntries(Object.keys(reactivationCopy).map(k=>[k,env?.get('WHATSAPP_REACTIVATION_TEMPLATE_'+k.toUpperCase())]));
 return access&&sender&&language&&/^v\d+\.\d+$/.test(apiVersion||'')&&Object.values(templates).every(Boolean)?{access,sender,language,apiVersion,templates}:null;
}
export function reactivationPayload(item,config,origin){
 if(!/^55[1-9][0-9]{9,10}$/.test(item.phone||'')||!config.templates[item.variant])throw Error('Destinatário ou modelo de retorno inválido.');
 return {messaging_product:'whatsapp',to:item.phone,type:'template',template:{name:config.templates[item.variant],language:{code:config.language},components:[{type:'body',parameters:[{type:'text',text:item.name},{type:'text',text:origin}]}]}};
}
