'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Image as ImageIcon, Tag } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_RECEIVER, PIX_BANK, PIX_CITY, brl, onlyDigits, validateCNPJ, todayBR } from '../../lib/config';
import { pixPayload } from '../../lib/pix';

const PRICE=39.90;
const MAX_SOURCE=8*1024*1024;
const WAITING=new Set(['aguardando_pagamento','pagamento_informado']);

function newDraft(){return crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
function tomorrowBR(){const d=new Date(`${todayBR()}T12:00:00-03:00`);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}
async function compress(file,kind){const bitmap=await createImageBitmap(file);const max=kind==='cover'?1400:700;const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d',{alpha:true}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();for(const q of [0.88,0.76,0.64,0.52]){const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',q));if(blob&&blob.size<=(kind==='cover'?900000:500000))return blob}throw new Error('media_too_large')}

export default function OfferBusinessFlow(){
  const [user,setUser]=useState(null);
  const [logo,setLogo]=useState('');
  const [cover,setCover]=useState('');
  const [uploading,setUploading]=useState(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [current,setCurrent]=useState(null);
  const [rows,setRows]=useState([]);
  const draft=useRef(newDraft());

  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user)location.replace('/');else{setUser(data.user);load(data.user.id)}});const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session?.user)location.replace('/')});return()=>data.subscription.unsubscribe()},[]);
  async function load(uid=user?.id){if(!uid)return;const {data}=await supabase.from('hocco_oferta_solicitacoes').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(30);setRows(data||[])}

  async function uploadMedia(event,kind){const file=event.target.files?.[0];if(!file||!user)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX_SOURCE)return setMsg('Use JPG, PNG ou WEBP de até 8 MB.');setUploading(kind);setMsg('Otimizando imagem...');try{const blob=await compress(file,kind);const path=`${user.id}/offers/${draft.current}/${kind}.webp`;const {error}=await supabase.storage.from('impulsionadores-avatars').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'31536000'});if(error)throw error;const {data}=supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);const url=`${data.publicUrl}?v=${Date.now()}`;if(kind==='cover')setCover(url);else setLogo(url);setMsg(`${kind==='cover'?'Capa':'Logo'} recebido.`)}catch(e){setMsg('Não foi possível processar a imagem. Tente outra foto.')}finally{setUploading(null)}}

  async function submit(event){event.preventDefault();if(!logo||!cover)return setMsg('Envie o logo e a capa da oferta.');const form=new FormData(event.currentTarget);const cnpj=onlyDigits(form.get('cnpj')),whatsapp=onlyDigits(form.get('whatsapp')),url=String(form.get('destino_url')||'').trim();if(!validateCNPJ(cnpj))return setMsg('CNPJ inválido.');if(whatsapp.length<10)return setMsg('WhatsApp inválido.');if(!/^https:\/\//i.test(url))return setMsg('O link de destino deve começar por https://');if(form.get('terms')!=='on')return setMsg('Aceite os Termos Comerciais para continuar.');setBusy(true);const payload={user_id:user.id,cnpj,razao_social:String(form.get('razao_social')||'').trim()||null,nome_fantasia:String(form.get('nome_fantasia')||'').trim(),responsavel:String(form.get('responsavel')||'').trim(),whatsapp,email:String(form.get('email')||'').trim().toLowerCase(),cidade:String(form.get('cidade')||'').trim()||null,uf:String(form.get('uf')||'').trim().toUpperCase().slice(0,2)||null,segmento:String(form.get('segmento')||'').trim()||null,logo_url:logo,capa_url:cover,instagram:String(form.get('instagram')||'').trim()||null,categoria:String(form.get('categoria')||'').trim(),titulo:String(form.get('titulo')||'').trim(),oferta_texto:String(form.get('oferta_texto')||'').trim(),descricao:String(form.get('descricao')||'').trim()||null,destino_url:url,display_date:String(form.get('display_date')),valor:PRICE,payment_status:'aguardando',status:'aguardando_pagamento'};const {data,error}=await supabase.from('hocco_oferta_solicitacoes').insert(payload).select().single();setBusy(false);if(error)return setMsg(error.message?.includes('offer_day_full')?'As vagas desta data estão completas. Escolha outro dia.':'Não foi possível criar a oferta. Revise os dados e tente novamente.');setCurrent(data);setLogo('');setCover('');draft.current=newDraft();event.currentTarget.reset();await load();setMsg('Oferta criada. Faça o PIX e informe o pagamento para seguir para revisão HOCCO.')}

  async function report(row=current){if(!row)return;const {data,error}=await supabase.rpc('informar_pagamento_oferta',{p_id:row.id});if(error)return setMsg('Não foi possível informar o pagamento.');const updated=data||{...row,status:'pagamento_informado',payment_status:'informado'};setCurrent(updated);setRows(list=>list.map(x=>x.id===row.id?updated:x));setMsg('Pagamento informado. A HOCCO fará a conferência antes da publicação.')}

  if(!user)return <div className="ofbiz-splash"><b>HOCCO Hype</b><span>Preparando sua oferta...</span></div>;
  return <main className="ofbiz-page"><header><button onClick={()=>location.href='/app'}><ArrowLeft/></button><div><b>HOCCO</b><i>Hype</i></div><span>EMPRESAS</span></header><section className="ofbiz-shell">
    <div className="ofbiz-hero"><small>OFERTAS DO MOMENTO</small><h1>Mostre sua promoção para a comunidade HOCCO.</h1><p>Logo, foto, oferta e link direto por um dia. Sem disputa de ranking: sua promoção fica disponível para os membros durante a data aprovada.</p><div><b>{brl(PRICE)}</b><span>por dia</span><em>até 50 ofertas / dia</em></div></div>

    <form className="ofbiz-form" onSubmit={submit}>
      <fieldset><legend>1 · Empresa</legend><div className="ofbiz-grid"><label>CNPJ*<input name="cnpj" inputMode="numeric" required/></label><label>Razão social<input name="razao_social"/></label><label>Nome fantasia*<input name="nome_fantasia" minLength="2" maxLength="100" required/></label><label>Responsável*<input name="responsavel" required/></label><label>WhatsApp*<input name="whatsapp" inputMode="tel" required/></label><label>E-mail*<input name="email" type="email" defaultValue={user.email||''} required/></label><label>Cidade<input name="cidade"/></label><label>UF<input name="uf" maxLength="2"/></label><label>Segmento<input name="segmento" placeholder="Restaurante, academia, loja..."/></label><label>Instagram / @<input name="instagram" placeholder="@empresa"/></label></div></fieldset>
      <fieldset><legend>2 · Oferta</legend><div className="ofbiz-grid"><label>Categoria*<select name="categoria" required><option value="Alimentação">Alimentação</option><option value="Serviços">Serviços</option><option value="Bem-estar">Bem-estar</option><option value="Beleza">Beleza</option><option value="Saúde">Saúde</option><option value="Mercado">Mercado</option><option value="Educação">Educação</option><option value="Varejo">Varejo</option><option value="Outros">Outros</option></select></label><label>Data de exibição*<input name="display_date" type="date" min={todayBR()} defaultValue={tomorrowBR()} required/></label><label className="wide">Oferta em destaque*<input name="oferta_texto" minLength="3" maxLength="180" placeholder="Ex.: 30% de desconto em pizzas grandes" required/></label><label className="wide">Título curto*<input name="titulo" minLength="3" maxLength="100" placeholder="Ex.: Só hoje na HOCCO" required/></label><label className="wide">Descrição<textarea name="descricao" maxLength="300" placeholder="Condições essenciais da promoção."/></label><label className="wide">Link de destino*<input name="destino_url" type="url" placeholder="https://wa.me/... ou https://instagram.com/..." required/></label></div></fieldset>
      <fieldset><legend>3 · Visual</legend><p className="ofbiz-help">A capa apresenta a promoção; o logo identifica a empresa.</p><div className="ofbiz-media"><Media kind="cover" url={cover} busy={uploading} onChange={uploadMedia}/><Media kind="logo" url={logo} busy={uploading} onChange={uploadMedia}/></div></fieldset>
      <section className="ofbiz-summary"><Tag/><div><small>OFERTA POR 1 DIA</small><b>Exibição + clique direto para a empresa</b><span>Pagamento confirmado e revisão HOCCO antes da publicação.</span></div><strong>{brl(PRICE)}</strong></section>
      <label className="ofbiz-check"><input name="terms" type="checkbox" required/><span>Li e aceito os <a href="/termos-empresa" target="_blank">Termos Comerciais</a>. A publicação depende de pagamento confirmado, revisão e disponibilidade da data.</span></label>
      {msg&&<div className="ofbiz-msg">{msg}</div>}<button className="ofbiz-primary" disabled={busy||Boolean(uploading)}>{busy?'CRIANDO OFERTA...':`CRIAR OFERTA · ${brl(PRICE)}`}</button>
    </form>

    {current&&<Payment row={current} onReport={()=>report(current)} setMsg={setMsg}/>} 
    {!!rows.length&&<section className="ofbiz-history"><div><small>MINHAS OFERTAS</small><h2>Acompanhe seus pedidos</h2></div>{rows.map(r=><button key={r.id} onClick={()=>setCurrent(r)}><span><b>{r.oferta_texto}</b><small>{r.payment_reference} · {String(r.status).replaceAll('_',' ')} · {new Date(`${r.display_date}T12:00:00-03:00`).toLocaleDateString('pt-BR')}</small></span><strong>{brl(r.valor)}</strong></button>)}</section>}
    <button className="ofbiz-sponsor" onClick={()=>location.href='/patrocinar-app'}><Tag/><span><b>Quer presença permanente no app?</b><small>Conheça os 5 quadros de Marcas Permanentes.</small></span></button>
  </section></main>;
}

function Media({kind,url,busy,onChange}){const cover=kind==='cover';return <label className={`ofbiz-upload ${url?'ready':''}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>onChange(e,kind)}/>{url?<><img src={url} alt="" className={cover?'cover':'logo'}/><span><CheckCircle2/> {cover?'Capa':'Logo'} recebido</span></>:<><ImageIcon/><b>{busy===kind?'OTIMIZANDO...':cover?'ENVIAR CAPA':'ENVIAR LOGO'}</b><small>JPG, PNG ou WEBP</small></>}</label>}
function Payment({row,onReport,setMsg}){const code=pixPayload(row.valor,row.payment_reference);return <section className="ofbiz-payment"><div><small>PIX DA OFERTA</small><h2>{brl(row.valor)}</h2><p>Recebedor: <b>{PIX_RECEIVER}</b><br/>Instituição: <b>{PIX_BANK}</b><br/>Cidade: {PIX_CITY} - SP<br/>Referência: <b>{row.payment_reference}</b></p><p>Informar pagamento não significa confirmação. A HOCCO confere o recebimento antes de publicar.</p></div><div><QRCodeSVG value={code} size={170}/><button onClick={async()=>{await navigator.clipboard?.writeText(code);setMsg('PIX copiado.')}}><Copy/> COPIAR PIX</button></div>{WAITING.has(row.status)&&row.payment_status!=='informado'&&<button className="ofbiz-primary" onClick={onReport}>JÁ FIZ O PIX · INFORMAR PAGAMENTO</button>}</section>}
