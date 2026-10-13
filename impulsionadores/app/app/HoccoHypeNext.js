'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Bell, Camera, CheckCircle2, ChevronRight, Clock3, Download, ExternalLink,
  Flame, Gift, HeartHandshake, Home, LockKeyhole, LogOut, QrCode, RefreshCw,
  Share2, Sparkles, Tag, Target, User, X, Youtube, Zap, Gamepad2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, todayBR } from '../../lib/config';
import { pixPayload } from '../../lib/pix';
import { MINIGAMES, MiniGamesModal } from '../components/Minigames';

const IMPULSE_PRESETS=[3,5,10,25,50,100];
const DROP_LIVE=new Set(['published','eligibility_closed','drawn','completed']);
const SPONSOR_BOARD={inicio:1,ofertas:2,missoes:3,drops:4,perfil:5};

function firstName(name='Membro'){return String(name).trim().split(/\s+/)[0]||'Membro'}
function safeDate(value){if(!value)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(value))}
function dropStatus(status){return ({published:'ABERTO',eligibility_closed:'ELEGIBILIDADE FECHADA',drawn:'RODADA REALIZADA',completed:'ENCERRADO',inscrito:'INSCRITO',elegivel:'ELEGÍVEL',nao_elegivel:'NÃO ELEGÍVEL',selecionado:'SELECIONADO',suplente:'SUPLENTE',nao_selecionado:'NÃO SELECIONADO',confirmado:'CONFIRMADO',entregue:'ENTREGUE'})[status]||String(status||'').toUpperCase()}

