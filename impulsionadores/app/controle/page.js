'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Award, Building2, CheckCircle2, CircleDollarSign, Clock3,
  FileText, HeartHandshake, LayoutDashboard, LogOut, MessageCircle, ReceiptText,
  RefreshCw, Search, Server, ShieldCheck, Trophy, Users, WalletCards, X, XCircle, Zap,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { HYPE_BOARDS, brl, todayBR, whatsappUrl } from '../../lib/config';
import './controle.css';

const NAV = [
  ['dashboard', LayoutDashboard, 'Visão geral'],
  ['solicitacoes', WalletCards, 'Solicitações'],
  ['empresas', Building2, 'Empresas'],
  ['hype', Zap, 'Hype'],
  ['financeiro', CircleDollarSign, 'Financeiro'],
  ['impulsoes', HeartHandshake, 'Impulsões'],
  ['membros', Users, 'Membros'],
  ['experiencias', Award, 'Experiências'],
  ['relatorios', FileText, 'Relatórios'],
  ['auditoria', ReceiptText, 'Auditoria'],
  ['saude', Server, 'Saúde'],
];

const CLOSED_REQUESTS = new Set(['programado','recusado','reembolso_pendente','reembolsado','cancelado']);

export default function Controle() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [metrics, setMetrics] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [votes, setVotes] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [impulsions, setImpulsions] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [results, setResults] = useState([]);
  const [audits, setAudits] = useState([]);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState([]);
  const [search, setSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [consolidateDate, setConsolidateDate] = useState(todayBR());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { location.replace('/'); return; }
      if (!mounted) return;
      setUser(data.user);
      const { data: admin } = await supabase.from('hocco_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      setIsAdmin(Boolean(admin));
      setLoading(false);
      if (admin) await loadAll();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) location.replace('/');
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  async function loadAll() {
    const date = todayBR();
    const from = new Date(`${date}T12:00:00-03:00`);
    from.setDate(from.getDate() - 14);
    const fromDate = from.toISOString().slice(0,10);
    const responses = await Promise.all([
      supabase.rpc('admin_hype_dashboard', { p_date: date }),
      supabase.from('impulsionadores_perfis').select('*').is('deleted_at', null).order('created_at', { ascending:false }).limit(500),
      supabase.from('impulsionadores_contatos').select('*').limit(500),
      supabase.from('hype_solicitacoes').select('*').order('created_at', { ascending:false }).limit(500),
      supabase.from('hype_empresas').select('*').order('updated_at', { ascending:false }).limit(500),
      supabase.from('hype_agenda').select('*,hype_empresas(id,nome_fantasia,logo_url,capa_url,segmento,lifecycle_status)').gte('hype_date', fromDate).order('hype_date', { ascending:false }).limit(2000),
      supabase.from('hype_votos').select('id,agenda_id,user_id,hype_date,quadro,created_at').eq('hype_date', date).limit(10000),
      supabase.from('hype_interacoes').select('id,agenda_id,user_id,event_type,created_at').gte('created_at', `${date}T00:00:00-03:00`).limit(10000),
      supabase.from('hype_financeiro_ledger').select('*').order('created_at', { ascending:false }).limit(500),
      supabase.from('impulsionadores_impulsoes').select('*').order('created_at', { ascending:false }).limit(500),
      supabase.from('hocco_experiencias').select('*').order('created_at', { ascending:false }).limit(200),
      supabase.from('hocco_experiencia_inscricoes').select('*').order('created_at', { ascending:false }).limit(1000),
      supabase.from('hype_relatorios').select('*,hype_empresas(nome_fantasia,logo_url)').order('created_at', { ascending:false }).limit(500),
      supabase.from('hype_resultados').select('*,hype_empresas(nome_fantasia,logo_url)').order('finalized_at', { ascending:false }).limit(300),
      supabase.from('hocco_admin_audit').select('*').order('created_at', { ascending:false }).limit(500),
    ]);
    const [dash,p,c,req,comp,ag,vo,inter,fin,imp,exp,apps,rep,res,aud] = responses;
    setMetrics(dash.data || {});
    setProfiles(p.data || []);
    setContacts(c.data || []);
    setRequests(req.data || []);
    setCompanies(comp.data || []);
    setAgenda(ag.data || []);
    setVotes(vo.data || []);
    setInteractions(inter.data || []);
    setLedger(fin.data || []);
    setImpulsions(imp.data || []);
    setExperiences(exp.data || []);
    setApplications(apps.data || []);
    setReports(rep.data || []);
    setResults(res.data || []);
    setAudits(aud.data || []);
    setErrors(responses.map((x, i) => x.error ? `${i}: ${x.error.message}` : null).filter(Boolean));
  }

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 5200);
  }

  async function runRpc(name, args, success) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) { flash(humanError(error.message)); return null; }
    flash(success || 'Operação concluída.');
    await loadAll();
    return data;
  }

  async function confirmPayment(r) {
    const data = await runRpc('admin_confirm_hype_payment', { p_request_id:r.id, p_amount:null }, `Pagamento ${r.payment_reference} confirmado.`);
    if (data && selectedRequest?.id === r.id) setSelectedRequest((x) => ({ ...x, payment_status:'confirmado', status:'em_analise', pagamento_confirmado_at:new Date().toISOString(), valor_recebido:data.amount }));
  }

  async function publishRequest(r) {
    const data = await runRpc('admin_publish_hype_request', { p_request_id:r.id }, `${r.nome_fantasia} publicada no Hype.`);
    if (data && selectedRequest?.id === r.id) setSelectedRequest((x) => ({ ...x, status:'programado', empresa_id:data.company_id }));
  }

  async function rejectRequest(r) {
    const reason = window.prompt('Motivo da recusa. Este texto será registrado na auditoria:');
    if (!reason?.trim()) return;
    const data = await runRpc('admin_reject_hype_request', { p_request_id:r.id, p_reason:reason.trim() }, r.payment_status==='confirmado' ? 'Solicitação recusada e enviada para reembolso.' : 'Solicitação recusada.');
    if (data && selectedRequest?.id === r.id) setSelectedRequest(null);
  }

  async function refundRequest(r) {
    if (!window.confirm(`Confirmar que o PIX de reembolso de ${brl(r.valor_recebido || r.valor)} foi concluído?`)) return;
    await runRpc('admin_confirm_hype_refund', { p_request_id:r.id, p_amount:null }, 'Reembolso registrado no financeiro e na auditoria.');
    if (selectedRequest?.id === r.id) setSelectedRequest(null);
  }

  async function confirmImpulse(item) {
    await runRpc('admin_confirm_impulsion', { p_impulsao_id:item.id }, `Impulsão ${item.reference_code} confirmada.`);
  }

  async function changeCompanyState(company, state) {
    const label = state === 'active' ? 'reativar' : state === 'suspended' ? 'suspender' : 'arquivar';
    const reason = state === 'active' ? 'Reativação operacional HOCCO' : window.prompt(`Motivo para ${label} ${company.nome_fantasia}:`);
    if (!reason?.trim()) return;
    await runRpc('admin_set_hype_company_state', { p_company_id:company.id, p_state:state, p_reason:reason.trim() }, `${company.nome_fantasia}: estado atualizado.`);
    if (selectedCompany?.id === company.id) setSelectedCompany(null);
  }

  async function saveCompany(event) {
    event.preventDefault();
    if (!selectedCompany) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') || '').trim();
    if (reason.length < 4) return flash('Informe o motivo da alteração.');
    const patch = {
      nome_fantasia:String(form.get('nome_fantasia') || '').trim(),
      razao_social:String(form.get('razao_social') || '').trim(),
      whatsapp:String(form.get('whatsapp') || '').trim(),
      email:String(form.get('email') || '').trim(),
      cidade:String(form.get('cidade') || '').trim(),
      uf:String(form.get('uf') || '').trim(),
      segmento:String(form.get('segmento') || '').trim(),
      instagram:String(form.get('instagram') || '').trim(),
      site_url:String(form.get('site_url') || '').trim(),
      desconto_padrao:Number(form.get('desconto_padrao') || 0),
      condicoes:String(form.get('condicoes') || '').trim(),
      beneficio_validade:String(form.get('beneficio_validade') || ''),
    };
    const data = await runRpc('admin_update_hype_company', { p_company_id:selectedCompany.id, p_patch:patch, p_reason:reason }, 'Dados da empresa atualizados e auditados.');
    if (data) setSelectedCompany(null);
  }

  async function consolidate() {
    const { data, error } = await supabase.rpc('finalizar_hype_dia', { p_date:consolidateDate });
    if (error) return flash(humanError(error.message));
    flash(data?.empate ? 'Consolidação concluída. Há empate registrado.' : `Dia ${formatDate(consolidateDate)} consolidado.`);
    await loadAll();
  }

  async function createExperience(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      titulo:String(form.get('titulo')).trim(),
      descricao:String(form.get('descricao')).trim(),
      empresa_id:form.get('empresa_id') || null,
      hc_min:Math.max(150,Number(form.get('hc_min') || 150)),
      hc_cost:Math.max(0,Number(form.get('hc_cost') || 0)),
      vagas:Math.max(1,Number(form.get('vagas') || 5)),
      regras:String(form.get('regras') || '').trim() || null,
      local_evento:String(form.get('local_evento') || '').trim() || null,
      evento_at:form.get('evento_at') ? new Date(String(form.get('evento_at'))).toISOString() : null,
      confirmar_ate:form.get('confirmar_ate') ? new Date(String(form.get('confirmar_ate'))).toISOString() : null,
      status:'publicada',
      created_by:user.id,
    };
    const { error } = await supabase.from('hocco_experiencias').insert(payload);
    if (error) return flash('Não foi possível publicar a experiência.');
    flash('Experiência publicada.');
    event.currentTarget.reset();
    await loadAll();
  }

  async function setApplicationStatus(app, status) {
    const exp = experiences.find((e) => e.id === app.experiencia_id);
    if (status === 'selecionado') {
      const occupied = applications.filter((a) => a.experiencia_id===app.experiencia_id && ['selecionado','confirmado'].includes(a.status)).length;
      if (occupied >= Number(exp?.vagas || 0)) return flash('Todas as vagas desta experiência estão preenchidas.');
    }
    const update = { status, updated_at:new Date().toISOString() };
    if (status === 'confirmado') update.participou_at = new Date().toISOString();
    const { error } = await supabase.from('hocco_experiencia_inscricoes').update(update).eq('id', app.id);
    if (error) return flash('Não foi possível alterar esta inscrição.');
    flash('Inscrição atualizada.');
    await loadAll();
  }

  const memberRows = useMemo(() => profiles.map((p) => ({ ...p, contact:contacts.find((c) => c.user_id===p.user_id) })).filter((p) => `${p.nome_publico} ${p.contact?.email || ''} ${p.contact?.telefone || ''}`.toLowerCase().includes(search.toLowerCase())), [profiles, contacts, search]);
  const companyRows = useMemo(() => companies.filter((c) => `${c.codigo} ${c.nome_fantasia} ${c.cnpj || ''} ${c.whatsapp || ''}`.toLowerCase().includes(companySearch.toLowerCase())), [companies, companySearch]);
  const requestPending = requests.filter((r) => !CLOSED_REQUESTS.has(r.status));
  const todaySlots = agenda.filter((a) => a.hype_date===todayBR() && a.status!=='cancelado');
  const futureSlots = agenda.filter((a) => a.hype_date>todayBR() && a.status!=='cancelado').sort((a,b) => String(a.hype_date).localeCompare(String(b.hype_date))).slice(0,120);

  if (loading) return <div className="adminGate"><ShieldCheck/><b>Validando HOCCO Control...</b></div>;
  if (!isAdmin) return <div className="adminGate"><XCircle/><b>Acesso não autorizado.</b><p>Esta conta não possui permissão administrativa HOCCO.</p><button onClick={() => location.href='/app'}>Voltar ao app</button></div>;

  return <main className="controlApp">
    <aside className="controlSide"><div className="controlBrand"><b>HOCCO</b><span>CONTROL · UNIFIED</span></div><nav>{NAV.map(([key,Icon,label]) => <button key={key} className={tab===key?'active':''} onClick={() => setTab(key)}><Icon/><span>{label}</span>{key==='solicitacoes' && requestPending.length>0 ? <em>{requestPending.length}</em> : key==='impulsoes' && impulsions.filter((i) => i.status==='pagamento_informado').length>0 ? <em>{impulsions.filter((i) => i.status==='pagamento_informado').length}</em> : null}</button>)}</nav><button className="controlLogout" onClick={async () => { await supabase.auth.signOut(); location.replace('/'); }}><LogOut/> Sair</button></aside>
    <section className="controlMain">
      <header className="controlTop"><div><small>CÉLULA OPERACIONAL</small><h1>{NAV.find((n) => n[0]===tab)?.[2]}</h1></div><div className="controlTopRight"><span className={`onlineDot ${errors.length?'warn':''}`}>● {errors.length ? 'ATENÇÃO' : 'OPERACIONAL'}</span><button onClick={loadAll}><RefreshCw/> Atualizar</button></div></header>
      {notice && <div className="controlNotice">{notice}</div>}

      {tab==='dashboard' && <Dashboard metrics={metrics} pending={requestPending.length} futureSlots={futureSlots.length}/>} 

      {tab==='solicitacoes' && <section className="stack"><div className="sectionTitle"><div><small>PIPELINE ÚNICO</small><h2>Pagamento → revisão → publicação</h2><p>Nenhum botão paralelo cria Pré-Hype. A publicação final é atômica no banco.</p></div></div>{requests.map((r) => <RequestCard key={r.id} r={r} open={() => setSelectedRequest(r)} confirm={() => confirmPayment(r)} publish={() => publishRequest(r)} reject={() => rejectRequest(r)} refund={() => refundRequest(r)}/>)}</section>}

      {tab==='empresas' && <section><div className="toolRow"><label className="controlSearch companySearch"><Search/><input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Código, nome, CNPJ ou WhatsApp"/></label><span>{companies.length} carregadas</span></div><div className="companyAdminList">{companyRows.map((c) => <article key={c.id}><div className="adminLogo">{c.logo_url ? <img src={c.logo_url} alt=""/> : c.nome_fantasia?.[0]}</div><div><b>{c.nome_fantasia}</b><small>{c.codigo} · {c.segmento || 'sem segmento'} · {stateLabel(c.lifecycle_status)}</small></div><button onClick={() => setSelectedCompany(c)}>GERENCIAR</button></article>)}</div></section>}

      {tab==='hype' && <section><div className="hypeControlHead"><div><small>{todayBR()}</small><h2>Quadros publicados</h2><p>Somente `ativo` aparece ao membro. Capacidade máxima: 10 empresas por quadro.</p></div></div><div className="boardControlGrid">{Object.entries(HYPE_BOARDS).map(([key,info]) => { const slots=todaySlots.filter((a) => a.quadro===key); return <div className="boardControl" key={key}><div className="boardControlTitle"><div><b>{info.label}</b><span>{info.window}</span></div><strong>{slots.length}/10</strong></div>{slots.map((slot) => { const count=votes.filter((v) => v.agenda_id===slot.id).length; const people=new Set(interactions.filter((i) => i.agenda_id===slot.id).map((i) => i.user_id)).size; return <article key={slot.id}><div className={`adminLogo size-${slot.tamanho}`}>{slot.logo_url_snapshot ? <img src={slot.logo_url_snapshot} alt=""/> : slot.hype_empresas?.logo_url ? <img src={slot.hype_empresas.logo_url} alt=""/> : 'H'}</div><div><b>{slot.company_name_snapshot || slot.hype_empresas?.nome_fantasia}</b><small>{human(slot.status)} · {slot.tamanho} · {Number(slot.desconto || 0)}%</small></div><span><b>{count}</b><small>Hypes</small></span><span><b>{people}</b><small>pessoas</small></span></article>; })}{!slots.length && <div className="miniEmpty">Nenhuma empresa neste quadro.</div>}</div>; })}</div><div className="controlPanel" style={{marginTop:16}}><small>CONSOLIDAÇÃO</small><h2>Fechar relatórios de um dia</h2><p>Os quadros encerram automaticamente. Esta ação consolida relatório e resultado diário, inclusive de datas anteriores.</p><div className="toolRow"><input type="date" value={consolidateDate} max={todayBR()} onChange={(e) => setConsolidateDate(e.target.value)}/><button className="finishDay" onClick={consolidate}><Trophy/> CONSOLIDAR DIA</button></div></div><div className="controlPanel" style={{marginTop:16}}><small>AGENDA FUTURA</small><h2>{futureSlots.length} posições carregadas</h2><div className="stack">{futureSlots.slice(0,40).map((a) => <div className="requestFacts" key={a.id}><span><b>{formatDate(a.hype_date)}</b></span><span>{a.company_name_snapshot || a.hype_empresas?.nome_fantasia}</span><span>{human(a.quadro)} · {human(a.status)}</span></div>)}</div></div></section>}

      {tab==='financeiro' && <section><div className="controlStats financeStats"><Stat icon={CircleDollarSign} label="Hype bruto" value={brl(metrics.business_gross)} note="pagamentos confirmados"/><Stat icon={WalletCards} label="Reembolsos" value={brl(metrics.refunds_total)} note={`${metrics.refunds_pending || 0} pendentes`}/><Stat icon={CircleDollarSign} label="Hype líquido" value={brl(metrics.business_net)} note="bruto menos reembolsos"/><Stat icon={HeartHandshake} label="Impulsões" value={brl(metrics.impulsions_total)} note="apoio separado da receita comercial"/></div><div className="controlPanel"><small>LEDGER FINANCEIRO</small><h2>Eventos monetários imutáveis</h2><div className="dataTable"><div className="thead"><span>Evento</span><span>Origem</span><span>Valor</span><span>Data</span></div>{ledger.map((l) => <div className="trow" key={l.id}><span><b>{human(l.event_type)}</b><small>{l.reference || '—'}</small></span><span><b>{human(l.source_type)}</b><small>{human(l.direction)}</small></span><span><b>{l.direction==='debit'?'- ':''}{brl(l.amount)}</b></span><span>{formatDateTime(l.created_at)}</span></div>)}</div></div></section>}

      {tab==='impulsoes' && <section className="stack"><div className="sectionTitle"><div><small>APOIO DA COMUNIDADE</small><h2>Impulsões</h2><p>Confirmar uma Impulsão registra financeiro, auditoria e recompensa de XP em uma única operação.</p></div></div>{impulsions.map((i) => <article className="requestCard" key={i.id}><div className="requestMain"><div><small>{i.reference_code}</small><h3>{profiles.find((p) => p.user_id===i.user_id)?.nome_publico || 'Impulsionador'}</h3><p>{formatDateTime(i.created_at)} · créditos {i.creditos_publicos?'públicos':'privados'}</p></div><div className="requestPrice"><b>{brl(i.amount)}</b><span>{human(i.status)}</span></div></div><div className="actions">{i.status==='pagamento_informado' && <button className="positive" onClick={() => confirmImpulse(i)}><CheckCircle2/> Confirmar Impulsão</button>}</div></article>)}</section>}

      {tab==='membros' && <section><div className="toolRow"><label className="controlSearch"><Search/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, e-mail ou telefone"/></label><span>{metrics.members || profiles.length} membros</span></div><div className="dataTable"><div className="thead"><span>Membro</span><span>Contato</span><span>HC / ofensiva</span><span>Progressão</span></div>{memberRows.map((m) => <div className="trow" key={m.user_id}><span><b>{m.nome_publico}</b><small>{m.username || 'perfil HOCCO'}</small></span><span><b>{m.contact?.email || '—'}</b><small>{m.contact?.telefone || 'telefone pendente'}</small></span><span><b>{m.hc} HC</b><small>🔥 {m.ofensiva_dias} · recorde {m.maior_ofensiva || m.ofensiva_dias}</small></span><span><b>Nível {m.nivel}</b><small>{m.xp} XP · {m.missoes_concluidas} missões</small></span></div>)}</div></section>}

      {tab==='experiencias' && <section className="controlGrid"><div className="controlPanel"><small>NOVA EXPERIÊNCIA</small><h2>Criar oportunidade</h2><form className="quickForm" onSubmit={createExperience}><label>Parceiro<select name="empresa_id" defaultValue=""><option value="">HOCCO</option>{companies.filter((c) => c.lifecycle_status==='active').map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome_fantasia}</option>)}</select></label><label>Título<input name="titulo" required/></label><label>Descrição<textarea name="descricao" required/></label><div className="two"><label>HC mínimo<input name="hc_min" type="number" min="150" defaultValue="150"/></label><label>HC consumido<input name="hc_cost" type="number" min="0" defaultValue="0"/></label></div><div className="two"><label>Vagas<input name="vagas" type="number" min="1" defaultValue="5"/></label><label>Local<input name="local_evento"/></label></div><div className="two"><label>Data/hora<input name="evento_at" type="datetime-local"/></label><label>Confirmar até<input name="confirmar_ate" type="datetime-local"/></label></div><label>Regras<textarea name="regras"/></label><button><Award/> PUBLICAR EXPERIÊNCIA</button></form></div><div className="controlPanel"><small>INSCRIÇÕES</small><h2>{applications.length} registros</h2><div className="stack">{applications.slice(0,120).map((a) => <div className="requestCard" key={a.id}><div className="requestMain"><div><small>{formatDateTime(a.created_at)}</small><h3>{experiences.find((e) => e.id===a.experiencia_id)?.titulo || 'Experiência'}</h3><p>{profiles.find((p) => p.user_id===a.user_id)?.nome_publico || a.user_id}</p></div><div className="requestPrice"><span>{human(a.status)}</span></div></div><div className="actions"><button onClick={() => setApplicationStatus(a,'selecionado')}>Selecionar</button><button className="positive" onClick={() => setApplicationStatus(a,'confirmado')}>Confirmar</button><button className="danger" onClick={() => setApplicationStatus(a,'recusado')}>Recusar</button></div></div>)}</div></div></section>}

      {tab==='relatorios' && <section className="stack"><div className="sectionTitle"><div><small>RESULTADOS CONGELADOS</small><h2>Relatórios e vencedores</h2></div></div>{results.slice(0,80).map((r) => <article className="requestCard" key={r.id}><div className="requestMain"><div><small>{formatDate(r.hype_date)} · {human(r.quadro)}</small><h3>{r.hype_empresas?.nome_fantasia || 'Empresa'}</h3><p>{r.hypes_validos} Hypes · {r.participantes_unicos} participantes · {r.empate?'empate registrado':'resultado único'}</p></div><div className="requestPrice"><b>{Number(r.score_percent || 0).toFixed(1)}%</b><span>score</span></div></div></article>)}{reports.slice(0,80).map((r) => <article className="requestCard" key={`rep-${r.id}`}><div className="requestMain"><div><small>RELATÓRIO · {formatDate(r.hype_date)}</small><h3>{r.hype_empresas?.nome_fantasia || 'Empresa'}</h3><p>{r.hypes_validos} Hypes · {r.pessoas_interagiram || 0} pessoas interagiram · {r.whatsapp_unicos || 0} WhatsApp</p></div></div></article>)}</section>}

      {tab==='auditoria' && <section><div className="dataTable"><div className="thead"><span>Ação</span><span>Entidade</span><span>ID</span><span>Data</span></div>{audits.map((a) => <div className="trow" key={a.id}><span><b>{human(a.action)}</b><small>{a.admin_user_id}</small></span><span>{human(a.entity_type)}</span><span><small>{a.entity_id}</small></span><span>{formatDateTime(a.created_at)}</span></div>)}</div></section>}

      {tab==='saude' && <section className="controlGrid"><div className="controlPanel"><small>INTEGRIDADE</small><h2>{errors.length ? 'Atenção necessária' : 'Operacional'}</h2><p>{errors.length ? errors.join(' · ') : 'Todas as consultas principais responderam. Banco, autenticação e Control estão conversando.'}</p></div><div className="controlPanel"><small>REGRAS ATIVAS</small><h2>Fonte de verdade no banco</h2><p>Capacidade por quadro, voto por horário, XP/HC, publicação, pagamento, reembolso, estado de empresa e financeiro não dependem apenas da interface.</p></div></section>}
    </section>

    {selectedRequest && <RequestModal r={selectedRequest} close={() => setSelectedRequest(null)} confirm={() => confirmPayment(selectedRequest)} publish={() => publishRequest(selectedRequest)} reject={() => rejectRequest(selectedRequest)} refund={() => refundRequest(selectedRequest)}/>} 
    {selectedCompany && <CompanyModal company={selectedCompany} close={() => setSelectedCompany(null)} save={saveCompany} setState={(state) => changeCompanyState(selectedCompany,state)}/>} 
  </main>;
}

