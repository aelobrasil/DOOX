'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Bolt, Building2, Camera, CheckCircle2, ChevronRight, Download, Flame,
  HeartHandshake, Home, LogOut, MessageCircle, QrCode, Sparkles, Target, Trophy,
  User, WalletCards, X, Youtube, Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import {
  HYPE_BOARDS, currentBoard, hypeMoment, isBoardLive, todayBR, whatsappUrl,
  PIX_KEY, PIX_RECEIVER, PIX_BANK, PIX_CITY, brl,
} from '../../lib/config';
import { pixPayload } from '../../lib/pix';

const IMPULSE_PRESETS = [3, 5, 10, 25, 50, 100];

export default function MemberApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [daily, setDaily] = useState(null);
  const [youtubeVisited, setYoutubeVisited] = useState(false);
  const [tab, setTab] = useState('inicio');
  const [board, setBoard] = useState(currentBoard());
  const [agenda, setAgenda] = useState([]);
  const [votes, setVotes] = useState({});
  const [results, setResults] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [applications, setApplications] = useState([]);
  const [community, setCommunity] = useState([]);
  const [impulsions, setImpulsions] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [impulseOpen, setImpulseOpen] = useState(false);
  const [impulseAmount, setImpulseAmount] = useState(3);
  const [customImpulse, setCustomImpulse] = useState('');
  const [impulseCredits, setImpulseCredits] = useState(false);
  const [activeImpulse, setActiveImpulse] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [toast, setToast] = useState('');
  const [busyVote, setBusyVote] = useState(false);
  const [busyImpulse, setBusyImpulse] = useState(false);
  const [edit, setEdit] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const sessionRef = useRef(null);
  const activeSecondsRef = useRef(0);
  const visibleSinceRef = useRef(Date.now());
  const viewedSlotsRef = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.replace('/');
      else if (mounted) setUser(data.user);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) location.replace('/');
      else setUser(session.user);
    });
    const installHandler = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', installHandler);
    const ticker = setInterval(() => setClock(Date.now()), 30000);
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
      window.removeEventListener('beforeinstallprompt', installHandler);
      clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let heartbeat;
    const accumulate = () => {
      if (document.visibilityState === 'visible' && visibleSinceRef.current) {
        activeSecondsRef.current += Math.max(0, Math.floor((Date.now() - visibleSinceRef.current) / 1000));
      }
      visibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;
    };
    const flush = async () => {
      if (!sessionRef.current) return;
      accumulate();
      await supabase.from('impulsionadores_sessoes').update({
        last_seen_at: new Date().toISOString(), active_seconds: activeSecondsRef.current,
      }).eq('id', sessionRef.current);
    };
    const visibilityHandler = () => accumulate();

    (async () => {
      await ensureIdentity(user);
      const { data: session } = await supabase.from('impulsionadores_sessoes').insert({
        user_id: user.id,
        platform: navigator.userAgentData?.platform || navigator.platform || 'web',
        user_agent: navigator.userAgent,
        path: '/app',
      }).select().single();
      if (session) sessionRef.current = session.id;
      activeSecondsRef.current = 0;
      visibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;
      await refreshAll(user);
      heartbeat = setInterval(flush, 30000);
      document.addEventListener('visibilitychange', visibilityHandler);
    })();

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', visibilityHandler);
      flush();
    };
  }, [user?.id]);

  useEffect(() => { if (user) loadHype(board, user); }, [board, user?.id]);

  async function ensureIdentity(currentUser) {
    let { data: p } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (!p) {
      const created = await supabase.from('impulsionadores_perfis').insert({
        user_id: currentUser.id,
        nome_publico: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Membro HOCCO',
      }).select().single();
      p = created.data;
    }
    const phone = String(currentUser.user_metadata?.phone || '').replace(/\D/g, '');
    if (phone) await supabase.from('impulsionadores_contatos').upsert({
      user_id: currentUser.id, email: currentUser.email, telefone: phone, updated_at: new Date().toISOString(),
    });
    setProfile(p);
  }

  async function refreshAll(currentUser = user) {
    if (!currentUser) return;
    await Promise.all([
      loadProfile(currentUser), loadDaily(currentUser), loadHype(board, currentUser), loadResults(),
      loadExperiences(currentUser), loadCommunity(), loadImpulsions(currentUser),
    ]);
  }

  async function loadProfile(currentUser = user) {
    const { data } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).single();
    if (data) setProfile(data);
  }
  async function loadDaily(currentUser = user) {
    const date = todayBR();
    const [{ data: hcData }, { data: youtubeMission }] = await Promise.all([
      supabase.from('hc_diario').select('*').eq('user_id', currentUser.id).eq('activity_date', date).maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key').eq('user_id', currentUser.id).eq('mission_date', date).eq('mission_key', 'youtube_channel_visit').maybeSingle(),
    ]);
    setDaily(hcData || { hc_earned: 0, missions_completed: 1, boards_hyped: 0 });
    setYoutubeVisited(Boolean(youtubeMission));
  }
  async function loadHype(selectedBoard = board, currentUser = user) {
    if (!currentUser) return;
    const date = todayBR();
    const [{ data: slots }, { data: ownVotes }] = await Promise.all([
      supabase.from('hype_agenda').select('*,hype_empresas(*)').eq('hype_date', date).eq('quadro', selectedBoard).neq('status', 'cancelado'),
      supabase.from('hype_votos').select('agenda_id,quadro').eq('user_id', currentUser.id).eq('hype_date', date),
    ]);
    const liveSlots = slots || [];
    setAgenda(liveSlots);
    const map = {};
    (ownVotes || []).forEach((v) => { map[v.quadro] = v.agenda_id; });
    setVotes(map);
    const unseen = liveSlots.filter((slot) => !viewedSlotsRef.current.has(slot.id));
    unseen.forEach((slot) => viewedSlotsRef.current.add(slot.id));
    if (unseen.length) {
      await supabase.from('hype_interacoes').insert(unseen.map((slot) => ({ agenda_id: slot.id, user_id: currentUser.id, event_type: 'view' })));
    }
  }
  async function loadResults() {
    const { data } = await supabase.from('hype_resultados').select('*,hype_empresas(*),hype_agenda(*)').order('hype_date', { ascending: false }).limit(20);
    setResults(data || []);
  }
  async function loadExperiences(currentUser = user) {
    const [{ data: exp }, { data: apps }] = await Promise.all([
      supabase.from('hocco_experiencias').select('*,hype_empresas(nome_fantasia)').in('status', ['publicada','inscricoes_encerradas']).order('created_at', { ascending: false }),
      supabase.from('hocco_experiencia_inscricoes').select('*').eq('user_id', currentUser.id),
    ]);
    setExperiences(exp || []); setApplications(apps || []);
  }
  async function loadCommunity() {
    const { data } = await supabase.from('impulsionadores_perfis').select('user_id,nome_publico,avatar_url,xp,nivel,ofensiva_dias').order('xp', { ascending: false }).limit(8);
    setCommunity(data || []);
  }
  async function loadImpulsions(currentUser = user) {
    const { data } = await supabase.from('impulsionadores_impulsoes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
    setImpulsions(data || []);
  }

  async function logEvent(eventType, entityType, entityId, metadata = {}) {
    if (!user) return;
    await supabase.from('impulsionadores_eventos').insert({
      user_id: user.id, session_id: sessionRef.current, event_type: eventType,
      path: `/app/${tab}`, entity_type: entityType, entity_id: entityId ? String(entityId) : null, metadata,
    });
  }
  async function visitYoutube() {
    if (!user) return;
    window.open('https://www.youtube.com/@hoccpov', '_blank', 'noopener,noreferrer');
    if (youtubeVisited) return;
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({
      user_id: user.id, mission_date: todayBR(), mission_key: 'youtube_channel_visit', metadata: { channel: '@hoccpov' },
    });
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) return showToast('O canal foi aberto, mas a missão não pôde ser registrada agora.');
    setYoutubeVisited(true);
    showToast('Missão concluída: visita ao canal oficial @hoccpov. +5 XP.');
    await Promise.all([loadDaily(), loadProfile()]);
  }
  async function openCompany(slot) {
    await supabase.from('hype_interacoes').insert([
      { agenda_id: slot.id, user_id: user.id, event_type: 'tap' },
      { agenda_id: slot.id, user_id: user.id, event_type: 'detail' },
    ]);
    setSelectedCompany(slot);
  }
  async function voteCompany(slot) {
    if (busyVote || votes[board]) return;
    if (!isBoardLive(board)) return showToast(`O ${HYPE_BOARDS[board].label} funciona das ${HYPE_BOARDS[board].window}.`);
    setBusyVote(true);
    const { error } = await supabase.from('hype_votos').insert({ agenda_id: slot.id, user_id: user.id, hype_date: todayBR(), quadro: board });
    setBusyVote(false);
    if (error) return showToast(error.message.includes('duplicate') ? 'Seu Hype válido deste quadro já foi usado.' : 'Não foi possível registrar este Hype agora.');
    await logEvent('hype_valid', 'empresa', slot.empresa_id, { quadro: board });
    showToast('Hype válido registrado. Seu progresso foi atualizado.');
    await Promise.all([loadHype(board), loadProfile(), loadDaily(), loadCommunity()]);
  }
  async function useCompanyBenefit(slot) {
    const company = slot?.hype_empresas;
    if (!company?.whatsapp) return;
    await supabase.from('hype_interacoes').insert({ agenda_id: slot.id, user_id: user.id, event_type: 'benefit' });
    await logEvent('benefit_open', 'empresa', company.id, { agenda: slot.id });
    setSelectedCompany(slot);
  }
  async function goCompanyWhatsapp(slot) {
    const company = slot?.hype_empresas;
    if (!company?.whatsapp) return;
    await supabase.from('hype_interacoes').insert({ agenda_id: slot.id, user_id: user.id, event_type: 'whatsapp' });
    await logEvent('benefit_whatsapp', 'empresa', company.id, { agenda: slot.id });
    window.open(whatsappUrl(company.whatsapp, `Olá! Vim pelo aplicativo HOCCO e gostaria de utilizar o benefício HOCCO da ${company.nome_fantasia}. Como faço para utilizar?`), '_blank', 'noopener,noreferrer');
  }

  async function applyExperience(exp) {
    if ((profile?.hc || 0) < exp.hc_min) return showToast(`Você precisa de pelo menos ${exp.hc_min} HC para esta experiência.`);
    const { error } = await supabase.from('hocco_experiencia_inscricoes').insert({ experiencia_id: exp.id, user_id: user.id });
    if (error) return showToast(error.message.includes('duplicate') ? 'Você já está inscrito nesta experiência.' : 'Não foi possível registrar sua inscrição.');
    await logEvent('experience_apply', 'experiencia', exp.id);
    showToast('Inscrição recebida. Se houver mais candidatos que vagas, a Curadoria HOCCO fará a seleção.');
    loadExperiences();
  }
  async function confirmExperience(app) {
    const { error } = await supabase.from('hocco_experiencia_inscricoes').update({ status: 'confirmado', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', app.id).eq('user_id', user.id).eq('status', 'selecionado');
    if (error) return showToast('Não foi possível confirmar agora.');
    showToast('Participação confirmada.'); loadExperiences();
  }

  async function createImpulse() {
    const amount = customImpulse ? Number(String(customImpulse).replace(',', '.')) : Number(impulseAmount);
    if (!Number.isFinite(amount) || amount < 3) return showToast('A Impulsão mínima é de R$ 3,00.');
    setBusyImpulse(true);
    const { data, error } = await supabase.from('impulsionadores_impulsoes').insert({
      user_id: user.id, amount: Math.round(amount * 100) / 100, creditos_publicos: impulseCredits,
    }).select().single();
    setBusyImpulse(false);
    if (error) return showToast('Não foi possível criar sua Impulsão agora.');
    setActiveImpulse(data); setImpulseOpen(true); await loadImpulsions();
  }
  async function reportImpulsePayment() {
    if (!activeImpulse) return;
    const { data, error } = await supabase.rpc('informar_impulsao_pagamento', { p_id: activeImpulse.id });
    if (error) return showToast('Não foi possível informar o pagamento agora.');
    const row = Array.isArray(data) ? data[0] : data;
    setActiveImpulse(row || { ...activeImpulse, status: 'pagamento_informado' });
    showToast('Pagamento informado. A HOCCO fará a conferência.');
    loadImpulsions();
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return showToast('Use uma imagem de até 5 MB.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, file, { upsert: true });
    if (error) return showToast('Não foi possível enviar a foto.');
    const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
    await supabase.from('impulsionadores_perfis').update({ avatar_url: `${data.publicUrl}?v=${Date.now()}`, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    loadProfile();
  }
  async function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from('impulsionadores_perfis').update({
      nome_publico: String(form.get('nome')).trim().slice(0, 40),
      username: String(form.get('username')).trim().replace(/^@/, '').slice(0, 30) || null,
      bio: String(form.get('bio')).trim().slice(0, 160) || null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    if (!error) { setEdit(false); loadProfile(); }
  }
  async function install() {
    if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
    else alert('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
  }
  function showToast(message) { setToast(message); setTimeout(() => setToast(''), 4200); }

  const moment = hypeMoment(new Date(clock));
  const overallWinner = useMemo(() => results.find((r) => r.quadro === 'dia'), [results]);
  const boardWinner = useMemo(() => results.find((r) => r.quadro === board), [results, board]);
  const hc = profile?.hc || 0;
  const dailyHC = daily?.hc_earned || 0;
  const boardsHyped = daily?.boards_hyped || 0;
  const dailyMissions = 1 + Math.min(3, boardsHyped) + (youtubeVisited ? 1 : 0);
  const missionProgress = Math.min(100, dailyMissions * 20);
  const totalImpulsed = impulsions.filter((i) => i.status === 'confirmada').reduce((sum, i) => sum + Number(i.amount || 0), 0);

  if (!profile) return <div className="splash"><b>HOCCO</b><span>Ativando sua célula...</span></div>;
  const nav = [['inicio', Home, 'Início'],['hype', Zap, 'Hype'],['missoes', Target, 'Missões'],['experiencias', Award, 'Experiências'],['perfil', User, 'Perfil']];

  return <main className="memberApp">
    <header><b className="logo">HOCCO</b><span className="pill">IMPULSIONADORES</span><div className="hcHeader"><Sparkles/><strong>{hc} HC</strong></div><button className="avatarBtn" onClick={()=>setTab('perfil')}>{profile.avatar_url?<img src={profile.avatar_url} alt="Perfil"/>:<span>{profile.nome_publico[0]}</span>}</button></header>
    <section className="shell liveShell">
      {tab==='inicio' && <>
        <section className="livingHero"><div><small>CÉLULA HOCCO ATIVA</small><h1>Olá, {profile.nome_publico.split(' ')[0]}.</h1><p>Participe dos Hypes, mantenha sua ofensiva, conquiste HC e desbloqueie experiências.</p></div><div className="pulseCore"><Bolt/><span>ATIVO</span></div></section>
        <div className="valueGrid"><Metric icon={Sparkles} value={`${hc} HC`} label="Saldo HC" note="máx. 2 por dia"/><Metric icon={Flame} value={`${profile.ofensiva_dias} dias`} label="Ofensiva" note={`recorde ${profile.maior_ofensiva || profile.ofensiva_dias}`}/><Metric icon={Target} value={`${dailyHC}/2`} label="HC de hoje" note={`${boardsHyped}/3 quadros`}/><Metric icon={Award} value={`Nível ${profile.nivel}`} label="Progressão" note={`${profile.xp} XP`}/></div>
        <section className="nowCard" onClick={()=>{if(moment.board)setBoard(moment.board);setTab('hype')}}><div><small>{moment.closed?'HYPE DE HOJE ENCERRADO':moment.live?'AO VIVO':'PRÓXIMO QUADRO'}</small><h2>{moment.closed?'Hype Almoço · amanhã':HYPE_BOARDS[moment.board]?.label}</h2><p>{moment.closed?'11h–14h':`${HYPE_BOARDS[moment.board]?.window} · até 10 empresas`}</p></div><div className={moment.live?'liveDot on':'liveDot'}>{moment.live?'AO VIVO':moment.closed?'ENCERRADO':'EM BREVE'}</div><ChevronRight/></section>
        <section className="missionPulse"><div className="sectionHead"><div><small>MISSÕES DIÁRIAS</small><h2>Seu dia é validado pelo sistema.</h2></div><strong>{missionProgress}%</strong></div><div className="progress"><div style={{width:`${missionProgress}%`}}/></div><div className="microMissions"><Mission done title="Entrou no app" reward="+5 XP"/><button type="button" className={youtubeVisited?'microMission done':'microMission'} style={{background:youtubeVisited?'#f4f9ff':'#fff',width:'100%',textAlign:'left'}} onClick={visitYoutube}><Youtube style={{color:'#ff0000'}}/><span>Visitar @hoccpov</span><b>{youtubeVisited?'+5 XP · FEITO':'+5 XP'}</b></button><Mission done={boardsHyped>=1} title="Primeiro quadro" reward="+1 HC · +25 XP"/><Mission done={boardsHyped>=2} title="Segundo quadro" reward="+1 HC · +25 XP"/><Mission done={boardsHyped>=3} title="Dia completo" reward="+25 XP"/></div></section>
        {overallWinner&&<WinnerCard result={overallWinner} results={results}/>} 
        <button className="impulseCTA" onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}><HeartHandshake/><div><b>Fazer uma Impulsão</b><span>Apoio voluntário à HOCCO a partir de R$ 3. Não compra HC, Hypes ou prioridade.</span></div><ChevronRight/></button>
        <button className="businessCTA" onClick={()=>location.href='/empresa'}><Building2/><div><b>Quer colocar sua empresa no Hype?</b><span>Cadastro, benefício, quadro e pagamento em um fluxo profissional.</span></div><ChevronRight/></button>
        <button className="installCard" onClick={install}><Download/><div><b>Instalar HOCCO no celular</b><span>Abra mais rápido e mantenha sua conta sincronizada.</span></div></button>
      </>}

      {tab==='hype' && <>
        <Title eyebrow="HYPE DO DIA" title="A comunidade escolhe." text="O plano comercial muda a exposição visual. O resultado depende apenas dos Hypes válidos dos membros."/>
        <div className="boardTabs">{Object.entries(HYPE_BOARDS).map(([key,info])=><button key={key} className={board===key?'active':''} onClick={()=>setBoard(key)}><b>{info.label.replace('Hype ','')}</b><span>{info.window}</span></button>)}</div>
        <div className="boardStatus"><span>{isBoardLive(board)?'● QUADRO AO VIVO':'○ FORA DO HORÁRIO'}</span><b>{agenda.length}/10 empresas</b></div>
        {agenda.length?<div className="hypeField">{agenda.map((slot,index)=>{const company=slot.hype_empresas;const chosen=votes[board]===slot.id;const locked=Boolean(votes[board])&&!chosen;return <article key={slot.id} className={`floatingCompany size-${slot.tamanho} ${chosen?'chosen':''}`} style={{'--delay':`${(index%5)*.55}s`}} onClick={()=>openCompany(slot)}><div className="companyGlow"/>{company?.logo_url?<img src={company.logo_url} alt={company.nome_fantasia}/>:<div className="companyInitial">{company?.nome_fantasia?.[0]||'H'}</div>}<small>{company?.segmento||'Empresa HOCCO'}</small><h3>{company?.nome_fantasia}</h3><span className="discount">{Number(slot.desconto??company?.desconto_padrao??0).toFixed(0)}% OFF</span><button disabled={locked||chosen||busyVote} onClick={(e)=>{e.stopPropagation();voteCompany(slot)}}><Zap/>{chosen?'SEU HYPE':locked?'HYPE USADO':'HYPAR'}</button></article>})}</div>:<Empty icon={Building2} title="Quadro em preparação" text="As empresas aprovadas aparecerão aqui automaticamente."/>}
        <div className="hypeRule"><Zap/><p><b>1 Hype válido por quadro.</b> O pagamento da empresa compra exposição visual, nunca peso de voto.</p></div>
        {boardWinner&&<WinnerCard result={boardWinner} results={results}/>} 
        <button className="businessCTA" onClick={()=>location.href='/empresa'}><Building2/><div><b>Hypar minha empresa</b><span>Participações a partir de R$ 29,90.</span></div><ChevronRight/></button>
      </>}

      {tab==='missoes' && <><Title eyebrow="OFENSIVA HOCCO" title={`${profile.ofensiva_dias} dias de constância`} text="Entrar em um novo dia mantém sua ofensiva. Missões extras podem render XP, mas o teto continua sendo 2 HC por dia."/><div className="hcCap"><Sparkles/><div><small>LIMITE DIÁRIO</small><h2>{dailyHC}/2 HC conquistados hoje</h2><p>Mesmo completando todas as missões, o máximo absoluto é 2 HC por dia.</p></div></div><div className="missionList"><MissionRow done title="Presença HOCCO" text="Entrar no app hoje mantém sua ofensiva." reward="+5 XP"/><button type="button" className={youtubeVisited?'missionRow done':'missionRow'} style={{width:'100%',textAlign:'left',background:youtubeVisited?'#fbfdff':'#fff'}} onClick={visitYoutube}><span style={{color:'#ff0000'}}><Youtube/></span><div><b>Canal oficial HOCCO</b><small>Visite @hoccpov no YouTube uma vez por dia.</small></div><em>{youtubeVisited?'+5 XP · FEITO':'+5 XP'}</em></button><MissionRow done={boardsHyped>=1} title="Primeiro Hype" text="Escolher uma empresa em um quadro válido." reward="+1 HC · +25 XP"/><MissionRow done={boardsHyped>=2} title="Dois momentos" text="Participar de dois quadros diferentes." reward="+1 HC · +25 XP"/><MissionRow done={boardsHyped>=3} title="Dia completo" text="Participar de Almoço, Tarde e Noite." reward="+25 XP"/></div><div className="unlockCard"><Award/><div><small>PORTA DE ENTRADA</small><h2>150 HC desbloqueiam experiências.</h2><p>HC torna você elegível; não compra automaticamente uma vaga.</p></div><strong>{hc}/150</strong></div></>}

      {tab==='experiencias' && <><Title eyebrow="EXPERIÊNCIAS HOCCO" title="Acesso que não está à venda." text="A partir de 150 HC você pode se candidatar a experiências HOCCO e de empresas parceiras."/>{hc<150&&<div className="lockedExperience"><Award/><div><b>Faltam {150-hc} HC</b><span>O limite continua sendo 2 HC por dia.</span></div></div>}<div className="experienceList">{experiences.map((exp)=>{const own=applications.find((a)=>a.experiencia_id===exp.id);const eligible=hc>=exp.hc_min;return <article className="experienceCard" key={exp.id}><div className="experienceTop"><span>{exp.hype_empresas?.nome_fantasia||'HOCCO'}</span><b>{exp.vagas} vagas</b></div><h2>{exp.titulo}</h2><p>{exp.descricao}</p><div className="experienceMeta"><span><Sparkles/> mínimo {exp.hc_min} HC</span>{exp.evento_at&&<span>{new Date(exp.evento_at).toLocaleDateString('pt-BR')}</span>}</div>{exp.local_evento&&<small>Local: {exp.local_evento}</small>}{exp.regras&&<small>{exp.regras}</small>}{own?.status==='selecionado'?<button onClick={()=>confirmExperience(own)}>CONFIRMAR PARTICIPAÇÃO</button>:<button disabled={!eligible||Boolean(own)||exp.status!=='publicada'} onClick={()=>applyExperience(exp)}>{own?statusLabel(own.status):eligible?'QUERO PARTICIPAR':`PRECISA DE ${exp.hc_min} HC`}</button>}</article>})}{!experiences.length&&<Empty icon={Award} title="Novas experiências em preparação" text="Eventos, bastidores, reuniões e benefícios de empresas aparecerão aqui."/>}</div></>}

      {tab==='perfil' && <><div className="profile"><label className="photo">{profile.avatar_url?<img src={profile.avatar_url} alt="Foto"/>:<span>{profile.nome_publico[0]}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/><i><Camera/></i></label><h1>{profile.nome_publico}</h1><p>{profile.username?`@${profile.username}`:user.email}</p><b>NÍVEL {profile.nivel} · IMPULSIONADOR</b></div><div className="profileStats"><div><strong>{profile.hc}</strong><span>HC</span></div><div><strong>{profile.ofensiva_dias}</strong><span>Ofensiva</span></div><div><strong>{profile.xp}</strong><span>XP</span></div><div><strong>{profile.impulsos}</strong><span>Hypes</span></div></div>{edit?<form className="edit" onSubmit={saveProfile}><label>Nome público<input name="nome" defaultValue={profile.nome_publico} required/></label><label>@ na comunidade<input name="username" defaultValue={profile.username||''}/></label><label>Sobre você<textarea name="bio" defaultValue={profile.bio||''}/></label><button className="primary">SALVAR PERFIL</button></form>:<button className="outline" onClick={()=>setEdit(true)}>EDITAR PERFIL</button>}
        <section className="impulseHistory"><div className="sectionHead"><div><small>MINHAS IMPULSÕES</small><h2>{brl(totalImpulsed)} confirmados</h2></div><button onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}>NOVA IMPULSÃO</button></div>{impulsions.slice(0,6).map((i)=><div className="impulseRow" key={i.id}><span><b>{i.reference_code}</b><small>{new Date(i.created_at).toLocaleDateString('pt-BR')} · {String(i.status).replaceAll('_',' ')}</small></span><strong>{brl(i.amount)}</strong></div>)}{!impulsions.length&&<p>Nenhuma Impulsão registrada ainda.</p>}</section>
        <section className="communityMini"><div className="sectionHead"><div><small>COMUNIDADE</small><h2>Mais ativos</h2></div></div>{community.map((r,i)=><div className="rankMini" key={r.user_id}><span>{i+1}</span><div><b>{r.nome_publico}{r.user_id===user.id?' · você':''}</b><small>Nível {r.nivel} · {r.xp} XP · 🔥 {r.ofensiva_dias}</small></div></div>)}</section><div className="legalLinks"><a href="/termos">Termos</a><a href="/privacidade">Privacidade</a></div><button className="outline" onClick={install}><Download/> INSTALAR APP</button><button className="logout" onClick={async()=>{await supabase.auth.signOut();location.replace('/')}}><LogOut/> Sair da conta</button></>}
    </section>

    {selectedCompany&&<CompanyModal slot={selectedCompany} onClose={()=>setSelectedCompany(null)} onBenefit={()=>useCompanyBenefit(selectedCompany)} onWhatsapp={()=>goCompanyWhatsapp(selectedCompany)}/>} 
    {impulseOpen&&<ImpulseModal active={activeImpulse} amount={impulseAmount} setAmount={(v)=>{setImpulseAmount(v);setCustomImpulse('')}} custom={customImpulse} setCustom={setCustomImpulse} credits={impulseCredits} setCredits={setImpulseCredits} onCreate={createImpulse} onReport={reportImpulsePayment} busy={busyImpulse} onClose={()=>{setImpulseOpen(false);setActiveImpulse(null)}}/>}
    {toast&&<div className="toast">{toast}</div>}
    <nav>{nav.map(([key,Icon,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}><Icon/><span>{label}</span></button>)}</nav>
  </main>;
}

function CompanyModal({slot,onClose,onBenefit,onWhatsapp}){const c=slot.hype_empresas;return <div className="modalBackdrop" onClick={onClose}><section className="companyModal" onClick={(e)=>e.stopPropagation()}><button className="modalClose" onClick={onClose}><X/></button>{c.logo_url?<img className="modalLogo" src={c.logo_url} alt={c.nome_fantasia}/>:<div className="modalLogo initial">{c.nome_fantasia?.[0]}</div>}<small>{c.segmento} · {c.cidade||''}{c.uf?`/${c.uf}`:''}</small><h2>{c.nome_fantasia}</h2><div className="benefitBox"><span>BENEFÍCIO HOCCO</span><strong>{Number(slot.desconto??c.desconto_padrao??0).toFixed(0)}% OFF</strong><p>{c.condicoes||'Consulte a empresa para as condições de utilização.'}</p>{c.beneficio_validade&&<small>Válido até {new Date(`${c.beneficio_validade}T12:00:00`).toLocaleDateString('pt-BR')}</small>}</div><button className="outline" onClick={onBenefit}>VER / REGISTRAR BENEFÍCIO</button><button className="primary" onClick={onWhatsapp}><MessageCircle/> FALAR COM A EMPRESA</button></section></div>}
function ImpulseModal({active,amount,setAmount,custom,setCustom,credits,setCredits,onCreate,onReport,busy,onClose}){const value=active?Number(active.amount):(custom?Number(String(custom).replace(',','.')):amount);const code=active?pixPayload(active.amount,active.reference_code):null;return <div className="modalBackdrop" onClick={onClose}><section className="impulseModal" onClick={(e)=>e.stopPropagation()}><button className="modalClose" onClick={onClose}><X/></button><HeartHandshake/><small>IMPULSÃO HOCCO</small><h2>{active?'Sua Impulsão está criada.':'Apoie diretamente a HOCCO.'}</h2><p>A Impulsão é um apoio voluntário e não compra HC, Hypes, ranking ou prioridade em experiências.</p>{!active?<><div className="impulsePresets">{IMPULSE_PRESETS.map((v)=><button key={v} className={!custom&&amount===v?'active':''} onClick={()=>setAmount(v)}>{brl(v)}</button>)}</div><label>Outro valor (mínimo R$ 3)<input inputMode="decimal" value={custom} onChange={(e)=>setCustom(e.target.value)} placeholder="3,00"/></label><label className="checkLine"><input type="checkbox" checked={credits} onChange={(e)=>setCredits(e.target.checked)}/> Quero autorizar meu nome público nos créditos HOCCO.</label><button className="primary" disabled={busy||!Number.isFinite(value)||value<3} onClick={onCreate}>{busy?'CRIANDO...':`GERAR PIX · ${brl(value)}`}</button></>:<><div className="impulsePix"><QRCodeSVG value={code} size={190}/><div className="pixIdentity"><span><small>RECEBEDOR</small><b>{PIX_RECEIVER}</b></span><span><small>INSTITUIÇÃO</small><b>{PIX_BANK}</b></span><span><small>CIDADE</small><b>{PIX_CITY} - SP</b></span><span><small>REFERÊNCIA</small><b>{active.reference_code}</b></span></div><button className="outline" onClick={()=>navigator.clipboard?.writeText(code)}><QrCode/> COPIAR PIX COPIA E COLA</button><p className="pixCheck">Confira o recebedor e a instituição antes de concluir o PIX.</p></div><button className="primary" disabled={active.status!=='aguardando_pagamento'} onClick={onReport}>{active.status==='aguardando_pagamento'?'JÁ FIZ O PIX · INFORMAR PAGAMENTO':'PAGAMENTO INFORMADO'}</button></>}</section></div>}
function WinnerCard({result}){const c=result.hype_empresas;if(!c)return null;const ties=result.empate?(result.detalhes?.vencedores||[]):[];return <section className="winnerCard"><Trophy/><div><small>{result.quadro==='dia'?'MAIS HYPADA DO DIA':`VENCEDORA · ${String(result.quadro).toUpperCase()}`} · {new Date(`${result.hype_date}T12:00:00`).toLocaleDateString('pt-BR')}</small><h2>{result.empate?`Empate · ${ties.map((x)=>x.nome).join(' + ')}`:c.nome_fantasia}</h2><p>{result.quadro==='dia'?`${Number(result.score_percent||0).toFixed(1)}% de índice diário normalizado`:`${result.hypes_validos} Hypes válidos`}</p></div></section>}
function Metric({icon:Icon,value,label,note}){return <article className="metricCard"><Icon/><strong>{value}</strong><b>{label}</b><span>{note}</span></article>}
function Mission({done,title,reward}){return <div className={done?'microMission done':'microMission'}>{done?<CheckCircle2/>:<Target/>}<span>{title}</span><b>{reward}</b></div>}
function MissionRow({done,title,text,reward}){return <article className={done?'missionRow done':'missionRow'}><span>{done?<CheckCircle2/>:<Target/>}</span><div><b>{title}</b><small>{text}</small></div><em>{reward}</em></article>}
function Title({eyebrow,title,text}){return <div className="title"><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>}
function Empty({icon:Icon,title,text}){return <div className="emptyState"><Icon/><b>{title}</b><p>{text}</p></div>}
function statusLabel(status){return ({candidato:'INSCRIÇÃO RECEBIDA',selecionado:'VOCÊ FOI SELECIONADO',lista_espera:'LISTA DE ESPERA',confirmado:'PARTICIPAÇÃO CONFIRMADA',recusado:'NÃO SELECIONADO',desistiu:'INSCRIÇÃO ENCERRADA'})[status]||status}
