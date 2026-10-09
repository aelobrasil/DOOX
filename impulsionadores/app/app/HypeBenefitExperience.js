'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, LockKeyhole, MessageCircle, Trophy, X, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BOARD_LABELS={almoco:'Almoço',tarde:'Tarde',noite:'Noite'};
const LOCK_TITLE='O benefício só é liberado se a empresa vencer o Hype.';

function fmtDate(value){
  if(!value)return '—';
  return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR');
}
function pct(value){return Number(value||0).toLocaleString('pt-BR',{maximumFractionDigits:2});}
function waUrl(phone,message){
  let digits=String(phone||'').replace(/\D/g,'');
  if(!digits)return null;
  if(!digits.startsWith('55'))digits=`55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message||'')}`;
}

export default function HypeBenefitExperience(){
  const [user,setUser]=useState(null);
  const [winners,setWinners]=useState([]);
  const [open,setOpen]=useState(false);
  const [locked,setLocked]=useState(null);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(null);

  useEffect(()=>{
    let alive=true;
    let timer;
    async function boot(){
      const {data:{user:current}}=await supabase.auth.getUser();
      if(!alive||!current)return;
      setUser(current);
      await loadWinners();
      timer=setInterval(loadWinners,60000);
    }
    async function loadWinners(){
      const {data,error}=await supabase.rpc('hype_vencedoras_publicas',{p_date:null});
      if(!alive||error)return;
      setWinners((data||[]).slice(0,3));
    }
    boot();
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    if(!user)return;
    let raf=0;

    function enhanceCard(card){
      if(card.dataset.hoccoBenefitEnhanced==='1')return;
      card.dataset.hoccoBenefitEnhanced='1';
      card.style.cursor='default';

      const discount=card.querySelector('.discount');
      if(discount){
        const raw=(discount.dataset.hoccoPotential||discount.textContent||'').replace(/[^0-9,.]/g,'')||'0';
        discount.dataset.hoccoPotential=raw;
        const desired=`🔒 LIBERE ATÉ ${raw}%`;
        if(discount.textContent!==desired)discount.textContent=desired;
        if(discount.getAttribute('title')!==LOCK_TITLE)discount.setAttribute('title',LOCK_TITLE);
      }

      const vote=card.querySelector('button');
      if(vote&&vote.textContent?.trim()==='HYPAR'){
        vote.innerHTML='<span aria-hidden="true">⚡</span> HYPAR PARA LIBERAR';
      }
    }

    function apply(){
      raf=0;
      document.querySelectorAll('.floatingCompany').forEach(enhanceCard);
      const rule=document.querySelector('.hypeRule p');
      if(rule&&!rule.dataset.unlockRule){
        rule.dataset.unlockRule='1';
        rule.innerHTML='<b>1 Hype válido por quadro.</b> Seu Hype ajuda a desbloquear o benefício das vencedoras. Até 3 empresas podem liberar benefícios por dia.';
      }
    }

    function scheduleApply(){
      if(raf)return;
      raf=requestAnimationFrame(apply);
    }

    function capture(event){
      const card=event.target.closest?.('.floatingCompany');
      if(!card||event.target.closest('button'))return;
      event.preventDefault();
      event.stopPropagation();
      const name=card.querySelector('h3')?.textContent?.trim()||'Empresa HOCCO';
      const raw=card.querySelector('.discount')?.dataset?.hoccoPotential||'0';
      setLocked({name,discount:raw});
    }

    apply();
    const observer=new MutationObserver((mutations)=>{
      const needsApply=mutations.some((mutation)=>
        Array.from(mutation.addedNodes||[]).some((node)=>
          node?.nodeType===1 && (node.matches?.('.floatingCompany,.hypeRule') || node.querySelector?.('.floatingCompany,.hypeRule'))
        )
      );
      if(needsApply)scheduleApply();
    });
    observer.observe(document.body,{subtree:true,childList:true});
    document.addEventListener('click',capture,true);

    return()=>{
      observer.disconnect();
      if(raf)cancelAnimationFrame(raf);
      document.removeEventListener('click',capture,true);
    };
  },[user?.id]);

  const latestDate=useMemo(()=>winners[0]?.hype_date||null,[winners]);

  async function benefitAction(winner,action){
    setBusy(`${winner.agenda_id}:${action}`);
    const {data,error}=await supabase.rpc('usar_beneficio_hype',{p_agenda_id:winner.agenda_id,p_action:action});
    setBusy(null);
    if(error){
      setNotice('Este benefício ainda não está liberado ou expirou.');
      return;
    }
    const row=Array.isArray(data)?data[0]:data;
    if(!row)return;
    if(action==='benefit'){
      if(row.cupom_hocco)await navigator.clipboard?.writeText(row.cupom_hocco);
      setNotice(row.cupom_hocco?`Cupom ${row.cupom_hocco} copiado.`:'Benefício registrado.');
      return;
    }
    const url=waUrl(row.whatsapp,row.mensagem);
    if(url)window.open(url,'_blank','noopener,noreferrer');
    else setNotice('A empresa ainda não disponibilizou um WhatsApp para este benefício.');
  }

  return <>
    {winners.length>0&&<button type="button" onClick={()=>setOpen(true)} aria-label="Ver benefícios desbloqueados" style={{position:'fixed',zIndex:115,right:14,bottom:148,border:0,borderRadius:18,padding:'11px 14px',background:'#fff',color:'#102844',boxShadow:'0 12px 36px rgba(15,35,65,.18)',display:'flex',alignItems:'center',gap:8,fontWeight:900,cursor:'pointer'}}><Trophy size={17}/>{winners.length} {winners.length===1?'BENEFÍCIO LIBERADO':'BENEFÍCIOS LIBERADOS'}</button>}

    {locked&&<div role="dialog" aria-modal="true" onClick={()=>setLocked(null)} style={{position:'fixed',inset:0,zIndex:220,background:'rgba(7,20,38,.58)',display:'grid',placeItems:'center',padding:20}}><section onClick={(e)=>e.stopPropagation()} style={{width:'min(420px,100%)',background:'#fff',borderRadius:24,padding:22,boxShadow:'0 30px 80px rgba(0,0,0,.28)'}}><button onClick={()=>setLocked(null)} style={{float:'right',border:0,background:'transparent',cursor:'pointer'}}><X/></button><LockKeyhole size={30}/><small style={{display:'block',marginTop:14,fontWeight:900,letterSpacing:'.12em',color:'#65768b'}}>BENEFÍCIO BLOQUEADO</small><h2 style={{margin:'7px 0'}}>{locked.name}</h2><p style={{color:'#607086',lineHeight:1.5}}>Ajude esta empresa a vencer o Hype para liberar <b>até {locked.discount}% de benefício</b> para a comunidade HOCCO.</p><div style={{padding:12,borderRadius:14,background:'#f3f7fd',fontWeight:800,color:'#075eea'}}><Zap size={16} style={{verticalAlign:'middle',marginRight:7}}/>Volte ao quadro e use seu Hype para tentar desbloquear.</div></section></div>}

    {open&&<div role="dialog" aria-modal="true" onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:230,background:'rgba(7,20,38,.66)',display:'grid',placeItems:'center',padding:16}}><section onClick={(e)=>e.stopPropagation()} style={{width:'min(620px,100%)',maxHeight:'88vh',overflow:'auto',background:'#f7f9fc',borderRadius:26,padding:18,boxShadow:'0 34px 90px rgba(0,0,0,.3)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}><div><small style={{fontWeight:900,letterSpacing:'.12em',color:'#65768b'}}>VENCEDORAS DO HYPE · {fmtDate(latestDate)}</small><h2 style={{margin:'5px 0 0'}}>Benefícios desbloqueados</h2><p style={{margin:'6px 0 0',color:'#65768b'}}>Somente empresas vencedoras liberam desconto, cupom e contato.</p></div><button onClick={()=>setOpen(false)} style={{border:0,background:'#fff',borderRadius:12,padding:8,cursor:'pointer'}}><X/></button></div>
      <div style={{display:'grid',gap:12}}>{winners.map((w)=><article key={w.empresa_id} style={{background:'#fff',border:'1px solid #e1e8f2',borderRadius:20,padding:14}}><div style={{display:'grid',gridTemplateColumns:'54px 1fr',gap:12,alignItems:'center'}}><div style={{width:54,height:54,borderRadius:15,background:'#f2f6fb',display:'grid',placeItems:'center',overflow:'hidden'}}>{w.logo_url?<img src={w.logo_url} alt={w.nome_fantasia} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Trophy size={22}/>}</div><div><small style={{color:'#708097',fontWeight:800}}>{(w.quadros||[]).map((q)=>BOARD_LABELS[q]||q).join(' · ')}</small><h3 style={{margin:'3px 0'}}>{w.nome_fantasia}</h3><span style={{fontSize:12,color:'#75859a'}}>{w.segmento||'Empresa HOCCO'}</span></div></div><div style={{marginTop:12,padding:14,borderRadius:16,background:'#eef6ff'}}><span style={{fontSize:11,fontWeight:900,color:'#075eea'}}>🏆 DESBLOQUEADO</span><strong style={{display:'block',fontSize:25,marginTop:3}}>{pct(w.desconto_desbloqueado)}% OFF</strong>{w.cupom_hocco&&<code style={{display:'inline-block',marginTop:8,padding:'7px 9px',borderRadius:9,background:'#fff',fontWeight:900}}>{w.cupom_hocco}</code>}{w.condicoes&&<p style={{margin:'9px 0 0',fontSize:12,color:'#5d6d81'}}>{w.condicoes}</p>}{w.beneficio_validade&&<small style={{display:'block',marginTop:6,color:'#78879a'}}>Válido até {fmtDate(w.beneficio_validade)}</small>}</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}><button disabled={busy!==null} onClick={()=>benefitAction(w,'benefit')} style={{border:'1px solid #d7e1ee',background:'#fff',borderRadius:13,padding:11,fontWeight:900,cursor:'pointer'}}><Copy size={15} style={{verticalAlign:'middle',marginRight:6}}/>COPIAR CUPOM</button><button disabled={busy!==null} onClick={()=>benefitAction(w,'whatsapp')} style={{border:0,background:'#075eea',color:'#fff',borderRadius:13,padding:11,fontWeight:900,cursor:'pointer'}}><MessageCircle size={15} style={{verticalAlign:'middle',marginRight:6}}/>FALAR COM A EMPRESA</button></div></article>)}</div>
      {notice&&<div style={{marginTop:12,padding:10,borderRadius:12,background:'#eaf8ef',color:'#176d39',fontWeight:800,display:'flex',gap:8,alignItems:'center'}}><CheckCircle2 size={17}/>{notice}</div>}
    </section></div>}
  </>;
}
