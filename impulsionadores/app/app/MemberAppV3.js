'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Bell, Building2, CheckCircle2, ChevronRight, Download, ExternalLink, Flame,
  Gamepad2, Gift, HeartHandshake, Home, LogOut, Search, Sparkles, Tag, Target,
  Trophy, User, X, Youtube, Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, todayBR } from '../../lib/config';
import { pixPayload } from '../../lib/pix';
import { MINIGAMES, MiniGamesModal } from '../components/Minigames';

const TAB_BOARD = { inicio: 1, ofertas: 2, missoes: 3, drops: 4, perfil: 5 };
const IMPULSE_PRESETS = [3, 5, 10, 25, 50];

function dateBR(value) {
  if (!value) return 'hoje';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(value));
}

function safeName(profile) {
  return String(profile?.nome_publico || 'Membro').trim().split(' ')[0] || 'Membro';
}

export default function MemberAppV3() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [daily, setDaily] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offerMission, setOfferMission] = useState({ count: 0, completed: false });
  const [dailyMissions, setDailyMissions] = useState([]);
  const [dailyGame, setDailyGame] = useState('pulso');
  const [frequency, setFrequency] = useState(0);
  const [tab, setTab] = useState('inicio');
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [toast, setToast] = useState('');
  const [gameOpen, setGameOpen] = useState(false);
  const [impulseOpen, setImpulseOpen] = useState(false);
  const [impulseAmount, setImpulseAmount] = useState(3);
  const [activeImpulse, setActiveImpulse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionId = useRef(null);
  const heartbeat = useRef(null);
  const seenImpressions = useRef(new Set());
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return location.replace('/');
      if (!alive) return;
      setUser(data.user);
      await bootstrap(data.user);
    });
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) location.replace('/');
    });
    return () => {
      alive = false;
      auth.subscription.unsubscribe();
      clearInterval(heartbeat.current);
      clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadBrands(TAB_BOARD[tab] || 1);
    if (tab === 'ofertas') markImpressions(offers.slice(0, 18));
  }, [tab, user?.id, offers.length]);

  async function bootstrap(currentUser) {
    setLoading(true);
    let { data: p } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (!p) {
      const created = await supabase.from('impulsionadores_perfis').insert({
        user_id: currentUser.id,
        nome_publico: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Membro HOCCO',
      }).select().single();
      p = created.data;
    }
    setProfile(p || null);

    const session = await supabase.from('impulsionadores_sessoes').insert({
      user_id: currentUser.id,
      platform: navigator.userAgentData?.platform || navigator.platform || 'web',
      user_agent: navigator.userAgent,
      path: '/app',
    }).select('id').single();
    if (session.data?.id) {
      sessionId.current = session.data.id;
      const started = Date.now();
      heartbeat.current = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        supabase.from('impulsionadores_sessoes').update({ active_seconds: Math.floor((Date.now() - started) / 1000) }).eq('id', sessionId.current).then(() => {});
      }, 30000);
    }
    await loadAll(currentUser);
    setLoading(false);
  }

  async function loadAll(currentUser = user) {
    if (!currentUser) return;
    const date = todayBR();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [p, d, o, m, missions, game, sessions] = await Promise.all([
      supabase.from('impulsionadores_perfis').select('*').eq('user_id', currentUser.id).single(),
      supabase.from('hc_diario').select('*').eq('user_id', currentUser.id).eq('activity_date', date).maybeSingle(),
      supabase.from('hocco_ofertas').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('oferta_missao_progresso'),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key,completed_at').eq('user_id', currentUser.id).eq('mission_date', date),
      supabase.rpc('get_daily_minigame'),
      supabase.from('impulsionadores_sessoes').select('created_at').eq('user_id', currentUser.id).gte('created_at', since).order('created_at', { ascending: false }).limit(250),
    ]);
    if (p.data) setProfile(p.data);
    setDaily(d.data || { hc_earned: 0, frequency_hc: 0, hype_hc: 0, missions_completed: 0 });
    setOffers(o.data || []);
    setOfferMission(m.data || { count: 0, completed: false });
    setDailyMissions(missions.data || []);
    setDailyGame(game.data || 'pulso');
    const days = new Set((sessions.data || []).map((row) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.created_at))));
    setFrequency(Math.min(100, Math.round((days.size / 30) * 100)));
    await loadBrands(TAB_BOARD[tab] || 1);
    setTimeout(() => markImpressions((o.data || []).slice(0, 6)), 250);
  }

  async function loadBrands(board) {
    const { data } = await supabase.rpc('marcas_permanentes_ativas', { p_quadro: board });
    setBrands((data || []).slice(0, 5));
  }

  async function markImpressions(rows) {
    if (!user) return;
    const targets = rows.filter((row) => !seenImpressions.current.has(row.id));
    targets.forEach((row) => seenImpressions.current.add(row.id));
    await Promise.allSettled(targets.map((row) => supabase.rpc('registrar_oferta_evento', { p_oferta_id: row.id, p_event: 'impression' })));
  }

  function showToast(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }

  async function openOffer(row) {
    const popup = window.open('', '_blank');
    const { data, error } = await supabase.rpc('registrar_oferta_evento', { p_oferta_id: row.id, p_event: 'click' });
    if (error || !data) {
      popup?.close();
      return showToast('Não foi possível abrir esta oferta agora.');
    }
    if (popup) popup.location.href = data;
    else location.href = data;
    await Promise.all([loadOfferMission(), loadProfileAndDaily()]);
  }

  async function openBrand(row) {
    const popup = window.open('', '_blank');
    const { data, error } = await supabase.rpc('registrar_patrocinio_evento', { p_id: row.id, p_event: 'click', p_placement: `v3_quadro_${row.quadro}` });
    if (error || !data) return popup?.close();
    if (popup) popup.location.href = data;
    else location.href = data;
  }

  async function loadOfferMission() {
    const { data } = await supabase.rpc('oferta_missao_progresso');
    setOfferMission(data || { count: 0, completed: false });
  }

  async function loadProfileAndDaily() {
    if (!user) return;
    const [p, d, missions] = await Promise.all([
      supabase.from('impulsionadores_perfis').select('*').eq('user_id', user.id).single(),
      supabase.from('hc_diario').select('*').eq('user_id', user.id).eq('activity_date', todayBR()).maybeSingle(),
      supabase.from('impulsionadores_missoes_diarias').select('mission_key,completed_at').eq('user_id', user.id).eq('mission_date', todayBR()),
    ]);
    if (p.data) setProfile(p.data);
    setDaily(d.data || daily);
    setDailyMissions(missions.data || []);
  }

  const missionDone = (key) => dailyMissions.some((m) => m.mission_key === key);

  async function visitYoutube() {
    window.open('https://www.youtube.com/@hoccpov', '_blank', 'noopener,noreferrer');
    if (missionDone('youtube_channel_visit')) return;
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({ user_id: user.id, mission_date: todayBR(), mission_key: 'youtube_channel_visit', metadata: { channel: '@hoccpov' } });
    if (!error || error.code === '23505') {
      showToast('Missão registrada. +5 XP.');
      await loadProfileAndDaily();
    }
  }

  async function completeMiniGame(gameKey, result) {
    if (gameKey !== dailyGame || missionDone('minigame_daily')) return;
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({ user_id: user.id, mission_date: todayBR(), mission_key: 'minigame_daily', metadata: { game_key: gameKey, result } });
    if (!error || error.code === '23505') {
      showToast('Minigame do dia concluído. +5 XP.');
      await loadProfileAndDaily();
    }
  }

  function openDrops() {
    const launcher = document.querySelector('button[aria-label="Abrir Drops HOCCO"]');
    if (launcher) launcher.click();
    else showToast('Drops carregando. Tente novamente em instantes.');
  }

  async function createImpulse() {
    const amount = Number(impulseAmount);
    if (!Number.isFinite(amount) || amount < 3) return showToast('A Impulsão mínima é de R$ 3,00.');
    setBusy(true);
    const { data, error } = await supabase.from('impulsionadores_impulsoes').insert({ user_id: user.id, amount, creditos_publicos: false }).select().single();
    setBusy(false);
    if (error) return showToast('Não foi possível criar a Impulsão agora.');
    setActiveImpulse(data);
  }

  async function reportImpulse() {
    if (!activeImpulse) return;
    const { data, error } = await supabase.rpc('informar_impulsao_pagamento', { p_id: activeImpulse.id });
    if (error) return showToast('Não foi possível informar o pagamento.');
    setActiveImpulse(data || activeImpulse);
    showToast('Pagamento informado. A HOCCO fará a conferência.');
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patch = {
      nome_publico: String(form.get('nome') || '').trim().slice(0, 40),
      username: String(form.get('username') || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 30) || null,
      bio: String(form.get('bio') || '').trim().slice(0, 160) || null,
      updated_at: new Date().toISOString(),
    };
    if (patch.nome_publico.length < 2) return showToast('Informe um nome válido.');
    const { error } = await supabase.from('impulsionadores_perfis').update(patch).eq('user_id', user.id);
    if (error) return showToast('Não foi possível salvar o perfil.');
    setEditOpen(false);
    await loadProfileAndDaily();
    showToast('Perfil atualizado.');
  }

  async function logout() {
    await supabase.auth.signOut();
    location.replace('/');
  }

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(offers.map((o) => o.categoria || o.segmento).filter(Boolean))).slice(0, 12)], [offers]);
  const filteredOffers = useMemo(() => offers.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || `${o.nome_fantasia} ${o.titulo} ${o.oferta_texto} ${o.categoria || ''}`.toLowerCase().includes(q);
    const matchesCategory = category === 'Todos' || (o.categoria || o.segmento) === category;
    return matchesText && matchesCategory;
  }), [offers, search, category]);

  if (loading || !profile) return <div className="v3Splash"><b>HOCCO <i>Hype</i></b><span>Preparando sua comunidade...</span></div>;

  const nav = [
    ['inicio', Home, 'Início'],
    ['ofertas', Tag, 'Ofertas'],
    ['missoes', Target, 'Missões'],
    ['drops', Gift, 'Drops'],
    ['perfil', User, 'Perfil'],
  ];

  return <main className="memberV3">
    <header className="v3Topbar">
      <button className="v3Brand" onClick={() => setTab('inicio')}><b>HOCCO</b><i>Hype</i></button>
      <div className="v3TopActions"><button aria-label="Notificações"><Bell/></button><button className="v3Avatar" onClick={() => setTab('perfil')}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Perfil"/> : <span>{profile.nome_publico?.[0] || 'H'}</span>}</button></div>
    </header>

    <div className="v3Layout">
      <nav className="v3SideNav">{nav.map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); if (key === 'drops') setTimeout(openDrops, 120); }}><Icon/><span>{label}</span></button>)}</nav>

      <section className="v3Content">
        {tab === 'inicio' && <>
          <section className="v3Hero"><div><small>CONEXÕES REAIS · BENEFÍCIOS TOTAIS</small><h1>Olá, {safeName(profile)}.</h1><p>Ofertas, missões, Drops e recompensas em um só lugar.</p></div><div className="v3HeroBadge"><Sparkles/><b>{profile.hc || 0}</b><span>HC</span></div></section>
          <Stats profile={profile} daily={daily} frequency={frequency}/>
          <SectionTitle icon={Flame} title="Ofertas do Momento" action="Ver todas" onAction={() => setTab('ofertas')}/>
          <div className="v3OfferRail">{offers.slice(0, 3).map((row) => <OfferCard key={row.id} row={row} onOpen={openOffer}/>)}{!offers.length && <EmptyOffers/>}</div>
          <OfferMission mission={offerMission} onOpen={() => setTab('ofertas')}/>
          <SponsorStrip rows={brands} onOpen={openBrand}/>
          <section className="v3DropPreview"><div><small>DROPS HOCCO</small><h2>Benefícios e experiências para quem participa.</h2><p>A elegibilidade usa HC, frequência, missões e outros critérios definidos em cada oportunidade.</p></div><button onClick={openDrops}>VER DROPS <ChevronRight/></button></section>
          <div className="v3ActionGrid"><button onClick={() => setTab('missoes')}><Target/><div><b>Missões</b><span>Ganhe HC e XP com participação real.</span></div><ChevronRight/></button><button onClick={() => location.href = '/empresa'}><Building2/><div><b>Publicar uma oferta</b><span>R$ 39,90 por dia · até 50 empresas.</span></div><ChevronRight/></button></div>
        </>}

        {tab === 'ofertas' && <>
          <section className="v3PageHead"><div><small>ATÉ 50 EMPRESAS POR DIA</small><h1>Ofertas do Momento</h1><p>Promoções e serviços publicados para a comunidade HOCCO. Clique e vá direto para o canal da empresa.</p></div><button className="v3Primary" onClick={() => location.href = '/empresa'}><Building2/> PUBLICAR OFERTA</button></section>
          <div className="v3Filters"><label><Search/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa ou oferta"/></label><div>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <OfferMission mission={offerMission}/>
          <div className="v3OfferGrid">{filteredOffers.map((row) => <OfferCard key={row.id} row={row} onOpen={openOffer} wide/>)}{!filteredOffers.length && <EmptyOffers/>}</div>
          <SponsorStrip rows={brands} onOpen={openBrand}/>
        </>}

        {tab === 'missoes' && <>
          <section className="v3PageHead"><div><small>PARTICIPAÇÃO QUE VIRA PROGRESSÃO</small><h1>Missões</h1><p>As missões mantêm a comunidade ativa sem exigir compras.</p></div></section>
          <div className="v3MissionGrid">
            <MissionCard icon={Tag} title="Folhear descontos" detail="Abra 5 ofertas diferentes hoje." reward="até +2 HC · +10 XP" done={offerMission.completed} progress={`${Math.min(5, offerMission.count || 0)}/5`} onClick={() => setTab('ofertas')}/>
            <MissionCard icon={Youtube} title="Visitar @hoccpov" detail="Acompanhe o canal oficial da HOCCO." reward="+5 XP" done={missionDone('youtube_channel_visit')} onClick={visitYoutube}/>
            <MissionCard icon={Gamepad2} title={MINIGAMES[dailyGame]?.name || 'Minigame HOCCO'} detail="Conclua o minigame definido para hoje." reward="+5 XP" done={missionDone('minigame_daily')} onClick={() => setGameOpen(true)}/>
            <MissionCard icon={Flame} title="Manter a frequência" detail="Sua primeira sessão válida do dia mantém a ofensiva." reward="+1 HC · +5 XP" done={(daily?.frequency_hc || 0) >= 1}/>
          </div>
          <section className="v3ProgressCard"><div><small>SEU PROGRESSO</small><h2>{profile.ofensiva_dias || 0} dias de ofensiva</h2><p>Maior ofensiva: {profile.maior_ofensiva || profile.ofensiva_dias || 0} dias · {profile.missoes_concluidas || 0} missões concluídas.</p></div><Trophy/></section>
          <SponsorStrip rows={brands} onOpen={openBrand}/>
        </>}

        {tab === 'drops' && <>
          <section className="v3PageHead"><div><small>PRODUTOS · EXPERIÊNCIAS · BENEFÍCIOS</small><h1>Drops HOCCO</h1><p>A partir de 100 HC nos Drops e 500 HC nas oportunidades diretamente ligadas a empresas, quando HC for o critério escolhido.</p></div></section>
          <section className="v3DropHero"><Gift/><div><b>Elegibilidade real</b><span>HC, XP, frequência e missões podem definir quem entra. Se houver mais elegíveis do que vagas, a HOCCO faz a rodada aleatória registrada.</span></div><button onClick={openDrops}>ABRIR CENTRAL DE DROPS</button></section>
          <div className="v3EligibilityGrid"><article><Sparkles/><b>100+ HC</b><span>Base para Drops quando HC for critério.</span></article><article><Building2/><b>500+ HC</b><span>Base para ações diretamente ligadas a empresas.</span></article><article><Flame/><b>Frequência</b><span>Constância também pode tornar o membro elegível.</span></article><article><Target/><b>Missões</b><span>Atividade recente pode ser usada como critério.</span></article></div>
          <SponsorStrip rows={brands} onOpen={openBrand}/>
        </>}

        {tab === 'perfil' && <>
          <section className="v3ProfileHero"><div className="v3ProfileAvatar">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : <span>{profile.nome_publico?.[0] || 'H'}</span>}</div><div><small>MEMBRO HOCCO</small><h1>{profile.nome_publico}</h1><p>{profile.username ? `@${profile.username}` : 'Seu perfil dentro da comunidade.'}</p></div><button onClick={() => setEditOpen(true)}>EDITAR</button></section>
          <Stats profile={profile} daily={daily} frequency={frequency}/>
          <SponsorStrip rows={brands} onOpen={openBrand}/>
          <div className="v3ProfileActions"><button onClick={() => setImpulseOpen(true)}><HeartHandshake/><div><b>Fazer uma Impulsão</b><span>Apoio voluntário a partir de R$ 3.</span></div><ChevronRight/></button><button onClick={() => location.href = '/patrocinar-app'}><Award/><div><b>Patrocinar o app</b><span>Marcas Permanentes nos 5 quadros.</span></div><ChevronRight/></button><button onClick={() => location.href = '/termos'}><ExternalLink/><div><b>Termos de uso</b><span>Regras da comunidade.</span></div><ChevronRight/></button><button onClick={logout}><LogOut/><div><b>Sair</b><span>Encerrar esta sessão.</span></div></button></div>
        </>}
      </section>
    </div>

    <nav className="v3BottomNav">{nav.map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); if (key === 'drops') setTimeout(openDrops, 120); }}><Icon/><span>{label}</span></button>)}</nav>

    {toast && <div className="v3Toast">{toast}</div>}
    {gameOpen && <MiniGamesModal dailyGame={dailyGame} doneToday={missionDone('minigame_daily')} onFinish={completeMiniGame} onClose={() => setGameOpen(false)}/>} 
    {impulseOpen && <ImpulseModal amount={impulseAmount} setAmount={setImpulseAmount} row={activeImpulse} busy={busy} onCreate={createImpulse} onPaid={reportImpulse} onClose={() => { setImpulseOpen(false); setActiveImpulse(null); }}/>} 
    {editOpen && <EditProfile profile={profile} onSave={saveProfile} onClose={() => setEditOpen(false)}/>} 
  </main>;
}

