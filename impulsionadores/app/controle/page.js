'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Award, BarChart3, Building2, CheckCircle2, Clock3, FileText, Flame,
  LayoutDashboard, LogOut, MessageCircle, RefreshCw, Search, ShieldCheck, Sparkles,
  Target, Trophy, UserRound, Users, WalletCards, XCircle, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { HYPE_BOARDS, HYPE_PRICES, brl, normalizeBrazilWhatsapp, todayBR, whatsappUrl } from '../../lib/config';
import './controle.css';

const NAV = [
  ['dashboard', LayoutDashboard, 'Visão geral'],
  ['membros', Users, 'Membros'],
  ['solicitacoes', WalletCards, 'Solicitações'],
  ['empresas', Building2, 'Empresas'],
  ['hype', Zap, 'Hype hoje'],
  ['experiencias', Award, 'Experiências'],
  ['relatorios', FileText, 'Relatórios'],
];

export default function Controle() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [metrics, setMetrics] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [votes, setVotes] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        location.replace('/');
        return;
      }
      setUser(data.user);
      const { data: admin } = await supabase.from('hocco_admins').select('*').eq('user_id', data.user.id).maybeSingle();
      setIsAdmin(Boolean(admin));
      setLoading(false);
      if (admin) await loadAll();
    });
  }, []);

  async function loadAll() {
    const date = todayBR();
    const todayStart = `${date}T00:00:00-03:00`;
    const [
      p, c, s, ev, req, comp, ag, vo, inter, exp, apps, rep,
    ] = await Promise.all([
      supabase.from('impulsionadores_perfis').select('*').order('created_at', { ascending: false }),
      supabase.from('impulsionadores_contatos').select('*'),
      supabase.from('impulsionadores_sessoes').select('*').gte('started_at', todayStart).order('started_at', { ascending: false }),
      supabase.from('impulsionadores_eventos').select('*').gte('created_at', todayStart).order('created_at', { ascending: false }).limit(500),
      supabase.from('hype_solicitacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('hype_empresas').select('*').order('created_at', { ascending: false }),
      supabase.from('hype_agenda').select('*,hype_empresas(*)').eq('hype_date', date).order('quadro'),
      supabase.from('hype_votos').select('*').eq('hype_date', date),
      supabase.from('hype_interacoes').select('*').gte('created_at', todayStart).limit(5000),
      supabase.from('hocco_experiencias').select('*').order('created_at', { ascending: false }),
      supabase.from('hocco_experiencia_inscricoes').select('*').order('created_at', { ascending: false }),
      supabase.from('hype_relatorios').select('*,hype_empresas(*)').order('created_at', { ascending: false }).limit(100),
    ]);
    setProfiles(p.data || []); setContacts(c.data || []); setSessions(s.data || []); setEvents(ev.data || []);
    setRequests(req.data || []); setCompanies(comp.data || []); setAgenda(ag.data || []); setVotes(vo.data || []);
    setInteractions(inter.data || []); setExperiences(exp.data || []); setApplications(apps.data || []); setReports(rep.data || []);
    const activeSeconds = (s.data || []).reduce((acc, item) => acc + Number(item.active_seconds || 0), 0);
    setMetrics({
      members: (p.data || []).length,
      sessions: (s.data || []).length,
      activeSeconds,
      actions: (ev.data || []).length + (inter.data || []).length,
      hypes: (vo.data || []).length,
      companies: (comp.data || []).length,
      pending: (req.data || []).filter((r) => !['programado','recusado','reembolsado','cancelado'].includes(r.status)).length,
      hc: (p.data || []).reduce((acc, item) => acc + Number(item.hc || 0), 0),
    });
  }

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 4500);
  }

  async function audit(action, entityType, entityId, metadata = {}) {
    if (!user) return;
    await supabase.from('hocco_admin_audit').insert({ admin_user_id: user.id, action, entity_type: entityType, entity_id: String(entityId || ''), metadata });
  }

  async function confirmPayment(request) {
    const { error } = await supabase.from('hype_solicitacoes').update({
      payment_status: 'confirmado', status: 'em_analise', pagamento_confirmado_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', request.id);
    if (error) return flash(error.message);
    await audit('confirm_payment', 'hype_solicitacao', request.id, { valor: request.valor });
    flash('Pagamento confirmado. Solicitação pronta para análise.');
    loadAll();
  }

  async function ensureCompany(request) {
    const existing = companies.find((c) => c.cnpj === request.cnpj);
    if (existing) return existing;
    const { data, error } = await supabase.from('hype_empresas').insert({
      razao_social: request.razao_social,
      nome_fantasia: request.nome_fantasia,
      cnpj: request.cnpj,
      whatsapp: request.whatsapp,
      email: request.email,
      cidade: request.cidade,
      uf: request.uf,
      segmento: request.segmento,
      logo_url: request.logo_url,
      instagram: request.instagram,
      site_url: request.site_url,
      desconto_padrao: request.desconto,
      condicoes: request.condicoes,
    }).select().single();
    if (error) throw error;
    return data;
  }

  function frameStarted(date, board) {
    if (date !== todayBR()) return false;
    const hour = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
    if (board === 'almoco') return hour >= 11;
    if (board === 'tarde') return hour >= 14;
    return hour >= 18;
  }

  async function findNextDate(period, preferred) {
    const { data: future } = await supabase.from('hype_agenda').select('hype_date,quadro,status').gte('hype_date', preferred || todayBR()).neq('status', 'cancelado').limit(2000);
    const rows = future || [];
    let base = new Date(`${preferred || todayBR()}T12:00:00-03:00`);
    for (let i = 0; i < 45; i += 1) {
      const date = base.toISOString().slice(0, 10);
      const needed = period === 'dia' ? ['almoco','tarde','noite'] : [period];
      const available = needed.every((board) => rows.filter((r) => r.hype_date === date && r.quadro === board).length < 10 && !frameStarted(date, board));
      if (available) return date;
      base = new Date(base.getTime() + 86400000);
    }
    throw new Error('Nenhuma vaga encontrada nos próximos 45 dias.');
  }

  async function approveAndSchedule(request) {
    if (request.payment_status !== 'confirmado') return flash('Confirme o pagamento antes de aprovar.');
    try {
      const company = await ensureCompany(request);
      const date = await findNextDate(request.periodo, request.data_preferida || todayBR());
      const boards = request.periodo === 'dia' ? ['almoco','tarde','noite'] : [request.periodo];
      const rows = boards.map((quadro) => ({
        empresa_id: company.id,
        solicitacao_id: request.id,
        hype_date: date,
        quadro,
        tamanho: request.tamanho,
        valor_pago: request.valor,
        desconto: request.desconto,
        status: 'pre_hype',
        created_by: user.id,
      }));
      const { error } = await supabase.from('hype_agenda').insert(rows);
      if (error) throw error;
      await supabase.from('hype_solicitacoes').update({ empresa_id: company.id, status: 'programado', updated_at: new Date().toISOString() }).eq('id', request.id);
      await audit('approve_schedule', 'hype_solicitacao', request.id, { company_id: company.id, date, boards });
      flash(`Aprovada e programada para ${date}.`);
      loadAll();
    } catch (error) {
      flash(`Falha ao programar: ${error.message}`);
    }
  }

  async function rejectRequest(request) {
    const reason = window.prompt('Motivo da recusa. Ele ficará registrado no pedido:');
    if (!reason?.trim()) return;
    const paid = request.payment_status === 'confirmado';
    const status = paid ? 'reembolso_pendente' : 'recusado';
    const { error } = await supabase.from('hype_solicitacoes').update({
      status,
      refund_status: paid ? 'pendente' : 'nao_aplicavel',
      motivo_recusa: reason.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', request.id);
    if (error) return flash(error.message);
    await audit('reject_request', 'hype_solicitacao', request.id, { paid, reason });
    const message = paid
      ? `Olá! A solicitação ${request.payment_reference} da ${request.nome_fantasia} não foi aprovada. Motivo: ${reason}. O pedido foi colocado em reembolso PIX pela HOCCO.`
      : `Olá! A solicitação ${request.payment_reference} da ${request.nome_fantasia} não foi aprovada. Motivo: ${reason}. Nenhuma participação será publicada.`;
    window.open(whatsappUrl(request.whatsapp, message), '_blank', 'noopener,noreferrer');
    loadAll();
  }

  async function markRefunded(request) {
    await supabase.from('hype_solicitacoes').update({ status: 'reembolsado', refund_status: 'reembolsado', updated_at: new Date().toISOString() }).eq('id', request.id);
    await audit('refund_confirmed', 'hype_solicitacao', request.id, { valor: request.valor });
    window.open(whatsappUrl(request.whatsapp, `Olá! O reembolso PIX da solicitação ${request.payment_reference} foi marcado como concluído pela HOCCO.`), '_blank', 'noopener,noreferrer');
    loadAll();
  }

  async function quickSchedule(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const company = companies.find((c) => c.id === form.get('empresa'));
    if (!company) return flash('Selecione uma empresa já cadastrada.');
    const size = String(form.get('tamanho'));
    const period = String(form.get('periodo'));
    const discount = Number(form.get('desconto') || company.desconto_padrao || 0);
    try {
      const date = await findNextDate(period, todayBR());
      const boards = period === 'dia' ? ['almoco','tarde','noite'] : [period];
      const total = HYPE_PRICES[size][period === 'dia' ? 'dia' : 'quadro'];
      const { error } = await supabase.from('hype_agenda').insert(boards.map((quadro) => ({
        empresa_id: company.id, hype_date: date, quadro, tamanho: size, valor_pago: total, desconto: discount, status: 'pre_hype', created_by: user.id, observacoes: 'Inclusão interna pelo HOCCO Control',
      })));
      if (error) throw error;
      await audit('quick_schedule', 'hype_empresa', company.id, { date, boards, size, total });
      flash(`${company.nome_fantasia} entrou no Pré-Hype de ${date}.`);
      event.currentTarget.reset();
      loadAll();
    } catch (error) { flash(error.message); }
  }

  async function finalizeToday() {
    if (!agenda.length) return flash('Não existem empresas no Hype de hoje.');
    const date = todayBR();
    const byAgendaVotes = {};
    votes.forEach((v) => { byAgendaVotes[v.agenda_id] = (byAgendaVotes[v.agenda_id] || 0) + 1; });
    const overall = {};
    agenda.forEach((slot) => { overall[slot.empresa_id] = (overall[slot.empresa_id] || 0) + (byAgendaVotes[slot.id] || 0); });

    for (const board of ['almoco','tarde','noite']) {
      const slots = agenda.filter((a) => a.quadro === board && a.status !== 'cancelado');
      if (!slots.length) continue;
      const ranked = [...slots].sort((a, b) => (byAgendaVotes[b.id] || 0) - (byAgendaVotes[a.id] || 0));
      const winner = ranked[0];
      await supabase.from('hype_resultados').upsert({
        hype_date: date, quadro: board, empresa_id: winner.empresa_id, agenda_id: winner.id,
        hypes_validos: byAgendaVotes[winner.id] || 0,
        participantes_unicos: votes.filter((v) => v.quadro === board).length,
        finalized_at: new Date().toISOString(),
      }, { onConflict: 'hype_date,quadro' });

      for (let i = 0; i < ranked.length; i += 1) {
        const slot = ranked[i];
        const ints = interactions.filter((x) => x.agenda_id === slot.id);
        const company = slot.hype_empresas;
        const metricsRow = {
          agenda_id: slot.id, empresa_id: slot.empresa_id, hype_date: date, quadro: board,
          hypes_validos: byAgendaVotes[slot.id] || 0,
          interacoes: ints.length,
          visitas_detalhe: ints.filter((x) => x.event_type === 'detail').length,
          beneficios_abertos: ints.filter((x) => x.event_type === 'benefit').length,
          whatsapp_clicks: ints.filter((x) => x.event_type === 'whatsapp').length,
          posicao: i + 1,
        };
        metricsRow.message_text = `HOCCO HYPE — RELATÓRIO\n\nEmpresa: ${company?.nome_fantasia || ''}\nData: ${date}\nQuadro: ${HYPE_BOARDS[board].label}\n\n⚡ ${metricsRow.hypes_validos} Hypes válidos\n✨ ${metricsRow.interacoes} interações\n🏪 ${metricsRow.visitas_detalhe} visitas aos detalhes\n🎁 ${metricsRow.beneficios_abertos} aberturas de benefício\n💬 ${metricsRow.whatsapp_clicks} direcionamentos ao WhatsApp\n🏆 Posição: ${metricsRow.posicao}º\n\nObrigado por participar do HOCCO Hype.`;
        await supabase.from('hype_relatorios').upsert(metricsRow, { onConflict: 'agenda_id' });
      }
    }

    const overallRank = Object.entries(overall).sort((a, b) => b[1] - a[1]);
    if (overallRank.length) {
      const [winnerCompanyId, score] = overallRank[0];
      const winnerAgenda = agenda.find((a) => a.empresa_id === winnerCompanyId);
      await supabase.from('hype_resultados').upsert({
        hype_date: date, quadro: 'dia', empresa_id: winnerCompanyId, agenda_id: winnerAgenda?.id || null,
        hypes_validos: score, participantes_unicos: new Set(votes.map((v) => v.user_id)).size, finalized_at: new Date().toISOString(),
      }, { onConflict: 'hype_date,quadro' });
    }
    await supabase.from('hype_agenda').update({ status: 'finalizado', updated_at: new Date().toISOString() }).eq('hype_date', date).neq('status', 'cancelado');
    await audit('finalize_hype_day', 'hype_day', date, { agenda: agenda.length, votes: votes.length });
    flash('Hype do dia finalizado. Vencedores e relatórios foram congelados.');
    loadAll();
  }

  async function createExperience(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      titulo: String(form.get('titulo')).trim(), descricao: String(form.get('descricao')).trim(),
      hc_min: Math.max(100, Number(form.get('hc_min') || 100)), vagas: Math.max(1, Number(form.get('vagas') || 5)),
      regras: String(form.get('regras')).trim() || null,
      evento_at: form.get('evento_at') ? new Date(String(form.get('evento_at'))).toISOString() : null,
      status: 'publicada', created_by: user.id,
    };
    const { data, error } = await supabase.from('hocco_experiencias').insert(payload).select().single();
    if (error) return flash(error.message);
    await audit('create_experience', 'experiencia', data.id, payload);
    flash('Experiência publicada no app.');
    event.currentTarget.reset();
    loadAll();
  }

  async function setApplicationStatus(app, status) {
    const exp = experiences.find((e) => e.id === app.experiencia_id);
    if (status === 'selecionado') {
      const already = applications.filter((a) => a.experiencia_id === app.experiencia_id && ['selecionado','confirmado'].includes(a.status)).length;
      if (already >= Number(exp?.vagas || 0)) return flash('Todas as vagas desta experiência já foram preenchidas.');
    }
    await supabase.from('hocco_experiencia_inscricoes').update({ status, updated_at: new Date().toISOString() }).eq('id', app.id);
    await audit('experience_curate', 'experiencia_inscricao', app.id, { status });
    loadAll();
  }

  const memberRows = useMemo(() => profiles.map((p) => ({
    ...p,
    contact: contacts.find((c) => c.user_id === p.user_id),
    seconds: sessions.filter((s) => s.user_id === p.user_id).reduce((a, s) => a + Number(s.active_seconds || 0), 0),
    sessions: sessions.filter((s) => s.user_id === p.user_id).length,
  })).filter((p) => `${p.nome_publico} ${p.contact?.email || ''} ${p.contact?.telefone || ''}`.toLowerCase().includes(search.toLowerCase())), [profiles, contacts, sessions, search]);

  if (loading) return <div className="adminGate"><ShieldCheck/><b>Validando HOCCO Control...</b></div>;
  if (!isAdmin) return <div className="adminGate"><XCircle/><b>Acesso não autorizado.</b><p>Esta conta não possui permissão administrativa HOCCO.</p><button onClick={() => location.href='/app'}>Voltar ao app</button></div>;

  return <main className="controlApp">
    <aside className="controlSide"><div className="controlBrand"><b>HOCCO</b><span>CONTROL</span></div><nav>{NAV.map(([key, Icon, label]) => <button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}><Icon/><span>{label}</span>{key==='solicitacoes'&&metrics.pending>0?<em>{metrics.pending}</em>:null}</button>)}</nav><button className="controlLogout" onClick={async()=>{await supabase.auth.signOut();location.replace('/')}}><LogOut/> Sair</button></aside>
    <section className="controlMain">
      <header className="controlTop"><div><small>CÉLULA OPERACIONAL</small><h1>{NAV.find((n)=>n[0]===tab)?.[2]}</h1></div><div className="controlTopRight"><span className="onlineDot">● ONLINE</span><button onClick={loadAll}><RefreshCw/> Atualizar</button></div></header>
      {notice && <div className="controlNotice">{notice}</div>}

      {tab==='dashboard' && <Dashboard metrics={metrics} requests={requests} agenda={agenda} sessions={sessions} events={events} />}

      {tab==='membros' && <section><div className="toolRow"><label className="controlSearch"><Search/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar nome, e-mail ou telefone"/></label><span>{memberRows.length} membros</span></div><div className="dataTable"><div className="thead"><span>Membro</span><span>Contato</span><span>HC / ofensiva</span><span>Hoje</span></div>{memberRows.map((m)=><div className="trow" key={m.user_id}><span><b>{m.nome_publico}</b><small>Nível {m.nivel} · {m.xp} XP</small></span><span><b>{m.contact?.email||'—'}</b><small>{m.contact?.telefone||'telefone pendente'}</small></span><span><b>{m.hc} HC</b><small>🔥 {m.ofensiva_dias} dias</small></span><span><b>{m.sessions} sessões</b><small>{formatDuration(m.seconds)}</small></span></div>)}</div></section>}

      {tab==='solicitacoes' && <section className="stack"><div className="sectionTitle"><div><small>PIPELINE EMPRESARIAL</small><h2>Pagamentos, análise e fila</h2></div></div>{requests.map((r)=><article className="requestCard" key={r.id}><div className="requestMain"><div><small>{r.payment_reference}</small><h3>{r.nome_fantasia}</h3><p>{r.cnpj} · {r.segmento} · {r.cidade}/{r.uf}</p></div><div className="requestPrice"><b>{brl(r.valor)}</b><span>{r.tamanho} · {r.periodo}</span></div></div><div className="requestFacts"><span>Desconto <b>{r.desconto}%</b></span><span>Pagamento <b>{r.payment_status}</b></span><span>Status <b>{r.status.replaceAll('_',' ')}</b></span></div>{r.motivo_recusa&&<div className="rejectReason">Motivo: {r.motivo_recusa}</div>}<div className="actions">{r.payment_status!=='confirmado'&&r.pagamento_informado_at&&<button onClick={()=>confirmPayment(r)}><CheckCircle2/> Confirmar pagamento</button>}{r.payment_status==='confirmado'&&!['programado','recusado','reembolso_pendente','reembolsado'].includes(r.status)&&<button className="positive" onClick={()=>approveAndSchedule(r)}><Zap/> Aprovar e colocar na fila</button>}{!['programado','recusado','reembolso_pendente','reembolsado'].includes(r.status)&&<button className="danger" onClick={()=>rejectRequest(r)}><XCircle/> Recusar</button>}{r.status==='reembolso_pendente'&&<button onClick={()=>markRefunded(r)}><WalletCards/> Marcar PIX reembolsado</button>}<a href={whatsappUrl(r.whatsapp,`Olá! Aqui é a equipe HOCCO sobre a solicitação ${r.payment_reference} da ${r.nome_fantasia}.`)} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a></div></article>)}</section>}

      {tab==='empresas' && <section className="controlGrid"><div className="controlPanel"><small>ENTRADA RÁPIDA</small><h2>Empresa já cadastrada</h2><p>Nome/código, quadro e tamanho. Materiais existentes são reutilizados.</p><form className="quickForm" onSubmit={quickSchedule}><label>Empresa<select name="empresa" required defaultValue=""><option value="" disabled>Selecione...</option>{companies.map((c)=><option value={c.id} key={c.id}>{c.codigo} · {c.nome_fantasia}</option>)}</select></label><div className="two"><label>Tamanho<select name="tamanho" defaultValue="medio"><option value="compacto">Compacto</option><option value="medio">Médio</option><option value="grande">Grande</option><option value="max">Max</option></select></label><label>Período<select name="periodo" defaultValue="tarde"><option value="almoco">Almoço</option><option value="tarde">Tarde</option><option value="noite">Noite</option><option value="dia">Dia inteiro</option></select></label></div><label>Desconto do Hype (%)<input name="desconto" type="number" min="0" max="30" defaultValue="10"/></label><button><Zap/> COLOCAR NO PRÉ-HYPE</button></form></div><div className="controlPanel"><small>BASE MESTRE</small><h2>{companies.length} empresas</h2><div className="companyAdminList">{companies.map((c)=><article key={c.id}>{c.logo_url?<img src={c.logo_url} alt=""/>:<span>{c.nome_fantasia[0]}</span>}<div><b>{c.nome_fantasia}</b><small>{c.codigo} · {c.segmento} · {c.desconto_padrao}% OFF</small></div><a href={whatsappUrl(c.whatsapp,`Olá, ${c.nome_fantasia}! Aqui é a equipe HOCCO.`)} target="_blank" rel="noreferrer"><MessageCircle/></a></article>)}</div></div></section>}

      {tab==='hype' && <section><div className="hypeControlHead"><div><small>{todayBR()}</small><h2>Operação dos três quadros</h2><p>Almoço 11–14 · Tarde 14–18 · Noite 18–22</p></div><button className="finishDay" onClick={finalizeToday}><Trophy/> FINALIZAR HYPE DO DIA</button></div><div className="boardControlGrid">{Object.entries(HYPE_BOARDS).map(([key,info])=>{const slots=agenda.filter((a)=>a.quadro===key&&a.status!=='cancelado');return <div className="boardControl" key={key}><div className="boardControlTitle"><div><b>{info.label}</b><span>{info.window}</span></div><strong>{slots.length}/10</strong></div>{slots.map((slot)=>{const count=votes.filter((v)=>v.agenda_id===slot.id).length;const ints=interactions.filter((i)=>i.agenda_id===slot.id).length;return <article key={slot.id}><div className={`adminLogo size-${slot.tamanho}`}>{slot.hype_empresas?.logo_url?<img src={slot.hype_empresas.logo_url} alt=""/>:slot.hype_empresas?.nome_fantasia?.[0]}</div><div><b>{slot.hype_empresas?.nome_fantasia}</b><small>{slot.tamanho} · {slot.desconto}% OFF</small></div><span><b>{count}</b><small>Hypes</small></span><span><b>{ints}</b><small>ações</small></span></article>})}{!slots.length&&<div className="miniEmpty">Nenhuma empresa programada.</div>}</div>})}</div></section>}

      {tab==='experiencias' && <section className="controlGrid"><div className="controlPanel"><small>NOVA EXPERIÊNCIA</small><h2>Criar oportunidade</h2><form className="quickForm" onSubmit={createExperience}><label>Título<input name="titulo" required placeholder="Dia de gravação HOCCO"/></label><label>Descrição<textarea name="descricao" required/></label><div className="two"><label>HC mínimo<input name="hc_min" type="number" min="100" defaultValue="100" required/></label><label>Vagas<input name="vagas" type="number" min="1" defaultValue="5" required/></label></div><label>Data/hora<input name="evento_at" type="datetime-local"/></label><label>Regras<textarea name="regras" placeholder="Critérios, duração, local..."/></label><button><Award/> PUBLICAR EXPERIÊNCIA</button></form></div><div className="controlPanel"><small>CURADORIA</small><h2>Candidatos e vagas</h2>{experiences.map((exp)=><article className="curation" key={exp.id}><div className="curationHead"><div><b>{exp.titulo}</b><small>{exp.hc_min} HC · {exp.vagas} vagas</small></div><span>{applications.filter((a)=>a.experiencia_id===exp.id).length} inscritos</span></div>{applications.filter((a)=>a.experiencia_id===exp.id).map((app)=>{const p=profiles.find((x)=>x.user_id===app.user_id);return <div className="candidate" key={app.id}><div><b>{p?.nome_publico||'Membro'}</b><small>{p?.hc||0} HC · 🔥 {p?.ofensiva_dias||0} · {p?.total_dias_ativos||0} dias ativos</small></div><em>{app.status}</em><button disabled={app.status==='selecionado'} onClick={()=>setApplicationStatus(app,'selecionado')}>Selecionar</button><button onClick={()=>setApplicationStatus(app,'lista_espera')}>Espera</button></div>})}</article>)}</div></section>}

      {tab==='relatorios' && <section><div className="sectionTitle"><div><small>PÓS-HYPE</small><h2>Relatórios individuais</h2><p>O texto é gerado no fechamento. O envio automático por WhatsApp fica preparado para integração oficial; enquanto isso, o botão abre a mensagem pronta.</p></div></div><div className="reportGrid">{reports.map((r)=><article className="reportCard" key={r.id}><div><small>{r.hype_date} · {r.quadro}</small><h3>{r.hype_empresas?.nome_fantasia}</h3></div><div className="reportMetrics"><span><b>{r.hypes_validos}</b> Hypes</span><span><b>{r.interacoes}</b> interações</span><span><b>{r.whatsapp_clicks}</b> WhatsApp</span><span><b>{r.posicao||'—'}º</b> posição</span></div><a href={whatsappUrl(r.hype_empresas?.whatsapp||'',r.message_text||'Relatório HOCCO Hype')} target="_blank" rel="noreferrer"><MessageCircle/> ENVIAR RELATÓRIO</a></article>)}</div></section>}
    </section>
  </main>;
}

function Dashboard({ metrics, requests, agenda, sessions, events }) {
  const avg = metrics.sessions ? Math.round(metrics.activeSeconds / metrics.sessions) : 0;
  const pendingRefund = requests.filter((r)=>r.status==='reembolso_pendente').length;
  return <section><div className="controlStats"><Stat icon={Users} label="Membros" value={metrics.members||0} note="cadastros totais"/><Stat icon={Activity} label="Acessos hoje" value={metrics.sessions||0} note={`${formatDuration(metrics.activeSeconds||0)} no app`}/><Stat icon={Zap} label="Hypes hoje" value={metrics.hypes||0} note={`${agenda.length}/30 posições ocupadas`}/><Stat icon={Sparkles} label="HC emitidos" value={metrics.hc||0} note="saldo total da comunidade"/><Stat icon={Clock3} label="Sessão média" value={formatDuration(avg)} note="tempo ativo por acesso"/><Stat icon={Target} label="Ações hoje" value={metrics.actions||0} note="eventos + interações"/><Stat icon={Building2} label="Empresas" value={metrics.companies||0} note={`${metrics.pending||0} no pipeline`}/><Stat icon={WalletCards} label="Reembolsos" value={pendingRefund} note="pendentes de confirmação"/></div><div className="controlGrid"><div className="controlPanel"><small>FLUXO HOJE</small><h2>Atividade recente</h2><div className="activityList">{events.slice(0,12).map((e)=><div key={e.id}><span>{String(e.event_type).replaceAll('_',' ')}</span><small>{new Date(e.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>)}{!events.length&&<p>Nenhuma ação registrada ainda.</p>}</div></div><div className="controlPanel"><small>SAÚDE DA CÉLULA</small><h2>Sinais operacionais</h2><div className="healthRows"><p><span>Quadros ocupados hoje</span><b>{agenda.length}/30</b></p><p><span>Sessões abertas hoje</span><b>{sessions.length}</b></p><p><span>Tempo ativo acumulado</span><b>{formatDuration(metrics.activeSeconds||0)}</b></p><p><span>Solicitações em andamento</span><b>{metrics.pending||0}</b></p></div></div></div></section>;
}
function Stat({icon:Icon,label,value,note}){return <article className="controlStat"><Icon/><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}
function formatDuration(seconds){const s=Math.max(0,Number(seconds||0));if(s<60)return `${s}s`;const m=Math.floor(s/60);if(m<60)return `${m}min`;const h=Math.floor(m/60),rm=m%60;return `${h}h ${rm}min`}