function Dashboard({ metrics, pending, futureSlots }) {
  return <section><div className="controlStats"><Stat icon={Users} label="Membros" value={metrics.members || 0} note="perfis ativos"/><Stat icon={Building2} label="Empresas ativas" value={metrics.companies_active || 0} note={`${metrics.companies_suspended || 0} suspensas · ${metrics.companies_archived || 0} arquivadas`}/><Stat icon={WalletCards} label="Solicitações" value={pending} note="aguardando ação"/><Stat icon={Zap} label="Hypes hoje" value={metrics.hypes_today || 0} note={`${metrics.slots_today || 0} posições publicadas`}/><Stat icon={CircleDollarSign} label="Comercial líquido" value={brl(metrics.business_net)} note="já desconta reembolsos"/><Stat icon={HeartHandshake} label="Impulsões" value={brl(metrics.impulsions_total)} note="contabilidade separada"/></div><div className="controlGrid"><div className="controlPanel"><small>FLUXO EMPRESARIAL</small><h2>Uma única linha de produção</h2><p>Empresa envia materiais → informa PIX → Control confirma → revisão final → publicar → membro recebe a posição ativa. Nenhum Pré-Hype paralelo é necessário.</p></div><div className="controlPanel"><small>AGENDA</small><h2>{futureSlots} posições futuras carregadas</h2><p>Empresas suspensas/arquivadas não aparecem aos membros. Histórico publicado permanece preservado.</p></div></div></section>;
}

