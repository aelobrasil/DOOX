'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, CheckCircle2, ExternalLink, Gift, Play, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './member-community.css';

let youtubeApi;
function loadYoutubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser_required'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApi) youtubeApi = new Promise((resolve, reject) => {
    const old = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { old?.(); resolve(window.YT); };
    let script = document.querySelector('script[data-hocco-youtube-api]');
    if (!script) { script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.dataset.hoccoYoutubeApi = 'true'; script.onerror = reject; document.head.appendChild(script); }
    setTimeout(() => window.YT?.Player && resolve(window.YT), 9000);
  });
  return youtubeApi;
}

export default function MemberCommunity({ profile, onRefresh, requestedItem = null, onVideoOpened }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('news');
  const [items, setItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [experienceApps, setExperienceApps] = useState([]);
  const [hcConfig, setHcConfig] = useState({ streak_days: 7, reward_hc: 5 });
  const [daily, setDaily] = useState(null);
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [feed, inbox, hc, exp, day, apps] = await Promise.all([
      supabase.rpc('hocco_content_feed'),
      supabase.rpc('member_notification_feed'),
      supabase.rpc('hocco_hc_config_public'),
      supabase.from('hocco_experiencias').select('id,titulo,descricao,hc_cost,hc_min,vagas,inscricoes_abrem_at,inscricoes_fecham_at,evento_at,local_evento,imagem_url').eq('status', 'publicada').gt('hc_cost', 0).order('evento_at', { ascending: true }).limit(30),
      profile?.user_id ? supabase.from('hc_diario').select('frequency_hc').eq('user_id', profile.user_id).eq('activity_date', today).maybeSingle() : Promise.resolve({ data: null }),
      profile?.user_id ? supabase.from('hocco_experiencia_inscricoes').select('experiencia_id,status').eq('user_id', profile.user_id).limit(200) : Promise.resolve({ data: [] }),
    ]);
    setItems(feed.data || []); setNotifications(inbox.data || []);
    const cfg = Array.isArray(hc.data) ? hc.data[0] : hc.data;
    if (cfg) setHcConfig(cfg);
    setExperiences((exp.data || []).filter(isExperienceOpen)); setExperienceApps(apps.data || []); setDaily(day.data || null);
    if (feed.error || inbox.error || exp.error || apps.error) setMessage('Algumas novidades ou experiências não carregaram. Toque em atualizar para tentar novamente.');
  }

  useEffect(() => { if (open) load(); }, [open, profile?.user_id]);
  useEffect(() => {
    const openExperiences = () => { setTab('experiences'); setOpen(true); };
    window.addEventListener('hocco:open-experiences', openExperiences);
    return () => window.removeEventListener('hocco:open-experiences', openExperiences);
  }, []);
  useEffect(() => {
    if (!requestedItem) return;
    setTab('news'); setOpen(true);
    beginVideo(requestedItem);
    onVideoOpened?.();
  }, [requestedItem?.id]);
  useEffect(() => {
    if (!open) return;
    const channel = supabase.channel(`hocco-community-${profile?.user_id || 'member'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_content_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_notifications' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [open, profile?.user_id]);

  const unread = useMemo(() => notifications.filter(n => !n.automatic && !n.read_at).length, [notifications]);
  const streakDays = Math.max(2, Number(hcConfig.streak_days || 7));
  const reward = Math.min(5, Math.max(1, Number(hcConfig.reward_hc || 5)));
  const currentStreak = Number(profile?.ofensiva_dias || 0);
  const gotRewardToday = Number(daily?.frequency_hc || 0) >= reward;
  const streakProgress = gotRewardToday ? 0 : currentStreak % streakDays;

  async function markRead(notification) {
    if (!notification.automatic && !notification.read_at) {
      await supabase.rpc('mark_notification_read', { p_id: notification.id });
      await load();
    }
    const match = items.find(item => item.title === notification.title);
    if (match) { setTab('news'); if (match.content_type === 'video') beginVideo(match); return; }
    if (notification.url && notification.url !== '/app') location.href = notification.url;
  }

  async function beginVideo(item) {
    setBusy(item.id); setMessage('Preparando o vídeo…');
    const { data, error } = await supabase.rpc('start_content_video', { p_content_id: item.id });
    setBusy(null);
    if (error || !data) { setMessage('Este vídeo não está disponível agora.'); return; }
    const required = Math.max(30, Number(item.required_watch_seconds || 30));
    setVideo({ item, sessionId: data }); setMessage(`Assista por ${required} segundos para registrar a conclusão.`);
  }

  async function redeem(experience) {
    if (!window.confirm(`Resgatar “${experience.titulo}” por ${experience.hc_cost} HC?`)) return;
    setBusy(experience.id); setMessage('');
    const { data, error } = await supabase.rpc('resgatar_experiencia_hc', { p_experience_id: experience.id });
    setBusy(null);
    if (error || !data?.ok) { setMessage(redeemError(error?.message)); return; }
    setMessage(`Resgate confirmado. Saldo: ${data.hc_balance} HC.`);
    await onRefresh?.(); await load();
  }

  return <>
    <button className="mcBell" aria-label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'} onClick={() => { setTab('news'); setOpen(true); }}><Bell/>{unread > 0 && <i>{unread > 99 ? '99+' : unread}</i>}</button>
    {open && <div className="mcBackdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setOpen(false); setVideo(null); } }}>
      <section className="mcPanel" role="dialog" aria-modal="true" aria-label="Novidades e notificações HOCCO">
        <header className="mcHeader"><div><small>HOCCO · COMUNIDADE</small><h2>Novidades e benefícios</h2><p>Publicações aprovadas, avisos e experiências.</p></div><button onClick={() => { setOpen(false); setVideo(null); }} aria-label="Fechar"><X/></button></header>
        <nav className="mcTabs"><button className={tab === 'news' ? 'active' : ''} onClick={() => setTab('news')}>Novidades</button><button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>Notificações {unread > 0 && <i>{unread}</i>}</button><button className={tab === 'experiences' ? 'active' : ''} onClick={() => setTab('experiences')}>Experiências</button><button className="mcRefresh" onClick={load}>Atualizar</button></nav>
        {message && <div className="mcMessage" role="status">{message}</div>}
        {video ? video.item.youtube_video_id ? <YouTubeWatch key={video.sessionId} item={video.item} sessionId={video.sessionId} onDone={text => { setMessage(text); setVideo(null); load(); onRefresh?.(); }} onClose={() => setVideo(null)}/> : <PrivateVideoWatch key={video.sessionId} item={video.item} sessionId={video.sessionId} onDone={text => { setMessage(text); setVideo(null); load(); onRefresh?.(); }} onClose={() => setVideo(null)}/> : <div className="mcScroll">
          {tab === 'news' && <><div className="mcStreak"><Sparkles/><span><b>Marco de ofensiva: {reward} HC a cada {streakDays} dias</b><small>{streakProgress}/{streakDays} dias no ciclo atual · recompensa automática ao completar o ciclo</small></span><strong>{profile?.hc || 0} HC</strong></div><h3>Publicações HOCCO</h3>{items.map(item => <article className="mcCard" key={item.id}>{item.image_url && <img src={item.image_url} alt=""/>}<div><small>{kindLabel(item.content_type)} · {date(item.starts_at)}</small><b>{item.title}</b><p>{item.body}</p>{item.content_type === 'video' ? <button onClick={() => beginVideo(item)} disabled={busy === item.id}><Play/>{busy === item.id ? 'ABRINDO…' : `ASSISTIR · ${item.required_watch_seconds || 30}s`}</button> : item.link_url ? <a href={item.link_url} target={item.link_url.startsWith('/') ? '_self' : '_blank'} rel="noreferrer">ABRIR <ExternalLink/></a> : null}</div></article>)}{!items.length && <Empty>Novidades aprovadas pela HOCCO aparecerão aqui.</Empty>}</>}
          {tab === 'inbox' && <>{notifications.map(n => <button className={`mcNotice ${!n.read_at && !n.automatic ? 'unread' : ''}`} key={n.id} onClick={() => markRead(n)}><span>{n.automatic ? <CalendarDays/> : <Bell/>}</span><div><small>{n.automatic ? 'SEU PROGRESSO' : kindLabel(n.kind)} · {date(n.created_at)}</small><b>{n.title}</b><p>{n.body}</p></div>{!n.read_at && !n.automatic && <i/>}</button>)}{!notifications.length && <Empty>Você está em dia com os avisos HOCCO.</Empty>}</>}
          {tab === 'experiences' && <><div className="mcRedeemIntro"><Gift/><span><b>Troque HC por experiências grátis</b><small>O saldo é debitado somente após confirmar um resgate disponível.</small></span></div>{experiences.map(experience => {const balance = Number(profile?.hc || 0); const cost = Number(experience.hc_cost || 0); const minimum = Number(experience.hc_min || 0); const missing = Math.max(0, cost - balance, minimum - balance); const registration = experienceApps.find(app => app.experiencia_id === experience.id); return <article className="mcExperience" key={experience.id}>{experience.imagem_url && <img src={experience.imagem_url} alt=""/>}<div><small>{experience.evento_at ? date(experience.evento_at) : 'DATA A CONFIRMAR'} · {experience.vagas} vaga(s)</small><b>{experience.titulo}</b><p>{experience.descricao}</p><span>{experience.local_evento || 'Local informado na confirmação'} · mínimo {minimum} HC · custo {cost} HC</span><button disabled={busy === experience.id || missing > 0 || Boolean(registration)} onClick={() => redeem(experience)}>{registration ? 'JÁ RESGATADA' : missing > 0 ? `FALTAM ${missing} HC` : busy === experience.id ? 'PROCESSANDO…' : `RESGATAR POR ${cost} HC`}</button></div></article>;})}{!experiences.length && <Empty>As próximas experiências resgatáveis aparecerão aqui.</Empty>}</>}
        </div>}
      </section>
    </div>}
  </>;
}

function YouTubeWatch({ item, sessionId, onDone, onClose }) {
  const host = useRef(null); const player = useRef(null); const watched = useRef(0); const finish = useRef(false);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const [playing, setPlaying] = useState(false); const [seconds, setSeconds] = useState(0); const [error, setError] = useState(''); const [confirming, setConfirming] = useState(false); const [canRetry, setCanRetry] = useState(false);
  const required = Math.max(30, Number(item.required_watch_seconds || 30));
  async function complete() {
    setConfirming(true); setCanRetry(false); setError('');
    const { data, error: rpcError } = await supabase.rpc('complete_content_video', { p_session_id: sessionId });
    setConfirming(false);
    if (rpcError || !data?.ok) { finish.current = true; setCanRetry(true); setError('A conclusão não foi confirmada. Tente novamente.'); return; }
    onDoneRef.current(`Vídeo concluído: ${required} segundos assistidos.`);
  }
  useEffect(() => {
    let alive = true;
    loadYoutubeApi().then(YT => {
      if (!alive || !host.current) return;
      player.current = new YT.Player(host.current, { videoId: item.youtube_video_id, playerVars: { playsinline: 1, rel: 0, origin: location.origin }, events: {
        onStateChange: e => setPlaying(e.data === 1), onError: () => setError('O vídeo do YouTube não pôde ser carregado.'),
      } });
    }).catch(() => setError('Não foi possível abrir o player agora.'));
    return () => { alive = false; try { player.current?.destroy(); } catch {} };
  }, [item.youtube_video_id]);
  useEffect(() => {
    if (!playing || error || finish.current) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      watched.current += 1; setSeconds(watched.current);
      if (watched.current < required || finish.current) return;
      finish.current = true; clearInterval(id); await complete();
    }, 1000);
    return () => clearInterval(id);
  }, [playing, error, required, sessionId]);
  return <div className="mcPlayer"><header><span><small>VÍDEO HOCCO</small><b>{item.title}</b></span><button onClick={onClose} aria-label="Fechar vídeo"><X/></button></header><div className="mcVideoFrame"><div ref={host}/></div><div className="mcWatchProgress"><span>Tempo assistido</span><b>{Math.min(seconds, required)} / {required}s</b><i><em style={{ width: `${Math.min(100, seconds / required * 100)}%` }}/></i></div>{error && <p className="mcVideoError">{error}</p>}{canRetry && <button className="mcRetry" disabled={confirming} onClick={complete}>{confirming ? 'CONFIRMANDO…' : 'TENTAR CONFIRMAR'}</button>}<p className="mcWatchHelp">O contador avança somente enquanto o vídeo está reproduzindo e o app está visível.</p></div>;
}

function PrivateVideoWatch({ item, sessionId, onDone, onClose }) {
  const [src, setSrc] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const watched = useRef(0);
  const finish = useRef(false);
  const required = Math.max(30, Number(item.required_watch_seconds || 30));

  useEffect(() => {
    let active = true;
    const path = String(item.video_storage_path || '').replace(/^\/+/, '');
    if (!path || path.includes('..')) { setError('O arquivo deste bastidor não está disponível.'); return () => { active = false; }; }
    supabase.storage.from('hocco-bastidores').createSignedUrl(path, 60 * 20).then(({ data, error: signedError }) => {
      if (!active) return;
      if (signedError || !data?.signedUrl) setError('Não foi possível abrir este bastidor para membros.');
      else setSrc(data.signedUrl);
    });
    return () => { active = false; };
  }, [item.video_storage_path]);

  async function complete() {
    setConfirming(true); setCanRetry(false); setError('');
    const { data, error: rpcError } = await supabase.rpc('complete_content_video', { p_session_id: sessionId });
    setConfirming(false);
    if (rpcError || !data?.ok) { finish.current = true; setCanRetry(true); setError('A conclusão não foi confirmada. Tente novamente.'); return; }
    onDone(`Bastidor concluído: ${required} segundos assistidos.`);
  }

  useEffect(() => {
    if (!playing || error || finish.current) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      watched.current += 1; setSeconds(watched.current);
      if (watched.current < required || finish.current) return;
      finish.current = true; clearInterval(timer); setPlaying(false); await complete();
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, error, required, sessionId]);

  return <div className="mcPlayer"><header><span><small>BASTIDOR EXCLUSIVO</small><b>{item.title}</b></span><button onClick={onClose} aria-label="Fechar vídeo"><X/></button></header><div className="mcVideoFrame mcPrivateVideo">{src ? <video controls playsInline preload="metadata" src={src} onPlay={() => { if (!finish.current) setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError('O arquivo de vídeo não pôde ser reproduzido neste aparelho.')}/> : !error && <p>Preparando o bastidor…</p>}</div><div className="mcWatchProgress"><span>Tempo assistido</span><b>{Math.min(seconds, required)} / {required}s</b><i><em style={{ width: `${Math.min(100, seconds / required * 100)}%` }}/></i></div>{error && <p className="mcVideoError">{error}</p>}{canRetry && <button className="mcRetry" disabled={confirming} onClick={complete}>{confirming ? 'CONFIRMANDO…' : 'TENTAR CONFIRMAR'}</button>}<p className="mcWatchHelp">O tempo conta somente enquanto o vídeo reproduz e a HOCCO fica visível na tela.</p></div>;
}

function Empty({ children }) { return <div className="mcEmpty"><Bell/><p>{children}</p></div>; }
function isExperienceOpen(experience) { const now = Date.now(); return (!experience.inscricoes_abrem_at || new Date(experience.inscricoes_abrem_at).getTime() <= now) && (!experience.inscricoes_fecham_at || new Date(experience.inscricoes_fecham_at).getTime() > now) && (!experience.evento_at || new Date(experience.evento_at).getTime() > now); }
function kindLabel(v='') { return ({promocao:'PROMOÇÃO',empresa:'EMPRESA',drop:'DROP',video:'VÍDEO',story:'NOVIDADE',novidade:'NOVIDADE',sistema:'HOCCO'})[v] || String(v).toUpperCase(); }
function date(v) { if (!v) return 'Agora'; return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)); }
function redeemError(v='') { if (v.includes('insufficient_hc')) return 'Seu saldo de HC ainda não cobre este resgate.'; if (v.includes('experience_full')) return 'As vagas desta experiência acabaram.'; if (v.includes('already_registered')) return 'Você já está inscrito nesta experiência.'; if (v.includes('experience_registration_closed')) return 'O período de resgate está fechado.'; return 'Não foi possível resgatar esta experiência agora.'; }
