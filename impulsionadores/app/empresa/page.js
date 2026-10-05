'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Copy, MessageCircle, ShieldCheck, Upload, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { HYPE_BOARDS, HYPE_PRICES, HOCCO_WHATSAPP, PIX_KEY, PIX_RECEIVER, brl, onlyDigits, validateCNPJ, whatsappUrl } from '../../lib/config';
import { pixPayload } from '../../lib/pix';

export default function CompanyHype() {
  const [user, setUser] = useState(null);
  const [size, setSize] = useState('medio');
  const [period, setPeriod] = useState('tarde');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.replace('/');
      else {
        setUser(data.user);
        loadRequests(data.user.id);
      }
    });
  }, []);

  const amount = useMemo(() => HYPE_PRICES[size][period === 'dia' ? 'dia' : 'quadro'], [size, period]);

  async function loadRequests(uid = user?.id) {
    if (!uid) return;
    const { data } = await supabase.from('hype_solicitacoes').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(6);
    setRequests(data || []);
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMsg('Use JPG, PNG ou WEBP com até 5 MB.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/empresa-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, file, { upsert: false });
    if (error) {
      setMsg('Não foi possível enviar a logo.');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    setMsg('Logo recebida.');
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
    if (discount < 0 || discount > 30) return setMsg('O benefício pode ser de até 30%.');
    if (!logoUrl) return setMsg('Envie a logo da empresa antes de continuar.');
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
      uf: String(form.get('uf')).trim().toUpperCase().slice(0, 2),
      segmento: String(form.get('segmento')).trim(),
      logo_url: logoUrl,
      instagram: String(form.get('instagram')).trim() || null,
      site_url: String(form.get('site')).trim() || null,
      desconto: discount,
      condicoes: String(form.get('condicoes')).trim() || null,
      tamanho: size,
      periodo: period,
      data_preferida: String(form.get('data_preferida')) || null,
    };
    const { data, error } = await supabase.from('hype_solicitacoes').insert(payload).select().single();
    setBusy(false);
    if (error) return setMsg(`Não foi possível criar a solicitação: ${error.message}`);
    setRequest(data);
    await loadRequests();
  }

  async function reportPayment() {
    if (!request) return;
    const { error } = await supabase.from('hype_solicitacoes').update({ pagamento_informado_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', request.id);
    if (error) return setMsg('Não foi possível registrar a informação de pagamento.');
    setRequest({ ...request, status: 'pagamento_informado', payment_status: 'informado', pagamento_informado_at: new Date().toISOString() });
    setMsg('Pagamento informado. A HOCCO fará a conferência antes da aprovação e entrada na fila.');
    await loadRequests();
  }

  if (!user) return <div className="splash"><b>HOCCO</b><span>Preparando cadastro empresarial...</span></div>;

  if (request) {
    const code = pixPayload(request.valor, request.payment_reference);
    return <main className="companyFlow"><header><button className="backIcon" onClick={() => location.href='/app'}><ArrowLeft/></button><b className="logo">HOCCO</b><span className="pill">HYPE EMPRESAS</span></header><section className="companyShell">
      <div className="companyDone"><Zap/><small>SOLICITAÇÃO {request.payment_reference}</small><h1>{request.nome_fantasia}</h1><p>Seu cadastro foi criado. O pagamento é conferido pela HOCCO antes da aprovação e programação.</p></div>
      <div className="payPanel"><div className="payPrice"><span>Hype {request.tamanho} · {request.periodo === 'dia' ? 'dia inteiro' : HYPE_BOARDS[request.periodo]?.label}</span><strong>{brl(request.valor)}</strong></div><div className="qrbox"><QRCodeSVG value={code} size={190}/></div><button className="copyPay" onClick={() => navigator.clipboard?.writeText(code)}><Copy/> COPIAR PIX COPIA E COLA</button><div className="payFacts"><span><small>RECEBEDOR</small><b>{PIX_RECEIVER}</b></span><span><small>CHAVE PIX</small><b>{PIX_KEY}</b></span></div></div>
      <div className="approvalPath"><ShieldCheck/><div><b>Como funciona agora</b><ol><li>Você realiza o PIX.</li><li>Informa o pagamento abaixo.</li><li>A HOCCO confere CNPJ, materiais, benefício e pagamento.</li><li>Se aprovado, o sistema coloca a empresa na primeira vaga compatível, respeitando 10 empresas por quadro.</li><li>Se recusado após pagamento confirmado, o pedido entra em reembolso e recebe o motivo registrado.</li></ol></div></div>
      <button className="primary" disabled={Boolean(request.pagamento_informado_at)} onClick={reportPayment}>{request.pagamento_informado_at ? 'PAGAMENTO JÁ INFORMADO' : 'JÁ FIZ O PIX · INFORMAR PAGAMENTO'}</button>
      <a className="waSupport" href={whatsappUrl(HOCCO_WHATSAPP, `Olá! Sou responsável pela empresa ${request.nome_fantasia}. Minha solicitação HOCCO Hype é ${request.payment_reference}.`)} target="_blank" rel="noreferrer"><MessageCircle/> FALAR COM A HOCCO NO WHATSAPP</a>
      {msg && <div className="authMsg">{msg}</div>}
    </section></main>;
  }

  return <main className="companyFlow"><header><button className="backIcon" onClick={() => location.href='/app'}><ArrowLeft/></button><b className="logo">HOCCO</b><span className="pill">HYPE EMPRESAS</span></header><section className="companyShell">
    <div className="title"><small>HYPAR MINHA EMPRESA</small><h1>Coloque sua marca dentro da célula.</h1><p>Cadastro empresarial, benefício para a comunidade, escolha do quadro e pagamento em um fluxo único.</p></div>

    <form className="companyForm" onSubmit={submit}>
      <fieldset><legend>1 · Empresa</legend><div className="formGrid"><label>CNPJ*<input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required/></label><label>Razão social*<input name="razao_social" required/></label><label>Nome fantasia*<input name="nome_fantasia" required/></label><label>Responsável*<input name="responsavel" required/></label><label>WhatsApp empresarial*<input name="whatsapp" inputMode="tel" required/></label><label>E-mail*<input name="email" type="email" defaultValue={user.email || ''} required/></label><label>Cidade*<input name="cidade" required/></label><label>UF*<input name="uf" maxLength="2" required/></label><label>Segmento*<input name="segmento" placeholder="Restaurante, clínica, loja..." required/></label><label>Instagram<input name="instagram" placeholder="@empresa"/></label><label className="wide">Site<input name="site" placeholder="https://..."/></label></div></fieldset>

      <fieldset><legend>2 · Benefício HOCCO</legend><div className="formGrid"><label>Desconto oferecido (%)*<input name="desconto" type="number" min="0" max="30" step="1" defaultValue="10" required/></label><label className="wide">Condições<textarea name="condicoes" placeholder="Ex.: válido de segunda a quinta, exceto feriados."/></label></div><p className="fieldHelp">O benefício pode chegar a 30%. Condições precisam ser claras para evitar divergências com os membros.</p></fieldset>

      <fieldset><legend>3 · Logo</legend><label className={`logoUpload ${logoUrl ? 'ready' : ''}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo}/>{logoUrl ? <><img src={logoUrl} alt="Logo enviada"/><span><CheckCircle2/> Logo recebida</span></> : <><Upload/><b>{uploading ? 'ENVIANDO...' : 'ENVIAR LOGO'}</b><span>JPG, PNG ou WEBP · até 5 MB</span></>}</label></fieldset>

      <fieldset><legend>4 · Quadro e exposição</legend><div className="periodPicker"><button type="button" className={period==='almoco'?'active':''} onClick={()=>setPeriod('almoco')}><b>Almoço</b><span>11h–14h</span></button><button type="button" className={period==='tarde'?'active':''} onClick={()=>setPeriod('tarde')}><b>Tarde</b><span>14h–18h</span></button><button type="button" className={period==='noite'?'active':''} onClick={()=>setPeriod('noite')}><b>Noite</b><span>18h–22h</span></button><button type="button" className={period==='dia'?'active':''} onClick={()=>setPeriod('dia')}><b>Dia inteiro</b><span>3 quadros</span></button></div><div className="sizePicker">{['compacto','medio','grande','max'].map((key)=><button type="button" className={`${size===key?'active':''} visual-${key}`} onClick={()=>setSize(key)} key={key}><span className="sizeDemo">HOCCO</span><b>{key==='max'?'MAX':key.toUpperCase()}</b><strong>{brl(HYPE_PRICES[key][period==='dia'?'dia':'quadro'])}</strong></button>)}</div><p className="fieldHelp"><b>O preço compra exposição/tamanho, nunca votos.</b> Hypes válidos são definidos exclusivamente pela comunidade.</p><label>Data preferida<input name="data_preferida" type="date"/></label></fieldset>

      <div className="commercialSummary"><div><span>Participação selecionada</span><b>{size.toUpperCase()} · {period==='dia'?'DIA INTEIRO':HYPE_BOARDS[period].label.toUpperCase()}</b></div><strong>{brl(amount)}</strong></div>
      {msg && <div className="authMsg">{msg}</div>}
      <button className="primary" disabled={busy}>{busy?'CRIANDO SOLICITAÇÃO...':'CRIAR SOLICITAÇÃO E IR PARA O PIX'}</button>
    </form>

    {requests.length > 0 && <section className="requestHistory"><small>MINHAS SOLICITAÇÕES</small>{requests.map((r)=><article key={r.id}><div><b>{r.nome_fantasia}</b><span>{r.payment_reference} · {r.periodo} · {brl(r.valor)}</span></div><em>{String(r.status).replaceAll('_',' ')}</em></article>)}</section>}
  </section></main>;
}