function RequestCard({ r, open, confirm, publish, reject, refund }) {
  const canPublish = r.payment_status==='confirmado' && !CLOSED_REQUESTS.has(r.status);
  return <article className="requestCard"><div className="requestMain"><div><small>{r.payment_reference}</small><h3>{r.nome_fantasia}</h3><p>{r.cnpj} · {r.segmento} · {r.cidade}/{r.uf}</p></div><div className="requestPrice"><b>{brl(r.valor)}</b><span>{human(r.tamanho)} · {human(r.periodo)}</span></div></div><div className="requestFacts"><span>Materiais <b>{r.logo_url && r.capa_url ? 'OK' : 'PENDENTE'}</b></span><span>Pagamento <b>{human(r.payment_status)}</b></span><span>Status <b>{human(r.status)}</b></span></div>{r.motivo_recusa && <div className="rejectReason">Motivo: {r.motivo_recusa}</div>}<div className="actions"><button onClick={open}>Revisar dados e imagens</button>{r.pagamento_informado_at && r.payment_status!=='confirmado' && <button onClick={confirm}><CheckCircle2/> Confirmar pagamento</button>}{canPublish && <button className="positive" onClick={publish}><Zap/> SUBIR PARA O HYPE</button>}{!CLOSED_REQUESTS.has(r.status) && <button className="danger" onClick={reject}><XCircle/> Recusar</button>}{r.status==='reembolso_pendente' && <button onClick={refund}><WalletCards/> Confirmar reembolso</button>}<a href={whatsappUrl(r.whatsapp,`Olá! Aqui é a equipe HOCCO sobre a solicitação ${r.payment_reference} da ${r.nome_fantasia}.`)} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a></div></article>;
}

