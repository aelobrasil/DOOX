'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, CalendarDays, ExternalLink, Image as ImageIcon, Mail, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { brl, whatsappUrl } from '../../lib/config';
import './request-detail.css';

export default function ControlRequestEnhancer(){
  const [requests,setRequests]=useState([]);
  const [selected,setSelected]=useState(null);
  const [coverFailed,setCoverFailed]=useState(false);
  const [logoFailed,setLogoFailed]=useState(false);

  useEffect(()=>{let cancelled=false;async function load(){const {data}=await supabase.from('hype_solicitacoes').select('*').order('created_at',{ascending:false}).limit(300);if(!cancelled)setRequests(data||[])}load();const timer=setInterval(load,60000);return()=>{cancelled=true;clearInterval(timer)}},[]);

  useEffect(()=>{
    const bind=()=>document.querySelectorAll('.requestCard').forEach((card)=>{
      if(card.dataset.companyReviewBound==='1')return;
      const reference=card.querySelector('.requestMain small')?.textContent?.trim()||'';
      const request=requests.find((r)=>String(r.payment_reference||'').trim()===reference);if(!request)return;
      card.dataset.companyReviewBound='1';
      const strip=document.createElement('div');strip.className='requestReviewStrip';strip.dataset.hoccoInjected='company-review';
      const preview=document.createElement('div');preview.className='requestReviewPreview';
      const imageUrl=request.capa_url||request.logo_url;
      if(imageUrl){const img=document.createElement('img');img.src=imageUrl;img.alt=`Material enviado por ${request.nome_fantasia||'empresa'}`;img.loading='lazy';img.onerror=()=>{img.style.display='none';preview.classList.add('logoError');preview.textContent='IMAGEM'};preview.appendChild(img)}else{preview.classList.add('logoError');preview.textContent='SEM IMAGENS'}
      const info=document.createElement('div');info.className='requestReviewInfo';const label=document.createElement('b');label.textContent='Materiais enviados pela empresa';const note=document.createElement('small');note.textContent=request.capa_url&&request.logo_url?'Capa + perfil/logo recebidos · revise antes de SUBIR':'Material incompleto · capa e perfil/logo são obrigatórios';info.append(label,note);
      const button=document.createElement('button');button.type='button';button.className='requestReviewButton';button.textContent='ANALISAR CADASTRO E IMAGENS';button.onclick=(event)=>{event.preventDefault();event.stopPropagation();setCoverFailed(false);setLogoFailed(false);setSelected(request)};
      strip.append(preview,info,button);const actions=card.querySelector('.actions');if(actions)card.insertBefore(strip,actions);else card.appendChild(strip);
    });
    bind();const observer=new MutationObserver(bind);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();document.querySelectorAll('[data-hocco-injected="company-review"]').forEach((el)=>el.remove())};
  },[requests]);

  useEffect(()=>{if(!selected)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(e)=>{if(e.key==='Escape')setSelected(null)};window.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)}},[selected]);

  if(!selected||typeof document==='undefined')return null;
  const r=selected;const whatsapp=r.whatsapp?whatsappUrl(r.whatsapp,`Olá! Aqui é a equipe HOCCO sobre a solicitação ${r.payment_reference} da ${r.nome_fantasia}.`):null;

  return createPortal(<div className="requestDetailOverlay" role="dialog" aria-modal="true" aria-label={`Análise da empresa ${r.nome_fantasia}`} onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="requestDetailDrawer">
    <header className="requestDetailHead"><div><small>REVISÃO EMPRESARIAL · {r.payment_reference}</small><h2>{r.nome_fantasia||'Empresa'}</h2><p>Revise capa, perfil/logo, dados, benefício e pagamento. A publicação ocorre somente em Última revisão → SUBIR.</p></div><button type="button" aria-label="Fechar revisão" onClick={()=>setSelected(null)}><X/></button></header>

    <div style={{display:'grid',gridTemplateColumns:'1.4fr .8fr',gap:12,marginBottom:14}}>
      <Media title="FOTO DE CAPA" url={r.capa_url} failed={coverFailed} onFail={()=>setCoverFailed(true)} cover/>
      <Media title="PERFIL / LOGO" url={r.logo_url} failed={logoFailed} onFail={()=>setLogoFailed(true)}/>
    </div>
    {(!r.capa_url||!r.logo_url)&&<div className="requestDetailWarning"><b>Material incompleto</b><span>Não use SUBIR até existir foto de capa e foto de perfil/logo.</span></div>}

    <Block icon={Building2} eyebrow="IDENTIFICAÇÃO" title="Dados da empresa"><div className="requestDataGrid"><Field label="Razão social" value={r.razao_social}/><Field label="Nome fantasia" value={r.nome_fantasia}/><Field label="CNPJ" value={formatCnpj(r.cnpj)}/><Field label="Responsável" value={r.responsavel}/><Field label="Segmento" value={r.segmento}/><Field label="Cidade / UF" value={[r.cidade,r.uf].filter(Boolean).join(' / ')}/></div></Block>
    <Block icon={MessageCircle} eyebrow="CONTATO" title="Canais informados"><div className="requestDataGrid"><Field label="WhatsApp" value={r.whatsapp}/><Field label="E-mail" value={r.email}/><Field label="Instagram" value={r.instagram}/><Field label="Site" value={r.site_url}/></div><div className="requestDetailActions">{whatsapp&&<a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/> Falar com a empresa</a>}{r.email&&<a href={`mailto:${r.email}`}><Mail/> Enviar e-mail</a>}{r.site_url&&<a href={safeUrl(r.site_url)} target="_blank" rel="noreferrer"><ExternalLink/> Abrir site</a>}</div></Block>
    <Block icon={ShieldCheck} eyebrow="BENEFÍCIO" title="Oferta potencial"><div className="requestDataGrid"><Field label="Desconto se vencer" value={`${Number(r.desconto||0)}%`}/><Field label="Validade" value={formatDate(r.beneficio_validade)}/><Field label="Condições" value={r.condicoes}/><Field label="Data preferida" value={formatDate(r.data_preferida)}/></div></Block>
    <Block icon={CalendarDays} eyebrow="PARTICIPAÇÃO" title="Quadro e financeiro"><div className="requestDataGrid"><Field label="Tamanho" value={human(r.tamanho)}/><Field label="Período" value={r.periodo==='dia'?'Quadro 2 · Dia inteiro':`Quadro 1 · ${human(r.periodo)}`}/><Field label="Valor" value={brl(r.valor)}/><Field label="Pagamento" value={human(r.payment_status)}/><Field label="Status" value={human(r.status)}/><Field label="Solicitada em" value={formatDateTime(r.created_at)}/></div></Block>
    {r.motivo_recusa&&<div className="requestDetailWarning"><b>Motivo registrado</b><span>{r.motivo_recusa}</span></div>}
    <div className="requestDetailFooter"><ShieldCheck/><p><b>Revisão obrigatória.</b> Feche esta tela e abra “Última revisão”. Apenas o botão SUBIR publica a empresa para os membros.</p></div>
  </section></div>,document.body);
}

