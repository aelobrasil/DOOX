'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Bolt, Building2, Camera, CheckCircle2, ChevronRight, Download, Flame, Gamepad2,
  HeartHandshake, Home, LockKeyhole, LogOut, QrCode, Share2, Sparkles, Target, Trophy,
  User, X, Youtube, Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import {
  HYPE_BOARDS, currentBoard, hypeMoment, isBoardLive, todayBR,
  PIX_RECEIVER, PIX_BANK, PIX_CITY, brl,
} from '../../lib/config';
import { pixPayload } from '../../lib/pix';
import { MINIGAMES, MiniGamesModal } from '../components/Minigames';

const IMPULSE_PRESETS = [3, 5, 10, 25, 50, 100];

function normalizeSlot(row) {
  return {
    id: row.agenda_id,
    agenda_id: row.agenda_id,
    empresa_id: row.empresa_id,
    hype_date: row.hype_date,
    quadro: row.quadro,
    tamanho: row.tamanho,
    desconto: row.desconto,
    status: row.status,
    updated_at: row.updated_at,
    company: {
      id: row.empresa_id,
      nome_fantasia: row.nome_fantasia,
      logo_url: row.logo_url,
      capa_url: row.capa_url,
      segmento: row.segmento,
    },
  };
}

export default function MemberAppCore() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [daily, setDaily] = useState(null);
  const [youtubeVisited, setYoutubeVisited] = useState(false);
  const [dailyGame, setDailyGame] = useState('pulso');
  const [miniGameDone, setMiniGameDone] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
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
  const toastTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) location.replace('/');
      else if (mounted) setUser(data.user);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) location.replace('/');
      else setUser(session.user);
    });
    const installedNow = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || localStorage.getItem('hocco_app_installed') === '1';
    if (installedNow) { setAppInstalled(true); localStorage.setItem('hocco_app_installed', '1'); }
    const installHandler = (event) => { event.preventDefault(); if (!installedNow) setInstallPrompt(event); };
    const installedHandler = () => { localStorage.setItem('hocco_app_installed', '1'); setAppInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', installHandler);
    window.addEventListener('appinstalled', installedHandler);
    const ticker = setInterval(() => setClock(Date.now()), 30000);
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
      window.removeEventListener('beforeinstallprompt', installHandler);
      window.removeEventListener('appinstalled', installedHandler);
      clearInterval(ticker);
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let heartbeat;
    let closed = false;
    const accumulate = () => {
      if (document.visibilityState === 'visible' && visibleSinceRef.current) {
        activeSecondsRef.current += Math.max(0, Math.floor((Date.now() - visibleSinceRef.current) / 1000));
      }
      visibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;
    };
    const flush = async () => {
      if (!sessionRef.current) return;
      accumulate();
      await supabase.from('impulsionadores_sessoes').update({ active_seconds: activeSecondsRef.current }).eq('id', sessionRef.current);
    };
    const visibilityHandler = () => accumulate();

    (async () => {
      await ensureIdentity(user);
      const { data: session, error } = await supabase.from('impulsionadores_sessoes').insert({
        user_id: user.id,
        platform: navigator.userAgentData?.platform || navigator.platform || 'web',
        user_agent: navigator.userAgent,
        path: '/app',
      }).select('id').single();
      if (!closed && session && !error) sessionRef.current = session.id;
      activeSecondsRef.current = 0;
      visibleSinceRef.current = document.visibilityState === 'visible' ? Date.now() : null;
      await refreshAll(user);
      if (!closed) {
        heartbeat = setInterval(flush, 30000);
        document.addEventListener('visibilitychange', visibilityHandler);
      }
    })();

    return () => {
      closed = true;
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', visibilityHandler);
      flush();
    };
  }, [user?.id]);

  useEffect(() => { if (user) loadHype(board, user); }, [board, user?.id]);

  useEffect(() => {
    if (!daily || typeof navigator === 'undefined') return;
    const pending = (Number(daily.hc_earned || 0) < 2 ? 1 : 0) + (youtubeVisited ? 0 : 1) + (miniGameDone ? 0 : 1);
    if (pending > 0 && 'setAppBadge' in navigator) navigator.setAppBadge(pending).catch(() => {});
    else if (pending === 0 && 'clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  }, [daily, youtubeVisited, miniGameDone]);

  useEffect(() => {
    if (!user || !appInstalled) return;
    localStorage.setItem('hocco_app_installed', '1');
    supabase.from('impulsionadores_pwa_status').upsert({ user_id: user.id }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.warn('PWA status não persistido', error.code);
    });
  }, [user?.id, appInstalled]);

  async function ensureIdentity(currentUser) {
    let { data: p, error } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (error) return showToast('Não foi possível carregar seu perfil.');
    if (!p) {
      const created = await supabase.from('impulsionadores_perfis').insert({
        user_id: currentUser.id,
        nome_publico: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Membro Hype',
      }).select().single();
      if (created.error) return showToast('Não foi possível preparar sua conta.');
      p = created.data;
    }
    const phone = String(currentUser.user_metadata?.phone || '').replace(/\D/g, '');
    if (phone) await supabase.from('impulsionadores_contatos').upsert({
      user_id: currentUser.id, email: currentUser.email, telefone: phone, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setProfile(p);
  }

  async function refreshAll(currentUser = user) {
    if (!currentUser) return;
    await Promise.allSettled([
      loadProfile(currentUser), loadDaily(currentUser), loadHype(board, currentUser), loadResults(),
      loadExperiences(currentUser), loadCommunity(), loadImpulsions(currentUser), loadPwaStatus(currentUser),
    ]);
  }

  async function loadProfile(currentUser = user) {
    const { data, error } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).single();
    if (!error && data) setProfile(data);
  }

  async function loadDaily(currentUser = user) {
    const date = todayBR();
    const [hcRes, youtubeRes, gameRes, selectedRes] = await Promise.all([
      supabase.from('hc_diario').select('*').eq('user_id', currentUser.id).eq('activity_date', date).maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key').eq('user_id', currentUser.id).eq('mission_date', date).eq('mission_key', 'youtube_channel_visit').maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key,metadata').eq('user_id', currentUser.id).eq('mission_date', date).eq('mission_key', 'minigame_daily').maybeSingle(),
      supabase.rpc('get_daily_minigame'),
    ]);
    setDaily(hcRes.data || { hc_earned: 0, missions_completed: 1, boards_hyped: 0 });
    setYoutubeVisited(Boolean(youtubeRes.data));
    setDailyGame(selectedRes.data || 'pulso');
    setMiniGameDone(Boolean(gameRes.data));
  }

  async function loadHype(selectedBoard = board, currentUser = user) {
    if (!currentUser) return;
    const date = todayBR();
    const [slotsRes, votesRes] = await Promise.all([
      supabase.rpc('hype_slots_publicos', { p_from_date: date, p_to_date: date, p_quadro: selectedBoard }),
      supabase.from('hype_votos').select('agenda_id,quadro').eq('user_id', currentUser.id).eq('hype_date', date),
    ]);
    if (slotsRes.error) {
      setAgenda([]);
      return showToast('Não foi possível carregar o quadro Hype agora.');
    }
    const liveSlots = (slotsRes.data || []).map(normalizeSlot);
    setAgenda(liveSlots);
    const map = {};
    (votesRes.data || []).forEach((v) => { map[v.quadro] = v.agenda_id; });
    setVotes(map);

    const unseen = liveSlots.filter((slot) => !viewedSlotsRef.current.has(slot.id));
    unseen.forEach((slot) => viewedSlotsRef.current.add(slot.id));
    if (unseen.length) {
      await supabase.from('hype_interacoes').insert(unseen.map((slot) => ({ agenda_id: slot.id, user_id: currentUser.id, event_type: 'view' })));
    }
  }

  async function loadResults() {
    const { data, error } = await supabase.rpc('hype_resultados_publicos', { p_limit: 20 });
    if (!error) setResults(data || []);
  }

  async function loadExperiences(currentUser = user) {
    const [expRes, appsRes] = await Promise.all([
      supabase.rpc('hocco_experiencias_publicas'),
      supabase.from('hocco_experiencia_inscricoes').select('*').eq('user_id', currentUser.id),
    ]);
    if (!expRes.error) setExperiences(expRes.data || []);
    if (!appsRes.error) setApplications(appsRes.data || []);
  }

  async function loadCommunity() {
    const { data } = await supabase.from('impulsionadores_perfis').select('user_id,nome_publico,avatar_url,xp,nivel,ofensiva_dias').is('deleted_at', null).order('xp', { ascending: false }).limit(8);
    setCommunity(data || []);
  }

  async function loadImpulsions(currentUser = user) {
    const { data } = await supabase.from('impulsionadores_impulsoes').select('id,reference_code,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);
    setImpulsions(data || []);
  }

  async function loadPwaStatus(currentUser = user) {
    if (!currentUser) return;
    const localInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || localStorage.getItem('hocco_app_installed') === '1';
    const { data } = await supabase.from('impulsionadores_pwa_status').select('installed_at').eq('user_id', currentUser.id).maybeSingle();
    if (localInstalled || data?.installed_at) {
      localStorage.setItem('hocco_app_installed', '1');
      setAppInstalled(true);
    }
  }

  async function logEvent(eventType, entityType, entityId, metadata = {}) {
    if (!user) return;
    await supabase.from('impulsionadores_eventos').insert({
      user_id: user.id, session_id: sessionRef.current, event_type: eventType,
      path: `/app/${tab}`, entity_type: entityType, entity_id: entityId ? String(entityId) : null, metadata,
    });
  }

  function haptic(pattern = 18) { if (navigator.vibrate) navigator.vibrate(pattern); }

  async function shareHype() {
    const shareData = { title: 'Hype', text: `Estou com ${profile?.ofensiva_dias || 0} dias de ofensiva na comunidade Hype da HOCCO.`, url: location.origin };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard?.writeText(shareData.url); showToast('Link do Hype copiado.'); }
      haptic(15); await logEvent('share_app', 'app', 'hype');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Não foi possível compartilhar agora.');
    }
  }

  async function completeMiniGame(gameKey, result) {
    haptic([20, 35, 20]);
    await logEvent('minigame_play', 'minigame', gameKey, result);
    if (gameKey !== dailyGame) return showToast(`${MINIGAMES[gameKey]?.name || 'Minigame'} concluído. A missão de hoje é ${MINIGAMES[dailyGame]?.name || 'outro jogo'}.`);
    if (miniGameDone) return showToast('Missão diária já concluída.');
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({
      user_id: user.id, mission_date: todayBR(), mission_key: 'minigame_daily', metadata: { game_key: gameKey, result },
    });
    if (error && error.code !== '23505') {
      await loadDaily();
      return showToast('A partida terminou, mas a missão não pôde ser validada.');
    }
    await Promise.all([loadDaily(), loadProfile(), loadCommunity()]);
    setMiniGameDone(true);
    showToast(error?.code === '23505' ? 'Missão diária já estava concluída.' : `${MINIGAMES[gameKey]?.name}: missão concluída. +5 XP.`);
  }

  async function visitYoutube() {
    if (!user) return;
    window.open('https://www.youtube.com/@hoccpov', '_blank', 'noopener,noreferrer');
    if (youtubeVisited) return;
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({
      user_id: user.id, mission_date: todayBR(), mission_key: 'youtube_channel_visit', metadata: { channel: '@hoccpov' },
    });
    if (error && error.code !== '23505') return showToast('O canal abriu, mas a missão não pôde ser registrada agora.');
    setYoutubeVisited(true); haptic(18); showToast('Missão concluída: @hoccpov. +5 XP.');
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
    if (error) {
      const message = String(error.message || '');
      return showToast(message.includes('duplicate') || error.code === '23505' ? 'Seu Hype válido deste quadro já foi usado.' : 'Não foi possível registrar este Hype agora.');
    }
    await logEvent('hype_valid', 'empresa', slot.empresa_id, { quadro: board });
    haptic([20, 30, 20]); showToast('Hype válido registrado.');
    await Promise.all([loadHype(board), loadProfile(), loadDaily(), loadCommunity()]);
  }

  async function applyExperience(exp) {
    if ((profile?.hc || 0) < exp.hc_min) return showToast(`Você precisa de pelo menos ${exp.hc_min} HC para esta experiência.`);
    const { error } = await supabase.from('hocco_experiencia_inscricoes').insert({ experiencia_id: exp.id, user_id: user.id });
    if (error) return showToast(error.code === '23505' ? 'Você já está inscrito nesta experiência.' : 'Não foi possível registrar sua inscrição.');
    await logEvent('experience_apply', 'experiencia', exp.id);
    showToast('Inscrição recebida.'); loadExperiences();
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
    setActiveImpulse(data || { ...activeImpulse, status: 'pagamento_informado' });
    showToast('Pagamento informado. A HOCCO fará a conferência.'); loadImpulsions();
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return showToast('Use uma imagem de até 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showToast('Use JPG, PNG ou WEBP.');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return showToast('Não foi possível enviar a foto.');
    const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
    const updated = await supabase.from('impulsionadores_perfis').update({ avatar_url: `${data.publicUrl}?v=${Date.now()}`, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (updated.error) return showToast('Foto enviada, mas o perfil não pôde ser atualizado.');
    loadProfile();
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('nome') || '').trim().slice(0, 40);
    if (name.length < 2) return showToast('Informe um nome público válido.');
    const { error } = await supabase.from('impulsionadores_perfis').update({
      nome_publico: name,
      username: String(form.get('username') || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 30) || null,
      bio: String(form.get('bio') || '').trim().slice(0, 160) || null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    if (error) return showToast('Não foi possível salvar o perfil.');
    setEdit(false); loadProfile();
  }

  async function install() {
    if (appInstalled) return;
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice?.outcome === 'accepted') { localStorage.setItem('hocco_app_installed', '1'); setAppInstalled(true); }
    } else alert('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
  }

  function showToast(message) {
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(''), 4200);
  }

  const moment = hypeMoment(new Date(clock));
  const overallWinner = useMemo(() => results.find((r) => r.quadro === 'dia'), [results]);
  const boardWinner = useMemo(() => results.find((r) => r.quadro === board), [results, board]);
  const hc = profile?.hc || 0;
  const dailyHC = daily?.hc_earned || 0;
  const boardsHyped = daily?.boards_hyped || 0;
  const dailyMissions = 1 + Math.min(3, boardsHyped) + (youtubeVisited ? 1 : 0) + (miniGameDone ? 1 : 0);
  const missionProgress = Math.min(100, Math.round((dailyMissions / 6) * 100));
  const confirmedImpulsions = impulsions.filter((i) => i.status === 'confirmada').length;

  if (!profile) return <div className="splash"><b>HYPE</b><span>Ativando sua conta...</span></div>;
  const nav = [['inicio', Home, 'Início'], ['hype', Zap, 'Hype'], ['missoes', Target, 'Missões'], ['experiencias', Award, 'Experiências'], ['perfil', User, 'Perfil']];

  return <main className="memberApp">
    <header><b className="logo">HYPE</b><span className="pill">HOCCO</span><div className="hcHeader"><Sparkles/><strong>{hc} HC</strong></div><button className="avatarBtn" onClick={() => setTab('perfil')}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Perfil"/> : <span>{profile.nome_publico?.[0] || 'H'}</span>}</button></header>
    <section className="shell liveShell">
      {tab === 'inicio' && <>
        <section className="livingHero"><div><small>COMUNIDADE HYPE ATIVA</small><h1>Olá, {profile.nome_publico.split(' ')[0]}.</h1><p>Participe dos Hypes, mantenha sua ofensiva, conquiste HC e desbloqueie experiências.</p></div><div className="pulseCore"><Bolt/><span>ATIVO</span></div></section>
        <div className="valueGrid"><Metric icon={Sparkles} value={`${hc} HC`} label="Saldo HC" note="máx. 2 por dia"/><Metric icon={Flame} value={`${profile.ofensiva_dias} dias`} label="Ofensiva" note={`recorde ${profile.maior_ofensiva || profile.ofensiva_dias}`}/><Metric icon={Target} value={`${dailyHC}/2`} label="HC de hoje" note={`${boardsHyped}/3 quadros`}/><Metric icon={Award} value={`Nível ${profile.nivel}`} label="Progressão" note={`${profile.xp} XP`}/></div>
        <section className="nowCard" onClick={() => { if (moment.board) setBoard(moment.board); setTab('hype'); }}><div><small>{moment.closed ? 'HYPE DE HOJE ENCERRADO' : moment.live ? 'AO VIVO' : 'PRÓXIMO QUADRO'}</small><h2>{moment.closed ? 'Hype Almoço · amanhã' : HYPE_BOARDS[moment.board]?.label}</h2><p>{moment.closed ? '11h–14h' : `${HYPE_BOARDS[moment.board]?.window} · até 10 empresas`}</p></div><div className={moment.live ? 'liveDot on' : 'liveDot'}>{moment.live ? 'AO VIVO' : moment.closed ? 'ENCERRADO' : 'EM BREVE'}</div><ChevronRight/></section>
        <section className="missionPulse"><div className="sectionHead"><div><small>MISSÕES DIÁRIAS</small><h2>Seu dia é validado pelo sistema.</h2></div><strong>{missionProgress}%</strong></div><div className="progress"><div style={{ width: `${missionProgress}%` }}/></div><div className="microMissions"><Mission done title="Entrou no Hype" reward="+5 XP"/><button type="button" className={youtubeVisited ? 'microMission done' : 'microMission'} style={{ width: '100%', textAlign: 'left' }} onClick={visitYoutube}><Youtube style={{ color: '#ff0000' }}/><span>Visitar @hoccpov</span><b>{youtubeVisited ? '+5 XP · FEITO' : '+5 XP'}</b></button><button type="button" className={miniGameDone ? 'microMission done' : 'microMission'} onClick={() => setGameOpen(true)}><Gamepad2/><span>{MINIGAMES[dailyGame]?.name || 'Minigame Hype'}</span><b>{miniGameDone ? 'MISSÃO FEITA' : '+5 XP'}</b></button><Mission done={boardsHyped >= 1} title="Primeiro quadro" reward="+1 HC · +25 XP"/><Mission done={boardsHyped >= 2} title="Segundo quadro" reward="+1 HC · +25 XP"/><Mission done={boardsHyped >= 3} title="Dia completo" reward="+25 XP"/></div></section>
        <div className="phoneFeatureRow"><button className="pulsoCTA" onClick={() => setGameOpen(true)}><Gamepad2/><div><b>Minigames Hype</b><span>5 jogos · missão de hoje: {MINIGAMES[dailyGame]?.short || 'Pulso'} · sem gastar HC</span></div><ChevronRight/></button><button className="shareCTA" onClick={shareHype}><Share2/><span>Compartilhar</span></button></div>
        {overallWinner && <WinnerCard result={overallWinner}/>} 
        <button className="impulseCTA" onClick={() => { setActiveImpulse(null); setImpulseOpen(true); }}><HeartHandshake/><div><b>Fazer uma Impulsão</b><span>Apoio voluntário à HOCCO a partir de R$ 3. Após confirmação, registra +5 XP fixos; o valor não aumenta a recompensa.</span></div><ChevronRight/></button>
        <button className="businessCTA" onClick={() => location.href = '/empresa'}><Building2/><div><b>Quer colocar sua empresa no Hype?</b><span>Cadastro, benefício, quadro e pagamento em um fluxo profissional.</span></div><ChevronRight/></button>
        {!appInstalled && <button className="installCard" onClick={install}><Download/><div><b>Instalar Hype no celular</b><span>Abra mais rápido e mantenha sua conta sincronizada.</span></div></button>}
      </>}

      {tab === 'hype' && <>
        <Title eyebrow="HYPE DO DIA" title="A comunidade escolhe." text="O plano comercial muda apenas a exposição visual. O resultado depende dos Hypes válidos dos membros."/>
        <div className="boardTabs">{Object.entries(HYPE_BOARDS).map(([key, info]) => <button key={key} className={board === key ? 'active' : ''} onClick={() => setBoard(key)}><b>{info.label.replace('Hype ', '')}</b><span>{info.window}</span></button>)}</div>
        <div className="boardStatus"><span>{isBoardLive(board) ? '● QUADRO AO VIVO' : '○ FORA DO HORÁRIO'}</span><b>{agenda.length}/10 empresas</b></div>
        {agenda.length ? <div className="hypeField">{agenda.map((slot, index) => {
          const company = slot.company;
          const chosen = votes[board] === slot.id;
          const locked = Boolean(votes[board]) && !chosen;
          return <article key={slot.id} className={`floatingCompany size-${slot.tamanho} ${chosen ? 'chosen' : ''}`} style={{ '--delay': `${(index % 5) * .55}s` }} onClick={() => openCompany(slot)}>
            <div className="companyGlow"/>
            {company?.capa_url && <div style={{ height: 72, margin: '-16px -16px 10px', background: `url(${company.capa_url}) center/cover no-repeat`, borderBottom: '1px solid #e4eaf2' }}/>} 
            {company?.logo_url ? <img src={company.logo_url} alt={company.nome_fantasia}/> : <div className="companyInitial">{company?.nome_fantasia?.[0] || 'H'}</div>}
            <small>{company?.segmento || 'Empresa Hype'}</small><h3>{company?.nome_fantasia}</h3><span className="discount" data-hocco-potential={Number(slot.desconto || 0).toFixed(0)}>🔒 LIBERE ATÉ {Number(slot.desconto || 0).toFixed(0)}%</span>
            <button disabled={locked || chosen || busyVote} onClick={(e) => { e.stopPropagation(); voteCompany(slot); }}><Zap/>{chosen ? 'SEU HYPE' : locked ? 'HYPE USADO' : 'HYPAR PARA LIBERAR'}</button>
          </article>;
        })}</div> : <Empty icon={Building2} title="Quadro em preparação" text="As empresas publicadas pela HOCCO aparecerão aqui no horário correto."/>}
        <div className="hypeRule"><Zap/><p><b>1 Hype válido por quadro.</b> O benefício, cupom e contato só são liberados para as empresas vencedoras.</p></div>
        {boardWinner && <WinnerCard result={boardWinner}/>} 
        <button className="businessCTA" onClick={() => location.href = '/empresa'}><Building2/><div><b>Hypar minha empresa</b><span>Participações a partir de R$ 29,90.</span></div><ChevronRight/></button>
      </>}

      {tab === 'missoes' && <><Title eyebrow="OFENSIVA HYPE" title={`${profile.ofensiva_dias} dias de constância`} text="Entrar em um novo dia mantém sua ofensiva. O teto continua sendo 2 HC por dia."/><div className="hcCap"><Sparkles/><div><small>LIMITE DIÁRIO</small><h2>{dailyHC}/2 HC conquistados hoje</h2><p>Mesmo completando todas as missões, o máximo absoluto é 2 HC por dia.</p></div></div><div className="missionList"><MissionRow done title="Presença Hype" text="Entrar no app hoje mantém sua ofensiva." reward="+5 XP"/><button type="button" className={youtubeVisited ? 'missionRow done' : 'missionRow'} style={{ width: '100%', textAlign: 'left' }} onClick={visitYoutube}><span style={{ color: '#ff0000' }}><Youtube/></span><div><b>Canal oficial HOCCO</b><small>Visite @hoccpov no YouTube uma vez por dia.</small></div><em>{youtubeVisited ? '+5 XP · FEITO' : '+5 XP'}</em></button><button type="button" className={miniGameDone ? 'missionRow done' : 'missionRow'} onClick={() => setGameOpen(true)}><span><Gamepad2/></span><div><b>{MINIGAMES[dailyGame]?.name || 'Minigame Hype'}</b><small>Jogo escolhido pelo sistema para a missão de hoje.</small></div><em>{miniGameDone ? 'MISSÃO FEITA' : '+5 XP'}</em></button><MissionRow done={boardsHyped >= 1} title="Primeiro Hype" text="Escolher uma empresa em um quadro válido." reward="+1 HC · +25 XP"/><MissionRow done={boardsHyped >= 2} title="Dois momentos" text="Participar de dois quadros diferentes." reward="+1 HC · +25 XP"/><MissionRow done={boardsHyped >= 3} title="Dia completo" text="Participar de Almoço, Tarde e Noite." reward="+25 XP"/></div><div className="unlockCard"><Award/><div><small>PORTA DE ENTRADA</small><h2>150 HC desbloqueiam experiências.</h2><p>HC torna você elegível; não compra automaticamente uma vaga.</p></div><strong>{hc}/150</strong></div></>}

      {tab === 'experiencias' && <><Title eyebrow="EXPERIÊNCIAS HOCCO" title="Acesso que não está à venda." text="A partir de 150 HC você pode se candidatar a experiências HOCCO e de empresas parceiras."/>{hc < 150 && <div className="lockedExperience"><Award/><div><b>Faltam {150 - hc} HC</b><span>O limite continua sendo 2 HC por dia.</span></div></div>}<div className="experienceList">{experiences.map((exp) => { const own = applications.find((a) => a.experiencia_id === exp.id); const eligible = hc >= exp.hc_min; return <article className="experienceCard" key={exp.id}><div className="experienceTop"><span>{exp.empresa_nome || 'HOCCO'}</span><b>{exp.vagas} vagas</b></div><h2>{exp.titulo}</h2><p>{exp.descricao}</p><div className="experienceMeta"><span><Sparkles/> mínimo {exp.hc_min} HC</span>{exp.evento_at && <span>{new Date(exp.evento_at).toLocaleDateString('pt-BR')}</span>}</div>{exp.local_evento && <small>Local: {exp.local_evento}</small>}{exp.regras && <small>{exp.regras}</small>}{own?.status === 'selecionado' ? <button onClick={() => confirmExperience(own)}>CONFIRMAR PARTICIPAÇÃO</button> : <button disabled={!eligible || Boolean(own) || exp.status !== 'publicada'} onClick={() => applyExperience(exp)}>{own ? statusLabel(own.status) : eligible ? 'QUERO PARTICIPAR' : `PRECISA DE ${exp.hc_min} HC`}</button>}</article>; })}{!experiences.length && <Empty icon={Award} title="Novas experiências em preparação" text="Eventos, bastidores, reuniões e benefícios de empresas aparecerão aqui."/>}</div></>}

      {tab === 'perfil' && <><div className="profile"><label className="photo">{profile.avatar_url ? <img src={profile.avatar_url} alt="Foto"/> : <span>{profile.nome_publico?.[0] || 'H'}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/><i><Camera/></i></label><h1>{profile.nome_publico}</h1><p>{profile.username ? `@${profile.username}` : user.email}</p><b>NÍVEL {profile.nivel} · MEMBRO HYPE</b></div><div className="profileStats"><div><strong>{profile.hc}</strong><span>HC</span></div><div><strong>{profile.ofensiva_dias}</strong><span>Ofensiva</span></div><div><strong>{profile.xp}</strong><span>XP</span></div><div><strong>{profile.impulsos}</strong><span>Hypes</span></div></div>{edit ? <form className="edit" onSubmit={saveProfile}><label>Nome público<input name="nome" defaultValue={profile.nome_publico} required/></label><label>@ na comunidade<input name="username" defaultValue={profile.username || ''}/></label><label>Sobre você<textarea name="bio" defaultValue={profile.bio || ''}/></label><button className="primary">SALVAR PERFIL</button></form> : <button className="outline" onClick={() => setEdit(true)}>EDITAR PERFIL</button>}
        <section className="impulseHistory"><div className="sectionHead"><div><small>MINHAS IMPULSÕES</small><h2>{confirmedImpulsions} apoios confirmados</h2></div><button onClick={() => { setActiveImpulse(null); setImpulseOpen(true); }}>NOVA IMPULSÃO</button></div><p className="fieldHelp">O histórico do membro não exibe valores. O valor aparece somente durante o pagamento atual.</p>{impulsions.slice(0, 6).map((i) => <div className="impulseRow" key={i.id}><span><b>{i.reference_code}</b><small>{new Date(i.created_at).toLocaleDateString('pt-BR')} · {String(i.status).replaceAll('_', ' ')}</small></span><strong>APOIO</strong></div>)}{!impulsions.length && <p>Nenhuma Impulsão registrada ainda.</p>}</section>
        <section className="communityMini"><div className="sectionHead"><div><small>COMUNIDADE</small><h2>Mais ativos</h2></div></div>{community.map((r, i) => <div className="rankMini" key={r.user_id}><span>{i + 1}</span><div><b>{r.nome_publico}{r.user_id === user.id ? ' · você' : ''}</b><small>Nível {r.nivel} · {r.xp} XP · 🔥 {r.ofensiva_dias}</small></div></div>)}</section><div className="legalLinks"><a href="/termos">Termos</a><a href="/privacidade">Privacidade</a></div><button className="outline" onClick={shareHype}><Share2/> COMPARTILHAR HYPE</button>{!appInstalled && <button className="outline" onClick={install}><Download/> INSTALAR APP</button>}<button className="logout" onClick={async () => { await supabase.auth.signOut(); location.replace('/'); }}><LogOut/> Sair da conta</button></>}
    </section>

    {selectedCompany && <LockedCompanyModal slot={selectedCompany} onClose={() => setSelectedCompany(null)}/>} 
    {impulseOpen && <ImpulseModal active={activeImpulse} amount={impulseAmount} setAmount={(v) => { setImpulseAmount(v); setCustomImpulse(''); }} custom={customImpulse} setCustom={setCustomImpulse} credits={impulseCredits} setCredits={setImpulseCredits} onCreate={createImpulse} onReport={reportImpulsePayment} busy={busyImpulse} onClose={() => { setImpulseOpen(false); setActiveImpulse(null); }}/>} 
    {gameOpen && <MiniGamesModal dailyGame={dailyGame} doneToday={miniGameDone} onFinish={completeMiniGame} onClose={() => setGameOpen(false)}/>} 
    {toast && <div className="toast">{toast}</div>}
    <nav>{nav.map(([key, Icon, label]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}><Icon/><span>{label}</span></button>)}</nav>
  </main>;
}

function LockedCompanyModal({ slot, onClose }) {
  const c = slot.company;
  return <div className="modalBackdrop" onClick={onClose}><section className="companyModal" onClick={(e) => e.stopPropagation()}><button className="modalClose" onClick={onClose}><X/></button>{c?.capa_url && <div style={{ height: 150, margin: '-20px -20px 16px', background: `url(${c.capa_url}) center/cover no-repeat`, borderRadius: '20px 20px 0 0' }}/>} {c?.logo_url ? <img className="modalLogo" src={c.logo_url} alt={c.nome_fantasia}/> : <div className="modalLogo initial">{c?.nome_fantasia?.[0] || 'H'}</div>}<small>{c?.segmento || 'Empresa Hype'}</small><h2>{c?.nome_fantasia}</h2><div className="benefitBox"><span><LockKeyhole size={14} style={{ verticalAlign: 'middle', marginRight: 5 }}/> BENEFÍCIO BLOQUEADO</span><strong>ATÉ {Number(slot.desconto || 0).toFixed(0)}% OFF</strong><p>Desconto, cupom, condições e contato só serão liberados se esta empresa vencer o Hype.</p></div><button className="outline" onClick={onClose}>VOLTAR AO QUADRO</button></section></div>;
}

function ImpulseModal({ active, amount, setAmount, custom, setCustom, credits, setCredits, onCreate, onReport, busy, onClose }) {
  const value = active ? Number(active.amount) : (custom ? Number(String(custom).replace(',', '.')) : amount);
  const code = active ? pixPayload(active.amount, active.reference_code) : null;
  return <div className="modalBackdrop" onClick={onClose}><section className="impulseModal" onClick={(e) => e.stopPropagation()}><button className="modalClose" onClick={onClose}><X/></button><HeartHandshake/><small>IMPULSÃO HOCCO</small><h2>{active ? 'Sua Impulsão está criada.' : 'Apoie diretamente a HOCCO.'}</h2><p>A Impulsão é apoio voluntário. Depois da confirmação, registra +5 XP fixos, independentemente do valor. Não compra HC, Hypes, votos nem prioridade.</p>{!active ? <><div className="impulsePresets">{IMPULSE_PRESETS.map((v) => <button type="button" key={v} className={!custom && amount === v ? 'active' : ''} onClick={() => setAmount(v)}>{brl(v)}</button>)}</div><label>Outro valor (mínimo R$ 3)<input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="3,00"/></label><label className="checkLine"><input type="checkbox" checked={credits} onChange={(e) => setCredits(e.target.checked)}/> Autorizo meu nome público nos créditos HOCCO.</label><button className="primary" disabled={busy || !Number.isFinite(value) || value < 3} onClick={onCreate}>{busy ? 'CRIANDO...' : `GERAR PIX · ${brl(value)}`}</button></> : <><div className="impulsePix"><QRCodeSVG value={code} size={190}/><div className="pixIdentity"><span><small>RECEBEDOR</small><b>{PIX_RECEIVER}</b></span><span><small>INSTITUIÇÃO</small><b>{PIX_BANK}</b></span><span><small>CIDADE</small><b>{PIX_CITY} - SP</b></span><span><small>REFERÊNCIA</small><b>{active.reference_code}</b></span></div><button className="outline" onClick={() => navigator.clipboard?.writeText(code)}><QrCode/> COPIAR PIX COPIA E COLA</button><p className="pixCheck">Confira o recebedor e a instituição antes de concluir o PIX.</p></div><button className="primary" disabled={active.status !== 'aguardando_pagamento'} onClick={onReport}>{active.status === 'aguardando_pagamento' ? 'JÁ FIZ O PIX · INFORMAR PAGAMENTO' : 'PAGAMENTO INFORMADO'}</button></>}</section></div>;
}

function WinnerCard({ result }) {
  const ties = result.empate ? (result.detalhes?.vencedores || []) : [];
  return <section className="winnerCard"><Trophy/><div><small>{result.quadro === 'dia' ? 'MAIS HYPADA DO DIA' : `VENCEDORA · ${String(result.quadro).toUpperCase()}`} · {new Date(`${result.hype_date}T12:00:00-03:00`).toLocaleDateString('pt-BR')}</small><h2>{result.empate ? `Empate · ${ties.map((x) => x.nome).join(' + ')}` : result.nome_fantasia}</h2><p>{result.quadro === 'dia' ? `${Number(result.score_percent || 0).toFixed(1)}% de índice diário normalizado` : `${result.hypes_validos} Hypes válidos`}</p></div></section>;
}
function Metric({ icon: Icon, value, label, note }) { return <article className="metricCard"><Icon/><strong>{value}</strong><b>{label}</b><span>{note}</span></article>; }
function Mission({ done, title, reward }) { return <div className={done ? 'microMission done' : 'microMission'}>{done ? <CheckCircle2/> : <Target/>}<span>{title}</span><b>{reward}</b></div>; }
function MissionRow({ done, title, text, reward }) { return <article className={done ? 'missionRow done' : 'missionRow'}><span>{done ? <CheckCircle2/> : <Target/>}</span><div><b>{title}</b><small>{text}</small></div><em>{reward}</em></article>; }
function Title({ eyebrow, title, text }) { return <div className="title"><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>; }
function Empty({ icon: Icon, title, text }) { return <div className="emptyState"><Icon/><b>{title}</b><p>{text}</p></div>; }
function statusLabel(status) { return ({ candidato: 'INSCRIÇÃO RECEBIDA', selecionado: 'VOCÊ FOI SELECIONADO', lista_espera: 'LISTA DE ESPERA', confirmado: 'PARTICIPAÇÃO CONFIRMADA', recusado: 'NÃO SELECIONADO', desistiu: 'INSCRIÇÃO ENCERRADA' })[status] || status; }
