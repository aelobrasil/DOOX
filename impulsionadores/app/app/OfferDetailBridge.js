'use client';

import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,ExternalLink,Tag,X} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import './offer-detail-bridge.css';

function readOffer(card){
  const company=card.querySelector('.hfCompany');
  const body=card.querySelector('.hfOfferBody');
  const cover=card.querySelector('.hfOfferImg img');
  const logo=company?.querySelector('img');
  const companyText=company?.querySelector('b')?.textContent?.trim()||'Parceiro HOCCO';
  const companySub=company?.querySelector('small')?.textContent?.trim()||'';
  const category=company?.querySelector('em')?.textContent?.trim()||'Oferta';
  const title=body?.querySelector('h3')?.textContent?.trim()||'Oferta HOCCO';
  const description=body?.querySelector('p')?.textContent?.trim()||'';
  const validity=[...body?.querySelectorAll('small')||[]].map(x=>x.textContent?.trim()).find(Boolean)||'Oferta válida hoje';
  return {id:card.dataset.offerId,company:companyText,companySub,category,title,description,validity,cover:cover?.src||'',logo:logo?.src||''};
}

export default function OfferDetailBridge(){
  const [offer,setOffer]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const timer=useRef(null);

  useEffect(()=>{
    const capture=async(event)=>{
      const button=event.target?.closest?.('.hoccoFinal .hfOffer button');
      if(!button||!button.textContent?.toLowerCase().includes('ver oferta'))return;
      const card=button.closest('.hfOffer[data-offer-id]');
      if(!card?.dataset.offerId)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const data=readOffer(card);
      setBusy(true);setNotice('');
      const {error}=await supabase.rpc('registrar_oferta_evento',{p_oferta_id:data.id,p_event:'open'});
      setBusy(false);
      if(error){setNotice('Esta oferta não está disponível agora.');clearTimeout(timer.current);timer.current=setTimeout(()=>setNotice(''),3200);return;}
      setOffer(data);
      const progress=await supabase.rpc('oferta_missao_progresso');
      const count=Math.min(5,Number(progress.data?.count||0));
      document.querySelectorAll('.hfMissionFeature').forEach(box=>{
        const counter=box.querySelector(':scope > b'); if(counter)counter.textContent=`${count}/5`;
        const fill=box.querySelector('i em'); if(fill)fill.style.width=`${count*20}%`;
      });
    };
    document.addEventListener('click',capture,true);
    return()=>{document.removeEventListener('click',capture,true);clearTimeout(timer.current)};
  },[]);

  async function outbound(){
    if(!offer||busy)return;
    const popup=window.open('','_blank','noopener,noreferrer');
    setBusy(true);setNotice('');
    const {data,error}=await supabase.rpc('registrar_oferta_evento',{p_oferta_id:offer.id,p_event:'outbound_click'});
    setBusy(false);
    if(error||!data){popup?.close();setNotice('O destino desta oferta não está disponível agora.');return;}
    if(popup)popup.location.href=data; else location.href=data;
  }

  return <>{offer&&<div className="offerDetailBackdrop" onClick={()=>setOffer(null)} role="presentation"><section className="offerDetailCard" role="dialog" aria-modal="true" aria-label={`Oferta de ${offer.company}`} onClick={e=>e.stopPropagation()}><button className="offerDetailClose" onClick={()=>setOffer(null)} aria-label="Fechar detalhes da oferta"><X/></button><div className="offerDetailCover">{offer.cover?<img src={offer.cover} alt=""/>:<Tag/>}</div><div className="offerDetailBody"><div className="offerDetailCompany">{offer.logo?<img src={offer.logo} alt=""/>:<span>{offer.company[0]||'H'}</span>}<div><b>{offer.company}</b><small>{offer.companySub}</small></div><em>{offer.category}</em></div><small className="offerDetailLabel">OFERTA APROVADA PELA HOCCO</small><h2>{offer.title}</h2>{offer.description&&<p>{offer.description}</p>}<div className="offerDetailMeta"><span><CheckCircle2/> Oferta revisada pela HOCCO</span><span><Tag/> {offer.validity}</span></div><button className="offerDetailOutbound" onClick={outbound} disabled={busy}>{busy?'Abrindo...':'Ir para a empresa'} <ExternalLink/></button><small className="offerDetailFoot">Você será direcionado ao canal definido pela empresa.</small></div></section></div>}{notice&&<div className="offerDetailNotice">{notice}</div>}</>;
}
