export function canSendLive(settings,programming,now=Date.now()){
 return settings?.live_enabled===true&&programming?.live_accepting===true;
}
export function liveScheduleLabel(programming){return Date.parse(programming?.next_live_at)>Date.now()?new Date(programming.next_live_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · Brasília':'Próxima LIVE · data a confirmar'}