function RequestModal({ r, close, confirm, publish, reject, refund }) {
  const canPublish = r.payment_status==='confirmado' && r.logo_url && r.capa_url && !CLOSED_REQUESTS.has(r.status);
  return <div style={overlay} onMouseDown={(e) => { if (e.target===e.currentTarget) close(); }}><section style={modal}><header style={modalHead}><div><small>REVISÃO EMPRESARIAL · {r.payment_reference}</small><h2>{r.nome_fantasia}</h2><p>Confira exatamente o que será congelado na publicação.</p></div><button onClick={close}><X/></button></header><div style={{display:'grid',gridTemplateColumns:'1.4fr .8fr',gap:12}}><Media title="CAPA" url={r.capa_url} cover/><Media title="PERFIL / LOGO" url={r.logo_url}/></div><div style={detailGrid}><Field label="Razão social" value={r.razao_social}/><Field label="CNPJ" value={r.cnpj}/><Field label="Responsável" value={r.responsavel}/><Field label="WhatsApp" value={r.whatsapp}/><Field label="E-mail" value={r.email}/><Field label="Segmento" value={r.segmento}/><Field label="Benefício" value={`${r.desconto}%`}/><Field label="Condições" value={r.condicoes}/><Field label="Período" value={human(r.periodo)}/><Field label="Tamanho" value={human(r.tamanho)}/><Field label="Pagamento" value={human(r.payment_status)}/><Field label="Valor recebido" value={brl(r.valor_recebido || 0)}/></div><div className="actions" style={{marginTop:14}}>{r.pagamento_informado_at && r.payment_status!=='confirmado' && <button onClick={confirm}>Confirmar pagamento</button>}{canPublish && <button className="positive" onClick={publish}>SUBIR PARA O HYPE</button>}{!CLOSED_REQUESTS.has(r.status) && <button className="danger" onClick={reject}>Recusar</button>}{r.status==='reembolso_pendente' && <button onClick={refund}>Confirmar reembolso</button>}</div></section></div>;
}

