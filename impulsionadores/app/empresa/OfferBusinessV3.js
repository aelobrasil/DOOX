'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Image as ImageIcon, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, onlyDigits, validateCNPJ } from '../../lib/config';
import { pixPayload } from '../../lib/pix';
import './offer-business-v3.css';

const PRICE = 39.90;
const TERMS_VERSION = '1.3-2026-10-13';
const MAX_SOURCE = 8 * 1024 * 1024;
const CLOSED = new Set(['aprovado','ativo','encerrado','recusado','cancelado','reembolsado']);

function draftId(){ return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

async function compress(file, kind) {
  const bitmap = await createImageBitmap(file);
  const maxSide = kind === 'cover' ? 1500 : 700;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha:true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const limit = kind === 'cover' ? 900*1024 : 450*1024;
  for (const q of [0.88,0.78,0.68,0.58]) {
    const blob = await new Promise((resolve)=>canvas.toBlob(resolve,'image/webp',q));
    if (blob && blob.size <= limit) return blob;
  }
  const blob = await new Promise((resolve)=>canvas.toBlob(resolve,'image/webp',0.48));
  if (!blob || blob.size > limit) throw new Error('media_too_large');
  return blob;
}

export default function OfferBusinessV3(){
  const [user,setUser]=useState(null);
  const [logo,setLogo]=useState('');
  const [cover,setCover]=useState('');
  const [uploading,setUploading]=useState(null);
  const [rows,setRows]=useState([]);
  const [payment,setPayment]=useState(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const draft=useRef(null);

  useEffect(()=>{
    draft.current=draftId();
    supabase.auth.getUser().then(({data})=>{
      if(!data.user) return location.replace('/');
      setUser(data.user);load(data.user.id);
    });
  },[]);

  async function load(uid=user?.id){
    if(!uid)return;
    const {data}=await supabase.from('hocco_oferta_solicitacoes').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(30);
    setRows(data||[]);
  }

  async function upload(event,kind){
    const file=event.target.files?.[0];
    if(!file||!user)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX_SOURCE)return setMsg('Use JPG, PNG ou WEBP de até 8 MB.');
    setUploading(kind);setMsg('Otimizando imagem...');
    try{
      const blob=await compress(file,kind);
      const path=`${user.id}/offers/${draft.current}/${kind}.webp`;
      const {error}=await supabase.storage.from('impulsionadores-avatars').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'31536000'});
      if(error)throw error;
      const {data}=supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);
      const url=`${data.publicUrl}?v=${Date.now()}`;
      if(kind==='cover')setCover(url);else setLogo(url);
      setMsg(`${kind==='cover'?'Capa':'Logo'} recebido.`);
    }catch(e){console.error(e);setMsg('Não foi possível processar essa imagem.');}
    finally{setUploading(null)}
  }

  async function submit(event){
    event.preventDefault();setMsg('');
    if(!user)return;
    if(!logo||!cover)return setMsg('Envie logo e foto de capa da oferta.');
    const form=new FormData(event.currentTarget);
    const cnpj=onlyDigits(form.get('cnpj'));
    const whatsapp=onlyDigits(form.get('whatsapp'));
    const link=String(form.get('destino_url')||'').trim();
    if(!validateCNPJ(cnpj))return setMsg('CNPJ inválido.');
    if(whatsapp.length<10)return setMsg('WhatsApp inválido.');
    if(!/^https:\/\//i.test(link))return setMsg('O link deve começar com https://');
    if(form.get('terms')!=='on')return setMsg('Aceite os Termos Comerciais para continuar.');
    const payload={
      user_id:user.id,cnpj,
      razao_social:String(form.get('razao_social')||'').trim(),
      nome_fantasia:String(form.get('nome_fantasia')||'').trim(),
      responsavel:String(form.get('responsavel')||'').trim(),whatsapp,
      email:String(form.get('email')||'').trim().toLowerCase(),
      cidade:String(form.get('cidade')||'').trim(),uf:String(form.get('uf')||'').trim().toUpperCase().slice(0,2),
      segmento:String(form.get('segmento')||'').trim(),logo_url:logo,capa_url:cover,
      instagram:String(form.get('instagram')||'').trim()||null,
      categoria:String(form.get('categoria')||'').trim(),titulo:String(form.get('titulo')||'').trim(),
      oferta_texto:String(form.get('oferta_texto')||'').trim(),descricao:String(form.get('descricao')||'').trim()||null,
      destino_url:link,display_date:String(form.get('display_date')||'')||null,valor:PRICE,
      payment_status:'aguardando',status:'aguardando_pagamento'
    };
    if(payload.nome_fantasia.length<2||payload.titulo.length<3||payload.oferta_texto.length<3)return setMsg('Revise nome, título e texto da oferta.');
    setBusy(true);
    const {data,error}=await supabase.from('hocco_oferta_solicitacoes').insert(payload).select().single();
    if(!error){await supabase.from('impulsionadores_aceites').insert({user_id:user.id,documento:'termos_ofertas_empresa',versao:TERMS_VERSION});}
    setBusy(false);
    if(error)return setMsg(human(error.message));
    setPayment(data);setLogo('');setCover('');draft.current=draftId();event.currentTarget.reset();await load();
  }

  async function reportPaid(row=payment){
    if(!row)return;
    const {data,error}=await supabase.rpc('informar_pagamento_oferta',{p_id:row.id});
    if(error)return setMsg('Não foi possível informar o pagamento.');
    setPayment(data||null);setMsg('Pagamento informado. A HOCCO fará a conferência antes da publicação.');await load();
  }

  async function copy(text){try{await navigator.clipboard.writeText(text);setMsg('PIX copiado.')}catch{setMsg('Selecione e copie o código PIX manualmente.')}}

  if(!user)return <div className="offerBizSplash"><b>HOCCO <i>Hype</i></b><span>Preparando área empresarial...</span></div>;

  return <main className="offerBiz">
    <header><button onClick={()=>location.href='/app'}><ArrowLeft/></button><div className="offerBizBrand"><b>HOCCO</b><i>Hype</i><span>EMPRESAS</span></div><a href="/patrocinar-app">MARCAS PERMANENTES</a></header>
    <section className="offerBizShell">
      <div className="offerBizHero"><div><small>OFERTAS DO MOMENTO</small><h1>Mostre sua promoção para a comunidade HOCCO.</h1><p>Logo, capa, oferta e link direto por um dia. Até 50 empresas podem aparecer por dia.</p></div><div><span>1 DIA</span><b>{brl(PRICE)}</b><small>preço fixo</small></div></div>

      <form onSubmit={submit} className="offerBizForm">
        <fieldset><legend>1 · Empresa</legend><div className="offerBizGrid"><label>CNPJ*<input name="cnpj" required/></label><label>Razão social*<input name="razao_social" required/></label><label>Nome fantasia*<input name="nome_fantasia" required/></label><label>Responsável*<input name="responsavel" required/></label><label>WhatsApp*<input name="whatsapp" required/></label><label>E-mail*<input type="email" name="email" defaultValue={user.email||''} required/></label><label>Cidade*<input name="cidade" required/></label><label>UF*<input name="uf" maxLength="2" required/></label><label>Segmento*<input name="segmento" required/></label><label>Instagram / @<input name="instagram" placeholder="@empresa"/></label></div></fieldset>

        <fieldset><legend>2 · Oferta</legend><div className="offerBizGrid"><label>Categoria*<input name="categoria" placeholder="Alimentação, beleza, serviços..." required/></label><label>Data de exibição*<input name="display_date" type="date" required/></label><label className="wide">Título*<input name="titulo" placeholder="Oferta especial de hoje" maxLength="100" required/></label><label className="wide">Oferta / desconto*<input name="oferta_texto" placeholder="30% de desconto em pizzas selecionadas" maxLength="180" required/></label><label className="wide">Descrição<textarea name="descricao" placeholder="Condições e detalhes que o membro precisa saber."/></label><label className="wide">Link de destino*<input type="url" name="destino_url" placeholder="https://wa.me/... ou https://instagram.com/..." required/></label></div></fieldset>

        <fieldset><legend>3 · Imagens</legend><div className="offerBizMedia"><Media kind="logo" url={logo} uploading={uploading} onChange={upload}/><Media kind="cover" url={cover} uploading={uploading} onChange={upload}/></div></fieldset>

        <section className="offerBizSummary"><div><Tag/><span><b>Oferta do Momento</b><small>1 dia · até 50 empresas no dia escolhido</small></span></div><strong>{brl(PRICE)}</strong></section>
        <label className="offerBizTerms"><input type="checkbox" name="terms" required/><span>Li e aceito os <a href="/termos-empresa" target="_blank">Termos Comerciais</a> · versão 1.3.</span></label>
        {msg&&<div className="offerBizMsg">{msg}</div>}
        <button className="offerBizPrimary" disabled={busy||Boolean(uploading)}>{busy?'CRIANDO SOLICITAÇÃO...':`CRIAR OFERTA · ${brl(PRICE)}`}</button>
      </form>

      {payment&&<Payment row={payment} copy={copy} paid={reportPaid}/>} 

      {!!rows.length&&<section className="offerBizHistory"><h2>Minhas ofertas</h2>{rows.map((r)=><article key={r.id}><div>{r.logo_url?<img src={r.logo_url} alt=""/>:<Tag/>}</div><span><b>{r.nome_fantasia}</b><small>{r.oferta_texto}</small><em>{r.payment_reference} · {status(r.status)} · {r.display_date||'sem data'}</em></span><strong>{brl(r.valor)}</strong>{!CLOSED.has(r.status)&&r.payment_status==='aguardando'&&<button onClick={()=>setPayment(r)}>VER PIX</button>}</article>)}</section>}
    </section>
  </main>;
}

