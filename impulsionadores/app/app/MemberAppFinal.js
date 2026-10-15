'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDownRight, ArrowUpRight, Building2, CalendarDays, Check, ChevronRight, CirclePlay, Clock3, Compass, ExternalLink, Flame, Gift, Heart, Home, LogOut, MessageCircle, Search, Send, ShieldCheck, Sparkles, Tag, Target, Trash2, UserRound, Video, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { HOCCO_WHATSAPP, todayBR, whatsappUrl } from '../../lib/config';
import { MINIGAMES, MiniGamesModal } from '../components/Minigames';
import MemberCommunity from './MemberCommunity';
import './member-final.css';

const NAV = [
  ['inicio', Home, 'Início'],
  ['historia', Archive, 'História'],
  ['descobrir', Compass, 'Descobrir'],
  ['missoes', Target, 'Missões'],
  ['perfil', UserRound, 'Perfil'],
];
const CATEGORIES = ['Tudo', 'Alimentação', 'Fitness', 'Beleza', 'Serviços', 'Casa', 'Pets'];

function displayDate(value, full = false) {
  if (!value) return 'A definir';
  try { return new Intl.DateTimeFormat('pt-BR', full ? { dateStyle: 'long', timeZone: 'America/Sao_Paulo' } : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
  catch { return String(value); }
}
function firstName(profile) { return String(profile?.nome_publico || 'Membro').trim().split(/\s+/)[0] || 'Membro'; }
function storyMedia(item) { return item?.media_url || item?.image_url || item?.cover_url || item?.thumbnail_url || ''; }

export default function MemberAppFinal() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('inicio');
  const [stories, setStories] = useState([]);
  const [storiesMode, setStoriesMode] = useState('today');
  const [selectedStory, setSelectedStory] = useState(null);
  const [requestedVideo, setRequestedVideo] = useState(null);
  const [offers, setOffers] = useState([]);
  const [saved, setSaved] = useState(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [missions, setMissions] = useState([]);
  const [daily, setDaily] = useState(null);
  const [dailyGame, setDailyGame] = useState('pulso');
  const [gameOpen, setGameOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [category, setCategory] = useState('Tudo');
  const [creditName, setCreditName] = useState('');
  const [creditText, setCreditText] = useState('');
  const [creditConsent, setCreditConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const announce = useCallback((message) => {
    setToast(message);
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => setToast(''), 3800);
  }, []);

  const loadStories = useCallback(async (mode = 'today') => {
    const { data, error: rpcError } = await supabase.rpc('hocco_story_feed', { p_mode: mode, p_limit: 50 });
    if (rpcError) { setError('Não foi possível carregar a história agora. Tente atualizar em instantes.'); return; }
    setStories(Array.isArray(data) ? data : []);
    setError('');
  }, []);

  const loadOffers = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('hocco_ofertas').select('id,nome_fantasia,logo_url,capa_url,categoria,segmento,titulo,oferta_texto,descricao,destino_url,display_date,starts_at,ends_at,valor,status,hocco_empresa_id,benefit_type,benefit_equivalent_percent').eq('status', 'active').eq('display_date', todayBR()).order('created_at', { ascending: false }).limit(30);
    if (queryError) { setError('As oportunidades não carregaram. Tente atualizar em instantes.'); return; }
    setOffers(data || []);
  }, []);

  const loadSaved = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('member_saved_company_ids');
    if (!rpcError) setSaved(new Set((data || []).map(row => typeof row === 'string' ? row : row.empresa_id || row.id).filter(Boolean)));
  }, []);

  const loadMemberData = useCallback(async (member, mode = 'today') => {
    await Promise.all([
      loadStories(mode),
      loadOffers(),
      loadSaved(),
      (async () => {
        const date = todayBR();
        const [missionRes, dailyRes, gameRes] = await Promise.all([
          supabase.from('impulsionadores_missoes_diarias').select('mission_key,completed_at').eq('user_id', member.id).eq('mission_date', date),
          supabase.from('hc_diario').select('frequency_hc,activity_date').eq('user_id', member.id).eq('activity_date', date).maybeSingle(),
          supabase.rpc('get_daily_minigame'),
        ]);
        setMissions(missionRes.data || []);
        setDaily(dailyRes.data || null);
        setDailyGame(gameRes.data || 'pulso');
      })(),
    ]);
  }, [loadOffers, loadSaved, loadStories]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) { location.replace('/'); return; }
      setUser(auth.user);
      const { data: adminAccess } = await supabase.from('hocco_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
      if (active) setIsAdmin(Boolean(adminAccess));
      let { data: member } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', auth.user.id).maybeSingle();
      if (!member) {
        const { data } = await supabase.from('impulsionadores_perfis').insert({ user_id: auth.user.id, nome_publico: auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || 'Membro HOCCO' }).select('*').single();
        member = data;
      }
      if (!active) return;
      setProfile(member);
      setCreditName(member?.nome_publico || '');
      await supabase.from('impulsionadores_sessoes').insert({ user_id: auth.user.id, platform: navigator.platform || 'web', user_agent: navigator.userAgent, path: '/app' });
      await loadMemberData(auth.user);
      if (active) setLoading(false);
    })().catch(() => { if (active) { setError('Não foi possível abrir sua área HOCCO. Atualize a página para tentar novamente.'); setLoading(false); } });
    return () => { active = false; };
  }, [loadMemberData]);

  useEffect(() => {
    const syncInstalled = () => setInstalled(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
    const captureInstall = event => { event.preventDefault(); setInstallPrompt(event); };
    syncInstalled();
    window.addEventListener('beforeinstallprompt', captureInstall);
    window.addEventListener('appinstalled', syncInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', captureInstall); window.removeEventListener('appinstalled', syncInstalled); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`hocco-project-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_content_items' }, () => loadStories(storiesMode))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_ofertas' }, loadOffers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, loadOffers, loadStories, storiesMode]);

  const filteredOffers = useMemo(() => offers.filter(offer => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !q || `${offer.nome_fantasia || ''} ${offer.titulo || ''} ${offer.oferta_texto || ''} ${offer.categoria || ''} ${offer.segmento || ''}`.toLocaleLowerCase('pt-BR').includes(q);
    return matchesSearch && (category === 'Tudo' || offer.categoria === category) && (!savedOnly || saved.has(offer.hocco_empresa_id));
  }), [offers, search, category, savedOnly, saved]);

  const todayStories = useMemo(() => stories.slice(0, 4), [stories]);
  const filteredStories = useMemo(() => {
    const q = historySearch.trim().toLocaleLowerCase('pt-BR');
    if (!q) return stories;
    return stories.filter(item => `${item.title || ''} ${item.body || ''} ${item.episode_label || ''} ${item.story_kind || ''}`.toLocaleLowerCase('pt-BR').includes(q));
  }, [stories, historySearch]);
  const isMissionDone = key => missions.some(item => item.mission_key === key);

  async function toggleSaved(offer) {
    const companyId = offer.hocco_empresa_id;
    if (!companyId) { announce('Esta empresa ainda não tem um perfil HOCCO para salvar.'); return; }
    const { error: rpcError } = await supabase.rpc('toggle_saved_company', { p_empresa_id: companyId });
    if (rpcError) { announce('Não foi possível atualizar seus salvos agora.'); return; }
    await loadSaved();
  }

  async function openOffer(offer) {
    const popup = window.open('about:blank', '_blank');
    const { data, error: rpcError } = await supabase.rpc('registrar_oferta_evento', { p_oferta_id: offer.id, p_event: 'click' });
    if (rpcError || !data) { popup?.close(); announce('Esta condição não está disponível agora.'); return; }
    if (popup) { popup.opener = null; popup.location.replace(data); }
    else location.href = data;
  }

  async function submitCredit(event) {
    event.preventDefault();
    if (!selectedStory?.id || busy) return;
    setBusy(true);
    const { data: submitted, error: rpcError } = await supabase.rpc('submit_credit_message', {
      p_content_id: selectedStory.id,
      p_public_name: creditName.trim(),
      p_message: creditText.trim(),
      p_consent: creditConsent,
    });
    setBusy(false);
    if (rpcError) {
      const reason = rpcError.message || '';
      announce(reason.includes('credit_message_locked') ? 'Esta mensagem já foi selecionada e não pode mais ser alterada.' : reason.includes('watch_required') ? 'Assista ao vídeo pelo tempo mínimo antes de enviar.' : reason.includes('credits_closed') ? 'O prazo para enviar mensagens para esta publicação terminou.' : reason.includes('links_not_allowed') ? 'Mensagens para os créditos não podem conter links ou e-mails.' : reason.includes('contact_data_not_allowed') ? 'Não inclua telefone ou outros dados de contato.' : 'Não foi possível enviar sua mensagem. Verifique os campos e tente novamente.');
      return;
    }
    setCreditText(''); setCreditConsent(false);
    announce('Mensagem recebida para análise editorial.');
    setSelectedStory({ ...selectedStory, myMessage: { content_id: selectedStory.id, public_name: creditName.trim(), message: creditText.trim(), status: submitted?.status || 'submitted' } });
  }

  async function logout() { await supabase.auth.signOut(); location.replace('/'); }

  async function finishGame(key, result) {
    if (!user || key !== dailyGame || isMissionDone('minigame_daily')) return;
    const { error: insertError } = await supabase.from('impulsionadores_missoes_diarias').insert({ user_id: user.id, mission_date: todayBR(), mission_key: 'minigame_daily', metadata: { game_key: key, result } });
    if (!insertError || insertError.code === '23505') {
      setMissions(current => current.some(item => item.mission_key === 'minigame_daily') ? current : [...current, { mission_key: 'minigame_daily' }]);
      setGameOpen(false);
      announce('Desafio diário concluído.');
    } else announce('Não foi possível registrar o desafio agora.');
  }

  async function installApp() {
    if (installed) return;
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice?.outcome === 'accepted') setInstalled(true);
    } else announce('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
  }

  async function deleteAccount() {
    if (!window.confirm('Excluir sua conta HOCCO? Seus dados pessoais serão anonimizados. Registros mínimos de auditoria, financeiro e métricas agregadas podem ser preservados.')) return;
    if (window.prompt('Para confirmar, digite EXCLUIR') !== 'EXCLUIR') return;
    setBusy(true);
    const { data: result, error: deleteError } = await supabase.rpc('excluir_minha_conta_hype');
    if (deleteError || !result?.ok) { setBusy(false); announce('Não foi possível concluir a exclusão com segurança. Fale com o Suporte HOCCO.'); return; }
    try {
      const { data: files } = await supabase.storage.from('impulsionadores-avatars').list(user.id, { limit: 100 });
      const paths = (files || []).map(file => `${user.id}/${file.name}`);
      if (paths.length) await supabase.storage.from('impulsionadores-avatars').remove(paths);
    } catch {}
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    localStorage.removeItem('hocco_app_installed');
    location.replace('/?conta=excluida');
  }

  if (loading) return <main className="hoccoProject"><div className="hpLoading"><span className="hpMark">H<span>.</span></span><p>Voltando para a história…</p></div></main>;
  if (!profile) return <main className="hoccoProject"><section className="hpLoadError"><h1>Não conseguimos abrir seu perfil.</h1><p>{error || 'Sua sessão continua protegida. Atualize a página para tentar novamente.'}</p><button onClick={() => location.reload()}>Tentar novamente</button></section></main>;

  return <main className="hoccoProject">
    <header className="hpHeader">
      <button className="hpWordmark" onClick={() => setTab('inicio')} aria-label="HOCCO, início">HOCCO<span>.</span></button>
      <span className="hpHeaderTag"><i/> A HISTÓRIA ACONTECE AGORA</span>
      <div className="hpHeaderActions"><MemberCommunity profile={profile} onRefresh={() => loadMemberData(user)} requestedItem={requestedVideo} onVideoOpened={() => setRequestedVideo(null)}/><button className="hpAvatar" onClick={() => setTab('perfil')} aria-label="Abrir perfil">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : firstName(profile).slice(0, 1).toUpperCase()}</button></div>
    </header>

    {error && <div className="hpNotice" role="status">{error}<button onClick={() => { setError(''); loadMemberData(user); }}>Atualizar</button></div>}

    <section className="hpMain" key={tab}>
      {tab === 'inicio' && <>
        <section className="hpGreeting"><div><span className="hpEyebrow"><i/> HOCCO HOJE · {displayDate(new Date(), true)}</span><h1>Olá, {firstName(profile)}.</h1><p>A história continua acontecendo. Veja o que mudou desde a última vez.</p></div><div className="hpNow"><span>AGORA</span><b>{todayStories.length ? 'Tem novidade na história' : 'Aguardando o próximo capítulo'}</b><small>{todayStories.length ? `${todayStories.length} publicação(ões) no HOCCO Hoje` : 'Volte em breve para acompanhar os próximos acontecimentos.'}</small></div></section>
        {todayStories[0] ? <StoryHero item={todayStories[0]} onOpen={() => { setSelectedStory(todayStories[0]); setTab('historia'); }}/>:<section className="hpQuiet"><div className="hpQuietFrame"><div className="hpRec"><i/> REC</div><span>HOCCO · ARQUIVO VIVO</span><p>Os próximos acontecimentos aparecem aqui quando a equipe publicar.</p></div><div className="hpQuietCopy"><span className="hpEyebrow">O PRESENTE DA SÉRIE</span><h2>Você está em dia com a história.</h2><p>Acompanhe os bastidores, as pessoas e as decisões que formam a trajetória da HOCCO.</p><button className="hpTextButton" onClick={() => setTab('historia')}>Explorar a linha do tempo <ArrowDownRight/></button></div></section>}
        <section className="hpSince"><div className="hpSectionHead"><div><span className="hpEyebrow">DESDE A ÚLTIMA VEZ</span><h2>O que está acontecendo</h2></div><button className="hpTextButton" onClick={() => setTab('historia')}>Ver a história <ChevronRight/></button></div><div className="hpStoryGrid">{todayStories.slice(1, 4).map(item => <StoryCard key={item.id} item={item} onClick={() => { setSelectedStory(item); setTab('historia'); }}/>) }{todayStories.length <= 1 && <div className="hpInlineEmpty">Novos registros aparecerão nesta área conforme a história avança.</div>}</div></section>
        <section className="hpEditorialRow"><div className="hpEditorialText"><span className="hpEyebrow">PARTICIPAÇÃO DA COMUNIDADE</span><h2>Você também faz parte dos créditos.</h2><p>Deixe uma mensagem para a equipe editorial. Algumas mensagens podem aparecer nos créditos de uma publicação.</p><button className="hpButton hpButtonDark" onClick={() => setTab('historia')}>Acompanhar a história <ChevronRight/></button></div><div className="hpEditorialNote"><MessageCircle/><span>Mensagem para os créditos</span><small>Com revisão editorial · até 140 caracteres</small><b>SEM RECOMPENSA EM HC</b></div></section>
        <section className="hpHomeFoot"><div><span className="hpEyebrow">SUA PARTICIPAÇÃO</span><h3>{profile.ofensiva_dias || 0} dias de presença</h3><p>O HC acompanha marcos de participação e experiências disponíveis.</p></div><div className="hpBalance"><span>SALDO</span><b>{profile.hc || 0}<small> HC</small></b><span>{profile.xp || 0} XP · nível {profile.nivel || 1}</span></div><button className="hpTextButton" onClick={() => setTab('missoes')}>Ver minhas missões <ChevronRight/></button></section>
      </>}

      {tab === 'historia' && <>
        <PageTitle eyebrow="HOCCO · ARQUIVO VIVO" title="História" text="Acompanhe os acontecimentos, os bastidores e os registros que formam a série."/>
        <div className="hpSegment"><button className={storiesMode === 'today' ? 'active' : ''} onClick={() => { setStoriesMode('today'); loadStories('today'); }}>HOCCO Hoje</button><button className={storiesMode === 'archive' ? 'active' : ''} onClick={() => { setStoriesMode('archive'); loadStories('archive'); }}><Archive/> Arquivo</button><button className="hpRefresh" onClick={() => loadStories(storiesMode)}>Atualizar</button></div>
        <label className="hpSearch hpArchiveSearch"><Search/><input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Buscar na história e no arquivo"/><button onClick={() => setHistorySearch('')} aria-label="Limpar busca"><X/></button></label>
        {selectedStory && <StoryDetail item={selectedStory} creditName={creditName} setCreditName={setCreditName} creditText={creditText} setCreditText={setCreditText} creditConsent={creditConsent} setCreditConsent={setCreditConsent} busy={busy} onSubmit={submitCredit} onOpenVideo={item => setRequestedVideo(item)} onClose={() => setSelectedStory(null)}/>}
        <div className="hpTimeline">{filteredStories.map(item => <article className="hpTimelineItem" key={item.id}><div className="hpTimelineRail"><i/></div><div className="hpTimelineDate">{displayDate(item.occurred_at || item.starts_at)}</div><button className="hpTimelineCard" onClick={() => setSelectedStory(item)}>{storyMedia(item) && <img src={storyMedia(item)} alt=""/>}<span className="hpEyebrow">{storyKind(item)}{item.episode_label ? ` · ${item.episode_label}` : ''}</span><b>{item.title}</b>{item.body && <p>{item.body}</p>}<small>{item.exclusive_app ? 'BASTIDOR PARA MEMBROS' : 'REGISTRO DA SÉRIE'} <ChevronRight/></small></button></article>)}{!filteredStories.length && <div className="hpEmpty"><Archive/><h3>{stories.length ? 'Nenhum registro corresponde à busca.' : storiesMode === 'archive' ? 'O arquivo está sendo organizado.' : 'Ainda não há uma publicação nova.'}</h3><p>{stories.length ? 'Tente outro nome, episódio ou acontecimento.' : 'Os registros publicados pela equipe HOCCO aparecem aqui.'}</p></div>}</div>
      </>}

      {tab === 'descobrir' && <>
        <PageTitle eyebrow="LUGARES · PESSOAS · EXPERIÊNCIAS" title="Descobrir" text="Encontre empresas e experiências que fazem parte da comunidade HOCCO."/>
        <section className="hpBusiness"><div><span className="hpEyebrow">PARA EMPRESAS</span><h3>Sua empresa também pode fazer parte.</h3><p>Publique uma condição real para a comunidade e acompanhe os resultados pelo seu próprio painel.</p></div><button className="hpButton hpButtonDark" onClick={() => location.href = '/empresa'}>Abrir área da empresa <ChevronRight/></button></section>
        <label className="hpSearch"><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, serviço ou categoria"/><button onClick={() => setSearch('')} aria-label="Limpar busca"><X/></button></label>
        <div className="hpFilters">{CATEGORIES.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}<button className={savedOnly ? 'active' : ''} onClick={() => setSavedOnly(value => !value)}>Salvos</button></div>
        <div className="hpDiscoverHead"><div><span className="hpEyebrow">VANTAGENS PARA MEMBROS</span><h2>Condições disponíveis hoje</h2></div><span>{filteredOffers.length} {filteredOffers.length === 1 ? 'empresa' : 'empresas'}</span></div>
        <div className="hpOfferGrid">{filteredOffers.map(offer => <OfferCard key={offer.id} offer={offer} saved={saved.has(offer.hocco_empresa_id)} onSave={() => toggleSaved(offer)} onOpen={() => openOffer(offer)}/>)}</div>
        {!filteredOffers.length && <div className="hpEmpty"><Building2/><h3>{savedOnly ? 'Nenhuma empresa salva com condição ativa.' : 'Nenhuma condição disponível agora.'}</h3><p>{savedOnly ? 'Salve uma empresa para encontrá-la aqui quando publicar uma condição.' : 'As empresas parceiras aparecem aqui enquanto suas condições estão ativas.'}</p></div>}
        <div className="hpDiscoverExtras"><div className="hpExperienceLink"><div><Sparkles/><span><b>Experiências e resgates</b><small>Veja experiências abertas para membros e acompanhe seus avisos.</small></span></div><button onClick={() => window.dispatchEvent(new Event('hocco:open-experiences'))}>Abrir experiências <ChevronRight/></button></div><div className="hpExperienceLink"><div><Gift/><span><b>Oportunidades HOCCO</b><small>Confira participações abertas e acompanhe suas inscrições.</small></span></div><button onClick={() => window.dispatchEvent(new Event('hocco:open-drops'))}>Ver oportunidades <ChevronRight/></button></div></div>
      </>}

      {tab === 'missoes' && <>
        <PageTitle eyebrow="PARTICIPAÇÃO · PROGRESSO" title="Missões" text="Pequenas ações para acompanhar a história. O HC permanece ligado aos marcos de participação e às experiências."/>
        <div className="hpStreak"><div className="hpStreakIcon"><Flame/></div><div><span className="hpEyebrow">SUA SEQUÊNCIA</span><b>{profile.ofensiva_dias || 0} {Number(profile.ofensiva_dias) === 1 ? 'dia' : 'dias'}</b><small>O próximo marco de HC é calculado automaticamente pelo ciclo da comunidade.</small></div><div className="hpStreakBalance"><span>HC</span><b>{profile.hc || 0}</b></div></div>
        <div className="hpMissionList">
          <MissionRow done={Boolean(daily)} title="Estar presente hoje" text="Acesse a HOCCO para manter sua participação registrada." progress={daily ? 'Concluída hoje' : 'Ainda não registrada'} icon={Check}/>
          <MissionRow done={isMissionDone('minigame_daily')} title={MINIGAMES[dailyGame]?.name || 'Desafio diário'} text="O desafio muda diariamente. XP registra sua participação." progress={isMissionDone('minigame_daily') ? 'Concluída hoje' : 'Jogar desafio'} icon={Target} action={() => setGameOpen(true)}/>
        </div>
        <a className="hpMissionExternal" href="https://www.youtube.com/@hoccpov" target="_blank" rel="noreferrer"><span><CirclePlay/><b>Acompanhe a série no YouTube</b><small>A reprodução externa não conta como missão até a HOCCO confirmar o tempo assistido.</small></span><ExternalLink/></a>
        <div className="hpMissionNote"><span>XP acompanha sua participação.</span><b>HC não é dinheiro e não é concedido por cliques ou visualizações.</b></div>
      </>}

    {tab === 'perfil' && <>
        <PageTitle eyebrow="SUA CONTA HOCCO" title="Perfil" text="Sua participação na série, seus saldos e suas preferências."/>
        <section className="hpProfile"><div className="hpProfileTop"><div className="hpProfileAvatar">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : firstName(profile).slice(0, 1).toUpperCase()}</div><div><h2>{profile.nome_publico}</h2><span>{profile.username ? `@${profile.username}` : 'Membro HOCCO'}</span></div></div><div className="hpProfileStats"><div><span>HC</span><b>{profile.hc || 0}</b><small>créditos HOCCO</small></div><div><span>XP</span><b>{profile.xp || 0}</b><small>participação</small></div><div><span>NÍVEL</span><b>{profile.nivel || 1}</b><small>na comunidade</small></div><div><span>SEQUÊNCIA</span><b>{profile.ofensiva_dias || 0}</b><small>dias</small></div></div></section>
        <section className="hpBusiness"><div><span className="hpEyebrow">PARA EMPRESAS</span><h3>Faça parte da comunidade.</h3><p>Empresas, MEIs e prestadores podem apresentar uma condição real para membros HOCCO.</p></div><button className="hpButton hpButtonDark" onClick={() => location.href = '/empresa?novo=1'}>Conhecer área de empresas <ChevronRight/></button></section>
        <section className="hpSupport"><div><span className="hpEyebrow">AJUDA E PRIVACIDADE</span><p>Se precisar de ajuda com seu perfil ou quiser encerrar sua conta, fale com a equipe HOCCO.</p><a href={whatsappUrl(HOCCO_WHATSAPP, 'Olá! Preciso de suporte com minha conta no app HOCCO.')} target="_blank" rel="noreferrer"><MessageCircle/> Suporte HOCCO <ExternalLink/></a></div><button onClick={deleteAccount} disabled={busy}><Trash2/>{busy ? 'PROCESSANDO…' : 'Excluir minha conta'}</button></section>
        <section className="hpSettings"><div><span><b>Conta conectada</b><small>{user?.email || 'E-mail não disponível'}</small></span><Check/></div><button onClick={() => document.querySelector('.hpHeaderActions .mcBell')?.click()}><span><b>Novidades e experiências</b><small>Publicações, avisos e resgates</small></span><ChevronRight/></button><button onClick={() => window.dispatchEvent(new Event('hocco:request-push'))}><span><b>Lembretes HOCCO</b><small>Opcional · você controla as notificações no aparelho</small></span><ChevronRight/></button>{!installed && <button onClick={installApp}><span><b>Levar HOCCO com você</b><small>Instale para acompanhar novos acontecimentos</small></span><ChevronRight/></button>}{isAdmin && <button onClick={() => location.href = '/controle'}><span><b>HOCCO Control</b><small>Operação administrativa · acesso restrito</small></span><ShieldCheck/></button>}<button onClick={logout}><span><b>Sair da conta</b><small>Encerrar esta sessão neste dispositivo</small></span><LogOut/></button></section>
        <footer className="hpLegal">Uma produção original DOOX Studios · HOCCO.</footer>
      </>}
    </section>

    <nav className="hpBottomNav" aria-label="Navegação principal">{NAV.map(([key, Icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); if (key !== 'historia') setSelectedStory(null); if (key === 'inicio' && storiesMode !== 'today') { setStoriesMode('today'); loadStories('today'); } }}><Icon/><span>{label}</span></button>)}</nav>
    {toast && <div className="hpToast" role="status">{toast}</div>}
    {gameOpen && <MiniGamesModal dailyGame={dailyGame} doneToday={isMissionDone('minigame_daily')} onFinish={finishGame} onClose={() => setGameOpen(false)}/>}
  </main>;
}

