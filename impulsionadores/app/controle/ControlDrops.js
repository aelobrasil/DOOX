'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, CheckCircle2, Eye, Link as LinkIcon, MousePointerClick, Pencil, Send, X, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function brInput(date=new Date()){
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  const get=(t)=>parts.find((p)=>p.type===t)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function fromBR(value){return value?new Date(`${value}:00-03:00`).toISOString():null}
function toBR(value){return value?brInput(new Date(value)):''}
function fmt(value){return value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—'}
function stateOf(row){
  const now=Date.now();
  if(row.status==='cancelled')return ['CANCELADO','#9c2b2b','#fff0f0'];
  if(row.status==='draft')return ['RASCUNHO','#6b7280','#f3f4f6'];
  if(new Date(row.ends_at).getTime()<=now)return ['ENCERRADO','#5f6d80','#eef1f5'];
  if(new Date(row.starts_at).getTime()>now)return ['PROGRAMADO','#6b4f00','#fff6d7'];
  return ['ATIVO','#08785a','#e9fbf4'];
}

export default function ControlDrops(){
  const [admin,setAdmin]=useState(false);
  const [open,setOpen]=useState(false);
  const [rows,setRows]=useState([]);
  const [metrics,setMetrics]=useState({});
  const [editing,setEditing]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [form,setForm]=useState(()=>({etiqueta:'DROP HOCCO',titulo:'',mensagem:'',cta_label:'',cta_url:'',starts_at:brInput(new Date()),ends_at:brInput(new Date(Date.now()+30*60*1000)),priority:50}));

  useEffect(()=>{
    let alive=true;
    let timer;
    async function boot(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!alive)return;
      const {data:allowed}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle();
      if(!allowed||!alive)return;
      setAdmin(true);
      await load();
      timer=setInterval(load,30000);
    }
    async function load(){
      const {data:drops}=await supabase.from('hocco_drops').select('*').order('created_at',{ascending:false}).limit(100);
      if(!alive)return;
      const list=drops||[];
      setRows(list);
      const ids=list.map((d)=>d.id);
      if(!ids.length){setMetrics({});return;}
      const {data:events}=await supabase.from('hocco_drop_interacoes').select('drop_id,user_id,event_type,created_at').in('drop_id',ids).order('created_at',{ascending:false}).limit(5000);
      const map={};
      (events||[]).forEach((e)=>{
        if(!map[e.drop_id])map[e.drop_id]={views:0,viewUsers:new Set(),clicks:0,clickUsers:new Set(),dismiss:0};
        const m=map[e.drop_id];
        if(e.event_type==='view'){m.views++;m.viewUsers.add(e.user_id)}
        if(e.event_type==='cta'){m.clicks++;m.clickUsers.add(e.user_id)}
        if(e.event_type==='dismiss')m.dismiss++;
      });
      const compact={};Object.entries(map).forEach(([id,m])=>compact[id]={views:m.views,uniqueViews:m.viewUsers.size,clicks:m.clicks,uniqueClicks:m.clickUsers.size,dismiss:m.dismiss});
      setMetrics(compact);
    }
    boot();
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  const activeCount=useMemo(()=>rows.filter((r)=>stateOf(r)[0]==='ATIVO').length,[rows]);

  function reset(){
    setEditing(null);setNotice('');
    setForm({etiqueta:'DROP HOCCO',titulo:'',mensagem:'',cta_label:'',cta_url:'',starts_at:brInput(new Date()),ends_at:brInput(new Date(Date.now()+30*60*1000)),priority:50});
  }
  function edit(row){
    setEditing(row.id);setOpen(true);setNotice('');
    setForm({etiqueta:row.etiqueta||'DROP HOCCO',titulo:row.titulo||'',mensagem:row.mensagem||'',cta_label:row.cta_label||'',cta_url:row.cta_url||'',starts_at:toBR(row.starts_at),ends_at:toBR(row.ends_at),priority:row.priority??50});
  }
  async function save(status){
    if(busy)return;
    const start=fromBR(form.starts_at),end=fromBR(form.ends_at);
    if(!form.titulo.trim()||!form.mensagem.trim())return setNotice('Preencha título e mensagem.');
    if(!start||!end||new Date(end)<=new Date(start))return setNotice('O encerramento precisa ser depois do início.');
    if(form.cta_url&&!(form.cta_url.startsWith('https://')||form.cta_url.startsWith('http://')||form.cta_url.startsWith('/')))return setNotice('Use um link https://, http:// ou uma rota interna começando com /.');
    setBusy(true);setNotice('');
    const payload={etiqueta:form.etiqueta.trim()||'DROP HOCCO',titulo:form.titulo.trim(),mensagem:form.mensagem.trim(),cta_label:form.cta_label.trim()||null,cta_url:form.cta_url.trim()||null,starts_at:start,ends_at:end,priority:Number(form.priority)||0,status,updated_at:new Date().toISOString()};
    const query=editing?supabase.from('hocco_drops').update(payload).eq('id',editing):supabase.from('hocco_drops').insert(payload);
    const {error}=await query;
    setBusy(false);
    if(error)return setNotice(`Não foi possível salvar o Drop: ${error.message}`);
    setNotice(status==='published'?'Drop publicado/programado.':'Rascunho salvo.');
    reset();
    const {data:drops}=await supabase.from('hocco_drops').select('*').order('created_at',{ascending:false}).limit(100);setRows(drops||[]);
  }
  async function cancel(id){
    if(!confirm('Cancelar este Drop? Ele deixará de aparecer para os membros.'))return;
    await supabase.from('hocco_drops').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id);
    setRows((r)=>r.map((x)=>x.id===id?{...x,status:'cancelled'}:x));
  }
  async function publish(id){
    await supabase.from('hocco_drops').update({status:'published',updated_at:new Date().toISOString()}).eq('id',id);
    setRows((r)=>r.map((x)=>x.id===id?{...x,status:'published'}:x));
  }

  if(!admin)return null;
  return <>
    <button type="button" onClick={()=>{reset();setOpen(true)}} style={{position:'fixed',right:18,bottom:122,zIndex:8100,border:0,borderRadius:999,background:'#075eea',color:'#fff',padding:'11px 15px',display:'flex',alignItems:'center',gap:8,fontSize:11,fontWeight:950,boxShadow:'0 12px 34px rgba(7,94,234,.28)',cursor:'pointer'}}><BellRing size={16}/> DROPS {activeCount?`· ${activeCount} ATIVO${activeCount>1?'S':''}`:''}</button>
    {open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:13000,background:'rgba(8,20,40,.52)',display:'flex',justifyContent:'flex-end'}}>
      <aside onClick={(e)=>e.stopPropagation()} style={{width:'min(610px,100vw)',height:'100vh',background:'#f6f8fc',padding:18,overflow:'auto',boxShadow:'-20px 0 60px rgba(6,20,44,.22)'}}>
        <header style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',position:'sticky',top:0,zIndex:5,background:'#f6f8fc',paddingBottom:13,borderBottom:'1px solid #e0e7f0'}}><div><small style={{fontSize:9,fontWeight:950,letterSpacing:'.13em',color:'#075eea'}}>ENGAJAMENTO AO VIVO</small><h2 style={{margin:'4px 0 2px',fontSize:24,color:'#102844'}}>Drops HOCCO</h2><p style={{margin:0,fontSize:11,color:'#718096'}}>Crie, programe e acompanhe Drops enviados automaticamente ao app dos membros.</p></div><button onClick={()=>setOpen(false)} style={{width:38,height:38,border:0,borderRadius:12,background:'#fff',display:'grid',placeItems:'center',cursor:'pointer'}}><X size={18}/></button></header>

        <section style={{marginTop:14,background:'#fff',border:'1px solid #dfe7f2',borderRadius:18,padding:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div><small style={{fontSize:9,fontWeight:950,color:'#718096'}}>{editing?'EDITANDO DROP':'NOVO DROP'}</small><h3 style={{margin:'3px 0 0',color:'#102844'}}>{editing?'Atualizar comunicação':'Enviar algo inesperado à comunidade'}</h3></div>{editing&&<button onClick={reset} style={{border:'1px solid #dfe6ef',background:'#fff',borderRadius:10,padding:'7px 9px',fontWeight:850,cursor:'pointer'}}>NOVO</button>}</div>
          <div style={{display:'grid',gap:10,marginTop:13}}>
            <label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>ETIQUETA<input value={form.etiqueta} maxLength={32} onChange={(e)=>setForm({...form,etiqueta:e.target.value})} style={input}/></label>
            <label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>TÍTULO<input value={form.titulo} maxLength={80} onChange={(e)=>setForm({...form,titulo:e.target.value})} placeholder="Ex.: DROP SURPRESA" style={input}/></label>
            <label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>MENSAGEM<textarea value={form.mensagem} maxLength={360} onChange={(e)=>setForm({...form,mensagem:e.target.value})} placeholder="O que o membro precisa saber agora?" style={{...input,minHeight:88,resize:'vertical'}}/></label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}><label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>COMEÇA · BRASÍLIA<input type="datetime-local" value={form.starts_at} onChange={(e)=>setForm({...form,starts_at:e.target.value})} style={input}/></label><label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>TERMINA · BRASÍLIA<input type="datetime-local" value={form.ends_at} onChange={(e)=>setForm({...form,ends_at:e.target.value})} style={input}/></label></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}><label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>BOTÃO OPCIONAL<input value={form.cta_label} maxLength={40} onChange={(e)=>setForm({...form,cta_label:e.target.value})} placeholder="Ex.: VER AGORA" style={input}/></label><label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>LINK / ROTA<input value={form.cta_url} onChange={(e)=>setForm({...form,cta_url:e.target.value})} placeholder="https://... ou /experiencias" style={input}/></label></div>
            <label style={{fontSize:10,fontWeight:850,color:'#50617a'}}>PRIORIDADE · {form.priority}<input type="range" min="0" max="100" value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})} style={{width:'100%'}}/></label>
          </div>
          {notice&&<div style={{marginTop:10,padding:10,borderRadius:11,background:'#eef5ff',color:'#204b85',fontSize:11,fontWeight:800}}>{notice}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1.25fr',gap:8,marginTop:12}}><button disabled={busy} onClick={()=>save('draft')} style={secondary}><CalendarClock size={15}/> SALVAR RASCUNHO</button><button disabled={busy} onClick={()=>save('published')} style={primary}><Send size={15}/> PUBLICAR / PROGRAMAR</button></div>
        </section>

        <section style={{marginTop:15}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><small style={{fontSize:9,fontWeight:950,color:'#718096'}}>HISTÓRICO E MÉTRICAS</small><h3 style={{margin:'3px 0',color:'#102844'}}>Drops recentes</h3></div><b style={{fontSize:11,color:'#075eea'}}>{rows.length} REGISTROS</b></div>
          <div style={{display:'grid',gap:10,marginTop:10}}>{rows.map((r)=>{const [label,color,bg]=stateOf(r);const m=metrics[r.id]||{};return <article key={r.id} style={{background:'#fff',border:'1px solid #dfe7f1',borderRadius:17,padding:13}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}><div><small style={{fontSize:9,fontWeight:950,color:'#718096'}}>{r.etiqueta}</small><h4 style={{margin:'4px 0 3px',fontSize:15,color:'#102844'}}>{r.titulo}</h4><p style={{margin:0,fontSize:11,lineHeight:1.4,color:'#64758b'}}>{r.mensagem}</p></div><span style={{fontSize:8,fontWeight:950,color,background:bg,padding:'6px 8px',borderRadius:999,whiteSpace:'nowrap'}}>{label}</span></div><div style={{marginTop:9,fontSize:9,color:'#7b899b'}}>De {fmt(r.starts_at)} até {fmt(r.ends_at)} · prioridade {r.priority}</div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:10}}><Metric icon={Eye} value={m.uniqueViews||0} label="vistos"/><Metric icon={MousePointerClick} value={m.uniqueClicks||0} label="cliques"/><Metric icon={XCircle} value={m.dismiss||0} label="dispensas"/></div><div style={{display:'flex',gap:7,marginTop:10,flexWrap:'wrap'}}><button onClick={()=>edit(r)} style={mini}><Pencil size={13}/> EDITAR</button>{r.status==='draft'&&<button onClick={()=>publish(r.id)} style={mini}><CheckCircle2 size={13}/> PUBLICAR</button>}{r.status!=='cancelled'&&new Date(r.ends_at)>new Date()&&<button onClick={()=>cancel(r.id)} style={{...mini,color:'#a02525'}}><XCircle size={13}/> CANCELAR</button>}{r.cta_url&&<span style={{...mini,cursor:'default'}}><LinkIcon size={13}/> CTA</span>}</div></article>})}{!rows.length&&<div style={{padding:24,textAlign:'center',color:'#7a899c',fontSize:12}}>Nenhum Drop criado ainda.</div>}</div>
        </section>
      </aside>
    </div>}
  </>;
}

function Metric({icon:Icon,value,label}){return <div style={{padding:'9px 8px',borderRadius:11,background:'#f4f7fb',display:'flex',alignItems:'center',gap:7}}><Icon size={14}/><span><b style={{display:'block',fontSize:13}}>{value}</b><small style={{fontSize:8,color:'#718096'}}>{label}</small></span></div>}

const input={display:'block',width:'100%',marginTop:5,border:'1px solid #dce4ef',borderRadius:11,padding:'10px 11px',fontSize:12,background:'#fff',color:'#102844',boxSizing:'border-box'};
const primary={border:0,borderRadius:12,background:'#075eea',color:'#fff',padding:'11px 12px',fontWeight:950,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',gap:7,cursor:'pointer'};
const secondary={...primary,background:'#eef3f9',color:'#30455f'};
const mini={border:'1px solid #dfe6ef',background:'#fff',borderRadius:10,padding:'7px 9px',fontSize:9,fontWeight:900,color:'#30455f',display:'flex',alignItems:'center',gap:5,cursor:'pointer'};
