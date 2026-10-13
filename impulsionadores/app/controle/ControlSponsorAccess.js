'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, RefreshCw, ShieldCheck, X, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CLOSED = new Set(['RECUSADO','ENCERRADO','CANCELADO','REEMBOLSO']);

export default function ControlSponsorAccess() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('brands');
  const [placements, setPlacements] = useState([]);
  const [partners, setPartners] = useState([]);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      const { data: admin } = await supabase.from('hocco_admins').select('role').eq('user_id', data.user.id).maybeSingle();
      if (mounted) setAllowed(Boolean(admin));
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    setMessage('');
    const [brands, sponsorPartners] = await Promise.all([
      supabase.from('hocco_patrocinios').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('hocco_patrocinadores').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    setPlacements(brands.data || []);
    setPartners(sponsorPartners.data || []);
    if (brands.error || sponsorPartners.error) setMessage(brands.error?.message || sponsorPartners.error?.message || 'Falha ao carregar patrocinadores.');
  }

  async function confirmPayment(row) {
    if (!window.confirm(`Confirmar que o PIX de ${money(row.valor)} de ${row.nome_fantasia} foi realmente recebido?`)) return;
    setBusy(row.id);
    const { error } = await supabase.rpc('admin_confirmar_pagamento_patrocinio', { p_id: row.id });
    setBusy(null);
    setMessage(error ? human(error.message) : 'Pagamento confirmado. Agora revise e aprove a marca.');
    await load();
  }

  async function approve(row) {
    if (row.payment_status !== 'confirmado') return setMessage('Confirme o pagamento antes de aprovar esta marca.');
    const reason = window.prompt('Observação da aprovação:', 'Marca, logo e destino revisados pela HOCCO.');
    if (reason === null) return;
    setBusy(row.id);
    const { data, error } = await supabase.rpc('admin_set_patrocinio', {
      p_id: row.id,
      p_status: 'APROVADO',
      p_quadro: Number(row.quadro || 1),
      p_posicao: null,
      p_reason: reason || 'Aprovado pela HOCCO',
    });
    setBusy(null);
    setMessage(error ? human(error.message) : data?.status === 'ATIVO' ? 'Marca aprovada e ATIVA no Impulsionadores.' : `Marca aprovada: ${data?.status || 'atualizada'}.`);
    await load();
  }

  async function reject(row) {
    const reason = window.prompt('Motivo da recusa:');
    if (!reason?.trim()) return;
    setBusy(row.id);
    const { error } = await supabase.rpc('admin_set_patrocinio', {
      p_id: row.id,
      p_status: 'RECUSADO',
      p_quadro: Number(row.quadro || 1),
      p_posicao: null,
      p_reason: reason.trim(),
    });
    setBusy(null);
    setMessage(error ? human(error.message) : 'Marca recusada e registrada na auditoria.');
    await load();
  }

  const pending = useMemo(() => placements.filter((r) => !CLOSED.has(r.status) && r.status !== 'ATIVO').length, [placements]);
  const active = useMemo(() => placements.filter((r) => r.status === 'ATIVO' && r.fim_at && new Date(r.fim_at) > new Date()).length, [placements]);

  if (!allowed) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} style={S.launch} aria-label="Abrir patrocinadores">
      <Building2 size={17}/><span>PATROCINADORES</span>{pending > 0 && <b style={S.badge}>{pending}</b>}
    </button>
    {open && <div style={S.backdrop}>
      <section style={S.panel}>
        <header style={S.header}>
          <div><small style={S.kicker}>HOCCO CONTROL · COMERCIAL</small><h1 style={S.title}>Patrocinadores</h1><p style={S.subtitle}>Marcas Permanentes e parceiros de Drops/Experiências. Uma Marca Permanente só aparece no Impulsionadores depois de pagamento confirmado e aprovação administrativa.</p></div>
          <button type="button" style={S.close} onClick={() => setOpen(false)}><X/></button>
        </header>
        <div style={S.tabs}>
          <button type="button" style={tab === 'brands' ? S.tabOn : S.tab} onClick={() => setTab('brands')}>MARCAS PERMANENTES</button>
          <button type="button" style={tab === 'partners' ? S.tabOn : S.tab} onClick={() => setTab('partners')}>PARCERIAS / DROPS</button>
          <button type="button" style={S.refresh} onClick={load}><RefreshCw size={15}/> ATUALIZAR</button>
        </div>
        {message && <div style={S.message}>{message}</div>}

        {tab === 'brands' ? <>
          <div style={S.stats}>
            <Stat label="Solicitações" value={placements.length}/><Stat label="Pendentes" value={pending}/><Stat label="Ativas" value={active}/><Stat label="Vagas livres" value={Math.max(0, 16-active)}/>
          </div>
          <div style={S.list}>
            {placements.map((row) => <article key={row.id} style={S.row}>
              <div style={S.logoBox}>{row.logo_url ? <img src={row.logo_url} alt={row.nome_fantasia} style={S.logo}/> : <Building2/>}</div>
              <div style={S.main}>
                <div style={S.nameLine}><b>{row.nome_fantasia}</b><Status status={row.status}/></div>
                <small style={S.muted}>Quadro {row.quadro} · {row.plano_dias || 7} dias · {money(row.valor)}</small>
                <small style={S.muted}>Pagamento: <strong>{row.payment_status}</strong>{row.payment_reference ? ` · ${row.payment_reference}` : ''}</small>
                {row.status === 'ATIVO' && row.fim_at && <small style={S.activeLine}><Clock3 size={13}/> Ativa até {new Date(row.fim_at).toLocaleString('pt-BR')}</small>}
                {row.status === 'EM ANÁLISE' && row.payment_status === 'informado' && <small style={S.warning}>Cliente informou o PIX; falta conferência administrativa.</small>}
              </div>
              <div style={S.actions}>
                {row.payment_status !== 'confirmado' && !CLOSED.has(row.status) && <button type="button" disabled={busy === row.id} style={S.action} onClick={() => confirmPayment(row)}><CheckCircle2 size={14}/> CONFIRMAR PAGAMENTO</button>}
                {row.payment_status === 'confirmado' && ['EM ANÁLISE','SOLICITADO','AGUARDANDO PAGAMENTO','APROVADO'].includes(row.status) && <button type="button" disabled={busy === row.id} style={S.primary} onClick={() => approve(row)}><ShieldCheck size={14}/> APROVAR / ATIVAR</button>}
                {!CLOSED.has(row.status) && row.status !== 'ATIVO' && <button type="button" disabled={busy === row.id} style={S.danger} onClick={() => reject(row)}><XCircle size={14}/> RECUSAR</button>}
              </div>
            </article>)}
            {!placements.length && <p style={S.empty}>Nenhuma Marca Permanente cadastrada.</p>}
          </div>
        </> : <div style={S.list}>
          {partners.map((p) => <article key={p.id} style={S.row}><div style={S.logoBox}>{p.logo_url ? <img src={p.logo_url} alt={p.nome_fantasia} style={S.logo}/> : <Building2/>}</div><div style={S.main}><div style={S.nameLine}><b>{p.nome_fantasia}</b><Status status={p.status}/></div><small style={S.muted}>{p.segmento || 'Sem segmento'} · {p.partnership_type || 'parceria'}</small><small style={S.muted}>{p.consideration || 'Contrapartida ainda não registrada'}</small></div></article>)}
          {!partners.length && <p style={S.empty}>Nenhuma parceria de Drop/Experiência cadastrada.</p>}
        </div>}
      </section>
    </div>}
  </>;
}

