'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, RefreshCw, Send, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AUDIENCES = [
  ['all', 'Todos que aceitaram notificações'],
  ['streak_risk', 'Ofensiva em risco'],
  ['inactive_today', 'Ainda não entraram hoje'],
  ['user', 'Um membro específico'],
];

export default function ControlPush() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: 'HOCCO · temos novidades para você',
    body: 'Entre no app para acompanhar os Hypes, HC e benefícios HOCCO.',
    url: '/app',
    audience: 'all',
    target_user_id: '',
    mode: 'now',
    scheduled_at: '',
  });

  useEffect(() => {
    const nav = document.querySelector('.controlSide nav');
    if (!nav || document.getElementById('push-control-entry')) return;
    const button = document.createElement('button');
    button.id = 'push-control-entry';
    button.innerHTML = '<span style="font-size:18px">🔔</span><span>Notificações</span>';
    button.onclick = () => setOpen(true);
    nav.appendChild(button);
    return () => button.remove();
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    setMessage('');
    const [statsRes, campaignsRes, membersRes] = await Promise.all([
      supabase.rpc('push_admin_stats'),
      supabase.from('hocco_push_campaigns').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('impulsionadores_perfis').select('user_id,nome_publico,username,deleted_at').is('deleted_at', null).order('nome_publico').limit(500),
    ]);
    if (statsRes.error) setMessage(statsRes.error.message);
    else setStats(statsRes.data || {});
    if (campaignsRes.error) setMessage(campaignsRes.error.message);
    else setCampaigns(campaignsRes.data || []);
    if (!membersRes.error) setMembers(membersRes.data || []);
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return setMessage('Informe título e mensagem.');
    if (form.audience === 'user' && !form.target_user_id) return setMessage('Escolha o membro que receberá a notificação.');
    if (form.mode === 'schedule' && !form.scheduled_at) return setMessage('Escolha a data e o horário do envio.');

    setBusy(true);
    setMessage('');
    const payload = {
      action: 'create_campaign',
      title: form.title.trim(),
      body: form.body.trim(),
      url: form.url.trim() || '/app',
      audience: form.audience,
      target_user_id: form.audience === 'user' ? form.target_user_id : null,
      scheduled_at: form.mode === 'schedule' ? new Date(form.scheduled_at).toISOString() : new Date().toISOString(),
    };
    const { data, error } = await supabase.functions.invoke('push-dispatch', { body: payload });
    setBusy(false);
    if (error) {
      setMessage(error.message || 'Não foi possível criar a campanha.');
      return;
    }
    if (data?.error) {
      setMessage(data.error);
      return;
    }
    const delivery = data?.delivery;
    setMessage(delivery
      ? `Envio concluído: ${delivery.sent_count || 0} entregue(s), ${delivery.failed_count || 0} falha(s).`
      : 'Notificação programada com sucesso.');
    await load();
  }

  const enabledUsers = Number(stats.users_enabled || 0);
  const statusCounts = useMemo(() => campaigns.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {}), [campaigns]);

  if (!open) return null;

  return <div style={S.overlay}>
    <section style={S.panel}>
      <header style={S.head}>
        <div>
          <small>HOCCO CONTROL</small>
          <h1 style={{ margin: '3px 0' }}>Notificações</h1>
          <p style={S.muted}>Push server-side + lembrete local. Só recebe quem escolheu permitir notificações no próprio aparelho.</p>
        </div>
        <button style={S.close} onClick={() => setOpen(false)} aria-label="Fechar"><X /></button>
      </header>

      <div style={S.notice}><b>OPT-IN DO CLIENTE</b><span>Aceitar é opcional. Recusar notificações não reduz Hype, HC, ofensiva, benefícios ou qualquer função do app.</span></div>

      <div style={S.stats}>
        <Stat label="Aparelhos ativos" value={stats.subscriptions_enabled || 0} />
        <Stat label="Membros alcançáveis" value={enabledUsers} />
        <Stat label="Entregues" value={stats.sent_total || 0} />
        <Stat label="Falhas" value={stats.failed_total || 0} />
        <Stat label="Campanhas" value={stats.campaigns_total || 0} />
        <Stat label="Na fila" value={statusCounts.QUEUED || 0} />
      </div>

      {message && <div style={S.message}>{message}</div>}

      <div style={S.grid}>
        <form style={S.card} onSubmit={submit}>
          <h2 style={S.cardTitle}>Nova notificação</h2>
          <label style={S.label}>Público
            <select style={S.input} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              {AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          {form.audience === 'user' && <label style={S.label}>Membro
            <select style={S.input} required value={form.target_user_id} onChange={(e) => setForm({ ...form, target_user_id: e.target.value })}>
              <option value="">Selecione...</option>
              {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.nome_publico || member.username || member.user_id}</option>)}
            </select>
          </label>}

          <label style={S.label}>Título
            <input style={S.input} maxLength={80} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label style={S.label}>Mensagem
            <textarea style={{ ...S.input, minHeight: 95, resize: 'vertical' }} maxLength={220} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <small style={S.muted}>{form.body.length}/220</small>
          </label>
          <label style={S.label}>Abrir ao tocar
            <input style={S.input} placeholder="/app" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </label>

          <div style={S.toggleRow}>
            <label style={S.radio}><input type="radio" name="push-mode" checked={form.mode === 'now'} onChange={() => setForm({ ...form, mode: 'now' })} /> Enviar agora</label>
            <label style={S.radio}><input type="radio" name="push-mode" checked={form.mode === 'schedule'} onChange={() => setForm({ ...form, mode: 'schedule' })} /> Programar</label>
          </div>
          {form.mode === 'schedule' && <label style={S.label}>Data e horário
            <input style={S.input} type="datetime-local" required value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </label>}

          <button style={S.primary} disabled={busy || !enabledUsers && form.audience !== 'user'}><Send size={17} /> {busy ? 'ENVIANDO...' : form.mode === 'now' ? 'ENVIAR NOTIFICAÇÃO' : 'PROGRAMAR NOTIFICAÇÃO'}</button>
          {!enabledUsers && <small style={S.muted}>Ainda não há aparelhos inscritos. O envio poderá ser programado, mas só alcançará quem permitir notificações.</small>}
        </form>

        <aside style={S.card}>
          <h2 style={S.cardTitle}>Automação ativa</h2>
          <div style={S.autoBox}>
            <BellRing size={22} />
            <div><b>Ofensiva em risco</b><p>Entre 19h e 22h (São Paulo), o servidor pode chamar quem possui ofensiva ativa e ainda não entrou no dia.</p></div>
          </div>
          <p style={S.muted}>O cron verifica a fila a cada 5 minutos. Notificações vencidas ou endpoints removidos pelo navegador são desativados automaticamente.</p>
          <button type="button" style={S.refresh} onClick={load}><RefreshCw size={15} /> Atualizar dados</button>
        </aside>
      </div>

      <h2 style={{ marginTop: 24 }}>Histórico</h2>
      <div style={S.history}>
        {!campaigns.length && <p style={{ ...S.muted, padding: 14 }}>Nenhuma campanha criada.</p>}
        {campaigns.map((row) => <div key={row.id} style={S.historyRow}>
          <div style={{ flex: 1 }}><b>{row.title}</b><small style={{ display: 'block', color: '#718198' }}>{row.body}</small><small style={{ display: 'block' }}>{audienceName(row.audience)} · {row.source === 'automation' ? 'automática' : 'manual'} · {new Date(row.scheduled_at).toLocaleString('pt-BR')}</small></div>
          <div style={{ textAlign: 'right' }}><b>{row.status}</b><small style={{ display: 'block' }}>{row.sent_count || 0}/{row.target_count || 0} entregues</small>{row.failed_count > 0 && <small style={{ display: 'block', color: '#b42336' }}>{row.failed_count} falha(s)</small>}</div>
        </div>)}
      </div>
    </section>
  </div>;
}