function Stats({ profile, daily, frequency }) {
  return <div className="v3Stats"><article><span className="gold"><Sparkles/></span><div><b>{profile.hc || 0}</b><small>HC</small></div></article><article><span className="blue"><Zap/></span><div><b>{profile.xp || 0}</b><small>XP</small></div></article><article><span className="orange"><Flame/></span><div><b>{profile.ofensiva_dias || 0}</b><small>Ofensiva</small></div></article><article><span className="cyan"><Award/></span><div><b>{frequency}%</b><small>Frequência</small></div></article><article className="desktopOnly"><span className="purple"><Target/></span><div><b>{daily?.hc_earned || 0}/3</b><small>HC hoje</small></div></article></div>;
}

function SectionTitle({ icon: Icon, title, action, onAction }) {
  return <div className="v3SectionTitle"><div><Icon/><h2>{title}</h2></div>{action && <button onClick={onAction}>{action} <ChevronRight/></button>}</div>;
}

function OfferCard({ row, onOpen, wide }) {
  return <article className={`v3OfferCard ${wide ? 'wide' : ''}`}>
    <div className="v3OfferCover">{row.capa_url ? <img src={row.capa_url} alt=""/> : <div className="v3CoverFallback"><Tag/></div>}<span>{row.categoria || row.segmento || 'Oferta'}</span></div>
    <div className="v3OfferBody"><div className="v3CompanyLine">{row.logo_url ? <img src={row.logo_url} alt=""/> : <span>{row.nome_fantasia?.[0] || 'H'}</span>}<div><b>{row.nome_fantasia}</b><small>{row.instagram || row.segmento || 'Parceiro HOCCO'}</small></div></div><h3>{row.oferta_texto || row.titulo}</h3>{row.descricao && <p>{row.descricao}</p>}<div className="v3OfferMeta"><span>Válido {row.display_date ? `em ${dateBR(`${row.display_date}T12:00:00-03:00`)}` : 'hoje'}</span><span>{row.cliques || 0} acessos</span></div><button onClick={() => onOpen(row)}>Ver oferta <ExternalLink/></button></div>
  </article>;
}

