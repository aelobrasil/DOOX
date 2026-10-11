'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CLOSED = new Set(['RECUSADO', 'ENCERRADO', 'CANCELADO', 'REEMBOLSO']);

export default function ControlSponsors() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const nav = document.querySelector('.controlSide nav');
    if (!nav || document.getElementById('sponsors-control-entry')) return;
    const button = document.createElement('button');
    button.id = 'sponsors-control-entry';
    button.innerHTML = '<span style="font-size:18px">◆</span><span>Patrocinadores</span>';
    button.onclick = () => setOpen(true);
    nav.appendChild(button);
    return () => button.remove();
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    const { data, error } = await supabase.from('hocco_patrocinios').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) setMsg(error.message);
    else setRows(data || []);
  }

  function humanError(error) {
    const text = String(error?.message || error || '');
    if (text.includes('payment_not_confirmed')) return 'Confirme o pagamento antes de aprovar.';
    if (text.includes('board_full')) return 'Este quadro já possui 4 marcas ativas. A solicitação deve permanecer programada na fila.';
    if (text.includes('not_authorized')) return 'Sessão sem permissão de administrador.';
    if (text.includes('invalid_board')) return 'Quadro inválido.';
    return text || 'Não foi possível concluir a operação.';
  }

  async function confirmPayment(row) {
    if (!confirm(`Confirmar recebimento de ${money(row.valor)} para ${row.nome_fantasia}?`)) return;
    setBusy(row.id);
    const { error } = await supabase.rpc('admin_confirmar_pagamento_patrocinio', { p_id: row.id });
    setBusy(null);
    setMsg(error ? humanError(error) : 'Pagamento confirmado. A solicitação está pronta para revisão e aprovação.');
    await load();
  }

  async function act(row, status) {
    let board = Number(row.quadro || 1);
    if (status === 'APROVADO') {
      const raw = prompt('Quadro (1 a 4):', String(board));
      if (!raw) return;
      board = Number(raw);
    }
    const defaultReason = status === 'APROVADO' ? 'Marca e destino revisados pela HOCCO.' : 'Operação HOCCO Control';
    const reason = prompt('Observação/motivo:', defaultReason);
    if (reason === null) return;

    setBusy(row.id);
    const { data, error } = await supabase.rpc('admin_set_patrocinio', {
      p_id: row.id,
      p_status: status,
      p_quadro: board,
      p_posicao: null,
      p_reason: reason || defaultReason,
    });
    setBusy(null);
    if (error) setMsg(humanError(error));
    else if (status === 'APROVADO') setMsg(data?.status === 'PROGRAMADO' ? 'Aprovado e colocado na fila do quadro.' : 'Aprovado e ativado. O período contratado começou agora.');
    else setMsg(`Patrocínio atualizado para ${data?.status || status}.`);
    await load();
  }

  const now = new Date();
  const active = rows.filter((r) => r.status === 'ATIVO' && r.fim_at && new Date(r.fim_at) > now);
  const queued = rows.filter((r) => r.status === 'PROGRAMADO');
  const waitingReview = rows.filter((r) => ['SOLICITADO', 'AGUARDANDO PAGAMENTO', 'EM ANÁLISE', 'APROVADO'].includes(r.status));
  const activeValue = active.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressoes || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.cliques || 0), 0);

  if (!open) return null;

  return (
    <div style={S.overlay}>
      <section style={S.panel}>
        <header style={S.head}>
          <div>
            <small>HOCCO CONTROL</small>
            <h1 style={{ margin: '3px 0' }}>Marcas Permanentes</h1>
            <p style={S.muted}>16 vagas · 4 quadros · 4 marcas por quadro · R$ 49,90 / 7 dias · R$ 189,90 / 30 dias</p>
          </div>
          <button style={S.close} onClick={() => setOpen(false)} aria-label="Fechar"><X /></button>
        </header>

        <div style={S.stats}>
          <Stat title="Ocupadas" value={`${active.length}/16`} />
          <Stat title="Livres" value={16 - active.length} />
          <Stat title="Na fila" value={queued.length} />
          <Stat title="Em revisão" value={waitingReview.length} />
          <Stat title="Contratos ativos" value={money(activeValue)} />
          <Stat title="CTR acumulado" value={`${impressions ? ((clicks / impressions) * 100).toFixed(2) : '0.00'}%`} />
        </div>

        {msg && <div style={S.msg}>{msg}</div>}
        <button style={S.refresh} onClick={load}><RefreshCw size={16} /> Atualizar</button>

        <div style={S.boards}>
          {[1, 2, 3, 4].map((board) => {
            const boardActive = active.filter((r) => Number(r.quadro) === board);
            const boardQueue = queued.filter((r) => Number(r.quadro) === board).sort((a, b) => Number(a.fila_ordem) - Number(b.fila_ordem));
            return (
              <article style={S.board} key={board}>
                <h3 style={S.boardTitle}>Quadro {board} <span>{boardActive.length}/4</span></h3>
                <small style={S.muted}>{boardName(board)}</small>
                <div style={{ marginTop: 10 }}>
                  {boardActive.map((row) => <SponsorRow row={row} key={row.id} busy={busy} onAct={act} compact />)}
                  {!boardActive.length && <p style={S.muted}>Nenhuma marca ativa.</p>}
                </div>
                {!!boardQueue.length && <div style={S.queue}><b>FILA · {boardQueue.length}</b>{boardQueue.map((row, index) => <div key={row.id} style={S.queueRow}><span>{index + 1}. {row.nome_fantasia}</span><small>{row.plano_dias || 7} dias · {money(row.valor)}</small></div>)}</div>}
              </article>
            );
          })}
        </div>

        <h2 style={{ marginTop: 28 }}>Solicitações e histórico</h2>
        <div style={S.list}>
          {!rows.length && <p style={{ ...S.muted, padding: 16 }}>Nenhuma solicitação de patrocínio.</p>}
          {rows.map((row) => <SponsorRow row={row} key={row.id} busy={busy} onPayment={confirmPayment} onAct={act} />)}
        </div>
      </section>
    </div>
  );
}

