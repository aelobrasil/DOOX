'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Copy, MessageCircle, ShieldCheck, Upload, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { HYPE_BOARDS, HYPE_PRICES, HOCCO_WHATSAPP, PIX_KEY, PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, onlyDigits, validateCNPJ, whatsappUrl } from '../../lib/config';
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
      else { setUser(data.user); loadRequests(data.user.id); }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session?.user) location.replace('/'); });
    return () => data.subscription.unsubscribe();
  }, []);

  const amount = useMemo(() => HYPE_PRICES[size][period === 'dia' ? 'dia' : 'quadro'], [size, period]);

  async function loadRequests(uid = user?.id) {
    if (!uid) return;
    const { data } = await supabase.from('hype_solicitacoes').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(12);
    setRequests(data || []);
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return setMsg('Use JPG, PNG ou WEBP com até 5 MB.');
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/empresa-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('impulsionadores-avatars').upload(path, file, { upsert: false });
    if (error) { setUploading(false); return setMsg('Não foi possível enviar a logo.'); }
    const { data } = supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
    setLogoUrl(data.publicUrl); setUploading(false); setMsg('Logo recebida.');
  }

  async function submit(event) {
    event.preventDefault(); setMsg('');
    const form = new FormData(event.currentTarget);
    const cnpj = onlyDigits(form.get('cnpj'));
    const whatsapp = onlyDigits(form.get('whatsapp'));
    const discount = Number(form.get('desconto'));
    if (!validateCNPJ(cnpj)) return setMsg('CNPJ inválido. Revise os 14 dígitos.');
    if (whatsapp.length < 10) return setMsg('Informe um WhatsApp empresarial válido.');
    if (discount < 0 || discount > 30) return setMsg('O benefício pode ser de 0% a 30%.');
    if (!logoUrl) return setMsg('Envie a logo da empresa antes de continuar.');
    setBusy(true);
    const payload = {
      user_id: user.id, cnpj,
      razao_social: String(form.get('razao_social')).trim(), nome_fantasia: String(form.get('nome_fantasia')).trim(),
      responsavel: String(form.get('responsavel')).trim(), whatsapp,
      email: String(form.get('email')).trim().toLowerCase(), cidade: String(form.get('cidade')).trim(),
      uf: String(form.get('uf')).trim().toUpperCase().slice(0,2), segmento: String(form.get('segmento')).trim(),
      logo_url: logoUrl, instagram: String(form.get('instagram')).trim() || null, site_url: String(form.get('site')).trim() || null,
      desconto: discount, condicoes: String(form.get('condicoes')).trim() || null,
      beneficio_validade: String(form.get('beneficio_validade')) || null,
      tamanho: size, periodo: period, data_preferida: String(form.get('data_preferida')) || null,
    };
    const { data, error } = await supabase.from('hype_solicitacoes').insert(payload).select().single();
    setBusy(false);
    if (error) return setMsg(humanError(error.message));
    setRequest(data); await loadRequests();
  }

  async function reportPayment() {
    if (!request) return;
    const { error } = await supabase.from('hype_solicitacoes').update({ pagamento_informado_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', request.id);
    if (error) return setMsg('Não foi possível registrar a informação de pagamento.');
    const updated = { ...request, status:'pagamento_informado', payment_status:'informado', pagamento_informado_at:new Date().toISOString() };
    setRequest(updated); setMsg('Pagamento informado. A HOCCO fará a conferência antes da aprovação e entrada na fila.'); await loadRequests();
  }

  if (!user) return <div className="splash"><b>HOCCO</b><span>Preparando cadastro empresarial...</span></div>;

  if (request) return <RequestView request={request} onBack={()=>{setRequest(null);setMsg('')}} onReport={reportPayment} msg={msg}/>;

  return <main className="companyFlow"><header><button className="backIcon" onClick={()=>location.href='/app'}><ArrowLeft/></button><b className="logo">HOCCO</b><span className="pill">HYPE EMPRESAS</span></header><section className="companyShell">
    <div className="title"><small>HYPAR MINHA EMPRESA</small><h1>Coloque sua marca dentro da célula.</h1><p>Cadastro empresarial, benefício para a comunidade, escolha do quadro e solicitação comercial em um fluxo único.</p></div>
    <form className="companyForm" onSubmit={submit}>
      <fieldset><legend>1 · Empresa</legend><div className="formGrid"><label>CNPJ*<input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required/></label><label>Razão social*<input name="razao_social" required/></label><label>Nome fantasia*<input name="nome_fantasia" required/></label><label>Responsável*<input name="responsavel" required/></label><label>WhatsApp empresarial*<input name="whatsapp" inputMode="tel" required/></label><label>E-mail*<input name="email" type="email" defaultValue={user.email||''} required/></label><label>Cidade*<input name="cidade" required/></label><label>UF*<input name="uf" maxLength="2" required/></label><label>Segmento*<input name="segmento" placeholder="Restaurante, clínica, loja..." required/></label><label>Instagram<input name="instagram" placeholder="@empresa"/></label><label className="wide">Site<input name="site" placeholder="https://..."/></label></div></fieldset>
      <fieldset><legend>2 · Benefício HOCCO</legend><div className="formGrid"><label>Desconto oferecido (%)*<input name="desconto" type="number" min="0" max="30" step="1" defaultValue="10" required/></label><label>Validade do benefício<input name="beneficio_validade" type="date"/></label><label className="wide">Condições<textarea name="condicoes" placeholder="Ex.: válido de segunda a quinta, exceto feriados."/></label></div><p className="fieldHelp">Condições claras evitam divergências. O desconto informado é exibido como percentual real, sem prometer venda.</p></fieldset>
      <fieldset><legend>3 · Logo</legend><label className={`logoUpload ${logoUrl?'ready':''}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo}/>{logoUrl?<><img src={logoUrl} alt="Logo enviada"/><span><CheckCircle2/> Logo recebida</span></>:<><Upload/><b>{uploading?'ENVIANDO...':'ENVIAR LOGO'}</b><span>JPG, PNG ou WEBP · até 5 MB</span></>}</label></fieldset>
      <fieldset><legend>4 · Quadro e exposição</legend><div className="periodPicker"><button type="button" className={period==='almoco'?'active':''} onClick={()=>setPeriod('almoco')}><b>Almoço</b><span>11h–14h</span></button><button type="button" className={period==='tarde'?'active':''} onClick={()=>setPeriod('tarde')}><b>Tarde</b><span>14h–18h</span></button><button type="button" className={period==='noite'?'active':''} onClick={()=>setPeriod('noite')}><b>Noite</b><span>18h–22h</span></button><button type="button" className={period==='dia'?'active':''} onClick={()=>setPeriod('dia')}><b>Dia inteiro</b><span>3 quadros</span></button></div><div className="sizePicker">{['compacto','medio','grande','max'].map((key)=><button type="button" className={`${size===key?'active':''} visual-${key}`} onClick={()=>setSize(key)} key={key}><span className="sizeDemo">HOCCO</span><b>{key==='max'?'MAX':key.toUpperCase()}</b><strong>{brl(HYPE_PRICES[key][period==='dia'?'dia':'quadro'])}</strong></button>)}</div><p className="fieldHelp"><b>O preço compra exposição e tamanho visual, nunca Hypes ou vitória.</b></p><label>Data preferida<input name="data_preferida" type="date"/></label></fieldset>
      <div className="commercialSummary"><div><span>Participação selecionada</span><b>{size.toUpperCase()} · {period==='dia'?'DIA INTEIRO':HYPE_BOARDS[period].label.toUpperCase()}</b></div><strong>{brl(amount)}</strong></div>
      <label className="legalCheck"><input type="checkbox" required/><span>Li e aceito os <a href="/termos-empresa" target="_blank">Termos Comerciais do HOCCO Hype</a>.</span></label>
      {msg&&<div className="authMsg">{msg}</div>}<button className="primary" disabled={busy}>{busy?'CRIANDO SOLICITAÇÃO...':'CRIAR SOLICITAÇÃO E IR PARA O PIX'}</button>
    </form>
    {requests.length>0&&<section className="requestHistory"><small>MINHAS SOLICITAÇÕES</small>{requests.map((r)=><article key={r.id}><div><b>{r.nome_fantasia}</b><span>{r.payment_reference} · {r.periodo} · {brl(r.valor)}</span></div><div className="requestHistoryActions"><em>{statusLabel(r.status)}</em><button onClick={()=>setRequest(r)}>{r.status==='aguardando_pagamento'?'CONTINUAR PAGAMENTO':'VER'}</button></div></article>)}</section>}
  </section></main>;
}

function RequestView({request,onBack,onReport,msg}){
  const paymentOpen=['aguardando_pagamento','pagamento_informado'].includes(request.status);
  const code=paymentOpen?pixPayload(request.valor,request.payment_reference):null;
  return <main className="companyFlow"><header><button className="backIcon" onClick={onBack}><ArrowLeft/></button><b className="logo">HOCCO</b><span className="pill">ACOMPANHAMENTO</span></header><section className="companyShell"><div className="companyDone"><Zap/><small>SOLICITAÇÃO {request.payment_reference}</small><h1>{request.nome_fantasia}</h1><p>{statusDescription(request)}</p></div>
    {paymentOpen&&<div className="payPanel"><div className="payPrice"><span>Hype {request.tamanho} · {request.periodo==='dia'?'dia inteiro':HYPE_BOARDS[request.periodo]?.label}</span><strong>{brl(request.valor)}</strong></div><div className="qrbox"><QRCodeSVG value={code} size={190}/></div><button className="copyPay" onClick={()=>navigator.clipboard?.writeText(code)}><Copy/> COPIAR PIX COPIA E COLA</button><div className="payFacts"><span><small>RECEBEDOR</small><b>{PIX_RECEIVER}</b></span><span><small>INSTITUIÇÃO</small><b>{PIX_BANK}</b></span><span><small>CIDADE</small><b>{PIX_CITY} - SP</b></span><span><small>REFERÊNCIA</small><b>{request.payment_reference}</b></span></div><p className="fieldHelp">Confira o recebedor, a instituição e o valor antes de concluir o PIX.</p></div>}
    <div className="approvalPath"><ShieldCheck/><div><b>Andamento</b><ol><li>Solicitação criada.</li><li>Pagamento informado e conferido pela HOCCO.</li><li>CNPJ, materiais e benefício analisados.</li><li>Empresa programada na primeira vaga compatível, respeitando 10 empresas por quadro.</li><li>Após o Hype, a empresa recebe relatório individual.</li></ol></div></div>
    {request.motivo_recusa&&<div className="rejectReason">Motivo registrado: {request.motivo_recusa}</div>}
    {request.status==='aguardando_pagamento'&&<button className="primary" onClick={onReport}>JÁ FIZ O PIX · INFORMAR PAGAMENTO</button>}
    {request.status==='pagamento_informado'&&<button className="primary" disabled>PAGAMENTO INFORMADO · AGUARDANDO CONFERÊNCIA</button>}
    <a className="waSupport" href={whatsappUrl(HOCCO_WHATSAPP,`Olá! Sou responsável pela empresa ${request.nome_fantasia}. Minha solicitação HOCCO Hype é ${request.payment_reference}.`)} target="_blank" rel="noreferrer"><MessageCircle/> FALAR COM A HOCCO NO WHATSAPP</a>{msg&&<div className="authMsg">{msg}</div>}
  </section></main>
}

function statusLabel(status){return ({aguardando_pagamento:'Aguardando pagamento',pagamento_informado:'Pagamento informado',em_analise:'Em análise',aprovado:'Aprovado',programado:'Programado',recusado:'Recusado',reembolso_pendente:'Reembolso pendente',reembolsado:'Reembolsado',cancelado:'Cancelado'})[status]||String(status).replaceAll('_',' ')}
function statusDescription(r){const map={aguardando_pagamento:'Sua solicitação está criada. Conclua o PIX para seguir.',pagamento_informado:'Recebemos sua informação de pagamento e a HOCCO fará a conferência.',em_analise:'Pagamento confirmado. Cadastro, materiais e benefício estão em análise.',aprovado:'Sua participação foi aprovada e está sendo preparada.',programado:'Sua empresa já está programada para um Hype.',recusado:'A solicitação não foi aprovada. Consulte o motivo registrado abaixo.',reembolso_pendente:'O pedido está em processo de reembolso PIX.',reembolsado:'O reembolso foi marcado como concluído pela HOCCO.',cancelado:'Esta solicitação foi cancelada.'};return map[r.status]||'Acompanhe aqui cada etapa da sua solicitação.'}
function humanError(message=''){if(message.includes('invalid_hype_plan'))return'Plano de Hype inválido. Atualize a página e tente novamente.';if(message.includes('duplicate')||message.includes('unique'))return'Já existe um cadastro ou solicitação conflitante com estes dados.';return'Não foi possível criar a solicitação agora. Revise os dados e tente novamente.'}
