'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function timeBR(value){
  if(!value)return '';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

export default function HoccoDrops(){
  const [user,setUser]=useState(null);
  const [drops,setDrops]=useState([]);
  const viewed=useRef(new Set());

  useEffect(()=>{
    let alive=true;
    let timer;
    let visibility;

    async function load(){
      const {data:{user:current}}=await supabase.auth.getUser();
      if(!alive||!current)return;
      setUser(current);
      const now=new Date().toISOString();
      const {data:active,error}=await supabase
        .from('hocco_drops')
        .select('id,titulo,mensagem,etiqueta,cta_label,cta_url,starts_at,ends_at,priority')
        .eq('status','published')
        .lte('starts_at',now)
        .gt('ends_at',now)
        .order('priority',{ascending:false})
        .order('starts_at',{ascending:false})
        .limit(8);
      if(error||!alive)return;

      const ids=(active||[]).map((d)=>d.id);
      if(!ids.length){setDrops([]);return;}
      const {data:dismissed}=await supabase
        .from('hocco_drop_interacoes')
        .select('drop_id')
        .eq('user_id',current.id)
        .eq('event_type','dismiss')
        .in('drop_id',ids);
      const hidden=new Set((dismissed||[]).map((r)=>r.drop_id));
      setDrops((active||[]).filter((d)=>!hidden.has(d.id)));
    }

    load();
    timer=setInterval(load,30000);
    visibility=()=>{if(document.visibilityState==='visible')load()};
    document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility)};
  },[]);

  const current=drops[0]||null;

  useEffect(()=>{
    if(!current||!user||viewed.current.has(current.id))return;
    viewed.current.add(current.id);
    supabase.from('hocco_drop_interacoes').insert({drop_id:current.id,user_id:user.id,event_type:'view'}).then(()=>{});
  },[current?.id,user?.id]);

  async function dismiss(){
    if(!current||!user)return;
    await supabase.from('hocco_drop_interacoes').insert({drop_id:current.id,user_id:user.id,event_type:'dismiss'});
    setDrops((rows)=>rows.filter((r)=>r.id!==current.id));
  }

  async function openCta(){
    if(!current||!user||!current.cta_url)return;
    await supabase.from('hocco_drop_interacoes').insert({drop_id:current.id,user_id:user.id,event_type:'cta'});
    if(current.cta_url.startsWith('/')) location.href=current.cta_url;
    else window.open(current.cta_url,'_blank','noopener,noreferrer');
  }

  if(!current)return null;

  return <aside role="status" aria-live="polite" style={{position:'fixed',zIndex:190,top:78,left:12,right:12,margin:'0 auto',width:'min(560px,calc(100vw - 24px))',background:'linear-gradient(135deg,#071f49,#075eea)',color:'#fff',borderRadius:22,padding:'15px 16px',boxShadow:'0 20px 55px rgba(5,30,76,.28)',border:'1px solid rgba(255,255,255,.14)'}}>
    <button type="button" aria-label="Fechar Drop" onClick={dismiss} style={{position:'absolute',right:10,top:10,width:34,height:34,border:0,borderRadius:11,background:'rgba(255,255,255,.12)',color:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}}><X size={17}/></button>
    <div style={{display:'flex',gap:12,paddingRight:34}}>
      <div style={{width:42,height:42,borderRadius:14,background:'rgba(255,255,255,.14)',display:'grid',placeItems:'center',flex:'0 0 auto'}}><Sparkles size={20}/></div>
      <div style={{minWidth:0,flex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><small style={{fontSize:9,fontWeight:950,letterSpacing:'.14em',opacity:.82}}>{current.etiqueta||'DROP HOCCO'}</small>{drops.length>1&&<span style={{fontSize:9,fontWeight:900,background:'rgba(255,255,255,.13)',padding:'4px 7px',borderRadius:999}}>+{drops.length-1}</span>}</div>
        <h3 style={{margin:'5px 0 4px',fontSize:17,lineHeight:1.12}}>{current.titulo}</h3>
        <p style={{margin:0,fontSize:12,lineHeight:1.45,opacity:.9}}>{current.mensagem}</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:11,flexWrap:'wrap'}}>
          <small style={{fontSize:9,fontWeight:800,opacity:.72}}>ATIVO ATÉ {timeBR(current.ends_at)}</small>
          {current.cta_label&&current.cta_url&&<button type="button" onClick={openCta} style={{border:0,borderRadius:11,background:'#fff',color:'#075eea',padding:'9px 11px',fontSize:10,fontWeight:950,display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>{current.cta_label}<ArrowRight size={14}/></button>}
        </div>
      </div>
    </div>
  </aside>;
}
