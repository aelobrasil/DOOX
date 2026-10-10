'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Image as ImageIcon, MessageCircle, Upload, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { HYPE_BOARDS, HYPE_PRICES, PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, onlyDigits, validateCNPJ } from '../../lib/config';
import { pixPayload } from '../../lib/pix';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MEDIA_LIMITS = { logo: 500 * 1024, cover: 900 * 1024 };
const CLOSED = new Set(['recusado','reembolsado','cancelado']);

async function compressMedia(file, kind) {
  const bitmap = await createImageBitmap(file);
  const maxSide = kind === 'cover' ? 1400 : 800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const qualities = kind === 'cover' ? [0.9,0.82,0.74,0.66,0.58] : [0.88,0.78,0.68,0.58];
  for (const quality of qualities) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= MEDIA_LIMITS[kind]) return blob;
  }
  const finalBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.5));
  if (!finalBlob || finalBlob.size > MEDIA_LIMITS[kind]) throw new Error('media_too_large_after_compression');
  return finalBlob;
}

function newDraftId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CompanyHype() {
  const [user, setUser] = useState(null);
  const [size, setSize] = useState('medio');
  const [period, setPeriod] = useState('tarde');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploading, setUploading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState('');
  const draftRef = useRef(null);

  useEffect(() => {
    draftRef.current = newDraftId();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.replace('/');
      else { setUser(data.user); loadRequests(data.user.id); }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) location.replace('/');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const amount = useMemo(() => HYPE_PRICES[size][period === 'dia' ? 'dia' : 'quadro'], [size, period]);

  async function loadRequests(uid = user?.id) {
    if (!uid) return;
    const { data } = await supabase.from('hype_solicitacoes').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20);
    setRequests(data || []);
  }

  async function uploadMedia(event, kind) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > MAX_SOURCE_BYTES) {
      return setMsg('Use JPG, PNG ou WEBP. O arquivo original pode ter até 8 MB.');
    }
    setUploading(kind);
    setMsg(kind === 'cover' ? 'Otimizando foto de capa...' : 'Otimizando perfil/logo...');
    try {
      const optimized = await compressMedia(file, kind);
      if (!draftRef.current) draftRef.current = newDraftId();
      const path = `${user.id}/requests/${draftRef.current}/${kind}.webp`;
      const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, optimized, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '31536000',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      if (kind === 'cover') setCoverUrl(url); else setLogoUrl(url);
      setMsg(`${kind === 'cover' ? 'Capa' : 'Perfil/logo'} recebido · ${Math.max(1, Math.round(optimized.size / 1024))} KB.`);
    } catch (error) {
      console.error('Company media upload error', error);
      setMsg('Não foi possível processar a imagem. Tente outra foto JPG, PNG ou WEBP.');
    } finally {
      setUploading(null);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setMsg('');
    const form = new FormData(event.currentTarget);
    const cnpj = onlyDigits(form.get('cnpj'));
    const whatsapp = onlyDigits(form.get('whatsapp'));
    const discount = Number(form.get('desconto'));
    if (!validateCNPJ(cnpj)) return setMsg('CNPJ inválido. Revise os 14 dígitos.');
    if (whatsapp.length < 10) return setMsg('Informe um WhatsApp empresarial válido.');
    if (discount < 0 || discount > 30) return setMsg('O benefício pode ser de 0% a 30%.');
    if (!coverUrl || !logoUrl) return setMsg('Envie a foto de capa e o perfil/logo antes de continuar.');

    setBusy(true);
    const payload = {
      user_id: user.id,
      cnpj,
      razao_social: String(form.get('razao_social')).trim(),
      nome_fantasia: String(form.get('nome_fantasia')).trim(),
      responsavel: String(form.get('responsavel')).trim(),
      whatsapp,
      email: String(form.get('email')).trim().toLowerCase(),
      cidade: String(form.get('cidade')).trim(),
      uf: String(form.get('uf')).trim().toUpperCase().slice(0,2),
      segmento: String(form.get('segmento')).trim(),
      logo_url: logoUrl,
      capa_url: coverUrl,
      instagram: String(form.get('instagram')).trim() || null,
      site_url: String(form.get('site')).trim() || null,
      desconto: discount,
      condicoes: String(form.get('condicoes')).trim() || null,
      beneficio_validade: String(form.get('beneficio_validade')) || null,
      tamanho: size,
      periodo: period,
      data_preferida: String(form.get('data_preferida')) || null,
    };
    const { data, error } = await supabase.from('hype_solicitacoes').insert(payload).select().single();
    setBusy(false);
    if (error) return setMsg(humanError(error.message));
    setRequest(data);
    draftRef.current = newDraftId();
    setLogoUrl('');
    setCoverUrl('');
    await loadRequests();
  }

  async function reportPayment(item = request) {
    if (!item || !['aguardando_pagamento','pagamento_informado'].includes(item.status)) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('hype_solicitacoes').update({ pagamento_informado_at: now, updated_at: now }).eq('id', item.id);
    if (error) return setMsg('Não foi possível registrar a informação de pagamento.');
    const updated = { ...item, status:'pagamento_informado', payment_status:'informado', pagamento_informado_at:now };
    setRequest(updated);
    setRequests((rows) => rows.map((r) => r.id === item.id ? updated : r));
    setMsg('Pagamento informado. A HOCCO fará a conferência antes da revisão final.');
  }

  if (!user) return <div className="splash"><b>HYPE</b><span>Preparando cadastro empresarial...</span></div>;
  if (request) return <RequestView request={request} onBack={() => { setRequest(null); setMsg(''); }} onReport={() => reportPayment(request)} msg={msg}/>;

  return <main className="companyFlow">
    <header><button className="backIcon" onClick={() => location.href='/app'}><ArrowLeft/></button><b className="logo">HYPE</b><span className="pill">EMPRESAS</span></header>
    <section className="companyShell">
      <div className="title"><small>HYPAR MINHA EMPRESA</small><h1>Coloque sua marca dentro do Hype.</h1><p>Cadastro, materiais, benefício potencial, quadro e pagamento em um único fluxo. A empresa só aparece aos membros depois da revisão final da HOCCO.</p></div>
      <form className="companyForm" onSubmit={submit}>
        <fieldset><legend>1 · Empresa</legend><div className="formGrid">
          <label>CNPJ*<input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required/></label>
          <label>Razão social*<input name="razao_social" required/></label>
          <label>Nome fantasia*<input name="nome_fantasia" required/></label>
          <label>Responsável*<input name="responsavel" required/></label>
          <label>WhatsApp empresarial*<input name="whatsapp" inputMode="tel" required/></label>
          <label>E-mail*<input name="email" type="email" defaultValue={user.email || ''} required/></label>
          <label>Cidade*<input name="cidade" required/></label>
          <label>UF*<input name="uf" maxLength="2" required/></label>
          <label>Segmento*<input name="segmento" placeholder="Restaurante, clínica, loja..." required/></label>
          <label>Instagram<input name="instagram" placeholder="@empresa"/></label>
          <label className="wide">Site<input name="site" placeholder="https://..."/></label>
        </div></fieldset>

        <fieldset><legend>2 · Benefício potencial</legend><div className="formGrid">
          <label>Desconto que poderá ser liberado (%)*<input name="desconto" type="number" min="0" max="30" step="1" defaultValue="10" required/></label>
          <label>Validade do benefício<input name="beneficio_validade" type="date"/></label>
          <label className="wide">Condições<textarea name="condicoes" placeholder="Ex.: válido de segunda a quinta, exceto feriados."/></label>
        </div><p className="fieldHelp"><b>O desconto só é liberado se a empresa vencer o Hype.</b> O pagamento compra exposição, nunca votos ou vitória.</p></fieldset>

        <fieldset><legend>3 · Imagens do Hype</legend><p className="fieldHelp">Cada solicitação mantém sua própria cópia de capa e perfil/logo. Uma participação futura não sobrescreve os materiais já aprovados.</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <MediaUpload kind="cover" url={coverUrl} uploading={uploading} onChange={uploadMedia}/>
          <MediaUpload kind="logo" url={logoUrl} uploading={uploading} onChange={uploadMedia}/>
        </div></fieldset>

        <fieldset><legend>4 · Quadro e exposição</legend>
          <div className="periodPicker">
            {Object.entries(HYPE_BOARDS).map(([key,info]) => <button type="button" key={key} className={period===key?'active':''} onClick={() => setPeriod(key)}><b>{info.label.replace('Hype ','')}</b><span>{info.window}</span></button>)}
          </div>
          <div className="periodPicker" style={{marginTop:10}}><button type="button" className={period==='dia'?'active':''} onClick={() => setPeriod('dia')}><b>Dia inteiro</b><span>Almoço + Tarde + Noite</span></button></div>
          <div className="sizePicker">{['compacto','medio','grande','max'].map((key) => <button type="button" className={`${size===key?'active':''} visual-${key}`} onClick={() => setSize(key)} key={key}><span className="sizeDemo">HYPE</span><b>{key==='max'?'MAX':key.toUpperCase()}</b><strong>{brl(HYPE_PRICES[key][period==='dia'?'dia':'quadro'])}</strong></button>)}</div>
          <label>Data preferida<input name="data_preferida" type="date"/></label>
        </fieldset>

        <div className="commercialSummary"><div><span>Participação selecionada</span><b>{period==='dia'?`DIA INTEIRO · ${size.toUpperCase()}`:`${HYPE_BOARDS[period].label.toUpperCase()} · ${size.toUpperCase()}`}</b></div><strong>{brl(amount)}</strong></div>
        <label className="legalCheck"><input type="checkbox" required/><span>Li e aceito os <a href="/termos-empresa" target="_blank">Termos Comerciais do Hype</a>.</span></label>
        {msg && <div className="authMsg">{msg}</div>}
        <button className="primary" disabled={busy || Boolean(uploading)}>{busy ? 'CRIANDO SOLICITAÇÃO...' : 'CRIAR SOLICITAÇÃO E IR PARA O PIX'}</button>
      </form>

      {requests.length > 0 && <section className="requestHistory"><small>MINHAS SOLICITAÇÕES</small>{requests.map((r) => <button type="button" key={r.id} onClick={() => { setRequest(r); setMsg(''); }} style={{width:'100%',textAlign:'left',border:0,background:'transparent',padding:0}}><article><div><b>{r.nome_fantasia}</b><span>{r.payment_reference} · {human(r.status)}</span></div><strong>{brl(r.valor)}</strong></article></button>)}</section>}
    </section>
  </main>;
}

