'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, BarChart3, CheckCircle2, Clock3, Flame, HeartHandshake, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Target, UserRound, X, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './member-detail.css';

const SUPPORT_NUMBER='5514991088104';
const MISSION_LABELS={youtube_channel_visit:'Visita ao @hoccpov',minigame_daily:'Minigame diário',pulso_daily:'Pulso diário'};

export default function ControlMemberEnhancer(){
  const [profiles,setProfiles]=useState([]);
  const [contacts,setContacts]=useState([]);
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [reason,setReason]=useState('');
  const [missionKey,setMissionKey]=useState('minigame_daily');
  const [missionDate,setMissionDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [xpDelta,setXpDelta]=useState(5);
  const [hcDelta,setHcDelta]=useState(1);
  const [streak,setStreak]=useState(0);
  const [message,setMessage]=useState('Olá! Aqui é o suporte HOCCO. Estamos entrando em contato sobre sua conta no aplicativo.');

  useEffect(()=>{
    let cancelled=false;
    async function hydrate(){
      const [{data:p},{data:c}]=await Promise.all([
        supabase.from('impulsionadores_perfis').select('*').order('created_at',{ascending:false}).limit(500),
        supabase.from('impulsionadores_contatos').select('*').limit(500),
      ]);
      if(!cancelled){setProfiles(p||[]);setContacts(c||[])}
    }
    hydrate();
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    const bind=()=>{
      document.querySelectorAll('.dataTable .trow').forEach((row)=>{
        if(row.dataset.memberBound==='1')return;
        const name=row.children?.[0]?.querySelector('b')?.textContent?.trim()||'';
        const email=row.children?.[1]?.querySelector('b')?.textContent?.trim()||'';
        const phone=row.children?.[1]?.querySelector('small')?.textContent?.replace(/\D/g,'')||'';
        const contact=contacts.find((c)=>(email&&email!=='—'&&c.email===email)||(phone&&String(c.telefone||'').replace(/\D/g,'')===phone));
        const profile=contact?profiles.find((p)=>p.user_id===contact.user_id):profiles.find((p)=>p.nome_publico===name);
        if(!profile)return;
        row.dataset.memberBound='1';
        row.classList.add('memberClickable');
        row.title='Abrir análise completa deste membro';
        const handler=()=>openMember(profile);
        row.__hoccoMemberHandler=handler;
        row.addEventListener('click',handler);
      });
    };
    bind();
    const observer=new MutationObserver(bind);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{
      observer.disconnect();
      document.querySelectorAll('.dataTable .trow').forEach((row)=>{
        if(row.__hoccoMemberHandler)row.removeEventListener('click',row.__hoccoMemberHandler);
        delete row.__hoccoMemberHandler;
        delete row.dataset.memberBound;
      });
    };
  },[profiles,contacts]);

  useEffect(()=>{
    if(!selected)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=(event)=>{if(event.key==='Escape')setSelected(null)};
    window.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)};
  },[selected]);

  async function openMember(profile){
    setSelected(profile);
    setStreak(Number(profile.ofensiva_dias||0));
    setDetail(null);
    await loadMember(profile.user_id);
  }

  async function loadMember(userId){
    setLoading(true);
    const [contact,sessions,events,missions,votes,interactions,impulsions,daily,apps]=await Promise.all([
      supabase.from('impulsionadores_contatos').select('*').eq('user_id',userId).maybeSingle(),
      supabase.from('impulsionadores_sessoes').select('*').eq('user_id',userId).order('started_at',{ascending:false}).limit(250),
      supabase.from('impulsionadores_eventos').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(500),
      supabase.from('impulsionadores_missoes_diarias').select('*').eq('user_id',userId).order('mission_date',{ascending:false}).limit(180),
      supabase.from('hype_votos').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(250),
      supabase.from('hype_interacoes').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(500),
      supabase.from('impulsionadores_impulsoes').select('id,reference_code,status,created_at,confirmed_at,amount').eq('user_id',userId).order('created_at',{ascending:false}).limit(100),
      supabase.from('hc_diario').select('*').eq('user_id',userId).order('activity_date',{ascending:false}).limit(180),
      supabase.from('hocco_experiencia_inscricoes').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(100),
    ]);
    setDetail({contact:contact.data||null,sessions:sessions.data||[],events:events.data||[],missions:missions.data||[],votes:votes.data||[],interactions:interactions.data||[],impulsions:impulsions.data||[],daily:daily.data||[],apps:apps.data||[],errors:[contact,sessions,events,missions,votes,interactions,impulsions,daily,apps].filter((x)=>x.error).map((x)=>x.error.message)});
    setLoading(false);
  }

  async function runControl(action,extra={}){
    if(!selected||busy)return;
    if(reason.trim().length<4){alert('Informe o motivo da correção para manter a auditoria.');return}
    setBusy(true);
    const {data,error}=await supabase.rpc('admin_member_control',{p_user_id:selected.user_id,p_action:action,p_reason:reason.trim(),p_mission_key:extra.missionKey??null,p_mission_date:extra.missionDate??null,p_delta:extra.delta??null,p_value:extra.value??null});
    setBusy(false);
    if(error){alert(adminError(error.message));return}
    const updated=data?.profile;
    if(updated){setSelected((s)=>({...s,...updated}));setProfiles((rows)=>rows.map((p)=>p.user_id===selected.user_id?{...p,...updated}:p));setStreak(Number(updated.ofensiva_dias||0))}
    setReason('');
    await loadMember(selected.user_id);
  }

  function sendWhatsapp(){
    const phone=String(detail?.contact?.telefone||'').replace(/\D/g,'');
    if(!phone){alert('Este membro ainda não possui telefone cadastrado.');return}
    const normalized=phone.startsWith('55')?phone:`55${phone}`;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  }

  const analytics=useMemo(()=>detail?buildAnalytics(detail):null,[detail]);
  if(!selected||typeof document==='undefined')return null;

  return createPortal(<div className="memberOverlay" role="dialog" aria-modal="true" aria-label={`Análise do membro ${selected.nome_publico}`} onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}}>
    <aside className="memberDrawer">
      <header className="memberDrawerHead"><div><small>MEMBRO · ANÁLISE 360°</small><h2>{selected.nome_publico}</h2><p>{detail?.contact?.email||selected.username||selected.user_id}</p></div><button type="button" aria-label="Fechar análise" onClick={()=>setSelected(null)}><X/></button></header>
      {loading||!detail?<div className="memberLoading"><RefreshCw className="spin"/> Carregando histórico completo...</div>:<>
        <section className="memberHeroStats">
          <Mini icon={Clock3} label="Tempo ativo" value={formatDuration(analytics.totalSeconds)} note={`${detail.sessions.length} sessões`}/>
          <Mini icon={Activity} label="Últimos 7 dias" value={formatDuration(analytics.last7Seconds)} note={`${analytics.last7Sessions} acessos`}/>
          <Mini icon={Zap} label="Hypes" value={detail.votes.length} note={`${detail.interactions.length} interações`}/>
          <Mini icon={Sparkles} label="Progressão" value={`${selected.hc||0} HC`} note={`${selected.xp||0} XP · nível ${selected.nivel||1}`}/>
          <Mini icon={Flame} label="Ofensiva" value={`${selected.ofensiva_dias||0} dias`} note={`recorde ${selected.maior_ofensiva||0}`}/>
          <Mini icon={Target} label="Missões" value={detail.missions.length} note={`${selected.missoes_concluidas||0} registradas`}/>
        </section>

        <section className="memberBlock"><div className="blockTitle"><div><small>COMPORTAMENTO</small><h3>Como ele usa o app</h3></div><BarChart3/></div><div className="behaviorGrid"><Fact label="Último acesso" value={analytics.lastSeen?new Date(analytics.lastSeen).toLocaleString('pt-BR'):'—'}/><Fact label="Sessão média" value={formatDuration(analytics.avgSession)}/><Fact label="Plataforma principal" value={analytics.topPlatform}/><Fact label="Dias ativos registrados" value={selected.total_dias_ativos||0}/><Fact label="Benefícios abertos" value={analytics.benefits}/><Fact label="WhatsApp de empresas" value={analytics.whatsapp}/></div><div className="eventChips">{analytics.topEvents.map(([key,count])=><span key={key}>{humanize(key)} <b>{count}</b></span>)}</div></section>

        <section className="memberBlock"><div className="blockTitle"><div><small>CONTATO</small><h3>Atendimento individual</h3></div><MessageCircle/></div><div className="contactLine"><b>{detail.contact?.telefone||'Telefone não cadastrado'}</b><span>{detail.contact?.email||'E-mail não cadastrado'}</span></div><textarea className="supportMessage" value={message} onChange={(e)=>setMessage(e.target.value)} rows={4}/><div className="drawerActions"><button className="primaryAction" onClick={sendWhatsapp}><MessageCircle/> Enviar mensagem no WhatsApp</button><a className="secondaryAction" href={`https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(`Suporte interno HOCCO sobre o membro ${selected.nome_publico}.`)}`} target="_blank" rel="noreferrer"><HeartHandshake/> Abrir suporte HOCCO</a></div></section>

        <section className="memberBlock adminControl"><div className="blockTitle"><div><small>CONTROLE DA CONTA</small><h3>Correções administrativas</h3></div><ShieldCheck/></div><p className="adminWarning">Toda alteração exige motivo e é registrada na auditoria com antes/depois.</p><label className="reasonField">Motivo da correção<input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Ex.: missão concluída não foi reconhecida"/></label>
          <div className="controlBox"><div><b>Missões</b><small>Concluir ou retirar uma missão específica.</small></div><select value={missionKey} onChange={(e)=>setMissionKey(e.target.value)}>{Object.entries(MISSION_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><input type="date" value={missionDate} onChange={(e)=>setMissionDate(e.target.value)}/><div className="drawerActions"><button disabled={busy} onClick={()=>runControl('mission_complete',{missionKey,missionDate})}><CheckCircle2/> Marcar concluída</button><button disabled={busy} className="dangerAction" onClick={()=>runControl('mission_remove',{missionKey,missionDate})}><X/> Retirar missão</button></div></div>
          <div className="adjustGrid"><Adjust title="Ajustar XP" value={xpDelta} setValue={setXpDelta} onApply={()=>runControl('xp_adjust',{delta:Number(xpDelta)})} busy={busy}/><Adjust title="Ajustar HC" value={hcDelta} setValue={setHcDelta} onApply={()=>runControl('hc_adjust',{delta:Number(hcDelta)})} busy={busy}/><div className="adjustCard"><b>Corrigir ofensiva</b><input type="number" min="0" max="3650" value={streak} onChange={(e)=>setStreak(e.target.value)}/><button disabled={busy} onClick={()=>runControl('streak_set',{value:Number(streak)})}>Salvar dias</button></div></div>
        </section>

        <section className="memberBlock"><div className="blockTitle"><div><small>HISTÓRICO</small><h3>Atividade recente</h3></div><UserRound/></div><div className="timeline">{buildTimeline(detail).slice(0,30).map((item,index)=><div className="timelineItem" key={`${item.type}-${item.id}-${index}`}><span className={`dot ${item.type}`}/><div><b>{item.title}</b><small>{item.subtitle}</small></div><time>{new Date(item.at).toLocaleString('pt-BR')}</time></div>)}{!buildTimeline(detail).length&&<p>Sem atividade registrada.</p>}</div></section>
        {detail.errors.length>0&&<div className="memberErrors">Algumas consultas não responderam: {detail.errors.join(' · ')}</div>}
      </>}
    </aside>
  </div>,document.body);
}

