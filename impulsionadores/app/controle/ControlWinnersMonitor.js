'use client';

import { useEffect, useState } from 'react';
import { LockKeyhole, Trophy, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const LABEL={almoco:'Almoço',tarde:'Tarde',noite:'Noite'};
const fmt=(d)=>d?new Date(`${d}T12:00:00-03:00`).toLocaleDateString('pt-BR'):'—';

export default function ControlWinnersMonitor(){
  const [rows,setRows]=useState([]);
  const [open,setOpen]=useState(false);
  const [admin,setAdmin]=useState(false);

  useEffect(()=>{
    let alive=true;
    let timer;
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!alive)return;
      const {data:allowed}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle();
      if(!allowed||!alive)return;
      setAdmin(true);
      const {data}=await supabase.rpc('hype_vencedoras_publicas',{p_date:null});
      if(alive)setRows((data||[]).slice(0,3));
    }
    load();
    timer=setInterval(load,60000);
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  if(!admin)return null;
  return <>
    <button type="button" onClick={()=>setOpen(true)} style={{position:'fixed',zIndex:8000,right:18,bottom:18,border:0,borderRadius:16,padding:'11px 14px',background:'#102844',color:'#fff',boxShadow:'0 14px 36px rgba(8,24,45,.24)',display:'flex',alignItems:'center',gap:8,fontWeight:900,cursor:'pointer'}}><Trophy size={17}/>VENCEDORAS · {rows.length}/3</button>
    {open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:12000,background:'rgba(8,18,32,.62)',display:'flex',justifyContent:'flex-end'}}><aside onClick={(e)=>e.stopPropagation()} style={{width:'min(480px,100%)',height:'100%',overflow:'auto',background:'#f7f9fc',padding:20,boxShadow:'-20px 0 60px rgba(0,0,0,.2)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><div><small style={{fontWeight:900,letterSpacing:'.12em',color:'#6c7b8e'}}>CONTROLE DE BENEFÍCIOS</small><h2 style={{margin:'5px 0'}}>Vencedoras do Hype</h2><p style={{color:'#6b7b8f',marginTop:5}}>O benefício é liberado automaticamente pelo resultado. Não existe liberação manual.</p></div><button onClick={()=>setOpen(false)} style={{border:0,background:'#fff',padding:8,borderRadius:12,cursor:'pointer'}}><X/></button></div>
      {rows.length===0?<div style={{marginTop:24,padding:18,border:'1px solid #e1e8f2',borderRadius:18,background:'#fff'}}><LockKeyhole/><h3>Nenhum benefício liberado</h3><p style={{color:'#6b7b8f'}}>Após o fechamento dos quadros e a apuração, as vencedoras aparecem aqui automaticamente.</p></div>:<div style={{display:'grid',gap:12,marginTop:18}}>{rows.map((r)=><article key={r.empresa_id} style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:18,padding:14}}><div style={{display:'grid',gridTemplateColumns:'50px 1fr',gap:10,alignItems:'center'}}><div style={{width:50,height:50,borderRadius:13,background:'#f0f4f9',overflow:'hidden',display:'grid',placeItems:'center'}}>{r.logo_url?<img src={r.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Trophy size={20}/>}</div><div><small style={{color:'#718096'}}>{fmt(r.hype_date)} · {(r.quadros||[]).map((q)=>LABEL[q]||q).join(' · ')}</small><h3 style={{margin:'3px 0'}}>{r.nome_fantasia}</h3><span style={{fontSize:12,color:'#718096'}}>{r.segmento||'Empresa HOCCO'}</span></div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><div style={{padding:11,borderRadius:12,background:'#edf6ff'}}><small>BENEFÍCIO</small><b style={{display:'block',fontSize:18}}>{Number(r.desconto_desbloqueado||0).toLocaleString('pt-BR')}% OFF</b></div><div style={{padding:11,borderRadius:12,background:'#f3f6fa'}}><small>CUPOM</small><b style={{display:'block',fontSize:14}}>{r.cupom_hocco||'—'}</b></div></div><p style={{fontSize:12,color:'#607086',marginBottom:0}}>Status: <b style={{color:'#18864b'}}>DESBLOQUEADO AUTOMATICAMENTE</b></p></article>)}</div>}
    </aside></div>}
  </>;
}