function SponsorRow({ row, busy, onPayment, onAct, compact = false }) {
  const isBusy = busy === row.id;
  const paid = row.payment_status === 'confirmado';
  const canConfirm = !paid && !CLOSED.has(row.status);
  const canApprove = paid && ['EM ANÁLISE', 'SOLICITADO', 'AGUARDANDO PAGAMENTO', 'APROVADO'].includes(row.status);
  const canReject = !CLOSED.has(row.status) && row.status !== 'ATIVO';

  return (
    <div style={S.row}>
      <img src={row.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', background: '#f7f9fc', borderRadius: 10, padding: 4 }} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <b>{row.nome_fantasia}</b>
        <small style={{ display: 'block', color: '#718198' }}>{row.payment_reference} · {row.status} · Quadro {row.quadro}</small>
        <small style={{ display: 'block' }}>{row.plano_dias || 7} dias · {money(row.valor)} · pagamento: <b>{row.payment_status}</b></small>
        {row.fim_at && <small style={{ display: 'block' }}>Até {new Date(row.fim_at).toLocaleString('pt-BR')}</small>}
        {!compact && <small style={{ display: 'block' }}>{row.impressoes} impressões · {row.cliques} cliques · {row.impressoes ? ((row.cliques / row.impressoes) * 100).toFixed(2) : '0.00'}% CTR</small>}
      </div>
      {!compact && <div style={S.actions}>
        {canConfirm && <button disabled={isBusy} style={S.money} onClick={() => onPayment(row)}><CheckCircle2 size={14} /> CONFIRMAR PAGAMENTO</button>}
        {canApprove && <button disabled={isBusy} style={S.action} onClick={() => onAct(row, 'APROVADO')}>APROVAR</button>}
        {row.status === 'ATIVO' && <button disabled={isBusy} style={S.neutral} onClick={() => onAct(row, 'ENCERRADO')}>ENCERRAR</button>}
        {row.status === 'PROGRAMADO' && <button disabled={isBusy} style={S.neutral} onClick={() => onAct(row, 'CANCELADO')}>CANCELAR FILA</button>}
        {canReject && <button disabled={isBusy} style={S.danger} onClick={() => onAct(row, 'RECUSADO')}>RECUSAR</button>}
      </div>}
    </div>
  );
}

function Stat({ title, value }) {
  return <div style={S.stat}><small>{title}</small><b>{value}</b></div>;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function boardName(number) {
  return ({ 1: 'Home', 2: 'Hype ao vivo', 3: 'Explorar / Benefícios', 4: 'Parceiros' })[number] || '';
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 30000, background: 'rgba(4,15,34,.7)', padding: 14, overflow: 'auto' },
  panel: { width: 'min(1160px,100%)', margin: '20px auto', background: '#f5f8fc', borderRadius: 24, padding: 20, color: '#10213b' },
  head: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  close: { border: 0, background: '#fff', borderRadius: 12, width: 44, height: 44, cursor: 'pointer' },
  muted: { color: '#718198' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, margin: '16px 0' },
  stat: { background: '#fff', padding: 15, borderRadius: 16, border: '1px solid #e1e8f0', display: 'grid', gap: 5 },
  boards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 10 },
  board: { background: '#fff', padding: 14, borderRadius: 18, border: '1px solid #e1e8f0' },
  boardTitle: { display: 'flex', justifyContent: 'space-between', margin: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #e6ebf2', flexWrap: 'wrap' },
  list: { background: '#fff', padding: '0 14px', borderRadius: 18, border: '1px solid #e1e8f0' },
  actions: { display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' },
  action: { border: 0, borderRadius: 9, padding: '8px 9px', background: '#075eea', color: '#fff', fontWeight: 800, fontSize: 10, cursor: 'pointer' },
  money: { border: 0, borderRadius: 9, padding: '8px 9px', background: '#e7f7ee', color: '#14753d', fontWeight: 800, fontSize: 10, display: 'inline-flex', gap: 5, alignItems: 'center', cursor: 'pointer' },
  neutral: { border: '1px solid #d5deea', borderRadius: 9, padding: '8px 9px', background: '#fff', color: '#31445f', fontWeight: 800, fontSize: 10, cursor: 'pointer' },
  danger: { border: 0, borderRadius: 9, padding: '8px 9px', background: '#feecef', color: '#b42336', fontWeight: 800, fontSize: 10, cursor: 'pointer' },
  refresh: { border: 0, background: '#fff', padding: 10, borderRadius: 10, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, cursor: 'pointer' },
  msg: { padding: 10, background: '#eef5ff', borderRadius: 10, marginBottom: 10 },
  queue: { marginTop: 10, padding: 10, borderRadius: 12, background: '#f5f8fc', display: 'grid', gap: 6 },
  queueRow: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 },
};