function CompanyModal({ company, close, save, setState }) {
  return <div style={overlay} onMouseDown={(e) => { if (e.target===e.currentTarget) close(); }}><section style={modal}><header style={modalHead}><div><small>{company.codigo} · {stateLabel(company.lifecycle_status)}</small><h2>{company.nome_fantasia}</h2><p>Editar a empresa não altera os snapshots das participações já publicadas.</p></div><button onClick={close}><X/></button></header><form onSubmit={save} className="quickForm"><div className="two"><label>Nome fantasia<input name="nome_fantasia" defaultValue={company.nome_fantasia}/></label><label>Razão social<input name="razao_social" defaultValue={company.razao_social || ''}/></label></div><div className="two"><label>WhatsApp<input name="whatsapp" defaultValue={company.whatsapp || ''}/></label><label>E-mail<input name="email" type="email" defaultValue={company.email || ''}/></label></div><div className="two"><label>Cidade<input name="cidade" defaultValue={company.cidade || ''}/></label><label>UF<input name="uf" maxLength="2" defaultValue={company.uf || ''}/></label></div><div className="two"><label>Segmento<input name="segmento" defaultValue={company.segmento || ''}/></label><label>Desconto padrão<input name="desconto_padrao" type="number" min="0" max="30" defaultValue={company.desconto_padrao || 0}/></label></div><div className="two"><label>Instagram<input name="instagram" defaultValue={company.instagram || ''}/></label><label>Site<input name="site_url" defaultValue={company.site_url || ''}/></label></div><label>Condições<textarea name="condicoes" defaultValue={company.condicoes || ''}/></label><label>Validade do benefício<input name="beneficio_validade" type="date" defaultValue={company.beneficio_validade || ''}/></label><label>Motivo da alteração<input name="reason" required minLength="4" placeholder="Obrigatório para auditoria"/></label><button>Salvar dados</button></form><div className="actions" style={{marginTop:16}}>{company.lifecycle_status!=='active' && <button className="positive" onClick={() => setState('active')}>Reativar</button>}{company.lifecycle_status==='active' && <button onClick={() => setState('suspended')}>Suspender</button>}{company.lifecycle_status!=='archived' && <button className="danger" onClick={() => setState('archived')}>Arquivar</button>}</div><p style={{fontSize:11,color:'#718096',marginTop:12}}>Não existe exclusão física para empresa com histórico. Arquivar preserva votos, relatórios, pagamentos e resultados.</p></section></div>;
}

