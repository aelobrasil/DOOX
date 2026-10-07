'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, CalendarDays, ExternalLink, Image as ImageIcon, Mail, MapPin, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { brl, whatsappUrl } from '../../lib/config';
import './request-detail.css';

export default function ControlRequestEnhancer(){
  const [requests,setRequests]=useState([]);
  const [selected,setSelected]=useState(null);
  const [logoFailed,setLogoFailed]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      const {data}=await supabase.from('hype_solicitacoes').select('*').order('created_at',{ascending:false}).limit(300);
      if(!cancelled)setRequests(data||[]);
    }
    load();
    const timer=setInterval(load,60000);
    return()=>{cancelled=true;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    const bind=()=>{
      document.querySelectorAll('.requestCard').forEach((card)=>{
        if(card.dataset.companyReviewBound==='1')return;
        const reference=card.querySelector('.requestMain small')?.textContent?.trim()||'';
        const request=requests.find((r)=>String(r.payment_reference||'').trim()===reference);
        if(!request)return;
        card.dataset.companyReviewBound='1';

        const strip=document.createElement('div');
        strip.className='requestReviewStrip';
        strip.dataset.hoccoInjected='company-review';

        const preview=document.createElement('div');
        preview.className='requestReviewPreview';
        if(request.logo_url){
          const img=document.createElement('img');
          img.src=request.logo_url;
          img.alt=`Logo enviada por ${request.nome_fantasia||'empresa'}`;
          img.loading='lazy';
          img.onerror=()=>{img.style.display='none';preview.classList.add('logoError');preview.textContent='LOGO';};
          preview.appendChild(img);
        }else{
          preview.classList.add('logoError');
          preview.textContent='SEM LOGO';
        }

        const info=document.createElement('div');
        info.className='requestReviewInfo';
        const label=document.createElement('b');
        label.textContent='Material enviado pela empresa';
        const note=document.createElement('small');
        note.textContent=request.logo_url?'Logo recebida · revise antes de programar':'Logo não encontrada · não programe antes de corrigir';
        info.append(label,note);

        const button=document.createElement('button');
        button.type='button';
        button.className='requestReviewButton';
        button.textContent='ANALISAR CADASTRO E LOGO';
        button.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();setLogoFailed(false);setSelected(request)});

        strip.append(preview,info,button);
        const actions=card.querySelector('.actions');
        if(actions)card.insertBefore(strip,actions);else card.appendChild(strip);
      });
    };
    bind();
    const observer=new MutationObserver(bind);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();document.querySelectorAll('[data-hocco-injected="company-review"]').forEach((el)=>el.remove())};
  },[requests]);

  useEffect(()=>{
    if(!selected)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onKey=(event)=>{if(event.key==='Escape')setSelected(null)};
    window.addEventListener('keydown',onKey);
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)};
  },[selected]);

  if(!selected||typeof document==='undefined')return null;

  const r=selected;
  const whatsapp=r.whatsapp?whatsappUrl(r.whatsapp,`Olá! Aqui é a equipe HOCCO sobre a solicitação ${r.payment_reference} da ${r.nome_fantasia}.`):null;

  return createPortal(<div className="requestDetailOverlay" role="dialog" aria-modal="true" aria-label={`Análise da empresa ${r.nome_fantasia}`} onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}}>
    <section className="requestDetailDrawer">
      <header className="requestDetailHead">
        <div><small>REVISÃO EMPRESARIAL · {r.payment_reference}</small><h2>{r.nome_fantasia||'Empresa'}</h2><p>Revise material, dados, benefício e pagamento antes de aprovar para o Hype.</p></div>
        <button type="button" aria-label="Fechar revisão" onClick={()=>setSelected(null)}><X/></button>
      </header>

      <div className="requestLogoReview">
        <div className={`requestLogoStage ${logoFailed||!r.logo_url?'failed':''}`}>
          {r.logo_url&&!logoFailed?<img src={r.logo_url} alt={`Logo de ${r.nome_fantasia}`} onError={()=>setLogoFailed(true)}/>:<><ImageIcon/><b>{r.logo_url?'Não foi possível carregar a imagem':'Nenhuma logo enviada'}</b><span>Não programe a empresa sem validar o material.</span></>}
        </div>
        <div className="requestLogoMeta"><small>MATERIAL PARA O QUADRO</small><h3>Logo enviada pela empresa</h3><p>Esta é a imagem que seguirá para a exibição no Hype quando a solicitação for aprovada.</p>{r.logo_url&&<a href={r.logo_url} target="_blank" rel="noreferrer"><ExternalLink/> Abrir imagem original</a>}</div>
      </div>

      <section className="requestDetailBlock"><div className="requestDetailTitle"><div><small>IDENTIFICAÇÃO</small><h3>Dados da empresa</h3></div><Building2/></div><div className="requestDataGrid">
        <Field label="Razão social" value={r.razao_social}/><Field label="Nome fantasia" value={r.nome_fantasia}/><Field label="CNPJ" value={formatCnpj(r.cnpj)}/><Field label="Responsável" value={r.responsavel}/><Field label="Segmento" value={r.segmento}/><Field label="Cidade / UF" value={[r.cidade,r.uf].filter(Boolean).join(' / ')}/>
      </div></section>

      <section className="requestDetailBlock"><div className="requestDetailTitle"><div><small>CONTATO</small><h3>Canais informados</h3></div><MessageCircle/></div><div className="requestDataGrid">
        <Field label="WhatsApp" value={r.whatsapp}/><Field label="E-mail" value={r.email}/><Field label="Instagram" value={r.instagram}/><Field label="Site" value={r.site_url}/>
      </div><div className="requestDetailActions">{whatsapp&&<a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/> Falar com a empresa</a>}{r.email&&<a href={`mailto:${r.email}`}><Mail/> Enviar e-mail</a>}{r.site_url&&<a href={safeUrl(r.site_url)} target="_blank" rel="noreferrer"><ExternalLink/> Abrir site</a>}</div></section>

      <section className="requestDetailBlock"><div className="requestDetailTitle"><div><small>BENEFÍCIO</small><h3>Oferta para membros HOCCO</h3></div><ShieldCheck/></div><div className="requestDataGrid">
        <Field label="Desconto" value={`${Number(r.desconto||0)}%`}/><Field label="Validade" value={formatDate(r.beneficio_validade)}/><Field label="Condições" value={r.condicoes}/><Field label="Data preferida" value={formatDate(r.data_preferida)}/>
      </div></section>

      <section className="requestDetailBlock"><div className="requestDetailTitle"><div><small>PARTICIPAÇÃO</small><h3>Quadro e financeiro</h3></div><CalendarDays/></div><div className="requestDataGrid">
        <Field label="Tamanho" value={human(r.tamanho)}/><Field label="Período" value={human(r.periodo)}/><Field label="Valor" value={brl(r.valor)}/><Field label="Pagamento" value={human(r.payment_status)}/><Field label="Status" value={human(r.status)}/><Field label="Solicitada em" value={formatDateTime(r.created_at)}/>
      </div></section>

      {r.motivo_recusa&&<div className="requestDetailWarning"><b>Motivo registrado</b><span>{r.motivo_recusa}</span></div>}
      <div className="requestDetailFooter"><ShieldCheck/><p><b>Revisão obrigatória antes do Hype.</b> Feche esta tela e use “Aprovar e programar” somente quando logo, cadastro, benefício e pagamento estiverem corretos.</p></div>
    </section>
  </div>,document.body);
}

function Field({label,value}){return <div className="requestField"><small>{label}</small><b>{value===null||value===undefined||value===''?'—':String(value)}</b></div>}
function human(value=''){return String(value||'—').replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase())}
function formatDate(value){if(!value)return'—';const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('pt-BR')}
function formatDateTime(value){if(!value)return'—';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('pt-BR')}
function formatCnpj(value=''){const d=String(value).replace(/\D/g,'').slice(0,14);if(d.length!==14)return value||'—';return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`}
function safeUrl(value=''){const raw=String(value).trim();return /^https?:\/\//i.test(raw)?raw:`https://${raw}`}