export default function HoccoHypeNext(){
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [daily,setDaily]=useState(null);
  const [activeDays30,setActiveDays30]=useState(0);
  const [offers,setOffers]=useState([]);
  const [offerProgress,setOfferProgress]=useState({count:0,completed:false});
  const [offerFilter,setOfferFilter]=useState('Todos');
  const [drops,setDrops]=useState([]);
  const [dropRegs,setDropRegs]=useState([]);
  const [dropEligibility,setDropEligibility]=useState({});
  const [selectedDrop,setSelectedDrop]=useState(null);
  const [sponsors,setSponsors]=useState({1:[],2:[],3:[],4:[],5:[]});
  const [youtubeVisited,setYoutubeVisited]=useState(false);
  const [dailyGame,setDailyGame]=useState('pulso');
  const [miniGameDone,setMiniGameDone]=useState(false);
  const [gameOpen,setGameOpen]=useState(false);
  const [impulsions,setImpulsions]=useState([]);
  const [impulseOpen,setImpulseOpen]=useState(false);
  const [activeImpulse,setActiveImpulse]=useState(null);
  const [impulseAmount,setImpulseAmount]=useState(3);
  const [customImpulse,setCustomImpulse]=useState('');
  const [impulseCredits,setImpulseCredits]=useState(false);
  const [busyImpulse,setBusyImpulse]=useState(false);
  const [edit,setEdit]=useState(false);
  const [tab,setTab]=useState('inicio');
  const [toast,setToast]=useState('');
  const [busy,setBusy]=useState(null);
  const [installed,setInstalled]=useState(false);
  const sessionRef=useRef(null);
  const activeSecondsRef=useRef(0);
  const visibleSinceRef=useRef(Date.now());
  const toastTimer=useRef(null);

  useEffect(()=>{
    let alive=true;
    supabase.auth.getUser().then(({data,error})=>{
      if(error||!data.user) location.replace('/');
      else if(alive) setUser(data.user);
    });
    const {data:auth}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'||!session?.user) location.replace('/'); else setUser(session.user);
    });
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true||localStorage.getItem('hocco_app_installed')==='1';
    setInstalled(Boolean(standalone));
    return()=>{alive=false;auth.subscription.unsubscribe();clearTimeout(toastTimer.current)};
  },[]);

  useEffect(()=>{
    if(!user)return;
    let heartbeat;let closed=false;
    const accumulate=()=>{
      if(document.visibilityState==='visible'&&visibleSinceRef.current)activeSecondsRef.current+=Math.max(0,Math.floor((Date.now()-visibleSinceRef.current)/1000));
      visibleSinceRef.current=document.visibilityState==='visible'?Date.now():null;
    };
    const flush=async()=>{if(!sessionRef.current)return;accumulate();await supabase.from('impulsionadores_sessoes').update({active_seconds:activeSecondsRef.current}).eq('id',sessionRef.current)};
    const vis=()=>accumulate();
    (async()=>{
      await ensureProfile(user);
      const {data:session}=await supabase.from('impulsionadores_sessoes').insert({user_id:user.id,platform:navigator.userAgentData?.platform||navigator.platform||'web',user_agent:navigator.userAgent,path:'/app'}).select('id').single();
      if(!closed&&session)sessionRef.current=session.id;
      activeSecondsRef.current=0;visibleSinceRef.current=document.visibilityState==='visible'?Date.now():null;
      await refreshAll(user);
      if(!closed){heartbeat=setInterval(flush,30000);document.addEventListener('visibilitychange',vis)}
    })();
    return()=>{closed=true;clearInterval(heartbeat);document.removeEventListener('visibilitychange',vis);flush()};
  },[user?.id]);

  useEffect(()=>{if(user&&['inicio','ofertas'].includes(tab)) registerVisibleImpressions()},[tab,user?.id,offers.length]);

  async function ensureProfile(currentUser){
    let {data:p}=await supabase.from('impulsionadores_perfis').select('*').eq('user_id',currentUser.id).maybeSingle();
    if(!p){const created=await supabase.from('impulsionadores_perfis').insert({user_id:currentUser.id,nome_publico:currentUser.user_metadata?.full_name||currentUser.email?.split('@')[0]||'Membro HOCCO'}).select().single();p=created.data}
    if(p)setProfile(p);
  }

  async function refreshAll(currentUser=user){
    if(!currentUser)return;
    await Promise.allSettled([loadProfile(currentUser),loadDaily(currentUser),loadOffers(),loadDrops(currentUser),loadSponsors(),loadImpulsions(currentUser)]);
  }

  async function loadProfile(currentUser=user){
    const since=new Date();since.setDate(since.getDate()-29);const sinceDate=since.toISOString().slice(0,10);
    const [pRes,daysRes]=await Promise.all([
      supabase.from('impulsionadores_perfis').select('*').eq('user_id',currentUser.id).single(),
      supabase.from('hc_diario').select('activity_date').eq('user_id',currentUser.id).gte('activity_date',sinceDate),
    ]);
    if(pRes.data)setProfile(pRes.data);if(!daysRes.error)setActiveDays30((daysRes.data||[]).length);
  }

  async function loadDaily(currentUser=user){
    const date=todayBR();
    const [hcRes,youtubeRes,gameRes,selectedGame,offerMission]=await Promise.all([
      supabase.from('hc_diario').select('*').eq('user_id',currentUser.id).eq('activity_date',date).maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key').eq('user_id',currentUser.id).eq('mission_date',date).eq('mission_key','youtube_channel_visit').maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key').eq('user_id',currentUser.id).eq('mission_date',date).eq('mission_key','minigame_daily').maybeSingle(),
      supabase.rpc('get_daily_minigame'),
      supabase.rpc('oferta_missao_progresso'),
    ]);
    setDaily(hcRes.data||{hc_earned:0,frequency_hc:0,hype_hc:0,missions_completed:0});
    setYoutubeVisited(Boolean(youtubeRes.data));setMiniGameDone(Boolean(gameRes.data));setDailyGame(selectedGame.data||'pulso');
    if(offerMission.data)setOfferProgress(offerMission.data);
  }

  async function loadOffers(){
    const {data,error}=await supabase.from('hocco_ofertas').select('id,nome_fantasia,logo_url,capa_url,instagram,categoria,segmento,titulo,oferta_texto,descricao,destino_url,display_date,starts_at,ends_at,impressoes,cliques,status').eq('status','active').eq('display_date',todayBR()).order('created_at',{ascending:false}).limit(50);
    if(!error)setOffers(data||[]);
  }

  async function loadSponsors(){
    const pairs=await Promise.all([1,2,3,4,5].map(async(q)=>{const {data}=await supabase.rpc('marcas_permanentes_ativas',{p_quadro:q});return [q,(data||[]).slice(0,5)]}));
    const map={1:[],2:[],3:[],4:[],5:[]};pairs.forEach(([q,rows])=>map[q]=rows);setSponsors(map);
  }

  async function loadDrops(currentUser=user){
    const since=new Date(Date.now()-30*86400000).toISOString();
    const [dRes,rRes]=await Promise.all([
      supabase.from('hocco_drops').select('id,titulo,mensagem,etiqueta,benefit,image_url,local_info,public_rules,opportunity_type,eligibility_mode,min_hc,min_xp,min_streak,min_active_days_30,min_missions_30,min_level,slots,waitlist_size,sponsor_name_snapshot,sponsor_logo_url_snapshot,starts_at,ends_at,status,priority').in('status',[...DROP_LIVE]).gte('ends_at',since).order('priority',{ascending:false}).order('starts_at',{ascending:false}).limit(30),
      supabase.from('hocco_drop_inscricoes').select('*').eq('user_id',currentUser.id).order('enrolled_at',{ascending:false}).limit(100),
    ]);
    const rows=dRes.data||[];setDrops(rows);setDropRegs(rRes.data||[]);
    const checks=await Promise.all(rows.map(async d=>{const {data}=await supabase.rpc('hocco_drop_eligibility',{p_drop_id:d.id,p_user_id:currentUser.id});return[d.id,data||null]}));
    const map={};checks.forEach(([id,e])=>map[id]=e);setDropEligibility(map);
  }

  async function loadImpulsions(currentUser=user){const {data}=await supabase.from('impulsionadores_impulsoes').select('id,reference_code,status,created_at,amount').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(20);setImpulsions(data||[])}

  async function registerVisibleImpressions(){
    if(!user||!offers.length)return;
    const visible=tab==='inicio'?offers.slice(0,6):offers;
    await Promise.allSettled(visible.map(o=>supabase.rpc('registrar_oferta_evento',{p_oferta_id:o.id,p_event:'impression'})));
  }

  async function openOffer(offer){
    setBusy(`offer-${offer.id}`);
    const {data,error}=await supabase.rpc('registrar_oferta_evento',{p_oferta_id:offer.id,p_event:'click'});
    setBusy(null);
    if(error)return flash('Esta oferta não está disponível agora.');
    if(data)window.open(data,'_blank','noopener,noreferrer');
    await Promise.all([loadDaily(),loadProfile(),loadOffers()]);
  }

  async function visitYoutube(){
    window.open('https://www.youtube.com/@hoccpov','_blank','noopener,noreferrer');
    if(youtubeVisited)return;
    const {error}=await supabase.from('impulsionadores_missoes_diarias').insert({user_id:user.id,mission_date:todayBR(),mission_key:'youtube_channel_visit',metadata:{channel:'@hoccpov'}});
    if(error&&error.code!=='23505')return flash('O canal abriu, mas a missão não pôde ser registrada.');
    await Promise.all([loadDaily(),loadProfile()]);flash('Missão concluída. +5 XP.');
  }

  async function completeMiniGame(key,result){
    if(key!==dailyGame)return flash(`A missão de hoje é ${MINIGAMES[dailyGame]?.name||'outro jogo'}.`);
    if(miniGameDone)return flash('Missão de minigame já concluída hoje.');
    const {error}=await supabase.from('impulsionadores_missoes_diarias').insert({user_id:user.id,mission_date:todayBR(),mission_key:'minigame_daily',metadata:{game_key:key,result}});
    if(error&&error.code!=='23505')return flash('A partida terminou, mas a missão não pôde ser validada.');
    setMiniGameDone(true);await Promise.all([loadDaily(),loadProfile()]);flash(`${MINIGAMES[key]?.name||'Minigame'} concluído. +5 XP.`);
  }

  async function participateDrop(drop){
    setBusy(`drop-${drop.id}`);const {error}=await supabase.rpc('participar_drop',{p_drop_id:drop.id});setBusy(null);
    if(error)return flash(String(error.message||'').includes('not_eligible')?'Você ainda não cumpre os requisitos.':'Não foi possível participar agora.');
    await loadDrops();flash('Participação registrada para a rodada HOCCO.');
  }

  async function confirmDrop(drop){
    setBusy(`drop-${drop.id}`);const {error}=await supabase.rpc('confirmar_selecao_drop',{p_drop_id:drop.id});setBusy(null);
    if(error)return flash('Não foi possível confirmar sua seleção.');await loadDrops();flash('Participação confirmada.');
  }

  async function createImpulse(){
    const amount=customImpulse?Number(String(customImpulse).replace(',','.')):Number(impulseAmount);
    if(!Number.isFinite(amount)||amount<3)return flash('A Impulsão mínima é de R$ 3,00.');
    setBusyImpulse(true);const {data,error}=await supabase.from('impulsionadores_impulsoes').insert({user_id:user.id,amount:Math.round(amount*100)/100,creditos_publicos:impulseCredits}).select().single();setBusyImpulse(false);
    if(error)return flash('Não foi possível criar sua Impulsão agora.');setActiveImpulse(data);await loadImpulsions();
  }

  async function reportImpulse(){if(!activeImpulse)return;const {data,error}=await supabase.rpc('informar_impulsao_pagamento',{p_id:activeImpulse.id});if(error)return flash('Não foi possível informar o pagamento.');setActiveImpulse(data||{...activeImpulse,status:'pagamento_informado'});flash('Pagamento informado. A HOCCO fará a conferência.');await loadImpulsions()}

  async function uploadAvatar(event){
    const file=event.target.files?.[0];if(!file||file.size>5*1024*1024)return flash('Use uma imagem de até 5 MB.');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${user.id}/avatar.${ext}`;
    const up=await supabase.storage.from('impulsionadores-avatars').upload(path,file,{upsert:true,contentType:file.type});if(up.error)return flash('Não foi possível enviar a foto.');
    const {data}=supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);await supabase.from('impulsionadores_perfis').update({avatar_url:`${data.publicUrl}?v=${Date.now()}`,updated_at:new Date().toISOString()}).eq('user_id',user.id);loadProfile();
  }

  async function saveProfile(event){event.preventDefault();const form=new FormData(event.currentTarget);const name=String(form.get('nome')||'').trim().slice(0,40);if(name.length<2)return flash('Informe um nome válido.');const {error}=await supabase.from('impulsionadores_perfis').update({nome_publico:name,username:String(form.get('username')||'').replace(/^@/,'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,30)||null,bio:String(form.get('bio')||'').trim().slice(0,160)||null,updated_at:new Date().toISOString()}).eq('user_id',user.id);if(error)return flash('Não foi possível salvar o perfil.');setEdit(false);loadProfile()}

  async function share(){const payload={title:'HOCCO Hype',text:'Ofertas, Drops e benefícios da comunidade HOCCO.',url:location.origin};try{if(navigator.share)await navigator.share(payload);else{await navigator.clipboard?.writeText(payload.url);flash('Link copiado.')}}catch(e){if(e?.name!=='AbortError')flash('Não foi possível compartilhar.')}}
  function flash(message){clearTimeout(toastTimer.current);setToast(message);toastTimer.current=setTimeout(()=>setToast(''),4200)}

  const frequency=Math.min(100,Math.round((activeDays30/30)*100));
  const categories=useMemo(()=>['Todos',...Array.from(new Set(offers.map(o=>o.categoria).filter(Boolean)))],[offers]);
  const filteredOffers=offerFilter==='Todos'?offers:offers.filter(o=>o.categoria===offerFilter);
  const hc=Number(profile?.hc||0),dailyHC=Number(daily?.hc_earned||0);
  const completedImpulsions=impulsions.filter(i=>i.status==='confirmada').length;
  const nav=[['inicio',Home,'Início'],['ofertas',Tag,'Ofertas'],['missoes',Target,'Missões'],['drops',Gift,'Drops'],['perfil',User,'Perfil']];

  if(!profile)return <div className="hh-splash"><b>HOCCO <i>Hype</i></b><span>Preparando sua comunidade...</span></div>;

  return <main className="hh-app">
    <header className="hh-top"><div className="hh-brand"><b>HOCCO</b><i>Hype</i></div><div className="hh-top-actions"><button aria-label="Notificações"><Bell/></button><button className="hh-avatar" onClick={()=>setTab('perfil')}>{profile.avatar_url?<img src={profile.avatar_url} alt="Perfil"/>:<span>{profile.nome_publico?.[0]||'H'}</span>}</button></div></header>

    <section className="hh-main">
      {tab==='inicio'&&<HomeView profile={profile} dailyHC={dailyHC} frequency={frequency} offers={offers} progress={offerProgress} drops={drops} eligibility={dropEligibility} sponsors={sponsors[1]} onOffer={openOffer} onOffers={()=>setTab('ofertas')} onMissions={()=>setTab('missoes')} onDrops={()=>setTab('drops')} onDrop={(d)=>{setSelectedDrop(d);setTab('drops')}} onImpulse={()=>{setActiveImpulse(null);setImpulseOpen(true)}}/>}
      {tab==='ofertas'&&<OffersView offers={filteredOffers} categories={categories} filter={offerFilter} setFilter={setOfferFilter} progress={offerProgress} sponsors={sponsors[2]} busy={busy} onOpen={openOffer} onBusiness={()=>location.href='/empresa'}/>} 
      {tab==='missoes'&&<MissionsView daily={daily} profile={profile} frequency={frequency} progress={offerProgress} youtubeVisited={youtubeVisited} miniGameDone={miniGameDone} dailyGame={dailyGame} sponsors={sponsors[3]} onOffers={()=>setTab('ofertas')} onYoutube={visitYoutube} onGame={()=>setGameOpen(true)}/>} 
      {tab==='drops'&&<DropsView drops={drops} regs={dropRegs} eligibility={dropEligibility} selected={selectedDrop} setSelected={setSelectedDrop} sponsors={sponsors[4]} busy={busy} onParticipate={participateDrop} onConfirm={confirmDrop}/>} 
      {tab==='perfil'&&<ProfileView profile={profile} user={user} frequency={frequency} edit={edit} setEdit={setEdit} uploadAvatar={uploadAvatar} saveProfile={saveProfile} sponsors={sponsors[5]} impulsions={impulsions} confirmed={completedImpulsions} onImpulse={()=>{setActiveImpulse(null);setImpulseOpen(true)}} onShare={share} installed={installed}/>} 
    </section>

    <nav className="hh-nav">{nav.map(([key,Icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);if(key!=='drops')setSelectedDrop(null)}}><Icon/><span>{label}</span></button>)}</nav>
    {impulseOpen&&<ImpulseModal active={activeImpulse} amount={impulseAmount} setAmount={(v)=>{setImpulseAmount(v);setCustomImpulse('')}} custom={customImpulse} setCustom={setCustomImpulse} credits={impulseCredits} setCredits={setImpulseCredits} onCreate={createImpulse} onReport={reportImpulse} busy={busyImpulse} onClose={()=>{setImpulseOpen(false);setActiveImpulse(null)}}/>}
    {gameOpen&&<MiniGamesModal dailyGame={dailyGame} doneToday={miniGameDone} onFinish={completeMiniGame} onClose={()=>setGameOpen(false)}/>} 
    {toast&&<div className="hh-toast">{toast}</div>}
  </main>;
}

function HomeView({profile,dailyHC,frequency,offers,progress,drops,eligibility,sponsors,onOffer,onOffers,onMissions,onDrops,onDrop,onImpulse}){
  return <>
    <section className="hh-greeting"><div><small>COMUNIDADE HOCCO</small><h1>Olá, {firstName(profile.nome_publico)}.</h1><p>Ofertas reais, missões, Drops e benefícios para quem participa.</p></div><div className="hh-streak"><Flame/><b>{profile.ofensiva_dias}</b><span>dias</span></div></section>
    <div className="hh-stats"><Stat icon={Sparkles} value={`${profile.hc}`} label="HC"/><Stat icon={Zap} value={`${profile.xp}`} label="XP"/><Stat icon={Flame} value={`${profile.ofensiva_dias}`} label="Ofensiva"/><Stat icon={Award} value={`${frequency}%`} label="Frequência"/></div>
    <SectionTitle icon={Tag} title="Ofertas do Momento" action="Ver todas" onAction={onOffers}/>
    <div className="hh-offer-scroll">{offers.slice(0,6).map(o=><OfferCard key={o.id} offer={o} onOpen={onOffer}/>) }{!offers.length&&<Empty title="As ofertas de hoje estão sendo preparadas."/>}</div>
    <section className="hh-mission-feature" onClick={onMissions}><div className="hh-mission-icon"><Target/></div><div><small>MISSÃO EM DESTAQUE</small><h2>Folhear descontos</h2><p>Abra 5 ofertas diferentes hoje e complete a missão.</p><div className="hh-progress"><i style={{width:`${Math.min(100,(Number(progress.count||0)/5)*100)}%`}}/></div><span>{progress.count||0}/5</span></div><div className="hh-rewards"><b>+2 HC</b><strong>+10 XP</strong></div><ChevronRight/></section>
    <SectionTitle icon={Gift} title="Drops" action="Ver todos" onAction={onDrops}/>
    <div className="hh-drop-mini-grid">{drops.slice(0,3).map(d=><button key={d.id} onClick={()=>onDrop(d)}><div>{d.sponsor_logo_url_snapshot?<img src={d.sponsor_logo_url_snapshot} alt=""/>:<Gift/>}</div><b>{d.titulo}</b><span>{eligibility[d.id]?.eligible?'Elegível':d.min_hc!=null?`≥ ${d.min_hc} HC`:'Ver requisitos'}</span></button>)}{!drops.length&&<Empty title="Nenhum Drop aberto agora."/>}</div>
    <SponsorStrip rows={sponsors} title="Marcas parceiras"/>
    <div className="hh-home-actions"><button onClick={onImpulse}><HeartHandshake/><span><b>Fazer uma Impulsão</b><small>Apoio voluntário à HOCCO</small></span><ChevronRight/></button><button onClick={()=>location.href='/empresa'}><Tag/><span><b>Publicar uma oferta</b><small>R$ 39,90 por dia</small></span><ChevronRight/></button></div>
    <div className="hh-daily-note"><CheckCircle2/><span>Hoje: <b>{dailyHC}/3 HC</b> possíveis no ciclo diário · presença + ofertas.</span></div>
  </>;
}

function OffersView({offers,categories,filter,setFilter,progress,sponsors,busy,onOpen,onBusiness}){
  return <><div className="hh-page-title"><small>DESCONTOS REAIS NO DIA A DIA</small><h1>Ofertas do Momento</h1><p>Promoções e serviços publicados hoje por empresas da comunidade.</p></div>
    <section className="hh-offer-mission"><Target/><div><small>MISSÃO DE HOJE</small><b>Folhear 5 ofertas diferentes</b><span>{progress.completed?'Concluída · +2 HC e +10 XP':`${progress.count||0}/5 abertas`}</span></div><div className="hh-progress"><i style={{width:`${Math.min(100,(Number(progress.count||0)/5)*100)}%`}}/></div></section>
    <div className="hh-chips">{categories.map(c=><button className={filter===c?'active':''} key={c} onClick={()=>setFilter(c)}>{c}</button>)}</div>
    <div className="hh-offer-grid">{offers.map(o=><OfferCard key={o.id} offer={o} onOpen={onOpen} busy={busy===`offer-${o.id}`}/>)}{!offers.length&&<Empty title="Nenhuma oferta nesta categoria hoje."/>}</div>
    <SponsorStrip rows={sponsors} title="Marcas que apoiam as ofertas"/>
    <button className="hh-business-banner" onClick={onBusiness}><Tag/><span><b>Sua empresa tem uma promoção hoje?</b><small>Publique por R$ 39,90/dia e leve o cliente direto ao seu link.</small></span><ChevronRight/></button>
  </>;
}

function MissionsView({daily,profile,frequency,progress,youtubeVisited,miniGameDone,dailyGame,sponsors,onOffers,onYoutube,onGame}){
  return <><div className="hh-page-title"><small>CONSTÂNCIA E PARTICIPAÇÃO</small><h1>Missões</h1><p>Ganhe HC e XP participando de forma real. Quebrar a sequência reinicia a ofensiva; o HC já conquistado permanece.</p></div>
    <div className="hh-stats hh-mission-stats"><Stat icon={Sparkles} value={`${daily?.hc_earned||0}/3`} label="HC hoje"/><Stat icon={Flame} value={`${profile.ofensiva_dias}`} label="Ofensiva"/><Stat icon={Award} value={`${frequency}%`} label="Frequência 30d"/></div>
    <div className="hh-mission-list">
      <MissionRow done={Number(daily?.frequency_hc||0)>=1} icon={Flame} title="Presença diária" text="Entrar em um novo dia mantém a frequência." reward="+1 HC · +5 XP"/>
      <button className={progress.completed?'done':''} onClick={onOffers}><span><Tag/></span><div><b>Folhear descontos</b><small>Abra 5 ofertas diferentes do dia.</small></div><em>{progress.completed?'+2 HC · +10 XP · FEITO':`${progress.count||0}/5 · +2 HC`}</em><ChevronRight/></button>
      <button className={youtubeVisited?'done':''} onClick={onYoutube}><span><Youtube/></span><div><b>Canal oficial HOCCO</b><small>Visite @hoccpov no YouTube.</small></div><em>{youtubeVisited?'+5 XP · FEITO':'+5 XP'}</em><ChevronRight/></button>
      <button className={miniGameDone?'done':''} onClick={onGame}><span><Gamepad2/></span><div><b>{MINIGAMES[dailyGame]?.name||'Minigame HOCCO'}</b><small>Complete o jogo escolhido para hoje.</small></div><em>{miniGameDone?'+5 XP · FEITO':'+5 XP'}</em><ChevronRight/></button>
    </div>
    <section className="hh-access-scale"><h2>Seu acesso cresce com você</h2><div><span><b>100+ HC</b><small>Começa a entrar em Drops</small></span><span><b>500+ HC</b><small>Oportunidades ligadas diretamente às empresas</small></span></div></section>
    <SponsorStrip rows={sponsors} title="Marcas que apoiam suas missões"/>
  </>;
}

function DropsView({drops,regs,eligibility,selected,setSelected,sponsors,busy,onParticipate,onConfirm}){
  const chosen=selected||drops[0]||null;const reg=chosen?regs.find(r=>r.drop_id===chosen.id):null;const elig=chosen?eligibility[chosen.id]:null;
  return <><div className="hh-page-title"><small>BENEFÍCIOS · PRODUTOS · EXPERIÊNCIAS</small><h1>Drops</h1><p>Cumpra os requisitos, entre na rodada e acompanhe sua participação.</p></div>
    <div className="hh-drop-layout"><aside>{drops.map(d=>{const r=regs.find(x=>x.drop_id===d.id),e=eligibility[d.id];return <button className={chosen?.id===d.id?'active':''} key={d.id} onClick={()=>setSelected(d)}><div>{d.sponsor_logo_url_snapshot?<img src={d.sponsor_logo_url_snapshot} alt=""/>:<Gift/>}</div><span><b>{d.titulo}</b><small>{r?dropStatus(r.status):e?.eligible?'VOCÊ ESTÁ ELEGÍVEL':dropStatus(d.status)}</small></span><ChevronRight/></button>})}{!drops.length&&<Empty title="Nenhum Drop disponível agora."/>}</aside>
      {chosen&&<article className="hh-drop-detail">{chosen.image_url&&<img className="hh-drop-hero" src={chosen.image_url} alt=""/>}<div className="hh-drop-head"><div><small>{chosen.etiqueta||'DROP HOCCO'}</small><h2>{chosen.titulo}</h2>{chosen.sponsor_name_snapshot&&<p>Oferecido por <b>{chosen.sponsor_name_snapshot}</b></p>}</div><span>{reg?dropStatus(reg.status):dropStatus(chosen.status)}</span></div><p className="hh-drop-benefit">{chosen.benefit||chosen.mensagem}</p><div className="hh-drop-facts"><span><Gift/> {chosen.slots} vagas</span><span><Clock3/> até {safeDate(chosen.ends_at)}</span>{chosen.local_info&&<span>{chosen.local_info}</span>}</div><DropRequirements data={elig}/><div className="hh-random"><Sparkles/><p><b>Rodada HOCCO.</b> Se houver mais elegíveis do que vagas, a seleção é aleatória entre os participantes elegíveis e fica registrada.</p></div>{!reg&&chosen.status==='published'&&<button className="hh-primary" disabled={!elig?.eligible||busy===`drop-${chosen.id}`} onClick={()=>onParticipate(chosen)}>{elig?.eligible?'PARTICIPAR DA RODADA':'CUMPRA OS REQUISITOS'}</button>}{reg?.status==='selecionado'&&<button className="hh-primary" onClick={()=>onConfirm(chosen)}>CONFIRMAR PARTICIPAÇÃO</button>}{reg&&reg.status!=='selecionado'&&<div className="hh-state"><CheckCircle2/><span><b>{dropStatus(reg.status)}</b><small>Sua participação está registrada.</small></span></div>}</article>}
    </div><SponsorStrip rows={sponsors} title="Marcas que criam oportunidades"/></>;
}

function ProfileView({profile,user,frequency,edit,setEdit,uploadAvatar,saveProfile,sponsors,impulsions,confirmed,onImpulse,onShare,installed}){
  return <><section className="hh-profile"><label>{profile.avatar_url?<img src={profile.avatar_url} alt="Foto"/>:<span>{profile.nome_publico?.[0]||'H'}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/><i><Camera/></i></label><div><small>MEMBRO HOCCO HYPE</small><h1>{profile.nome_publico}</h1><p>{profile.username?`@${profile.username}`:user?.email}</p></div></section>
    <div className="hh-profile-stats"><Stat icon={Sparkles} value={profile.hc} label="HC"/><Stat icon={Zap} value={profile.xp} label="XP"/><Stat icon={Flame} value={profile.ofensiva_dias} label="Ofensiva"/><Stat icon={Award} value={`${frequency}%`} label="Frequência"/></div>
    {edit?<form className="hh-edit" onSubmit={saveProfile}><label>Nome público<input name="nome" defaultValue={profile.nome_publico} required/></label><label>@ na comunidade<input name="username" defaultValue={profile.username||''}/></label><label>Sobre você<textarea name="bio" defaultValue={profile.bio||''}/></label><div><button type="button" onClick={()=>setEdit(false)}>CANCELAR</button><button className="hh-primary">SALVAR</button></div></form>:<button className="hh-outline" onClick={()=>setEdit(true)}>EDITAR PERFIL</button>}
    <SponsorStrip rows={sponsors} title="Marcas que caminham com você"/>
    <section className="hh-profile-card"><div className="hh-section-title"><div><small>MINHAS IMPULSÕES</small><h2>{confirmed} apoios confirmados</h2></div><button onClick={onImpulse}>NOVA</button></div>{impulsions.slice(0,5).map(i=><div className="hh-history" key={i.id}><span><b>{i.reference_code}</b><small>{safeDate(i.created_at)} · {String(i.status).replaceAll('_',' ')}</small></span><strong>APOIO</strong></div>)}{!impulsions.length&&<p>Nenhuma Impulsão registrada ainda.</p>}</section>
    <div className="hh-profile-links"><button onClick={onShare}><Share2/> Compartilhar HOCCO Hype</button>{!installed&&<button onClick={()=>alert('Abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.')}><Download/> Instalar app</button>}<a href="/termos">Termos</a><a href="/privacidade">Privacidade</a><button className="danger" onClick={async()=>{await supabase.auth.signOut();location.replace('/')}}><LogOut/> Sair da conta</button></div>
  </>;
}

function OfferCard({offer,onOpen,busy}){return <article className="hh-offer-card"><div className="hh-offer-cover" style={{backgroundImage:`url(${offer.capa_url})`}}><span>{offer.categoria}</span></div><div className="hh-offer-company">{offer.logo_url?<img src={offer.logo_url} alt=""/>:<i>{offer.nome_fantasia?.[0]}</i>}<div><b>{offer.nome_fantasia}</b><small>{offer.instagram||offer.segmento||offer.categoria}</small></div></div><h3>{offer.oferta_texto}</h3><p>{offer.titulo}</p><small className="hh-valid"><Clock3/> Válido hoje</small><button disabled={busy} onClick={()=>onOpen(offer)}>{busy?'ABRINDO...':'VER OFERTA'} <ExternalLink/></button></article>}

function SponsorStrip({rows=[],title}){if(!rows.length)return null;return <section className="hh-sponsors"><div><small>{title}</small><span>Somente logos · acesso direto</span></div><div>{rows.slice(0,5).map(row=><button key={row.id} title={row.nome_fantasia} onClick={async()=>{const {data}=await supabase.rpc('registrar_patrocinio_evento',{p_id:row.id,p_event:'click',p_placement:`app_quadro_${row.quadro}`});if(data)window.open(data,'_blank','noopener,noreferrer')}}><img src={row.logo_url} alt={row.nome_fantasia}/></button>)}</div></section>}

function DropRequirements({data}){if(!data)return <div className="hh-requirements"><p>Carregando elegibilidade...</p></div>;const rows=[data.min_hc!=null&&['HC',Number(data.hc||0),Number(data.min_hc)],data.min_xp!=null&&['XP',Number(data.xp||0),Number(data.min_xp)],data.min_streak!=null&&['Frequência consecutiva',Number(data.streak||0),Number(data.min_streak)],data.min_active_days_30!=null&&['Dias ativos em 30 dias',Number(data.active_days_30||0),Number(data.min_active_days_30)],data.min_missions_30!=null&&['Missões em 30 dias',Number(data.missions_30||0),Number(data.min_missions_30)],data.min_level!=null&&['Nível',Number(data.level||1),Number(data.min_level)]].filter(Boolean);return <section className="hh-requirements"><div><small>ELEGIBILIDADE</small><b className={data.eligible?'ok':''}>{data.eligible?'VOCÊ ESTÁ ELEGÍVEL':'AINDA NÃO ELEGÍVEL'}</b></div><p>{data.eligibility_mode==='all'?'Cumpra todos os requisitos abaixo.':'Cumpra pelo menos um dos requisitos abaixo.'}</p>{rows.map(([label,current,required])=><span key={label} className={current>=required?'ok':''}>{current>=required?<CheckCircle2/>:<LockKeyhole/>}<b>{label}</b><small>{current} / {required}</small></span>)}</section>}

function Stat({icon:Icon,value,label}){return <article className="hh-stat"><Icon/><strong>{value}</strong><span>{label}</span></article>}
function SectionTitle({icon:Icon,title,action,onAction}){return <div className="hh-section-title"><div><Icon/><h2>{title}</h2></div>{action&&<button onClick={onAction}>{action} <ChevronRight/></button>}</div>}
function MissionRow({done,icon:Icon,title,text,reward}){return <article className={done?'done':''}><span><Icon/></span><div><b>{title}</b><small>{text}</small></div><em>{reward}</em>{done&&<CheckCircle2/>}</article>}
function Empty({title}){return <div className="hh-empty"><Sparkles/><b>{title}</b></div>}

function ImpulseModal({active,amount,setAmount,custom,setCustom,credits,setCredits,onCreate,onReport,busy,onClose}){
  const value=active?Number(active.amount):(custom?Number(String(custom).replace(',','.')):amount);const code=active?pixPayload(active.amount,active.reference_code):null;
  return <div className="hh-modal" onClick={onClose}><section onClick={e=>e.stopPropagation()}><button className="hh-modal-close" onClick={onClose}><X/></button><HeartHandshake className="hh-modal-hero"/><small>IMPULSÃO HOCCO</small><h2>{active?'Sua Impulsão está criada.':'Apoie diretamente a HOCCO.'}</h2><p>A Impulsão é apoio voluntário. Depois da confirmação registra +5 XP fixos. Não compra HC, ofertas, Drops ou prioridade.</p>{!active?<><div className="hh-presets">{IMPULSE_PRESETS.map(v=><button key={v} className={!custom&&amount===v?'active':''} onClick={()=>setAmount(v)}>{brl(v)}</button>)}</div><label>Outro valor (mínimo R$ 3)<input inputMode="decimal" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="3,00"/></label><label className="hh-check"><input type="checkbox" checked={credits} onChange={e=>setCredits(e.target.checked)}/> Autorizo meu nome público nos créditos HOCCO.</label><button className="hh-primary" disabled={busy||!Number.isFinite(value)||value<3} onClick={onCreate}>{busy?'CRIANDO...':`GERAR PIX · ${brl(value)}`}</button></>:<><div className="hh-pix"><QRCodeSVG value={code} size={180}/><p><b>{PIX_RECEIVER}</b><br/>{PIX_BANK}<br/>{PIX_CITY} - SP<br/>Ref. {active.reference_code}</p><button className="hh-outline" onClick={()=>navigator.clipboard?.writeText(code)}><QrCode/> COPIAR PIX</button></div><button className="hh-primary" disabled={active.status!=='aguardando_pagamento'} onClick={onReport}>{active.status==='aguardando_pagamento'?'JÁ FIZ O PIX':'PAGAMENTO INFORMADO'}</button></>}</section></div>;
}
