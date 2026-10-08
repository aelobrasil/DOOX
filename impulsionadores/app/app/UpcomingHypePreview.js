'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function todayBR(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function formatDate(value){
  return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
}

export default function UpcomingHypePreview(){
  const [future,setFuture]=useState([]);
  const [todayFingerprint,setTodayFingerprint]=useState(null);
  const [updateAvailable,setUpdateAvailable]=useState(false);
  const initialTodayRef=useRef(null);

  useEffect(()=>{
    let active=true;
    let timer;
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!active)return;
      const today=todayBR();
      const [{data:todayRows},{data:futureRows}]=await Promise.all([
        supabase.from('hype_agenda').select('id,updated_at,status').eq('hype_date',today).neq('status','cancelado').order('id'),
        supabase.from('hype_agenda').select('id,hype_date,quadro,tamanho,desconto,status,hype_empresas(id,nome_fantasia,logo_url,segmento)').gt('hype_date',today).neq('status','cancelado').order('hype_date',{ascending:true}).order('quadro',{ascending:true}).limit(60),
      ]);
      if(!active)return;
      const fingerprint=(todayRows||[]).map((r)=>`${r.id}:${r.updated_at}:${r.status}`).join('|');
      if(initialTodayRef.current===null)initialTodayRef.current=fingerprint;
      else if(initialTodayRef.current!==fingerprint)setUpdateAvailable(true);
      setTodayFingerprint(fingerprint);
      setFuture(futureRows||[]);
    }
    load();
    timer=setInterval(load,30000);
    const onVisible=()=>{if(document.visibilityState==='visible')load()};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)};
  },[]);

  const next=useMemo(()=>{
    if(!future.length)return null;
    const date=future[0].hype_date;
    const rows=future.filter((r)=>r.hype_date===date);
    const companies=[];
    const seen=new Set();
    rows.forEach((r)=>{
      const c=r.hype_empresas;
      if(c&&!seen.has(c.id)){seen.add(c.id);companies.push({...c,tamanho:r.tamanho,desconto:r.desconto,quadros:rows.filter((x)=>x.hype_empresas?.id===c.id).map((x)=>x.quadro)})}
    });
    return {date,companies};
  },[future]);

  if(updateAvailable){
    return <button onClick={()=>location.reload()} style={{position:'fixed',zIndex:140,right:14,bottom:88,border:0,borderRadius:16,padding:'12px 14px',background:'#075eea',color:'#fff',boxShadow:'0 12px 36px rgba(7,94,234,.28)',display:'flex',alignItems:'center',gap:9,fontWeight:900,cursor:'pointer'}}><RefreshCw size={17}/> HYPE ATUALIZADO · TOQUE PARA CARREGAR</button>;
  }
  if(!next?.companies?.length)return null;

  const first=next.companies[0];
  return <aside aria-label="Próximo Hype" style={{position:'fixed',zIndex:120,right:14,bottom:88,width:'min(360px,calc(100vw - 28px))',background:'#fff',border:'1px solid #dfe7f2',borderRadius:18,padding:12,boxShadow:'0 14px 40px rgba(15,35,65,.16)',display:'grid',gridTemplateColumns:'50px 1fr auto',gap:10,alignItems:'center'}}>
    <div style={{width:50,height:50,borderRadius:14,background:'#f2f6fc',display:'grid',placeItems:'center',overflow:'hidden'}}>{first.logo_url?<img src={first.logo_url} alt={first.nome_fantasia} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Building2 size={20}/>}</div>
    <div style={{minWidth:0}}><small style={{display:'block',fontSize:9,fontWeight:900,letterSpacing:'.1em',color:'#70839c'}}>PRÓXIMO HYPE · {formatDate(next.date)}</small><b style={{display:'block',fontSize:13,color:'#102844',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{first.nome_fantasia}{next.companies.length>1?` +${next.companies.length-1}`:''}</b><span style={{display:'block',fontSize:10,color:'#718096',marginTop:2}}>Programada · disponível para Hypar no horário do quadro</span></div>
    <Zap size={18} color="#075eea"/>
  </aside>;
}