function buildAnalytics(d){
  const now=Date.now(),week=now-7*86400000;
  const totalSeconds=d.sessions.reduce((a,s)=>a+Number(s.active_seconds||0),0);
  const last7=d.sessions.filter((s)=>new Date(s.started_at).getTime()>=week);
  const counts={};d.events.forEach((e)=>{counts[e.event_type]=(counts[e.event_type]||0)+1});d.interactions.forEach((e)=>{counts[`hype_${e.event_type}`]=(counts[`hype_${e.event_type}`]||0)+1});
  const platformCounts={};d.sessions.forEach((s)=>{const p=s.platform||'web';platformCounts[p]=(platformCounts[p]||0)+1});
  return {totalSeconds,last7Seconds:last7.reduce((a,s)=>a+Number(s.active_seconds||0),0),last7Sessions:last7.length,avgSession:d.sessions.length?Math.round(totalSeconds/d.sessions.length):0,lastSeen:d.sessions[0]?.last_seen_at||d.sessions[0]?.started_at||null,topPlatform:Object.entries(platformCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—',benefits:d.interactions.filter((i)=>i.event_type==='benefit').length,whatsapp:d.interactions.filter((i)=>i.event_type==='whatsapp').length,topEvents:Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8)};
}
function buildTimeline(d){return [...d.missions.map((x)=>({id:`m-${x.mission_key}-${x.mission_date}`,type:'mission',title:`Missão: ${MISSION_LABELS[x.mission_key]||humanize(x.mission_key)}`,subtitle:x.mission_date,at:x.completed_at||`${x.mission_date}T12:00:00-03:00`})),...d.votes.map((x)=>({id:`v-${x.id}`,type:'hype',title:`Hype no quadro ${humanize(x.quadro)}`,subtitle:x.hype_date,at:x.created_at})),...d.events.map((x)=>({id:`e-${x.id}`,type:'event',title:humanize(x.event_type),subtitle:x.path||x.entity_type||'Ação no app',at:x.created_at})),...d.impulsions.map((x)=>({id:`i-${x.id}`,type:'impulse',title:`Impulsão ${x.reference_code}`,subtitle:humanize(x.status),at:x.created_at}))].filter((x)=>x.at).sort((a,b)=>new Date(b.at)-new Date(a.at))}
function Mini({icon:Icon,label,value,note}){return <article><Icon/><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function Fact({label,value}){return <div><small>{label}</small><b>{value}</b></div>}
function Adjust({title,value,setValue,onApply,busy}){return <div className="adjustCard"><b>{title}</b><input type="number" value={value} onChange={(e)=>setValue(e.target.value)}/><button disabled={busy||!Number.isFinite(Number(value))||Number(value)===0} onClick={onApply}>Aplicar ajuste</button></div>}
function formatDuration(seconds){const s=Math.max(0,Number(seconds||0));if(s<60)return `${s}s`;const m=Math.floor(s/60);if(m<60)return `${m}min`;const h=Math.floor(m/60),rm=m%60;return `${h}h ${rm}min`}
function humanize(value=''){return String(value).replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase())}
function adminError(message=''){if(message.includes('reason_required'))return'Motivo obrigatório.';if(message.includes('not_authorized'))return'Sua conta não possui autorização administrativa.';if(message.includes('invalid_delta'))return'Ajuste fora do limite permitido.';if(message.includes('invalid_value'))return'Valor inválido.';if(message.includes('invalid_mission'))return'Missão inválida.';return'Não foi possível aplicar a correção. Verifique a auditoria e tente novamente.'}