function Media({ title, url, cover=false }) { return <div style={{background:'#fff',border:'1px solid #dfe7f0',borderRadius:16,padding:10}}><small>{title}</small><div style={{height:cover?190:130,marginTop:7,borderRadius:12,background:'#eef2f7',overflow:'hidden',display:'grid',placeItems:'center'}}>{url ? <img src={url} alt={title} style={{width:'100%',height:'100%',objectFit:cover?'cover':'contain'}}/> : <AlertTriangle/>}</div></div>; }
function Field({ label, value }) { return <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:10}}><small style={{display:'block',color:'#7a899b'}}>{label}</small><b style={{fontSize:12}}>{value || '—'}</b></div>; }
function Stat({ icon:Icon, label, value, note }) { return <div className="controlStat"><Icon/><div><small>{label}</small><b>{value}</b><span>{note}</span></div></div>; }
function human(value='') { return String(value || '—').replaceAll('_',' ').replace(/\b\w/g,(c) => c.toUpperCase()); }
function stateLabel(value='active') { return value==='active' ? 'ATIVA' : value==='suspended' ? 'SUSPENSA' : 'ARQUIVADA'; }
function formatDate(value) { if (!value) return '—'; return new Date(`${String(value).slice(0,10)}T12:00:00-03:00`).toLocaleDateString('pt-BR'); }
function formatDateTime(value) { if (!value) return '—'; return new Date(value).toLocaleString('pt-BR'); }
function humanError(message='') {
  const m = String(message || '');
  if (m.includes('not_authorized')) return 'Ação não autorizada para esta conta.';
  if (m.includes('payment_not_confirmed')) return 'Confirme o pagamento antes de publicar.';
  if (m.includes('logo_required')) return 'A empresa ainda não enviou o perfil/logo.';
  if (m.includes('cover_required')) return 'A empresa ainda não enviou a foto de capa.';
  if (m.includes('already_published')) return 'Esta solicitação já foi publicada.';
  if (m.includes('request_closed')) return 'Esta solicitação já está encerrada.';
  if (m.includes('no_hype_capacity')) return 'Não há vaga disponível nos próximos 60 dias.';
  if (m.includes('hype_day_not_finished')) return 'O dia ainda não terminou. Para hoje, consolide após 22h.';
  if (m.includes('refund_not_pending')) return 'Este pedido não possui reembolso pendente.';
  if (m.includes('reason_required')) return 'Informe um motivo com pelo menos 4 caracteres.';
  if (m.includes('payment_not_informed')) return 'O membro ainda não informou o pagamento desta Impulsão.';
  return 'A operação não foi concluída. Nenhuma alteração parcial foi mantida.';
}

const overlay = { position:'fixed',inset:0,zIndex:15000,background:'rgba(4,15,34,.66)',display:'grid',placeItems:'center',padding:16 };
const modal = { width:'min(850px,100%)',maxHeight:'92vh',overflow:'auto',background:'#f5f8fc',borderRadius:24,padding:18,boxShadow:'0 30px 90px rgba(0,0,0,.32)' };
const modalHead = { display:'flex',justifyContent:'space-between',gap:12,marginBottom:16 };
const detailGrid = { display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:12 };
