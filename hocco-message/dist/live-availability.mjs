export function canSendLive(settings,programming,now=Date.now()){
 return settings?.live_enabled===true&&programming?.live_accepting===true&&Number(programming.available)>0&&(!programming.next_live_at||Date.parse(programming.next_live_at)>now);
}
export function liveScheduleLabel(programming){return programming?.next_live_at?new Date(programming.next_live_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · Brasília':'Próxima LIVE · data a confirmar'}