function EmptyOffers() {
  return <div className="v3Empty"><Tag/><b>Nenhuma oferta ativa agora.</b><span>As ofertas aprovadas para hoje aparecem aqui automaticamente.</span></div>;
}

function OfferMission({ mission, onOpen }) {
  const count = Math.min(5, Number(mission?.count || 0));
  return <section className="v3OfferMission"><Target/><div><small>MISSÃO EM DESTAQUE</small><h3>Folhear descontos</h3><p>Abra 5 ofertas diferentes e conclua a missão do dia.</p><div className="v3MissionBar"><span style={{ width: `${(count / 5) * 100}%` }}/></div><b>{count}/5</b></div><div className="v3MissionReward"><span>HC</span><b>{mission?.completed ? 'CONCLUÍDA' : 'até +2'}</b><small>+10 XP</small>{onOpen && <button onClick={onOpen}>ABRIR</button>}</div></section>;
}

function SponsorStrip({ rows, onOpen }) {
  if (!rows?.length) return null;
  return <section className="v3SponsorStrip"><div className="v3SectionTitle"><div><Award/><h2>Marcas parceiras</h2></div><small>Patrocinadores do app</small></div><div className="v3SponsorLogos">{rows.slice(0, 5).map((row) => <button key={row.id} title={row.nome_fantasia} onClick={() => onOpen(row)}>{row.logo_url ? <img src={row.logo_url} alt={row.nome_fantasia}/> : <span>{row.nome_fantasia?.[0]}</span>}</button>)}</div></section>;
}