function MediaUpload({ kind, url, uploading, onChange }) {
  const cover = kind === 'cover';
  return <label className={`logoUpload ${url?'ready':''}`} style={{minHeight:190}}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange(e,kind)}/>{url ? <><img src={url} alt={cover?'Foto de capa':'Perfil/logo'} style={{width:cover?'100%':100,height:cover?120:100,objectFit:cover?'cover':'contain',borderRadius:14}}/><span><CheckCircle2/> {cover?'Capa':'Perfil/logo'} recebido</span></> : <><ImageIcon/><b>{uploading===kind?'OTIMIZANDO...':cover?'ENVIAR FOTO DE CAPA':'ENVIAR PERFIL / LOGO'}</b><span>JPG, PNG ou WEBP · até 8 MB</span></>}</label>;
}

function RequestView({ request, onBack, onReport, msg }) {
  const payload = pixPayload(request.valor, request.payment_reference);
  const canReport = request.payment_status === 'aguardando' && !CLOSED.has(request.status);
  return <main className="companyFlow"><header><button className="backIcon" onClick={onBack}><ArrowLeft/></button><b className="logo">HYPE</b><span className="pill">{human(request.status)}</span></header><section className="companyShell">
    <div className="title"><small>{request.payment_reference}</small><h1>{request.nome_fantasia}</h1><p>Seu pedido conversa diretamente com o HOCCO Control. Cada alteração de pagamento, revisão e publicação aparece neste status.</p></div>
    <div className="commercialSummary"><div><span>{request.periodo==='dia'?'Dia inteiro':HYPE_BOARDS[request.periodo]?.label}</span><b>{String(request.tamanho).toUpperCase()} · {request.desconto}% de benefício potencial</b></div><strong>{brl(request.valor)}</strong></div>
    {request.payment_status !== 'confirmado' && !CLOSED.has(request.status) && <section style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:20,padding:18,textAlign:'center'}}><small>PIX HOCCO</small><div style={{margin:'14px auto',width:220,maxWidth:'100%'}}><QRCodeSVG value={payload} size={220} style={{width:'100%',height:'auto'}}/></div><p style={{fontSize:12,color:'#6d7d92'}}>Recebedor: <b>{PIX_RECEIVER}</b><br/>{PIX_BANK} · {PIX_CITY}</p><button className="switch" onClick={() => navigator.clipboard?.writeText(payload)}><Copy/> Copiar PIX copia e cola</button>{canReport && <button className="primary" onClick={onReport}><CheckCircle2/> JÁ FIZ O PIX · INFORMAR PAGAMENTO</button>}</section>}
    <StatusTimeline request={request}/>
    {request.motivo_recusa && <div className="authMsg">Motivo: {request.motivo_recusa}</div>}
    {msg && <div className="authMsg">{msg}</div>}
    <a className="switch" href={`https://wa.me/5514991088104?text=${encodeURIComponent(`Olá! Quero falar sobre a solicitação ${request.payment_reference} da ${request.nome_fantasia}.`)}`} target="_blank" rel="noreferrer"><MessageCircle/> Falar com a HOCCO</a>
    <button className="switch" onClick={onBack}>Voltar para minhas solicitações</button>
  </section></main>;
}

