'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function todayBR(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function brDate(value){return new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR')}

export default function ControlFutureHype(){
  const [rows,setRows]=useState([]);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    let active=true;
    let timer;
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!active)return;
      const {data:admin}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle();
      if(!admin||!active)return;
      const {data}=await supabase.from('hype_agenda').select('id,hype_date,quadro,tamanho,status,desconto,solicitacao_id,hype_empresas(id,nome_fantasia,logo_url,segmento)').gte('hype_date',todayBR()).neq('status','cancelado').order('hype_date',{ascending:true}).order('quadro',{ascending:true}).limit(120);
      if(active)setRows(data||[]);
    }
    load();timer=setInterval(load,30000);
    return()=>{active=false;clearInterval(timer)};
  },[]);

  const future=useMemo(()=>rows.filter((r)=>r.hype_date>todayBR()),[rows]);
  const grouped=useMemo(()=>{
    const map=new Map();
    future.forEach((r)=>{if(!map.has(r.hype_date))map.set(r.hype_date,[]);map.get(r.hype_date).push(r)});
    return [...map.entries()].slice(0,14);
  },[future]);

  if(!rows.length)return null;
  return <>
    <button onClick={()=>setOpen(true)} aria-label="Abrir agenda futura do Hype" style={{position:'fixed',right:18,bottom:70,zIndex:8000,border:0,borderRadius:999,background:'#071f49',color:'#fff',padding:'11px 15px',display:'flex',alignItems:'center',gap:8,fontSize:11,fontWeight:900,boxShadow:'0 12px 34px rgba(7,31,73,.25)',cursor:'pointer'}}><CalendarDays size={16}/> AGENDA HYPE {future.length>0?`· ${future.length}`:''}</button>
    {open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:12000,background:'rgba(8,20,40,.42)',display:'flex',justifyContent:'flex-end'}}>
      <aside onClick={(e)=>e.stopPropagation()} style={{width:'min(520px,100vw)',height:'100vh',background:'#f6f8fc',padding:18,overflow:'auto',boxShadow:'-20px 0 60px rgba(6,20,44,.18)'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,position:'sticky',top:0,background:'#f6f8fc',padding:'4px 0 14px',zIndex:2,borderBottom:'1px solid #e1e7ef'}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#71839b'}}>PROGRAMAÇÃO FUTURA</small><h2 style={{margin:'4px 0 2px',fontSize:23,color:'#102844'}}>Agenda HOCCO Hype</h2><p style={{margin:0,fontSize:11,color:'#718096'}}>Empresas já aprovadas que entrarão no app dos membros na data e quadro programados.</p></div><button onClick={()=>setOpen(false)} style={{width:38,height:38,border:0,borderRadius:12,background:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}}><X size={18}/></button></header>
        {!grouped.length&&<div style={{padding:'36px 8px',textAlign:'center',color:'#7a899c',fontSize:12}}>Nenhuma empresa futura programada.</div>}
        {grouped.map(([date,items])=><section key={date} style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:17,padding:14,marginTop:13}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><b style={{fontSize:13,color:'#102844'}}>{brDate(date)}</b><span style={{fontSize:9,color:'#075eea',fontWeight:900}}>{items.length} POSIÇÕES</span></div>{items.map((r)=><article key={r.id} style={{display:'grid',gridTemplateColumns:'42px 1fr auto',alignItems:'center',gap:10,padding:'9px 0',borderTop:'1px solid #eef2f6'}}><div style={{width:42,height:42,borderRadius:11,background:'#f3f6fa',overflow:'hidden',display:'grid',placeItems:'center'}}>{r.hype_empresas?.logo_url?<img src={r.hype_empresas.logo_url} alt={r.hype_empresas?.nome_fantasia||''} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<CalendarDays size={17}/>}</div><div><b style={{display:'block',fontSize:12,color:'#172b46'}}>{r.hype_empresas?.nome_fantasia||'Empresa'}</b><small style={{display:'block',fontSize:9,color:'#7a899c',marginTop:2}}>{r.quadro} · {r.tamanho} · {Number(r.desconto||0).toFixed(0)}% OFF · {r.status}</small></div><span style={{fontSize:9,fontWeight:900,color:'#08785a'}}>PROGRAMADA</span></article>)}</section>)}
        <a href="/app" target="_blank" rel="noreferrer" style={{marginTop:16,display:'flex',alignItems:'center',justifyContent:'center',gap:7,textDecoration:'none',background:'#075eea',color:'#fff',padding:12,borderRadius:12,fontSize:10,fontWeight:900}}><ExternalLink size={15}/> ABRIR APP DO MEMBRO</a>
      </aside>
    </div>}
  </>;
}
