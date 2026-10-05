'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Bolt, Building2, Camera, CheckCircle2, ChevronRight, Download, Flame,
  Home, LogOut, MessageCircle, Play, Sparkles, Target, Trophy, User, Users, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  HYPE_BOARDS, currentBoard, isBoardLive, todayBR, whatsappUrl,
} from '../../lib/config';

export default function MemberApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [daily, setDaily] = useState(null);
  const [tab, setTab] = useState('inicio');
  const [board, setBoard] = useState(currentBoard());
  const [agenda, setAgenda] = useState([]);
  const [votes, setVotes] = useState({});
  const [results, setResults] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [applications, setApplications] = useState([]);
  const [community, setCommunity] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [toast, setToast] = useState('');
  const [busyVote, setBusyVote] = useState(false);
  const [edit, setEdit] = useState(false);
  const sessionRef = useRef(null);
  const sessionStartedRef = useRef(Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.replace('/');
      else setUser(data.user);
    });
    const installHandler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', installHandler);
    return () => window.removeEventListener('beforeinstallprompt', installHandler);
  }, []);

  useEffect(() => {
    if (!user) return;
    let timer;
    (async () => {
      await ensureIdentity();
      const { data: session } = await supabase.from('impulsionadores_sessoes').insert({
        user_id: user.id,
        platform: navigator.userAgentData?.platform || navigator.platform || 'web',
        user_agent: navigator.userAgent,
        path: '/app',
      }).select().single();
      if (session) sessionRef.current = session.id;
      await refreshAll();
      timer = setInterval(async () => {
        if (!sessionRef.current || document.visibilityState !== 'visible') return;
        const seconds = Math.max(0, Math.floor((Date.now() - sessionStartedRef.current) / 1000));
        await supabase.from('impulsionadores_sessoes').update({
          last_seen_at: new Date().toISOString(),
          active_seconds: seconds,
        }).eq('id', sessionRef.current);
      }, 60000);
    })();
    return () => clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (user) loadHype(board);
  }, [board, user?.id]);

  async function ensureIdentity() {
    let { data: p } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', user.id).maybeSingle();
    if (!p) {
      const created = await supabase.from('impulsionadores_perfis').insert({
        user_id: user.id,
        nome_publico: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Membro HOCCO',
      }).select().single();
      p = created.data;
    }
    const phone = String(user.user_metadata?.phone || '').replace(/\D/g, '');
    if (phone) {
      await supabase.from('impulsionadores_contatos').upsert({
        user_id: user.id,
        email: user.email,
        telefone: phone,
        updated_at: new Date().toISOString(),
      });
    }
    setProfile(p);
  }

  async function refreshAll() {
    await Promise.all([loadProfile(), loadDaily(), loadHype(board), loadResults(), loadExperiences(), loadCommunity()]);
  }

  async function loadProfile() {
    const { data } = await supabase.from('impulsionadores_perfis').select('*').eq('user_id', user.id).single();
    if (data) setProfile(data);
  }

  async function loadDaily() {
    const { data } = await supabase.from('hc_diario').select('*').eq('user_id', user.id).eq('activity_date', todayBR()).maybeSingle();
    setDaily(data || { hc_earned: 0, missions_completed: 1, boards_hyped: 0, streak_snapshot: profile?.ofensiva_dias || 0 });
  }

  async function loadHype(selectedBoard = board) {
    const date = todayBR();
    const [{ data: slots }, { data: ownVotes }] = await Promise.all([
      supabase.from('hype_agenda').select('*,hype_empresas(*)').eq('hype_date', date).eq('quadro', selectedBoard).neq('status', 'cancelado'),
      supabase.from('hype_votos').select('agenda_id,quadro').eq('user_id', user.id).eq('hype_date', date),
    ]);
    setAgenda(slots || []);
    const map = {};
    (ownVotes || []).forEach((v) => { map[v.quadro] = v.agenda_id; });
    setVotes(map);
  }

  async function loadResults() {
    const { data } = await supabase.from('hype_resultados').select('*,hype_empresas(*),hype_agenda(*)').order('hype_date', { ascending: false }).limit(12);
    setResults(data || []);
  }

  async function loadExperiences() {
    const [{ data: exp }, { data: apps }] = await Promise.all([
      supabase.from('hocco_experiencias').select('*,hype_empresas(nome_fantasia)').in('status', ['publicada', 'inscricoes_encerradas']).order('created_at', { ascending: false }),
      supabase.from('hocco_experiencia_inscricoes').select('*').eq('user_id', user.id),
    ]);
    setExperiences(exp || []);
    setApplications(apps || []);
  }

  async function loadCommunity() {
    const { data } = await supabase.from('impulsionadores_perfis').select('user_id,nome_publico,avatar_url,xp,nivel,hc,ofensiva_dias').order('xp', { ascending: false }).limit(8);
    setCommunity(data || []);
  }

  async function logEvent(eventType, entityType, entityId, metadata = {}) {
    if (!user) return;
    await supabase.from('impulsionadores_eventos').insert({
      user_id: user.id,
      session_id: sessionRef.current,
      event_type: eventType,
      path: `/app/${tab}`,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      metadata,
    });
  }

  async function tapCompany(slot) {
    if (!user) return;
    await supabase.from('hype_interacoes').insert({ agenda_id: slot.id, user_id: user.id, event_type: 'tap' });
  }

  async function voteCompany(slot) {
    if (busyVote || votes[board]) return;
    if (!isBoardLive(board)) {
      showToast(`O ${HYPE_BOARDS[board].label} funciona das ${HYPE_BOARDS[board].window}.`);
      return;
    }
    setBusyVote(true);
    const { error } = await supabase.from('hype_votos').insert({
      agenda_id: slot.id,
      user_id: user.id,
      hype_date: todayBR(),
      quadro: board,
    });
    setBusyVote(false);
    if (error) {
      showToast(error.message.includes('duplicate') ? 'Seu Hype válido deste quadro já foi usado.' : 'Não foi possível registrar este Hype agora.');
      return;
    }
    await logEvent('hype_valid', 'empresa', slot.empresa_id, { quadro: board });
    showToast('Hype válido registrado. Seu progresso foi atualizado.');
    await Promise.all([loadHype(board), loadProfile(), loadDaily(), loadCommunity()]);
  }

  async function useBenefit(result) {
    const company = result.hype_empresas;
    if (!company?.whatsapp) return;
    if (result.agenda_id) {
      await supabase.from('hype_interacoes').insert({ agenda_id: result.agenda_id, user_id: user.id, event_type: 'whatsapp' });
    }
    await logEvent('benefit_whatsapp', 'empresa', company.id, { resultado: result.id });
    window.open(whatsappUrl(company.whatsapp, `Olá! Vim pelo app HOCCO. Vi que a ${company.nome_fantasia} foi destaque no Hype e gostaria de utilizar o benefício HOCCO. Como faço para utilizar?`), '_blank', 'noopener,noreferrer');
  }

  async function applyExperience(exp) {
    if ((profile?.hc || 0) < exp.hc_min) return showToast(`Você precisa de pelo menos ${exp.hc_min} HC para esta experiência.`);
    const { error } = await supabase.from('hocco_experiencia_inscricoes').insert({ experiencia_id: exp.id, user_id: user.id });
    if (error) {
      showToast(error.message.includes('duplicate') ? 'Você já está inscrito nesta experiência.' : 'Não foi possível registrar sua inscrição.');
      return;
    }
    await logEvent('experience_apply', 'experiencia', exp.id);
    showToast('Inscrição recebida. Se houver mais candidatos que vagas, a Curadoria HOCCO fará a seleção.');
    loadExperiences();
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return;
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
    if (!error) {
      setEdit(false);
      loadProfile();
    }
  }

  async function install() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else alert('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 4200);
  }

  const overallWinner = useMemo(() => results.find((r) => r.quadro === 'dia'), [results]);
  const boardWinner = useMemo(() => results.find((r) => r.quadro === board && r.hype_date === todayBR()) || results.find((r) => r.quadro === board), [results, board]);
  const hc = profile?.hc || 0;
  const dailyHC = daily?.hc_earned || 0;
  const boardsHyped = daily?.boards_hyped || 0;

  if (!profile) return <div className="splash"><b>HOCCO</b><span>Ativando sua célula...</span></div>;

  const nav = [
    ['inicio', Home, 'Início'],
    ['hype', Zap, 'Hype'],
    ['missoes', Target, 'Missões'],
    ['experiencias', Award, 'Experiências'],
    ['perfil', User, 'Perfil'],
  ];

  return (
    <main className="memberApp">
      <header>
        <b className="logo">HOCCO</b>
        <span className="pill">IMPULSIONADORES</span>
        <div className="hcHeader"><Sparkles/> <strong>{hc} HC</strong></div>
        <button className="avatarBtn" onClick={() => setTab('perfil')}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Perfil" /> : <span>{profile.nome_publico[0]}</span>}</button>
      </header>

      <section className="shell liveShell">
        {tab === 'inicio' && (
          <>
            <section className="livingHero">
              <div>
                <small>CÉLULA HOCCO ATIVA</small>
                <h1>Olá, {profile.nome_publico.split(' ')[0]}.</h1>
                <p>Entre, participe, construa sua ofensiva e transforme presença em acesso.</p>
              </div>
              <div className="pulseCore"><Bolt/><span>ATIVO</span></div>
            </section>

            <div className="valueGrid">
              <Metric icon={Sparkles} value={`${hc} HC`} label="Saldo HC" note="máx. 2 por dia" />
              <Metric icon={Flame} value={`${profile.ofensiva_dias} dias`} label="Ofensiva" note="constância ativa" />
              <Metric icon={Target} value={`${dailyHC}/2`} label="HC de hoje" note={`${boardsHyped}/3 quadros`} />
              <Metric icon={Award} value={`Nível ${profile.nivel}`} label="Progressão" note={`${profile.xp} XP`} />
            </div>

            <section className="nowCard" onClick={() => setTab('hype')}>
              <div><small>AGORA / PRÓXIMO QUADRO</small><h2>{HYPE_BOARDS[currentBoard()].label}</h2><p>{HYPE_BOARDS[currentBoard()].window} · até 10 empresas</p></div>
              <div className={isBoardLive(currentBoard()) ? 'liveDot on' : 'liveDot'}>{isBoardLive(currentBoard()) ? 'AO VIVO' : 'EM BREVE'}</div>
              <ChevronRight/>
            </section>

            <section className="missionPulse">
              <div className="sectionHead"><div><small>MISSÕES AUTOMÁTICAS</small><h2>Seu dia está sendo contado.</h2></div><strong>{Math.min(100, 25 + boardsHyped * 25)}%</strong></div>
              <div className="progress"><div style={{ width: `${Math.min(100, 25 + boardsHyped * 25)}%` }} /></div>
              <div className="microMissions">
                <Mission done title="Entrou no app" reward="XP" />
                <Mission done={boardsHyped >= 1} title="Participou de 1 quadro" reward="+1 HC" />
                <Mission done={boardsHyped >= 2} title="Participou de 2 quadros" reward="+1 HC" />
                <Mission done={boardsHyped >= 3} title="Fechou os 3 quadros" reward="XP" />
              </div>
            </section>

            {overallWinner && <WinnerCard result={overallWinner} onBenefit={() => useBenefit(overallWinner)} />}

            <button className="businessCTA" onClick={() => location.href = '/empresa'}>
              <Building2/><div><b>Quer colocar sua empresa no Hype?</b><span>Cadastre CNPJ, benefício, quadro e solicite sua participação.</span></div><ChevronRight/>
            </button>

            <button className="installCard" onClick={install}><Download/><div><b>Instalar HOCCO no celular</b><span>Abra mais rápido e mantenha sua conta e sua ofensiva em qualquer aparelho.</span></div></button>
          </>
        )}

        {tab === 'hype' && (
          <>
            <Title eyebrow="HYPE DO DIA" title="A comunidade escolhe." text="Os tamanhos variam conforme o plano comercial. O resultado depende apenas dos Hypes válidos dos membros." />
            <div className="boardTabs">
              {Object.entries(HYPE_BOARDS).map(([key, info]) => <button key={key} className={board === key ? 'active' : ''} onClick={() => setBoard(key)}><b>{info.label.replace('Hype ', '')}</b><span>{info.window}</span></button>)}
            </div>
            <div className="boardStatus"><span>{isBoardLive(board) ? '● QUADRO AO VIVO' : '○ FORA DO HORÁRIO'}</span><b>{agenda.length}/10 empresas</b></div>
            {agenda.length ? (
              <div className="hypeField">
                {agenda.map((slot, index) => {
                  const company = slot.hype_empresas;
                  const chosen = votes[board] === slot.id;
                  const locked = Boolean(votes[board]) && !chosen;
                  return (
                    <article key={slot.id} className={`floatingCompany size-${slot.tamanho} ${chosen ? 'chosen' : ''}`} style={{ '--delay': `${(index % 5) * .55}s` }} onClick={() => tapCompany(slot)}>
                      <div className="companyGlow" />
                      {company?.logo_url ? <img src={company.logo_url} alt={company.nome_fantasia} /> : <div className="companyInitial">{company?.nome_fantasia?.[0] || 'H'}</div>}
                      <small>{company?.segmento || 'Empresa HOCCO'}</small>
                      <h3>{company?.nome_fantasia}</h3>
                      <span className="discount">até {Number(slot.desconto ?? company?.desconto_padrao ?? 0).toFixed(0)}% OFF</span>
                      <button disabled={locked || chosen || busyVote} onClick={(e) => { e.stopPropagation(); voteCompany(slot); }}><Zap/>{chosen ? 'SEU HYPE' : locked ? 'HYPE USADO' : 'HYPAR'}</button>
                    </article>
                  );
                })}
              </div>
            ) : <Empty icon={Building2} title="Quadro em preparação" text="As empresas aprovadas aparecerão aqui automaticamente." />}
            <div className="hypeRule"><Zap/><p><b>1 Hype válido por quadro.</b> Toques adicionais fazem a marca reagir e contam como interação, mas não compram nem multiplicam votos.</p></div>
            {boardWinner && <WinnerCard result={boardWinner} onBenefit={() => useBenefit(boardWinner)} />}
            <button className="businessCTA" onClick={() => location.href = '/empresa'}><Building2/><div><b>Hypar minha empresa</b><span>Participações a partir de R$ 29,90.</span></div><ChevronRight/></button>
          </>
        )}

        {tab === 'missoes' && (
          <>
            <Title eyebrow="OFENSIVA HOCCO" title={`${profile.ofensiva_dias} dias de constância`} text="As missões são concluídas automaticamente pelas ações reais dentro do app. Você nunca precisa marcar uma missão manualmente." />
            <div className="hcCap"><Sparkles/><div><small>LIMITE DIÁRIO</small><h2>{dailyHC}/2 HC conquistados hoje</h2><p>Mesmo completando tudo, o máximo diário é 2 HC. Isso mantém o HC raro.</p></div></div>
            <div className="missionList">
              <MissionRow done title="Presença HOCCO" text="Entrar no app hoje." reward="+5 XP" />
              <MissionRow done={boardsHyped >= 1} title="Primeiro Hype" text="Escolher uma empresa em um quadro válido." reward="+1 HC · +25 XP" />
              <MissionRow done={boardsHyped >= 2} title="Dois momentos" text="Participar de dois quadros diferentes." reward="+1 HC · +25 XP" />
              <MissionRow done={boardsHyped >= 3} title="Dia completo" text="Participar de Almoço, Tarde e Noite." reward="XP + ofensiva" />
            </div>
            <div className="unlockCard"><Award/><div><small>PORTA DE ENTRADA</small><h2>100 HC desbloqueiam experiências.</h2><p>HC não compra uma vaga. Ele torna você elegível. Quando houver mais interessados que vagas, a Curadoria HOCCO seleciona os participantes.</p></div><strong>{hc}/100</strong></div>
          </>
        )}

        {tab === 'experiencias' && (
          <>
            <Title eyebrow="EXPERIÊNCIAS HOCCO" title="Acesso que não está à venda." text="A partir de 100 HC você começa a disputar experiências com a HOCCO e empresas parceiras." />
            {hc < 100 && <div className="lockedExperience"><Award/><div><b>Faltam {100 - hc} HC</b><span>Mantenha sua ofensiva. O limite continua sendo 2 HC por dia.</span></div></div>}
            <div className="experienceList">
              {experiences.map((exp) => {
                const own = applications.find((a) => a.experiencia_id === exp.id);
                const eligible = hc >= exp.hc_min;
                return <article className="experienceCard" key={exp.id}>
                  <div className="experienceTop"><span>{exp.hype_empresas?.nome_fantasia || 'HOCCO'}</span><b>{exp.vagas} vagas</b></div>
                  <h2>{exp.titulo}</h2><p>{exp.descricao}</p>
                  <div className="experienceMeta"><span><Sparkles/> mínimo {exp.hc_min} HC</span>{exp.evento_at && <span>{new Date(exp.evento_at).toLocaleDateString('pt-BR')}</span>}</div>
                  {exp.regras && <small>{exp.regras}</small>}
                  <button disabled={!eligible || Boolean(own) || exp.status !== 'publicada'} onClick={() => applyExperience(exp)}>{own ? statusLabel(own.status) : eligible ? 'QUERO PARTICIPAR' : `PRECISA DE ${exp.hc_min} HC`}</button>
                </article>;
              })}
              {!experiences.length && <Empty icon={Award} title="Novas experiências em preparação" text="Eventos, bastidores, reuniões e benefícios de empresas aparecerão aqui." />}
            </div>
          </>
        )}

        {tab === 'perfil' && (
          <>
            <div className="profile">
              <label className="photo">{profile.avatar_url ? <img src={profile.avatar_url} alt="Foto" /> : <span>{profile.nome_publico[0]}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar}/><i><Camera/></i></label>
              <h1>{profile.nome_publico}</h1><p>{profile.username ? `@${profile.username}` : user.email}</p>
              <b>NÍVEL {profile.nivel} · IMPULSIONADOR</b>
            </div>
            <div className="profileStats">
              <div><strong>{profile.hc}</strong><span>HC</span></div><div><strong>{profile.ofensiva_dias}</strong><span>Ofensiva</span></div><div><strong>{profile.xp}</strong><span>XP</span></div><div><strong>{profile.impulsos}</strong><span>Hypes/impulsos</span></div>
            </div>
            {edit ? <form className="edit" onSubmit={saveProfile}><label>Nome público<input name="nome" defaultValue={profile.nome_publico} required /></label><label>@ na comunidade<input name="username" defaultValue={profile.username || ''} /></label><label>Sobre você<textarea name="bio" defaultValue={profile.bio || ''} /></label><button className="primary">SALVAR PERFIL</button></form> : <button className="outline" onClick={() => setEdit(true)}>EDITAR PERFIL</button>}
            <section className="communityMini"><div className="sectionHead"><div><small>COMUNIDADE</small><h2>Mais ativos</h2></div></div>{community.map((r, i) => <div className="rankMini" key={r.user_id}><span>{i + 1}</span><div><b>{r.nome_publico}{r.user_id === user.id ? ' · você' : ''}</b><small>Nível {r.nivel} · {r.xp} XP · 🔥 {r.ofensiva_dias}</small></div></div>)}</section>
            <button className="outline" onClick={install}><Download/> INSTALAR APP</button>
            <button className="logout" onClick={async () => { await supabase.auth.signOut(); location.replace('/'); }}><LogOut/> Sair da conta</button>
          </>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
      <nav>{nav.map(([key, Icon, label]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}><Icon/><span>{label}</span></button>)}</nav>
    </main>
  );
}

function Metric({ icon: Icon, value, label, note }) {
  return <article className="metricCard"><Icon/><strong>{value}</strong><b>{label}</b><span>{note}</span></article>;
}
function Mission({ done, title, reward }) {
  return <div className={done ? 'microMission done' : 'microMission'}>{done ? <CheckCircle2/> : <Target/>}<span>{title}</span><b>{reward}</b></div>;
}
function MissionRow({ done, title, text, reward }) {
  return <article className={done ? 'missionRow done' : 'missionRow'}><span>{done ? <CheckCircle2/> : <Target/>}</span><div><b>{title}</b><small>{text}</small></div><em>{reward}</em></article>;
}
function Title({ eyebrow, title, text }) {
  return <div className="title"><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>;
}
function Empty({ icon: Icon, title, text }) {
  return <div className="emptyState"><Icon/><b>{title}</b><p>{text}</p></div>;
}
function WinnerCard({ result, onBenefit }) {
  const company = result.hype_empresas;
  if (!company) return null;
  return <section className="winnerCard"><Trophy/><div><small>{result.quadro === 'dia' ? 'MAIS HYPADA DO DIA' : `VENCEDORA · ${String(result.quadro).toUpperCase()}`}</small><h2>{company.nome_fantasia}</h2><p>{result.hypes_validos} Hypes válidos · benefício HOCCO disponível.</p></div><button onClick={onBenefit}><MessageCircle/> USAR BENEFÍCIO</button></section>;
}
function statusLabel(status) {
  const labels = { candidato: 'INSCRIÇÃO RECEBIDA', selecionado: 'VOCÊ FOI SELECIONADO', lista_espera: 'LISTA DE ESPERA', confirmado: 'PARTICIPAÇÃO CONFIRMADA', recusado: 'NÃO SELECIONADO', desistiu: 'INSCRIÇÃO ENCERRADA' };
  return labels[status] || status;
}
