'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Award, Banknote, Bell, Building2, CalendarDays, CheckCircle2, CircleDollarSign,
  ExternalLink, Gift, LayoutDashboard, LogOut, MousePointerClick, PauseCircle,
  PlayCircle, RefreshCw, Search, ShieldCheck, Tag, Users, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { brl, todayBR } from '../../lib/config';
import './control-v3.css';

const CLOSED_REQ = new Set(['aprovado','ativo','encerrado','recusado','cancelado','reembolsado']);

export default function ControlDashboardV3() {
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [offers, setOffers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [drops, setDrops] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return location.replace('/');
      if (!alive) return;
      setUser(data.user);
      const { data: admin } = await supabase.from('hocco_admins').select('user_id,role').eq('user_id', data.user.id).maybeSingle();
      if (!admin) { setLoading(false); return; }
      setAllowed(true);
      await loadAll();
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const channel = supabase.channel('control-v3-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_ofertas' }, debounceLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_oferta_solicitacoes' }, debounceLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hocco_patrocinios' }, debounceLoad)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allowed]);

  let loadTimer;
  function debounceLoad() {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => loadAll(), 450);
  }

  async function loadAll() {
    const [o, r, s, p, c, d, f] = await Promise.all([
      supabase.from('hocco_ofertas').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('hocco_oferta_solicitacoes').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('hocco_patrocinios').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('impulsionadores_perfis').select('user_id,nome_publico,username,hc,xp,nivel,ofensiva_dias,total_dias_ativos,governance_status,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(700),
      supabase.from('impulsionadores_contatos').select('user_id,email,telefone').limit(700),
      supabase.from('hocco_drops').select('id,titulo,status,slots,ends_at,created_at').order('created_at', { ascending: false }).limit(80),
      supabase.from('hype_financeiro_ledger').select('*').order('created_at', { ascending: false }).limit(400),
    ]);
    setOffers(o.data || []);
    setRequests(r.data || []);
    setSponsors(s.data || []);
    setProfiles(p.data || []);
    setContacts(c.data || []);
    setDrops(d.data || []);
    setLedger(f.data || []);
    const error = [o,r,s,p,c,d,f].find((x) => x.error)?.error;
    if (error) flash(`Falha parcial ao atualizar: ${error.message}`);
  }

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 5000);
  }

  async function rpc(name, args, ok) {
    setBusy(args?.p_id || name);
    const { data, error } = await supabase.rpc(name, args);
    setBusy(null);
    if (error) { flash(humanError(error.message)); return null; }
    flash(ok || 'Operação concluída.');
    await loadAll();
    return data;
  }

  async function confirmOfferPayment(row) {
    if (!confirm(`Confirmar que o PIX de ${brl(row.valor)} de ${row.nome_fantasia} foi recebido?`)) return;
    await rpc('admin_confirmar_pagamento_oferta', { p_id: row.id }, 'Pagamento confirmado. A oferta já pode ser aprovada.');
  }

  async function approveOffer(row) {
    if (row.payment_status !== 'confirmado') return flash('Confirme o pagamento antes de aprovar.');
    const date = prompt('Data de exibição (AAAA-MM-DD):', row.display_date || todayBR());
    if (!date) return;
    const reason = prompt('Observação da aprovação:', 'Oferta e materiais revisados pela HOCCO.');
    if (reason === null) return;
    await rpc('admin_aprovar_oferta', { p_id: row.id, p_display_date: date, p_reason: reason || 'Aprovada pela HOCCO' }, 'Oferta aprovada e programada.');
  }

  async function rejectOffer(row) {
    const reason = prompt('Motivo da recusa:');
    if (!reason || reason.trim().length < 4) return;
    await rpc('admin_recusar_oferta', { p_id: row.id, p_reason: reason.trim() }, row.payment_status === 'confirmado' ? 'Oferta recusada; reembolso ficou pendente.' : 'Oferta recusada.');
  }

  async function setOfferStatus(row, status) {
    const labels = { active:'reativar', paused:'pausar', ended:'encerrar', cancelled:'cancelar' };
    const reason = prompt(`Motivo para ${labels[status] || status} esta oferta:`, 'Operação HOCCO Control');
    if (reason === null) return;
    await rpc('admin_set_oferta_status', { p_id: row.id, p_status: status, p_reason: reason || 'Operação HOCCO Control' }, 'Status da oferta atualizado.');
  }

  function openSponsors() {
    const button = document.querySelector('button[aria-label="Abrir patrocinadores"]') || document.getElementById('sponsors-control-entry');
    button?.click();
  }
  function openDrops() { document.getElementById('drops-control-entry')?.click(); }

  async function logout() { await supabase.auth.signOut(); location.replace('/'); }

  const date = todayBR();
  const activeOffers = offers.filter((o) => o.status === 'active' && o.display_date === date);
  const activeSponsors = sponsors.filter((s) => s.status === 'ATIVO' && s.fim_at && new Date(s.fim_at) > new Date());
  const clicksToday = activeOffers.reduce((sum, o) => sum + Number(o.cliques || 0), 0);
  const revenueToday = requests.filter((r) => sameBRDay(r.pagamento_confirmado_at, date)).reduce((sum, r) => sum + Number(r.valor_recebido || r.valor || 0), 0)
    + sponsors.filter((s) => sameBRDay(s.pagamento_confirmado_at, date)).reduce((sum, s) => sum + Number(s.valor || 0), 0);
  const pendingRequests = requests.filter((r) => !CLOSED_REQ.has(r.status));
  const memberRows = useMemo(() => profiles.map((p) => ({ ...p, contact: contacts.find((c) => c.user_id === p.user_id) })).filter((p) => `${p.nome_publico} ${p.username || ''} ${p.contact?.email || ''} ${p.contact?.telefone || ''}`.toLowerCase().includes(search.toLowerCase())), [profiles, contacts, search]);
  const filteredOffers = useMemo(() => offers.filter((o) => `${o.nome_fantasia} ${o.titulo} ${o.oferta_texto} ${o.categoria || ''}`.toLowerCase().includes(search.toLowerCase())), [offers, search]);

  if (loading) return <div className="controlV3Gate"><ShieldCheck/><b>Validando HOCCO Control...</b></div>;
  if (!allowed) return <div className="controlV3Gate"><XCircle/><b>Acesso não autorizado.</b><button onClick={() => location.href='/app'}>Voltar ao app</button></div>;

  const nav = [
    ['overview', LayoutDashboard, 'Visão Geral'],
    ['offers', Tag, 'Ofertas', pendingRequests.length],
    ['sponsors', Building2, 'Patrocinadores'],
    ['drops', Gift, 'Drops'],
    ['members', Users, 'Membros'],
    ['payments', CircleDollarSign, 'Pagamentos'],
  ];

  return <main className="controlV3">
    <aside className="controlSide controlV3Side">
      <div className="controlV3Brand"><b>HOCCO</b><i>Control</i><span>ECOSSISTEMA HYPE</span></div>
      <nav>{nav.map(([key, Icon, label, count]) => <button key={key} className={tab===key?'active':''} onClick={() => { if (key==='sponsors') return openSponsors(); if (key==='drops') return openDrops(); setTab(key); }}><Icon/><span>{label}</span>{count ? <em>{count}</em> : null}</button>)}</nav>
      <div className="controlV3SideFoot"><small>HOCCO Control</small><span>Ofertas · comunidade · governança</span><button onClick={logout}><LogOut/> Sair</button></div>
    </aside>

    <section className="controlV3Main">
      <header className="controlV3Top"><label><Search/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no ecossistema..."/></label><div><button onClick={loadAll}><RefreshCw/></button><button><Bell/></button><span className="controlV3Admin">{user?.email?.[0]?.toUpperCase() || 'A'}</span></div></header>
      {notice && <div className="controlV3Notice">{notice}</div>}

      {tab === 'overview' && <>
        <div className="controlV3Head"><div><small>HOCCO CONTROL</small><h1>Visão Geral</h1><p>Acompanhe os principais indicadores do ecossistema HOCCO Hype.</p></div><span><CalendarDays/> Hoje · {formatDate(date)}</span></div>
        <div className="controlV3Kpis"><Kpi icon={Tag} label="Ofertas ativas" value={activeOffers.length} note={`${Math.max(0,50-activeOffers.length)} vagas disponíveis hoje`}/><Kpi icon={Building2} label="Patrocinadores" value={activeSponsors.length} note={`${Math.max(0,25-activeSponsors.length)} posições livres`}/><Kpi icon={MousePointerClick} label="Cliques hoje" value={clicksToday.toLocaleString('pt-BR')} note="Acessos diretos às empresas"/><Kpi icon={Banknote} label="Faturamento diário" value={brl(revenueToday)} note="Pagamentos confirmados hoje"/></div>
        <div className="controlV3OverviewGrid"><section className="controlV3Panel"><PanelTitle title="Ofertas do dia" action="Ver todas" onAction={() => setTab('offers')}/><OffersTable rows={activeOffers.slice(0,8)} onStatus={setOfferStatus}/></section><aside className="controlV3Right"><section className="controlV3Panel"><PanelTitle title="Patrocinadores / Marcas Permanentes" action="Ver todos" onAction={openSponsors}/><div className="controlV3MiniList">{sponsors.slice(0,6).map((s)=><button key={s.id} onClick={openSponsors}>{s.logo_url?<img src={s.logo_url} alt=""/>:<Building2/>}<span><b>{s.nome_fantasia}</b><small>Quadro {s.quadro} · {s.status}</small></span></button>)}{!sponsors.length&&<p>Nenhuma marca cadastrada.</p>}</div></section><section className="controlV3Panel"><PanelTitle title="Rodada de Drops" action="Abrir" onAction={openDrops}/><div className="controlV3DropList">{drops.slice(0,4).map((d)=><article key={d.id}><Gift/><div><b>{d.titulo}</b><small>{humanStatus(d.status)} · {d.slots} vaga{d.slots!==1?'s':''}</small></div></article>)}{!drops.length&&<p>Nenhum Drop criado.</p>}</div></section></aside></div>
      </>}

      {tab === 'offers' && <>
        <div className="controlV3Head"><div><small>PRODUTO COMERCIAL · R$ 39,90 / DIA</small><h1>Ofertas</h1><p>Até 50 empresas por dia. Pagamento, revisão, publicação e métricas no mesmo fluxo.</p></div><button className="controlV3Primary" onClick={() => window.open('/empresa','_blank')}><ExternalLink/> ABRIR CADASTRO EMPRESARIAL</button></div>
        <div className="controlV3Kpis"><Kpi icon={Tag} label="Ativas hoje" value={activeOffers.length} note={`${Math.max(0,50-activeOffers.length)} de 50 vagas livres`}/><Kpi icon={Award} label="Pendentes" value={pendingRequests.length} note="Aguardando operação"/><Kpi icon={MousePointerClick} label="Cliques" value={clicksToday.toLocaleString('pt-BR')} note="Nas ofertas de hoje"/><Kpi icon={Banknote} label="Receita hoje" value={brl(revenueToday)} note="Ofertas + patrocínios confirmados"/></div>
        <section className="controlV3Panel"><PanelTitle title="Fila de solicitações" action={`${pendingRequests.length} pendente${pendingRequests.length===1?'':'s'}`}/><div className="controlV3RequestList">{pendingRequests.map((r)=><article key={r.id}><div className="controlV3ReqLogo">{r.logo_url?<img src={r.logo_url} alt=""/>:<Building2/>}</div><div className="controlV3ReqMain"><b>{r.nome_fantasia}</b><span>{r.oferta_texto || r.titulo}</span><small>{r.payment_reference} · {humanStatus(r.status)} · pagamento {r.payment_status} · {r.display_date || 'sem data'}</small></div><strong>{brl(r.valor)}</strong><div className="controlV3ReqActions">{r.payment_status!=='confirmado'&&<button disabled={busy===r.id} onClick={()=>confirmOfferPayment(r)}><CheckCircle2/> CONFIRMAR PIX</button>}{r.payment_status==='confirmado'&&<button className="primary" disabled={busy===r.id} onClick={()=>approveOffer(r)}><PlayCircle/> APROVAR</button>}<button className="danger" disabled={busy===r.id} onClick={()=>rejectOffer(r)}>RECUSAR</button></div></article>)}{!pendingRequests.length&&<p className="controlV3Empty">Nenhuma solicitação pendente.</p>}</div></section>
        <section className="controlV3Panel"><PanelTitle title="Ofertas publicadas" action={`${offers.length} registro${offers.length===1?'':'s'}`}/><OffersTable rows={filteredOffers} onStatus={setOfferStatus}/></section>
      </>}

      {tab === 'members' && <>
        <div className="controlV3Head"><div><small>COMUNIDADE</small><h1>Membros</h1><p>Visão rápida de progressão. Governança e análise 360° continuam disponíveis nos módulos administrativos.</p></div></div>
        <div className="controlV3Kpis"><Kpi icon={Users} label="Membros" value={profiles.length} note="Perfis ativos no banco"/><Kpi icon={Award} label="500+ HC" value={profiles.filter((p)=>Number(p.hc)>=500).length} note="Elegíveis para ações empresariais quando HC for critério"/><Kpi icon={Gift} label="100+ HC" value={profiles.filter((p)=>Number(p.hc)>=100).length} note="Base de elegibilidade para Drops"/><Kpi icon={ShieldCheck} label="Suspensos" value={profiles.filter((p)=>p.governance_status==='suspended').length} note="Bloqueados pela governança"/></div>
        <section className="controlV3Panel"><div className="controlV3Members">{memberRows.map((p)=><article key={p.user_id}><span className="controlV3MemberAvatar">{p.nome_publico?.[0]||'H'}</span><div><b>{p.nome_publico}</b><small>{p.username?`@${p.username} · `:''}{p.contact?.email||'sem e-mail'} · {p.governance_status||'active'}</small></div><div className="controlV3MemberStats"><span><b>{p.hc||0}</b>HC</span><span><b>{p.xp||0}</b>XP</span><span><b>{p.ofensiva_dias||0}</b>dias</span></div></article>)}{!memberRows.length&&<p className="controlV3Empty">Nenhum membro encontrado.</p>}</div></section>
      </>}

      {tab === 'payments' && <>
        <div className="controlV3Head"><div><small>FINANCEIRO</small><h1>Pagamentos</h1><p>Ofertas, Marcas Permanentes e lançamentos financeiros consolidados.</p></div></div>
        <section className="controlV3Panel"><PanelTitle title="Ofertas comerciais"/><div className="controlV3PaymentList">{requests.slice(0,100).map((r)=><article key={r.id}><div><b>{r.nome_fantasia}</b><small>{r.payment_reference} · {r.payment_status} · {humanStatus(r.status)}</small></div><strong>{brl(r.valor_recebido||r.valor)}</strong></article>)}{!requests.length&&<p className="controlV3Empty">Sem pagamentos de ofertas.</p>}</div></section>
        <section className="controlV3Panel"><PanelTitle title="Ledger operacional"/><div className="controlV3PaymentList">{ledger.slice(0,100).map((r)=><article key={r.id}><div><b>{r.kind||r.type||r.reference_type||'Lançamento'}</b><small>{r.reference_code||r.reference_id||r.id} · {formatDateTime(r.created_at)}</small></div><strong>{brl(r.amount||r.valor||0)}</strong></article>)}{!ledger.length&&<p className="controlV3Empty">Sem lançamentos recentes.</p>}</div></section>
      </>}
    </section>
  </main>;
}