function Media({title,url,failed,onFail,cover=false}){return <div style={{background:'#fff',border:'1px solid #dfe7f0',borderRadius:18,padding:10}}><small style={{fontSize:9,fontWeight:950,color:'#71839b'}}>{title}</small><div style={{height:cover?170:120,marginTop:7,borderRadius:13,background:'#eef2f7',overflow:'hidden',display:'grid',placeItems:'center'}}>{url&&!failed?<img src={url} alt={title} onError={onFail} style={{width:'100%',height:'100%',objectFit:cover?'cover':'contain'}}/>:<><ImageIcon/><b style={{fontSize:10}}>NÃO RECEBIDA</b></>}</div>{url&&<a href={url} target="_blank" rel="noreferrer" style={{display:'inline-flex',gap:5,alignItems:'center',marginTop:8,fontSize:10,fontWeight:900,color:'#075eea'}}><ExternalLink size={13}/> Abrir original</a>}</div>}
function Block({icon:Icon,eyebrow,title,children}){return <section className="requestDetailBlock"><div className="requestDetailTitle"><div><small>{eyebrow}</small><h3>{title}</h3></div><Icon/></div>{children}</section>}
function Field({label,value}){return <div className="requestField"><small>{label}</small><b>{value===null||value===undefined||value===''?'—':String(value)}</b></div>}
function human(value=''){return String(value||'—').replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase())}
function formatDate(value){if(!value)return'—';const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('pt-BR')}
function formatDateTime(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('pt-BR')}
function formatCnpj(value=''){const d=String(value).replace(/\D/g,'').slice(0,14);if(d.length!==14)return value||'—';return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`}
function safeUrl(value=''){const raw=String(value).trim();return /^https?:\/\//i.test(raw)?raw:`https://${raw}`}
