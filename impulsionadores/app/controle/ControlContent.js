'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarClock, Check, Edit3, Newspaper, Plus, RefreshCw, Send, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './content-control.css';

const TYPES = [
  ['promocao', 'Promoção'], ['empresa', 'Empresa'], ['drop', 'Drop'],
  ['video', 'Vídeo do YouTube'], ['story', 'Novidade HOCCO'],
];
const EMPTY = { content_type: 'story', title: '', body: '', image_url: '', link_url: '', instagram: '', youtube_video_id: '', video_storage_path: '', company_id: '', drop_id: '', offer_id: '', required_watch_seconds: 30, starts_at: '', ends_at: '', priority: 0, notify_members: true, story_kind: 'novidade' };

function toLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function ControlContent() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [offers, setOffers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [drops, setDrops] = useState([]);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const handler = () => { setOpen(true); load(); };
    window.addEventListener('hocco-control-content-open', handler);
    return () => window.removeEventListener('hocco-control-content-open', handler);
  }, []);

  async function load() {
    setMessage('');
    const [content, offerRows, companyRows, dropRows] = await Promise.all([
      supabase.from('hocco_content_items').select('*').order('updated_at', { ascending: false }).limit(200),
      supabase.from('hocco_ofertas').select('id,titulo,nome_fantasia,oferta_texto,descricao,capa_url,destino_url,instagram,hocco_empresa_id,status,display_date').order('created_at', { ascending: false }).limit(500),
      supabase.from('hocco_empresas').select('id,nome_fantasia,status,logo_url,capa_url,instagram,site_url').order('nome_fantasia').limit(500),
      supabase.from('hocco_drops').select('id,titulo,mensagem,benefit,image_url,cta_url,status,starts_at,ends_at').order('created_at', { ascending: false }).limit(300),
    ]);
    setOffers(offerRows.data || []); setCompanies(companyRows.data || []); setDrops(dropRows.data || []);
    if (content.error) setMessage(`Não foi possível carregar publicações: ${content.error.message}`);
    else setRows(content.data || []);
  }

  function newDraft() { setEditing(null); setVideoFile(null); setDraft({ ...EMPTY, starts_at: toLocal(new Date()) }); setMessage(''); }
  function editDraft(row) {
    setEditing(row.id);
    setVideoFile(null);
    setDraft({ ...EMPTY, ...row, starts_at: toLocal(row.starts_at), ends_at: toLocal(row.ends_at) });
    setMessage('');
  }
  function field(key, value) { setDraft(current => ({ ...current, [key]: value })); }

  async function uploadVideo() {
    if (!videoFile || videoBusy) return;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(videoFile.type) || videoFile.size > 50 * 1024 * 1024) {
      setMessage('Use MP4, WebM ou MOV de até 50 MB.'); return;
    }
    setVideoBusy(true); setMessage('Enviando bastidor privado…');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setVideoBusy(false); setMessage('Entre novamente no HOCCO Control para enviar o arquivo.'); return; }
    const ext = videoFile.type === 'video/quicktime' ? 'mov' : videoFile.type === 'video/webm' ? 'webm' : 'mp4';
    const path = `${auth.user.id}/content/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('hocco-bastidores').upload(path, videoFile, { contentType: videoFile.type, cacheControl: '3600', upsert: false });
    setVideoBusy(false);
    if (error) { setMessage(`Não foi possível enviar o vídeo: ${error.message}`); return; }
    setVideoFile(null);
    setDraft(current => ({ ...current, youtube_video_id: '', video_storage_path: path }));
    setMessage('Bastidor privado enviado. Salve a publicação como rascunho antes de publicar.');
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const payload = {
      content_type: draft.content_type,
      title: draft.title.trim(), body: draft.body.trim(),
      image_url: draft.image_url.trim() || null, link_url: draft.link_url.trim() || null,
      youtube_video_id: draft.content_type === 'video' ? videoId(draft.youtube_video_id) : null,
      video_storage_path: draft.content_type === 'video' ? draft.video_storage_path || null : null,
      instagram: draft.instagram.trim() || null,
      company_id: draft.content_type === 'empresa' ? (draft.company_id || null) : draft.content_type === 'promocao' ? (offers.find(o => o.id === draft.offer_id)?.hocco_empresa_id || null) : null,
      offer_id: draft.content_type === 'promocao' ? (draft.offer_id || null) : null,
      drop_id: draft.content_type === 'drop' ? (draft.drop_id || null) : null,
      required_watch_seconds: draft.content_type === 'video' ? 30 : Number(draft.required_watch_seconds || 30),
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : new Date().toISOString(),
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      priority: Math.max(0, Math.min(100, Number(draft.priority || 0))),
      notify_members: Boolean(draft.notify_members), story_kind: draft.story_kind || null,
    };
    if (payload.content_type === 'video' && !payload.youtube_video_id && !payload.video_storage_path) {
      setBusy(false); setMessage('Informe um link ou ID válido do YouTube ou envie um bastidor privado.'); return;
    }
    if ((payload.content_type === 'promocao' && !payload.offer_id) || (payload.content_type === 'empresa' && !payload.company_id) || (payload.content_type === 'drop' && !payload.drop_id)) {
      setBusy(false); setMessage('Selecione a oferta, empresa ou Drop correspondente antes de salvar.'); return;
    }
    if (payload.ends_at && new Date(payload.ends_at) <= new Date(payload.starts_at)) {
      setBusy(false); setMessage('O encerramento precisa ocorrer depois do início.'); return;
    }
    const result = editing
      ? await supabase.from('hocco_content_items').update(payload).eq('id', editing).select().single()
      : await supabase.from('hocco_content_items').insert({ ...payload, status: 'draft' }).select().single();
    setBusy(false);
    if (result.error) { setMessage(`Não foi possível salvar: ${result.error.message}`); return; }
    setMessage(editing ? 'Rascunho atualizado.' : 'Salvo como rascunho. Ainda não aparece para os membros.');
    setEditing(result.data.id); setDraft(current => ({ ...current, status: result.data.status }));
    await load();
  }

  async function setStatus(row, status) {
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('admin_set_content_status', {
      p_id: row.id, p_status: status, p_notify: Boolean(row.notify_members),
    });
    setBusy(false);
    if (error || !data?.ok) { setMessage(`Não foi possível alterar a publicação: ${error?.message || 'erro de autorização'}`); return; }
    setMessage(status === 'scheduled' ? 'Publicação programada. Ela aparecerá para os membros no horário definido.' : status === 'published' ? 'Publicado. Os membros verão a novidade no app.' : `Status alterado para ${status}.`);
    if (['published', 'scheduled'].includes(status) && row.notify_members) {
      const push = await supabase.functions.invoke('push-dispatch', { body: {
        action: 'create_campaign', title: row.title, body: row.body,
        url: '/app', audience: 'all', scheduled_at: row.starts_at ? new Date(row.starts_at).toISOString() : new Date().toISOString(),
      } });
      const delivery = push.data?.delivery;
      if (push.error || push.data?.error) setMessage('Publicado e disponível no sino. O push não foi agendado; confira a autorização e a configuração de notificações.');
      else if (delivery?.status === 'FAILED' || delivery?.status === 'PARTIAL') setMessage(`Publicado e disponível no sino. Push: ${delivery.sent_count || 0} entregue(s), ${delivery.failed_count || 0} falha(s).`);
      else if (status === 'scheduled' && !delivery) setMessage('Publicação e push programados para o horário definido.');
      else if (delivery) setMessage(`Publicado e disponível no sino. Push: ${delivery.sent_count || 0} entregue(s).`);
    }
    await load();
  }

  function publish(row) {
    const startsAt = row.starts_at ? new Date(row.starts_at) : new Date();
    return setStatus(row, startsAt > new Date() ? 'scheduled' : 'published');
  }

  function selectOffer(id) {
    const offer = offers.find(item => item.id === id);
    setDraft(current => ({ ...current, offer_id: id, title: offer?.titulo || offer?.oferta_texto || current.title, body: offer?.descricao || offer?.oferta_texto || current.body, image_url: offer?.capa_url || current.image_url, link_url: offer?.destino_url || current.link_url, instagram: offer?.instagram || current.instagram }));
  }
  function selectCompany(id) {
    const company = companies.find(item => item.id === id);
    setDraft(current => ({ ...current, company_id: id, title: company?.nome_fantasia || current.title, image_url: company?.capa_url || company?.logo_url || current.image_url, instagram: company?.instagram || current.instagram, link_url: company?.site_url || current.link_url }));
  }
  function selectDrop(id) {
    const drop = drops.find(item => item.id === id);
    setDraft(current => ({ ...current, drop_id: id, title: drop?.titulo || current.title, body: drop?.benefit || drop?.mensagem || current.body, image_url: drop?.image_url || current.image_url, link_url: drop?.cta_url || current.link_url }));
  }

  const shown = useMemo(() => rows.filter(row => filter === 'all' || row.status === filter), [rows, filter]);
  if (!open) return null;

  return <div className="ccBackdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
    <section className="ccPanel" role="dialog" aria-modal="true" aria-label="Publicações HOCCO">
      <header className="ccHead"><div><small>HOCCO CONTROL</small><h2>Publicações e novidades</h2><p>Rascunhos só aparecem para os membros depois da publicação.</p></div><button onClick={() => setOpen(false)} aria-label="Fechar"><X/></button></header>
      <div className="ccLayout">
        <section className="ccListPane"><div className="ccListTools"><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os status</option>{['draft','scheduled','published','ended','archived'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><button onClick={load} aria-label="Atualizar"><RefreshCw/></button><button className="ccPrimary" onClick={newDraft}><Plus/> Nova publicação</button></div>
          <div className="ccRows">{shown.map(row => <article key={row.id} className="ccRow"><div><span className={`ccType ${row.content_type}`}>{typeLabel(row.content_type)}</span><b>{row.title}</b><p>{row.body}</p><small>{dateLabel(row.starts_at)} · {statusLabel(row.status)}{row.content_type === 'video' ? ` · ${row.required_watch_seconds || 30}s` : ''}</small></div><div className="ccActions"><button onClick={() => editDraft(row)} title="Editar"><Edit3/></button>{row.status !== 'published' && row.status !== 'scheduled' && <button className="ccPublish" onClick={() => publish(row)} disabled={busy} title="Publicar ou programar"><Send/></button>}{row.status !== 'archived' && <button onClick={() => setStatus(row, 'archived')} disabled={busy} title="Arquivar"><Archive/></button>}</div></article>)}{!shown.length&&<p className="ccEmpty">Nenhum conteúdo neste filtro.</p>}</div>
        </section>
        <form className="ccForm" onSubmit={save}>
          <div className="ccFormTitle"><Newspaper/><span><b>{editing ? 'Editar publicação' : 'Nova publicação'}</b><small>{editing ? `ID ${editing.slice(0, 8)}` : 'Começa como rascunho'}</small></span></div>
          <label>Tipo<select value={draft.content_type} onChange={e => field('content_type', e.target.value)}>{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {draft.content_type === 'promocao' && <label>Oferta aprovada<select value={draft.offer_id || ''} onChange={e => selectOffer(e.target.value)}><option value="">Selecione uma oferta</option>{offers.map(offer => <option key={offer.id} value={offer.id}>{offer.nome_fantasia} · {offer.titulo || offer.oferta_texto} · {offer.status}</option>)}</select></label>}
          {draft.content_type === 'empresa' && <label>Empresa<select value={draft.company_id || ''} onChange={e => selectCompany(e.target.value)}><option value="">Selecione uma empresa</option>{companies.map(company => <option key={company.id} value={company.id}>{company.nome_fantasia} · {company.status}</option>)}</select></label>}
          {draft.content_type === 'drop' && <label>Drop cadastrado<select value={draft.drop_id || ''} onChange={e => selectDrop(e.target.value)}><option value="">Selecione um Drop</option>{drops.map(drop => <option key={drop.id} value={drop.id}>{drop.titulo} · {drop.status}</option>)}</select></label>}
          <label>Título<input value={draft.title} maxLength={100} required onChange={e => field('title', e.target.value)}/></label>
          <label>Texto<textarea value={draft.body} maxLength={500} required rows={4} onChange={e => field('body', e.target.value)}/></label>
          {draft.content_type === 'video' && <><label>Link ou ID do YouTube (opcional)<input value={draft.youtube_video_id || ''} placeholder="https://youtu.be/..." onChange={e => { field('youtube_video_id', e.target.value); if (e.target.value) field('video_storage_path', ''); }}/></label><div className="ccFile"><label>Ou envie um bastidor privado<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setVideoFile(e.target.files?.[0] || null)}/><small>MP4, WebM ou MOV · até 50 MB · acesso para membros autenticados</small></label><button type="button" className="ccPrimary" disabled={!videoFile || videoBusy} onClick={uploadVideo}>{videoBusy ? 'ENVIANDO…' : 'Enviar vídeo'}</button>{draft.video_storage_path && <small className="ccUploaded"><Check/> Arquivo privado anexado a este rascunho</small>}</div><div className="ccRule"><Check/> O app exige o tempo mínimo de reprodução antes de registrar conclusão.</div></>}
          <label>Imagem (URL)<input value={draft.image_url || ''} type="url" placeholder="https://..." onChange={e => field('image_url', e.target.value)}/></label>
          <label>Link ao tocar<input value={draft.link_url || ''} placeholder="/app ou https://..." onChange={e => field('link_url', e.target.value)}/></label>
          <div className="ccDates"><label>Começa em<input type="datetime-local" value={draft.starts_at || ''} onChange={e => field('starts_at', e.target.value)}/></label><label>Termina em<input type="datetime-local" value={draft.ends_at || ''} onChange={e => field('ends_at', e.target.value)}/></label></div>
          <div className="ccDates"><label>Prioridade<input type="number" min="0" max="100" value={draft.priority} onChange={e => field('priority', e.target.value)}/></label><label>Story<input value={draft.story_kind || ''} onChange={e => field('story_kind', e.target.value)}/></label></div>
          <label className="ccCheck"><input type="checkbox" checked={Boolean(draft.notify_members)} onChange={e => field('notify_members', e.target.checked)}/> Avisar membros ao publicar</label>
          {message && <p className="ccMessage" role="status">{message}</p>}
          <button className="ccPrimary ccSave" disabled={busy}>{busy ? 'SALVANDO…' : editing ? 'SALVAR ALTERAÇÕES' : 'SALVAR RASCUNHO'}</button>
          {editing && !['published', 'scheduled'].includes(draft.status) && <button type="button" className="ccPublishFull" disabled={busy} onClick={() => publish({ id: editing, notify_members: draft.notify_members, title: draft.title, body: draft.body, starts_at: draft.starts_at })}><Send/> PUBLICAR / PROGRAMAR</button>}
        </form>
      </div>
    </section>
  </div>;
}

function videoId(value='') { const s=String(value).trim(); const match=s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/); return match?.[1] || (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : ''); }
function typeLabel(v) { return TYPES.find(([key]) => key === v)?.[1] || v; }
function statusLabel(v) { return ({ draft:'Rascunho', scheduled:'Programado', published:'Publicado', ended:'Encerrado', archived:'Arquivado' })[v] || v; }
function dateLabel(v) { return v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : 'Sem data'; }
