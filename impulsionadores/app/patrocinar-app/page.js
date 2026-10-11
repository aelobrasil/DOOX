'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_BANK, PIX_CITY, PIX_RECEIVER, brl } from '../../lib/config';
import { pixPayload } from '../../lib/pix';

const PLANS = {
  7: { days: 7, price: 49.90, label: '7 dias', helper: 'Ideal para testar a presença da marca.' },
  30: { days: 30, price: 189.90, label: '30 dias', helper: 'Melhor valor · cerca de 11% de economia.', badge: 'MELHOR VALOR' },
};

const BOARDS = {
  1: 'Home',
  2: 'Hype ao vivo',
  3: 'Explorar / Benefícios',
  4: 'Parceiros',
};

const DESTINOS = ['whatsapp', 'instagram', 'facebook', 'youtube', 'tiktok', 'site'];
const WAITING_PAYMENT = new Set(['SOLICITADO', 'AGUARDANDO PAGAMENTO']);

export default function PatrocinarApp() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [planDays, setPlanDays] = useState(7);
  const [logo, setLogo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentRow, setPaymentRow] = useState(null);

  const plan = PLANS[planDays];
  const activeRows = useMemo(
    () => rows.filter((r) => r.status === 'ATIVO' && r.fim_at && new Date(r.fim_at) > new Date()),
    [rows],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.replace('/');
      else {
        setUser(data.user);
        load(data.user.id);
      }
    });
  }, []);

  async function load(uid = user?.id) {
    if (!uid) return;
    const [{ data: sponsorRows }, { data: slots }] = await Promise.all([
      supabase.from('hocco_patrocinios').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.rpc('marcas_permanentes_disponibilidade'),
    ]);
    setRows(sponsorRows || []);
    setAvailability(slots || []);
  }

  function boardInfo(number) {
    return availability.find((x) => Number(x.quadro) === Number(number)) || { ocupadas: 0, livres: 4, fila: 0 };
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      return setMsg('Use PNG, JPG ou WEBP de até 4 MB.');
    }
    setBusy(true);
    setMsg('Enviando logo...');
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
    const path = `${user.id}/sponsors/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, file, { contentType: file.type });
    if (error) {
      setMsg('Não foi possível enviar o logo.');
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
    setLogo(data.publicUrl);
    setMsg('Logo recebido.');
    setBusy(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (!logo) return setMsg('Envie o logo da empresa.');
    const form = new FormData(event.currentTarget);
    const url = String(form.get('destino_url') || '').trim();
    if (!/^https:\/\//i.test(url)) return setMsg('Informe o link completo começando por https://');

    setBusy(true);
    const payload = {
      user_id: user.id,
      nome_fantasia: String(form.get('nome_fantasia') || '').trim(),
      logo_url: logo,
      destino_tipo: String(form.get('destino_tipo')),
      destino_url: url,
      quadro: Number(form.get('quadro')),
      plano_dias: plan.days,
      valor: plan.price,
      status: 'SOLICITADO',
    };
    const { data, error } = await supabase.from('hocco_patrocinios').insert(payload).select().single();
    setBusy(false);
    if (error) return setMsg('Não foi possível criar o patrocínio. Revise os dados e tente novamente.');

    setPaymentRow(data);
    setLogo('');
    event.currentTarget.reset();
    setMsg('Solicitação criada. O período começa somente depois da confirmação do pagamento e aprovação da HOCCO.');
    await load();
  }

  async function paid(id) {
    const { error } = await supabase.rpc('informar_pagamento_patrocinio', { p_id: id });
    setMsg(error ? 'Não foi possível informar o pagamento.' : 'Pagamento informado. A HOCCO fará a conferência antes da ativação.');
    if (!error) setPaymentRow(null);
    await load();
  }

  async function renew(row, days) {
    setBusy(true);
    const { data, error } = await supabase.rpc('renovar_patrocinio', { p_id: row.id, p_plano_dias: days });
    setBusy(false);
    if (error) return setMsg('Não foi possível abrir a renovação agora.');
    setPaymentRow(data);
    setMsg(`Renovação de ${days} dias criada. Faça o novo pagamento para seguir para análise.`);
    await load();
  }

  function openPayment(row) {
    setPaymentRow(row);
    setMsg('Confira o valor e a referência antes de pagar.');
  }

  async function copyPix(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Código PIX copiado.');
    } catch {
      setMsg('Não foi possível copiar automaticamente. Selecione o código PIX abaixo.');
    }
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <button style={S.icon} onClick={() => (location.href = '/empresa')} aria-label="Voltar"><ArrowLeft /></button>
        <b>HYPE</b>
        <span style={S.pill}>MARCAS PERMANENTES</span>
      </header>

      <section style={S.shell}>
        <div>
          <small>PATROCÍNIO DO APP</small>
          <h1 style={S.h1}>{activeRows.length ? 'Meu patrocínio' : 'Patrocinar o app'}</h1>
          <p style={S.p}>Escolha 7 ou 30 dias de presença institucional. São 4 quadros com 4 marcas cada. O logo leva diretamente ao canal escolhido pela empresa e nunca altera votos, ranking, HC, missões ou o resultado do Hype.</p>
        </div>

        {activeRows.map((active) => (
          <article style={S.active} key={active.id}>
            <div style={{ flex: 1 }}>
              <small>ATIVO ATÉ {new Date(active.fim_at).toLocaleString('pt-BR')}</small>
              <h2 style={{ margin: '6px 0' }}>{active.nome_fantasia}</h2>
              <p style={{ margin: 0, opacity: 0.8 }}>Quadro {active.quadro} · plano {active.plano_dias || 7} dias · posição rotativa · {active.impressoes} impressões · {active.cliques} cliques · CTR {active.impressoes ? ((active.cliques / active.impressoes) * 100).toFixed(2) : '0.00'}%</p>
            </div>
            <div style={S.activeActions}>
              <button style={S.secondary} disabled={busy} onClick={() => renew(active, 7)}><RefreshCw size={16} /> Renovar 7 dias</button>
              <button style={S.secondary} disabled={busy} onClick={() => renew(active, 30)}><RefreshCw size={16} /> Renovar 30 dias</button>
            </div>
          </article>
        ))}

        <div style={S.planGrid}>
          {Object.values(PLANS).map((item) => (
            <button type="button" key={item.days} onClick={() => setPlanDays(item.days)} style={{ ...S.planCard, ...(planDays === item.days ? S.planCardActive : {}) }}>
              <span style={S.planTop}>{item.days === 7 ? 'MARCA 7' : 'MARCA 30'} {item.badge && <em style={S.badge}>{item.badge}</em>}</span>
              <strong style={S.planPrice}>{brl(item.price)}</strong>
              <span>{item.label}</span>
              <small style={S.planHelp}>{item.helper}</small>
            </button>
          ))}
        </div>

        <div style={S.rules}>
          <b>{brl(plan.price)} · {plan.label}</b>
          <span>16 vagas totais</span>
          <span>Somente logo + link direto</span>
          <span>Posições rotativas</span>
        </div>

        <form onSubmit={submit} style={S.form}>
          <div>
            <b>1 · Escolha o quadro</b>
            <div style={S.boardGrid}>
              {Object.entries(BOARDS).map(([number, name]) => {
                const info = boardInfo(number);
                return (
                  <label style={S.boardChoice} key={number}>
                    <input type="radio" name="quadro" value={number} defaultChecked={number === '1'} />
                    <span><b>Quadro {number} · {name}</b><small>{info.livres} de 4 vagas livres{Number(info.fila) ? ` · ${info.fila} na fila` : ''}</small></span>
                  </label>
                );
              })}
            </div>
            <p style={S.help}>Se o quadro estiver cheio, uma solicitação paga e aprovada entra na fila e é ativada automaticamente quando uma vaga for liberada. O prazo contratado só começa quando a marca fica ativa.</p>
          </div>

          <label>Nome fantasia<input name="nome_fantasia" minLength="2" maxLength="100" required /></label>
          <label>Destino<select name="destino_tipo">{DESTINOS.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>Link do perfil ou site<input name="destino_url" type="url" placeholder="https://..." required /></label>

          <label style={S.upload}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
            {logo ? <img src={logo} alt="Logo selecionado" style={{ maxWidth: 140, maxHeight: 78, objectFit: 'contain' }} /> : <><ImageIcon /><b>ENVIAR LOGO</b><span>PNG, JPG ou WEBP · até 4 MB</span></>}
          </label>

          <label style={S.check}><input type="checkbox" required /> Entendo que este produto compra exposição institucional, não garante cliques ou vendas e não influencia a competição do Hype.</label>
          <button style={S.primary} disabled={busy}>{busy ? 'PROCESSANDO...' : `SOLICITAR · ${brl(plan.price)} / ${plan.label.toUpperCase()}`}</button>
        </form>

        {paymentRow && <PaymentCard row={paymentRow} onCopy={copyPix} onPaid={paid} />}
        {msg && <div style={S.msg}>{msg}</div>}

        {!!rows.length && (
          <section style={{ marginTop: 26 }}>
            <h2>Meus patrocínios</h2>
            <div style={S.history}>
              {rows.map((row) => (
                <article key={row.id} style={S.row}>
                  <img src={row.logo_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                  <div style={{ flex: 1, minWidth: 190 }}>
                    <b>{row.nome_fantasia}</b>
                    <small style={{ display: 'block', color: '#718198' }}>{row.payment_reference} · {row.status} · Quadro {row.quadro} · {row.plano_dias || 7} dias</small>
                    {row.status === 'PROGRAMADO' && <small style={{ display: 'block', color: '#075eea', fontWeight: 800 }}>Na fila do quadro. O prazo ainda não começou.</small>}
                    {row.fim_at && <small style={{ display: 'block' }}>Vigência até {new Date(row.fim_at).toLocaleString('pt-BR')}</small>}
                  </div>
                  <strong>{brl(row.valor)}</strong>
                  {WAITING_PAYMENT.has(row.status) && <button style={S.secondary} onClick={() => openPayment(row)}>VER PIX</button>}
                  {row.status === 'ENCERRADO' && <><button style={S.secondary} disabled={busy} onClick={() => renew(row, 7)}>RENOVAR 7</button><button style={S.secondary} disabled={busy} onClick={() => renew(row, 30)}>RENOVAR 30</button></>}
                </article>
              ))}
            </div>
          </section>
        )}

        <a href="/empresa" style={S.back}><ExternalLink size={16} /> Voltar à área empresarial</a>
      </section>
    </main>
  );
}

function PaymentCard({ row, onCopy, onPaid }) {
  const payload = pixPayload(row.valor, row.payment_reference);
  return (
    <section style={S.payment}>
      <div>
        <small>PAGAMENTO DO PATROCÍNIO</small>
        <h2 style={{ margin: '5px 0' }}>{brl(row.valor)} · {row.plano_dias || 7} dias</h2>
        <p style={S.paymentText}>Recebedor: {PIX_RECEIVER}<br />Instituição: {PIX_BANK}<br />Cidade: {PIX_CITY}<br />Referência: <b>{row.payment_reference}</b></p>
        <p style={S.paymentText}>O pagamento não inicia o prazo automaticamente. A HOCCO confirma o recebimento e aprova a marca; se o quadro estiver cheio, ela entra na fila.</p>
      </div>
      <div style={S.qr}><QRCodeSVG value={payload} size={156} /><small>PIX copia e cola</small></div>
      <textarea readOnly value={payload} style={S.pixCode} aria-label="PIX copia e cola" />
      <div style={S.paymentActions}>
        <button type="button" style={S.secondary} onClick={() => onCopy(payload)}><Copy size={16} /> COPIAR PIX</button>
        {WAITING_PAYMENT.has(row.status) && <button type="button" style={S.primarySmall} onClick={() => onPaid(row.id)}><CheckCircle2 size={16} /> JÁ FIZ O PIX</button>}
      </div>
    </section>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#f5f8fc', color: '#10213b', fontFamily: 'system-ui' },
  header: { height: 68, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', background: '#fff', borderBottom: '1px solid #e4eaf2' },
  icon: { border: 0, background: 'transparent', cursor: 'pointer' },
  pill: { marginLeft: 'auto', fontSize: 11, fontWeight: 900, color: '#075eea' },
  shell: { width: 'min(800px,calc(100% - 28px))', margin: '0 auto', padding: '32px 0 60px' },
  h1: { fontSize: 'clamp(30px,7vw,48px)', margin: '5px 0' },
  p: { color: '#63738a', lineHeight: 1.6 },
  active: { background: '#071c3d', color: '#fff', borderRadius: 22, padding: 20, display: 'flex', gap: 15, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  activeActions: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, margin: '22px 0 12px' },
  planCard: { textAlign: 'left', border: '1px solid #dce5ef', borderRadius: 20, background: '#fff', padding: 18, color: '#10213b', display: 'grid', gap: 4, cursor: 'pointer' },
  planCardActive: { border: '2px solid #075eea', boxShadow: '0 10px 28px rgba(7,94,234,.10)' },
  planTop: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 12 },
  badge: { fontStyle: 'normal', background: '#eaf2ff', color: '#075eea', padding: '4px 7px', borderRadius: 999, fontSize: 9 },
  planPrice: { fontSize: 30, letterSpacing: '-.03em' },
  planHelp: { color: '#718198' },
  rules: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, margin: '12px 0 18px', padding: 16, background: '#fff', borderRadius: 18, border: '1px solid #e1e8f0' },
  form: { display: 'grid', gap: 14, background: '#fff', padding: 20, borderRadius: 22, border: '1px solid #e1e8f0' },
  boardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 9, marginTop: 10 },
  boardChoice: { display: 'flex', gap: 9, alignItems: 'flex-start', padding: 12, border: '1px solid #dde5ee', borderRadius: 14, cursor: 'pointer' },
  help: { fontSize: 12, lineHeight: 1.5, color: '#718198', marginBottom: 0 },
  upload: { minHeight: 120, border: '1px dashed #9aabc0', borderRadius: 16, display: 'grid', placeItems: 'center', gap: 5, cursor: 'pointer', padding: 12 },
  check: { fontSize: 12, color: '#53657d', lineHeight: 1.5 },
  primary: { border: 0, borderRadius: 14, padding: 16, background: '#075eea', color: '#fff', fontWeight: 900, cursor: 'pointer' },
  primarySmall: { border: 0, borderRadius: 12, padding: '11px 13px', background: '#075eea', color: '#fff', fontWeight: 900, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' },
  secondary: { border: '1px solid #d5deea', borderRadius: 12, padding: '10px 12px', background: '#fff', color: '#10213b', fontWeight: 800, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' },
  payment: { marginTop: 18, background: '#fff', border: '1px solid #dbe5f0', borderRadius: 22, padding: 20, display: 'grid', gap: 12 },
  paymentText: { color: '#63738a', lineHeight: 1.55, margin: '8px 0' },
  qr: { display: 'grid', justifyItems: 'center', gap: 6, padding: 12, background: '#f7f9fc', borderRadius: 16, width: 'fit-content' },
  pixCode: { width: '100%', minHeight: 92, border: '1px solid #dce5ef', borderRadius: 12, padding: 10, resize: 'vertical', fontSize: 11 },
  paymentActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  msg: { margin: '14px 0', padding: 13, background: '#eef5ff', borderRadius: 13 },
  history: { background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #e1e8f0' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderBottom: '1px solid #e6ebf2', flexWrap: 'wrap' },
  back: { marginTop: 20, display: 'inline-flex', gap: 7, color: '#075eea', fontWeight: 800, textDecoration: 'none', alignItems: 'center' },
};