function Stat({ label, value }) { return <div style={S.stat}><small>{label}</small><b>{value}</b></div>; }
function audienceName(value) { return Object.fromEntries(AUDIENCES)[value] || value; }

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 32000, background: 'rgba(4,15,34,.72)', padding: 14, overflow: 'auto' },
  panel: { width: 'min(1120px,100%)', margin: '20px auto', background: '#f5f8fc', borderRadius: 24, padding: 20, color: '#10213b' },
  head: { display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' },
  close: { border: 0, background: '#fff', borderRadius: 12, width: 44, height: 44, cursor: 'pointer' },
  muted: { color: '#718198', lineHeight: 1.5 },
  notice: { display: 'grid', gap: 4, background: '#eef5ff', border: '1px solid #d7e6ff', padding: 14, borderRadius: 14, margin: '15px 0' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 9, marginBottom: 14 },
  stat: { background: '#fff', border: '1px solid #e1e8f0', borderRadius: 15, padding: 14, display: 'grid', gap: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(260px,.8fr)', gap: 12 },
  card: { background: '#fff', border: '1px solid #e1e8f0', borderRadius: 18, padding: 17, display: 'grid', gap: 12, alignContent: 'start' },
  cardTitle: { margin: 0, fontSize: 18 },
  label: { display: 'grid', gap: 6, fontSize: 12, fontWeight: 800 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #d7e0eb', borderRadius: 11, padding: '11px 12px', background: '#fff', color: '#10213b', font: 'inherit' },
  toggleRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  radio: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800 },
  primary: { border: 0, borderRadius: 12, padding: 14, background: '#075eea', color: '#fff', fontWeight: 900, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 },
  refresh: { border: '1px solid #dbe4ef', background: '#fff', borderRadius: 10, padding: 10, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'fit-content' },
  autoBox: { display: 'flex', alignItems: 'flex-start', gap: 11, padding: 14, borderRadius: 14, background: '#f5f8fc' },
  message: { padding: 12, background: '#fff7df', border: '1px solid #f3df98', borderRadius: 12, marginBottom: 12 },
  history: { background: '#fff', border: '1px solid #e1e8f0', borderRadius: 18, padding: '0 14px' },
  historyRow: { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderBottom: '1px solid #e8edf3', flexWrap: 'wrap' },
};