function StatusTimeline({ request }) {
  const steps = [
    ['aguardando_pagamento','Solicitação criada'],
    ['pagamento_informado','Pagamento informado'],
    ['em_analise','Pagamento confirmado · em análise'],
    ['programado','Revisada e publicada/programada'],
  ];
  const order = { aguardando_pagamento:0, pagamento_informado:1, em_analise:2, aprovado:2, programado:3 };
  const current = order[request.status] ?? (request.payment_status==='confirmado'?2:0);
  return <section style={{marginTop:16,display:'grid',gap:8}}>{steps.map(([key,label],index) => <div key={key} style={{display:'grid',gridTemplateColumns:'28px 1fr',gap:9,alignItems:'center',padding:11,border:'1px solid #e3e9f1',borderRadius:14,background:index<=current?'#f5f9ff':'#fff',opacity:index<=current?1:.55}}><span style={{width:24,height:24,borderRadius:99,display:'grid',placeItems:'center',background:index<=current?'#075eea':'#e9eef5',color:'#fff',fontWeight:900,fontSize:11}}>{index<=current?'✓':index+1}</span><b style={{fontSize:12}}>{label}</b></div>)}</section>;
}

function human(value='') { return String(value || '—').replaceAll('_',' ').replace(/\b\w/g,(c) => c.toUpperCase()); }
function humanError(message='') {
  const text = String(message || '');
  if (text.includes('hype_solicitacoes_cnpj') || text.includes('duplicate')) return 'Já existe uma solicitação incompatível com estes dados. Revise ou fale com a HOCCO.';
  if (text.includes('invalid_hype_plan')) return 'Este plano não está disponível no momento.';
  if (text.includes('violates row-level security')) return 'Sua sessão expirou. Entre novamente e tente de novo.';
  return 'Não foi possível criar a solicitação. Revise os dados e tente novamente.';
}