function storyKind(item) {
  const labels = { episode: 'EPISÓDIO', video: 'BASTIDOR', behind_the_scenes: 'BASTIDOR', milestone: 'ACONTECIMENTO', event: 'ACONTECIMENTO', archive: 'ARQUIVO', story: 'HISTÓRIA' };
  return labels[item.story_kind || item.content_type] || 'HOCCO · HISTÓRIA';
}
function PageTitle({ eyebrow, title, text }) { return <header className="hpPageTitle"><span className="hpEyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></header>; }
function StoryHero({ item, onOpen }) {
  const media = storyMedia(item);
  return <button className={`hpStoryHero ${media ? 'hasMedia' : ''}`} onClick={onOpen} style={media ? { backgroundImage: `linear-gradient(90deg,rgba(12,12,12,.91),rgba(12,12,12,.14)),url("${media}")` } : undefined}>
    <span className="hpRec"><i/> GRAVANDO</span><span className="hpStoryHeroMeta">{item.episode_label || 'HOCCO · AGORA'} · {displayDate(item.occurred_at || item.starts_at)}</span><span className="hpStoryHeroCopy"><small>{storyKind(item)}{item.exclusive_app ? ' · EXCLUSIVO NO APP' : ''}</small><b>{item.title}</b>{item.body && <span>{item.body}</span>}<em>Abrir registro <ArrowUpRight/></em></span>
    {item.content_type === 'video' && <CirclePlay className="hpPlay"/>}
  </button>;
}
function StoryCard({ item, onClick }) {
  const media = storyMedia(item);
  return <button className="hpStoryCard" onClick={onClick}>{media ? <img src={media} alt=""/> : <div className="hpStoryCardBlank"><span className="hpRec"><i/> REC</span></div>}<span className="hpEyebrow">{storyKind(item)} · {displayDate(item.occurred_at || item.starts_at)}</span><b>{item.title}</b><small>{item.episode_label || 'HOCCO'} <ChevronRight/></small></button>;
}
function StoryDetail({ item, creditName, setCreditName, creditText, setCreditText, creditConsent, setCreditConsent, busy, onSubmit, onOpenVideo, onClose }) {
  const [existing, setExisting] = useState(null);
  const [checkDone, setCheckDone] = useState(false);
  const existingMessage = item.myMessage || existing;
  useEffect(() => { let active = true; supabase.rpc('member_credit_messages').then(({ data }) => { if (active) { setExisting((data || []).find(row => row.content_id === item.id) || null); setCheckDone(true); } }); return () => { active = false; }; }, [item.id]);
  const media = storyMedia(item);
  return <section className="hpStoryDetail" aria-label="Detalhes da publicação">
    <header><span><small>{storyKind(item)} · {item.episode_label || 'HOCCO'}</small><h2>{item.title}</h2></span><button onClick={onClose} aria-label="Fechar detalhes"><X/></button></header>
    {media && <img className="hpStoryDetailImage" src={media} alt=""/>}
    <p className="hpStoryDetailDate"><CalendarDays/>{displayDate(item.occurred_at || item.starts_at, true)}</p>
    {item.body && <p className="hpStoryDetailBody">{item.body}</p>}
    {item.content_type === 'video' && <div className="hpVideoNote"><Video/><span><b>Bastidor em vídeo</b><small>O acesso e a conclusão de vídeos são registrados pelo player HOCCO.</small></span>{item.youtube_video_id || item.video_storage_path ? <button onClick={() => onOpenVideo(item)}>Assistir <ChevronRight/></button> : <small>Este vídeo está sendo preparado.</small>}</div>}
    {item.comments_enabled && <div className="hpCreditBox"><span className="hpEyebrow">PARTICIPAÇÃO NOS CRÉDITOS</span><h3>Deixe uma mensagem para a equipe.</h3><p>Mensagens passam por revisão editorial. Enviar uma mensagem não garante publicação e não gera HC.</p>
      {existingMessage ? <div className="hpExistingMessage"><Check/><span><b>Mensagem enviada</b><small>Status: {existingMessage.status || 'em análise editorial'}</small></span></div> : !checkDone ? <p>Verificando sua participação…</p> : <form onSubmit={onSubmit}><label>Nome público<input value={creditName} onChange={event => setCreditName(event.target.value)} minLength={2} maxLength={40} required/></label><label>Mensagem<textarea value={creditText} onChange={event => setCreditText(event.target.value)} minLength={3} maxLength={140} required placeholder="Escreva até 140 caracteres"/><small>{creditText.length}/140</small></label><label className="hpConsent"><input type="checkbox" checked={creditConsent} onChange={event => setCreditConsent(event.target.checked)} required/><span>Autorizo a HOCCO a avaliar e, se selecionada, publicar esta mensagem com o nome informado.</span></label><button className="hpButton hpButtonOrange" disabled={busy || !creditConsent}>{busy ? 'ENVIANDO…' : 'Enviar mensagem'} <Send/></button></form>}
    </div>}
  </section>;
}
function OfferCard({ offer, saved, onSave, onOpen }) {
  const card = useRef(null);
  const reported = useRef(false);
  const benefit = Number(offer.benefit_equivalent_percent || 0);
  useEffect(() => {
    if (!card.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting || entry.intersectionRatio < .55 || reported.current) return;
      reported.current = true;
      supabase.rpc('registrar_oferta_evento', { p_oferta_id: offer.id, p_event: 'impression' }).then(() => {});
      observer.disconnect();
    }), { threshold: [.55] });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [offer.id]);
  return <article className="hpOfferCard" ref={card}><button className="hpOfferSave" aria-label={saved ? 'Remover empresa dos salvos' : 'Salvar empresa'} onClick={onSave}><Heart fill={saved ? 'currentColor' : 'none'}/></button><div className="hpOfferImage">{offer.capa_url ? <img src={offer.capa_url} alt=""/> : <div className="hpOfferPlaceholder"><Tag/></div>}{offer.logo_url && <span className="hpOfferLogo"><img src={offer.logo_url} alt=""/></span>}</div><div className="hpOfferBody"><span className="hpEyebrow">{offer.categoria || offer.segmento || 'EMPRESA PARCEIRA'}</span><h3>{offer.nome_fantasia}</h3><b className="hpOfferTitle">{offer.oferta_texto || offer.titulo}</b>{offer.descricao && <p>{offer.descricao}</p>}<div className="hpOfferMeta"><span><Clock3/> Válida até {displayDate(offer.ends_at || offer.display_date, false)}</span>{benefit >= 5 && <em>{benefit}% de vantagem</em>}</div><button className="hpButton hpButtonDark" onClick={onOpen}>Ver condição <ExternalLink/></button></div></article>;
}
function MissionRow({ done, title, text, progress, icon: Icon, action }) {
  return <article className={`hpMissionRow ${done ? 'done' : ''}`}><div className="hpMissionIcon">{done ? <Check/> : <Icon/>}</div><div className="hpMissionCopy"><span className="hpEyebrow">{done ? 'CONCLUÍDA' : 'PARTICIPAÇÃO'}</span><h3>{title}</h3><p>{text}</p></div><button className="hpMissionAction" onClick={action} disabled={done}>{progress}{action && !done && <ChevronRight/>}</button></article>;
}