function Stat({ label, value }) { return <div style={S.stat}><small>{label}</small><b>{value}</b></div>; }
function Status({ status }) { const ok = status === 'ATIVO'; return <span style={{...S.status, ...(ok ? S.statusOn : {})}}>{status}</span>; }
function money(v) { return Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function human(value='') { const s=String(value); if(s.includes('payment_not_confirmed')) return 'Pagamento ainda não foi confirmado.'; if(s.includes('board_full')) return 'O quadro está lotado; a marca deve permanecer programada/fila.'; if(s.includes('not_authorized')) return 'Esta conta não possui permissão administrativa.'; return s || 'Não foi possível concluir.'; }

const S={
  launch:{position:'fixed',right:16,bottom:18,zIndex:9200,border:'1px solid #d9e2ee',borderRadius:999,background:'#10213b',color:'#fff',padding:'11px 14px',fontWeight:900,fontSize:11,display:'flex',alignItems:'center',gap:8,boxShadow:'0 12px 34px rgba(16,33,59,.2)',cursor:'pointer'},
  badge:{minWidth:20,height:20,borderRadius:99,background:'#ff8a1f',display:'grid',placeItems:'center',fontSize:10},
  backdrop:{position:'fixed',inset:0,zIndex:32100,background:'rgba(6,17,32,.68)',backdropFilter:'blur(6px)',padding:12,overflow:'auto'},
  panel:{width:'min(1080px,100%)',margin:'0 auto',background:'#f6f8fb',borderRadius:24,padding:18,color:'#10213b',minHeight:'min(720px,calc(100dvh - 24px))'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,borderBottom:'1px solid #dfe6ef',paddingBottom:14},
  kicker:{fontSize:9,fontWeight:950,letterSpacing:'.13em',color:'#5f7188'},title:{fontSize:30,margin:'5px 0 4px'},subtitle:{margin:0,maxWidth:760,color:'#68788d',lineHeight:1.5},close:{border:0,background:'#fff',borderRadius:12,width:44,height:44,cursor:'pointer'},
  tabs:{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'},tab:{border:'1px solid #dce4ee',background:'#fff',borderRadius:10,padding:'9px 11px',fontWeight:900,color:'#53647a',cursor:'pointer'},tabOn:{border:'1px solid #075eea',background:'#075eea',color:'#fff',borderRadius:10,padding:'9px 11px',fontWeight:900,cursor:'pointer'},refresh:{marginLeft:'auto',border:'1px solid #dce4ee',background:'#fff',borderRadius:10,padding:'9px 11px',fontWeight:900,display:'flex',alignItems:'center',gap:6,cursor:'pointer'},
  message:{padding:'10px 12px',background:'#edf4ff',borderRadius:11,color:'#174b8b',fontSize:12,fontWeight:800,marginBottom:12},stats:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:12},stat:{background:'#fff',border:'1px solid #e0e7ef',borderRadius:14,padding:13,display:'grid',gap:4},
  list:{background:'#fff',border:'1px solid #e0e7ef',borderRadius:18,padding:'0 14px'},row:{display:'flex',alignItems:'center',gap:12,padding:'14px 0',borderBottom:'1px solid #edf1f5',flexWrap:'wrap'},logoBox:{width:54,height:54,borderRadius:13,background:'#f3f6fa',display:'grid',placeItems:'center',overflow:'hidden',flex:'0 0 auto'},logo:{width:'100%',height:'100%',objectFit:'contain'},main:{flex:1,minWidth:220,display:'grid',gap:4},nameLine:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'},muted:{color:'#6b7a8f'},warning:{color:'#9a5b00',fontWeight:800},activeLine:{color:'#087044',fontWeight:800,display:'flex',alignItems:'center',gap:5},status:{fontSize:9,fontWeight:950,padding:'4px 7px',borderRadius:99,background:'#edf1f6',color:'#526176'},statusOn:{background:'#e7f7ee',color:'#087044'},actions:{display:'flex',gap:7,flexWrap:'wrap'},action:{border:'1px solid #cdd9e8',background:'#fff',borderRadius:10,padding:'9px 10px',fontWeight:900,display:'flex',alignItems:'center',gap:5,cursor:'pointer'},primary:{border:0,background:'#075eea',color:'#fff',borderRadius:10,padding:'9px 10px',fontWeight:900,display:'flex',alignItems:'center',gap:5,cursor:'pointer'},danger:{border:'1px solid #ecc9c9',background:'#fff7f7',color:'#a12626',borderRadius:10,padding:'9px 10px',fontWeight:900,display:'flex',alignItems:'center',gap:5,cursor:'pointer'},empty:{padding:'24px 6px',color:'#708096'}
};
