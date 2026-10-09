'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const NOTICE_MS=5*60*1000;

function dayBR(date=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function addDays(value,days){
  const d=new Date(`${value}T12:00:00-03:00`);
  d.setDate(d.getDate()+days);
  return dayBR(d);
}
function formatDate(value){return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});}

export default function UpcomingHypePreview(){
  const [future,setFuture]=useState([]);
  const [updateVisible,setUpdateVisible]=useState(false);
  const [previewVisible,setPreviewVisible]=useState(true);
  const initialTodayRef=useRef(null);
  const lastFutureFingerprintRef=useRef(null);
  const updateTimerRef=useRef(null);
  const previewTimerRef=useRef(null);

  function showUpdateNotice(){setUpdateVisible(true);clearTimeout(updateTimerRef.current);updateTimerRef.current=setTimeout(()=>setUpdateVisible(false),NOTICE_MS);}
  function showPreviewNotice(){setPreviewVisible(true);clearTimeout(previewTimerRef.current);previewTimerRef.current=setTimeout(()=>setPreviewVisible(false),NOTICE_MS);}

  useEffect(()=>{
    let active=true;
    let timer;
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!active)return;
      const today=dayBR();
      const tomorrow=addDays(today,1);
      const until=addDays(today,31);
      const [todayRes,futureRes]=await Promise.all([
        supabase.rpc('hype_slots_publicos',{p_from_date:today,p_to_date:today,p_quadro:null}),
        supabase.rpc('hype_slots_publicos',{p_from_date:tomorrow,p_to_date:until,p_quadro:null}),
      ]);
      if(!active)return;
      if(todayRes.error||futureRes.error){
        setFuture([]);
        return;
      }

      const todayRows=todayRes.data||[];
      const todayFingerprint=todayRows.map((r)=>`${r.agenda_id}:${r.updated_at}:${r.status}`).join('|');
      if(initialTodayRef.current===null)initialTodayRef.current=todayFingerprint;
      else if(initialTodayRef.current!==todayFingerprint){initialTodayRef.current=todayFingerprint;showUpdateNotice();}

      const nextFuture=futureRes.data||[];
      const futureFingerprint=nextFuture.map((r)=>`${r.agenda_id}:${r.hype_date}:${r.quadro}:${r.status}`).join('|');
      if(lastFutureFingerprintRef.current===null){lastFutureFingerprintRef.current=futureFingerprint;if(futureFingerprint)showPreviewNotice();}
      else if(lastFutureFingerprintRef.current!==futureFingerprint){lastFutureFingerprintRef.current=futureFingerprint;if(futureFingerprint)showPreviewNotice();}
      setFuture(nextFuture);
    }

    load();
    timer=setInterval(load,30000);
    const onVisible=()=>{if(document.visibilityState==='visible')load()};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;clearInterval(timer);clearTimeout(updateTimerRef.current);clearTimeout(previewTimerRef.current);document.removeEventListener('visibilitychange',onVisible)};
  },[]);

  const next=useMemo(()=>{
    if(!future.length)return null;
    const date=future[0].hype_date;
    const rows=future.filter((r)=>r.hype_date===date);
    const companies=[];
    const seen=new Set();
    rows.forEach((r)=>{
      if(!seen.has(r.empresa_id)){
        seen.add(r.empresa_id);
        companies.push({id:r.empresa_id,nome_fantasia:r.nome_fantasia,logo_url:r.logo_url,segmento:r.segmento,tamanho:r.tamanho,desconto:r.desconto,quadros:rows.filter((x)=>x.empresa_id===r.empresa_id).map((x)=>x.quadro)});
      }
    });
    return {date,companies};
  },[future]);

  if(updateVisible){
    return <button onClick={()=>location.reload()} style={{position:'fixed',zIndex:140,right:14,bottom:88,border:0,borderRadius:16,padding:'12px 14px',background:'#075eea',color:'#fff',boxShadow:'0 12px 36px rgba(7,94,234,.28)',display:'flex',alignItems:'center',gap:9,fontWeight:900,cursor:'pointer'}}><RefreshCw size={17}/> HYPE ATUALIZADO · TOQUE PARA CARREGAR</button>;
  }
  if(!previewVisible||!next?.companies?.length)return null;

  const first=next.companies[0];
  return <aside aria-label="Próximo Hype" onClick={()=>setPreviewVisible(false)} style={{position:'fixed',zIndex:120,right:14,bottom:88,width:'min(360px,calc(100vw - 28px))',background:'#fff',border:'1px solid #dfe7f2',borderRadius:18,padding:12,boxShadow:'0 14px 40px rgba(15,35,65,.16)',display:'grid',gridTemplateColumns:'50px 1fr auto',gap:10,alignItems:'center',cursor:'pointer'}}>
    <div style={{width:50,height:50,borderRadius:14,background:'#f2f6fc',display:'grid',placeItems:'center',overflow:'hidden'}}>{first.logo_url?<img src={first.logo_url} alt={first.nome_fantasia} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Building2 size={20}/>}</div>
    <div style={{minWidth:0}}><small style={{display:'block',fontSize:9,fontWeight:900,letterSpacing:'.1em',color:'#70839c'}}>PRÓXIMO HYPE · {formatDate(next.date)}</small><b style={{display:'block',fontSize:13,color:'#102844',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{first.nome_fantasia}{next.companies.length>1?` +${next.companies.length-1}`:''}</b><span style={{display:'block',fontSize:10,color:'#718096',marginTop:2}}>Programada · disponível para Hypar no horário do quadro</span></div>
    <Zap size={18} color="#075eea"/>
  </aside>;
}