function Media({kind,url,uploading,onChange}){const cover=kind==='cover';return <label className={`offerBizUpload ${url?'ready':''}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>onChange(e,kind)}/>{url?<><img src={url} alt="" className={cover?'cover':'logo'}/><span><CheckCircle2/> {cover?'Capa':'Logo'} recebido</span></>:<><ImageIcon/><b>{uploading===kind?'OTIMIZANDO...':cover?'ENVIAR CAPA':'ENVIAR LOGO'}</b><small>JPG, PNG ou WEBP</small></>}</label>}
function Payment({row,copy,paid}){const code=pixPayload(row.valor,row.payment_reference);return <section className="offerBizPayment"><div><small>PAGAMENTO</small><h2>{row.nome_fantasia}</h2><p>Referência {row.payment_reference}</p><b>{brl(row.valor)}</b><span>{PIX_RECEIVER}</span><span>{PIX_BANK}</span><span>{PIX_CITY}</span></div><QRCodeSVG value={code} size={190}/><div className="offerBizPix"><textarea readOnly value={code}/><button onClick={()=>copy(code)}><Copy/> COPIAR PIX</button>{row.payment_status==='aguardando'&&<button className="primary" onClick={()=>paid(row)}>JÁ FIZ O PIX</button>}</div></section>}
function status(s){return ({aguardando_pagamento:'AGUARDANDO PAGAMENTO',pagamento_informado:'PAGAMENTO INFORMADO',em_analise:'EM ANÁLISE',aprovado:'APROVADA',ativo:'ATIVA',encerrado:'ENCERRADA',recusado:'RECUSADA',reembolso_pendente:'REEMBOLSO PENDENTE',reembolsado:'REEMBOLSADA'})[s]||String(s||'').toUpperCase()}
function human(v=''){if(v.includes('offer_day_full'))return 'O dia escolhido já atingiu 50 ofertas.';if(v.includes('violates row-level security'))return 'Não foi possível criar a solicitação com esta conta.';return v||'Não foi possível concluir.'}