function MissionCard({ icon: Icon, title, detail, reward, done, progress, onClick }) {
  return <button className={`v3MissionCard ${done ? 'done' : ''}`} onClick={onClick}><span><Icon/></span><div><b>{title}</b><p>{detail}</p>{progress && <small>{progress}</small>}</div><strong>{done ? 'CONCLUÍDA' : reward}</strong>{done ? <CheckCircle2/> : <ChevronRight/>}</button>;
}

function ImpulseModal({ amount, setAmount, row, busy, onCreate, onPaid, onClose }) {
  const payload = row ? pixPayload(row.amount, row.reference_code) : null;
  return <div className="v3ModalBackdrop" onClick={onClose}><section className="v3Modal" onClick={(e) => e.stopPropagation()}><button className="v3ModalClose" onClick={onClose}><X/></button><small>IMPULSÃO HOCCO</small><h2>Apoio voluntário</h2><p>A Impulsão não compra HC, voto ou prioridade. Após confirmação, registra +5 XP fixos.</p>{!row ? <><div className="v3AmountGrid">{IMPULSE_PRESETS.map((v) => <button className={Number(amount) === v ? 'active' : ''} key={v} onClick={() => setAmount(v)}>{brl(v)}</button>)}</div><label className="v3Field">Outro valor<input type="number" min="3" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}/></label><button className="v3Primary full" disabled={busy} onClick={onCreate}>GERAR PIX · {brl(Number(amount || 0))}</button></> : <div className="v3Pix"><QRCodeSVG value={payload} size={190}/><b>{brl(row.amount)}</b><span>{PIX_RECEIVER}</span><span>{PIX_BANK}</span><span>{PIX_CITY}</span><textarea readOnly value={payload}/><button onClick={() => navigator.clipboard?.writeText(payload)}>COPIAR PIX</button>{row.status === 'aguardando_pagamento' && <button className="v3Primary" onClick={onPaid}>JÁ FIZ O PIX</button>}</div>}</section></div>;
}

function EditProfile({ profile, onSave, onClose }) {
  return <div className="v3ModalBackdrop" onClick={onClose}><form className="v3Modal" onClick={(e) => e.stopPropagation()} onSubmit={onSave}><button type="button" className="v3ModalClose" onClick={onClose}><X/></button><small>PERFIL</small><h2>Editar informações</h2><label className="v3Field">Nome público<input name="nome" defaultValue={profile.nome_publico || ''} required/></label><label className="v3Field">@ do membro<input name="username" defaultValue={profile.username || ''}/></label><label className="v3Field">Bio<textarea name="bio" defaultValue={profile.bio || ''}/></label><button className="v3Primary full">SALVAR PERFIL</button></form></div>;
}