function Kpi({ icon: Icon, label, value, note }) { return <article><span><Icon/></span><small>{label}</small><b>{value}</b><em>{note}</em></article>; }
function PanelTitle({ title, action, onAction }) { return <header className="controlV3PanelHead"><h2>{title}</h2>{action&&<button onClick={onAction}>{action}{onAction&&<ExternalLink/>}</button>}</header>; }
function OffersTable({ rows, onStatus }) { return <div className="controlV3Table"><div className="head"><span>Empresa</span><span>Categoria</span><span>Oferta</span><span>Status</span><span>Cliques</span><span>Ação</span></div>{rows.map((o)=><div className="row" key={o.id}><span className="company">{o.logo_url?<img src={o.logo_url} alt=""/>:<Building2/>}<b>{o.nome_fantasia}</b></span><span>{o.categoria||o.segmento||'—'}</span><span>{o.oferta_texto||o.titulo}</span><span><i className={`status ${o.status}`}>{humanStatus(o.status)}</i></span><span>{Number(o.cliques||0).toLocaleString('pt-BR')}</span><span className="actions">{o.status==='active'?<button onClick={()=>onStatus(o,'paused')}><PauseCircle/> Pausar</button>:o.status==='paused'?<button onClick={()=>onStatus(o,'active')}><PlayCircle/> Ativar</button>:null}{!['ended','cancelled'].includes(o.status)&&<button onClick={()=>onStatus(o,'ended')}>Encerrar</button>}</span></div>)}{!rows.length&&<p className="controlV3Empty">Nenhuma oferta encontrada.</p>}</div>; }
function humanStatus(s){return ({active:'ATIVA',paused:'PAUSADA',ended:'ENCERRADA',cancelled:'CANCELADA',aguardando_pagamento:'AGUARDANDO PAGAMENTO',pagamento_informado:'PAGAMENTO INFORMADO',em_analise:'EM ANÁLISE',aprovado:'APROVADA',ativo:'ATIVA',encerrado:'ENCERRADA',recusado:'RECUSADA',cancelado:'CANCELADA',reembolso_pendente:'REEMBOLSO PENDENTE',reembolsado:'REEMBOLSADO',published:'ABERTO',eligibility_closed:'ELEGIBILIDADE FECHADA',drawn:'RODADA REALIZADA',completed:'ENCERRADO'})[s]||String(s||'').toUpperCase()}
function humanError(v=''){if(v.includes('offer_day_full'))return 'O dia escolhido já atingiu 50 ofertas.';if(v.includes('payment_not_confirmed'))return 'Confirme o pagamento antes de aprovar.';if(v.includes('invalid_display_date'))return 'Escolha uma data válida.';if(v.includes('not_authorized'))return 'Sem permissão administrativa.';return v||'Não foi possível concluir.'}
function sameBRDay(value,date){if(!value)return false;return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))===date}
function formatDate(v){if(!v)return '—';const [y,m,d]=String(v).slice(0,10).split('-');return `${d}/${m}/${y}`}
function formatDateTime(v){if(!v)return '—';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
