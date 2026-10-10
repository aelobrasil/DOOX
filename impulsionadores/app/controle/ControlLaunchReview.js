'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Image as ImageIcon, LockKeyhole, Rocket, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { todayBR } from '../../lib/config';

const CLOSED=['recusado','reembolso_pendente','reembolsado','cancelado'];
const LABEL={almoco:'Almoço',tarde:'Tarde',noite:'Noite',dia:'Dia inteiro'};
const LIVE=new Set(['ativo','finalizado']);
const money=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const brDate=(v)=>v?new Date(`${v}T12:00:00-03:00`).toLocaleDateString('pt-BR'):'—';

export default function ControlLaunchReview(){
  const [admin,setAdmin]=useState(false);
  const [rows,setRows]=useState([]);
  const [queueOpen,setQueueOpen]=useState(false);
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {data:a}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle(); if(!a)return;
    setAdmin(true);
    const {data:reqs,error}=await supabase.from('hype_solicitacoes').select('*').order('created_at',{ascending:false}).limit(300);
    if(error)return;
    const list=reqs||[], ids=list.map((r)=>r.id); let agenda=[];
    if(ids.length){const res=await supabase.from('hype_agenda').select('id,solicitacao_id,hype_date,quadro,status').in('solicitacao_id',ids).neq('status','cancelado').limit(3000);agenda=res.data||[];}
    const grouped=new Map();
    agenda.forEach((slot)=>{if(!grouped.has(slot.solicitacao_id))grouped.set(slot.solicitacao_id,[]);grouped.get(slot.solicitacao_id).push(slot)});
    setRows(list.map((r)=>{const slots=grouped.get(r.id)||[];return {...r,_agenda:slots,_live:slots.some((s)=>LIVE.has(s.status)),_staging:slots.some((s)=>s.status==='pre_hype')}}));
  }

  useEffect(()=>{let alive=true;let timer;load();timer=setInterval(()=>{if(alive)load()},30000);return()=>{alive=false;clearInterval(timer)}},[]);

  useEffect(()=>{
    if(!admin)return;
    const bind=()=>document.querySelectorAll('.requestCard').forEach((card)=>{
      const ref=card.querySelector('.requestMain small')?.textContent?.trim();
      const r=rows.find((x)=>x.payment_reference===ref); if(!r)return;
      card.querySelectorAll('.actions button.positive:not([data-hocco-review="1"])').forEach((b)=>{b.style.display='none';b.disabled=true});
      if(card.querySelector('[data-hocco-review="1"]')||CLOSED.includes(r.status)||r._live)return;
      const actions=card.querySelector('.actions'); if(!actions)return;
      const btn=document.createElement('button');btn.type='button';btn.className='positive';btn.dataset.hoccoReview='1';btn.textContent='ÚLTIMA REVISÃO';
      btn.onclick=(e)=>{e.preventDefault();e.stopPropagation();setNotice('');setSelected(r)};actions.prepend(btn);
    });
    bind();const observer=new MutationObserver(bind);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[rows,admin]);

  const reviewRows=useMemo(()=>rows.filter((r)=>String(r.created_at||'').slice(0,10)===todayBR()||(r.payment_status==='confirmado'&&!r._live&&!CLOSED.includes(r.status))),[rows]);
  const q1=reviewRows.filter((r)=>r.periodo!=='dia'), q2=reviewRows.filter((r)=>r.periodo==='dia');
  const pending=reviewRows.filter((r)=>!r._live&&!CLOSED.includes(r.status)).length;

  async function subir(){
    if(!selected||busy)return;
    if(selected._live)return setNotice('Esta solicitação já foi publicada.');
    if(selected.payment_status!=='confirmado')return setNotice('Pagamento ainda não está confirmado.');
    if(!selected.logo_url)return setNotice('Falta a foto de perfil/logo.');
    if(!selected.capa_url)return setNotice('Falta a foto de capa.');
    setBusy(true);setNotice('');
    const {data,error}=await supabase.rpc('admin_publish_hype_request',{p_request_id:selected.id});
    setBusy(false);
    if(error){setNotice(publishError(error.message));return;}
    const date=data?.date, boards=data?.boards||[];
    setNotice(selected.periodo==='dia'?`SUBIU · Quadro 2 · Dia inteiro em ${brDate(date)} · Almoço + Tarde + Noite.`:`SUBIU · Quadro 1 · ${LABEL[selected.periodo]} em ${brDate(date)}.`);
    setSelected((r)=>({...r,status:'programado',empresa_id:data?.company_id,_live:true,_staging:false,_agenda:boards.map((quadro)=>({quadro,hype_date:date,status:'ativo'}))}));
    await load();
  }

  if(!admin)return null;
  return <>
    <button type="button" onClick={()=>setQueueOpen(true)} style={floatButton}>SOLICITAÇÕES DO DIA · {pending}</button>
    {queueOpen&&typeof document!=='undefined'&&createPortal(<div style={overlayRight} onMouseDown={(e)=>{if(e.target===e.currentTarget)setQueueOpen(false)}}><aside style={queueStyle}><Header eyebrow="CONTROLE ANTES DE PUBLICAR" title="Solicitações do dia" text="Nada chega ao membro antes da Última revisão e do clique em SUBIR." onClose={()=>setQueueOpen(false)}/><Queue title="QUADRO 1 · POR PERÍODO" subtitle="Almoço · Tarde · Noite" rows={q1} open={(r)=>{setQueueOpen(false);setNotice('');setSelected(r)}}/><Queue title="QUADRO 2 · DIA INTEIRO" subtitle="Contratação única exibida nos três momentos" rows={q2} open={(r)=>{setQueueOpen(false);setNotice('');setSelected(r)}}/>{!reviewRows.length&&<Empty/>}</aside></div>,document.body)}
    {selected&&typeof document!=='undefined'&&createPortal(<div style={overlayCenter} onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}}><section style={reviewStyle}>
      <Header eyebrow={`ÚLTIMA REVISÃO · ${selected.periodo==='dia'?'QUADRO 2':'QUADRO 1'}`} title="Como ficará no Hype" text="Confira pagamento, capa, perfil, benefício e período. Só depois use SUBIR." onClose={()=>setSelected(null)}/>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(250px,.85fr)',gap:14,marginTop:16}}>
        <Preview r={selected}/>
        <div style={{display:'grid',gap:9,alignContent:'start'}}>
          <Check label="Pagamento" ok={selected.payment_status==='confirmado'} value={selected.payment_status}/>
          <Check label="Foto de capa" ok={Boolean(selected.capa_url)} value={selected.capa_url?'Recebida':'Pendente'}/>
          <Check label="Perfil / logo" ok={Boolean(selected.logo_url)} value={selected.logo_url?'Recebido':'Pendente'}/>
          <Check label="Período" ok value={selected.periodo==='dia'?'QUADRO 2 · DIA INTEIRO':`QUADRO 1 · ${LABEL[selected.periodo]||selected.periodo}`}/>
          <Check label="Valor" ok value={money(selected.valor_recebido||selected.valor)}/>
          <Check label="Benefício potencial" ok value={`Até ${Number(selected.desconto||0)}%`}/>
          {selected._staging&&<div style={warning}>Existe um Pré-Hype antigo. Ao SUBIR, ele será substituído atomicamente pela publicação válida.</div>}
        </div>
      </div>
      {notice&&<div style={noticeStyle}>{notice}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.35fr',gap:9,marginTop:14}}><button onClick={()=>setSelected(null)} style={secondary}>VOLTAR</button><button onClick={subir} disabled={busy||selected._live||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url} style={{...primary,opacity:(busy||selected._live||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url)?.45:1}}><Rocket size={16}/>{selected._live?'JÁ ESTÁ NO HYPE':busy?'SUBINDO...':'SUBIR PARA O HYPE'}</button></div>
    </section></div>,document.body)}
  </>;
}

function Queue({title,subtitle,rows,open}){return <section style={{marginTop:18}}><small style={{fontWeight:950,color:'#64768d'}}>{title}</small><p style={{margin:'4px 0 8px',fontSize:11,color:'#8290a0'}}>{subtitle}</p><div style={{display:'grid',gap:8}}>{rows.map((r)=><button key={r.id} onClick={()=>open(r)} style={{border:'1px solid #dfe7f0',background:'#fff',borderRadius:15,padding:12,textAlign:'left',display:'grid',gridTemplateColumns:'1fr auto',gap:10,cursor:'pointer'}}><span><b style={{display:'block',color:'#17304d'}}>{r.nome_fantasia}</b><small style={{color:'#7a899b'}}>{r.payment_reference} · {r.payment_status} · {r._staging?'Pré-Hype aguardando SUBIR':r.status}</small></span><strong style={{fontSize:11,color:r.payment_status==='confirmado'?'#0b8a5b':'#c46b00'}}>{r._live?'PUBLICADA':'REVISAR'}</strong></button>)}</div></section>}
function Preview({r}){return <div style={{background:'#fff',borderRadius:22,overflow:'hidden',border:'1px solid #dce5f0'}}><div style={{height:230,background:'#eaf0f7',position:'relative',overflow:'hidden'}}>{r.capa_url?<img src={r.capa_url} alt="Capa" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:'#8898aa'}}><ImageIcon/></div>}<div style={{position:'absolute',left:14,right:14,bottom:12,display:'flex',gap:10,alignItems:'end'}}><div style={{width:62,height:62,borderRadius:16,background:'#fff',padding:5}}>{r.logo_url?<img src={r.logo_url} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:12}}/>:<ImageIcon/>}</div><div style={{background:'rgba(255,255,255,.94)',borderRadius:13,padding:'8px 11px'}}><b style={{display:'block',color:'#102844'}}>{r.nome_fantasia}</b><small style={{color:'#6b7d92'}}>{r.segmento}</small></div></div></div><div style={{padding:14}}><div style={{background:'#eef5ff',borderRadius:12,padding:'10px 12px',fontWeight:900,color:'#075eea'}}><LockKeyhole size={15} style={{verticalAlign:'middle',marginRight:6}}/>Ajude a liberar até {Number(r.desconto||0)}%</div><button disabled style={{marginTop:10,width:'100%',border:0,borderRadius:13,padding:12,background:'#075eea',color:'#fff',fontWeight:950}}>⚡ HYPAR PARA LIBERAR</button></div></div>}
function Check({label,ok,value}){return <div style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:13,padding:11,display:'grid',gridTemplateColumns:'22px 1fr',gap:8,alignItems:'center'}}>{ok?<CheckCircle2 size={18} color="#0b8a5b"/>:<ShieldCheck size={18} color="#c46b00"/>}<div><small style={{display:'block',color:'#7b899b',fontSize:9,fontWeight:900}}>{label.toUpperCase()}</small><b style={{fontSize:12,color:'#18304d'}}>{String(value||'—').replaceAll('_',' ')}</b></div></div>}
function Header({eyebrow,title,text,onClose}){return <header style={{display:'flex',justifyContent:'space-between',gap:12}}><div><small style={{fontWeight:950,color:'#ff6b00'}}>{eyebrow}</small><h2 style={{margin:'4px 0'}}>{title}</h2><p style={{margin:0,color:'#6d7d92',fontSize:12}}>{text}</p></div><button onClick={onClose} style={{border:0,background:'#fff',borderRadius:12,padding:8,cursor:'pointer',height:40}}><X/></button></header>}
function Empty(){return <div style={{marginTop:18,padding:24,textAlign:'center',border:'1px dashed #ccd7e4',borderRadius:18,color:'#76869a'}}>Nenhuma solicitação aguardando revisão.</div>}
function publishError(message=''){if(message.includes('already_published'))return'Esta solicitação já foi publicada.';if(message.includes('payment_not_confirmed'))return'Pagamento ainda não está confirmado.';if(message.includes('logo_required'))return'Falta a foto de perfil/logo.';if(message.includes('cover_required'))return'Falta a foto de capa.';if(message.includes('no_hype_capacity'))return'Sem vaga disponível nos próximos 60 dias.';if(message.includes('request_closed'))return'Esta solicitação está encerrada.';return'Não foi possível publicar. Nenhuma alteração parcial foi mantida.'}
const floatButton={position:'fixed',right:18,bottom:176,zIndex:8100,border:0,borderRadius:999,background:'#ff6b00',color:'#fff',padding:'11px 15px',fontSize:11,fontWeight:950,boxShadow:'0 12px 34px rgba(255,107,0,.25)',cursor:'pointer'};
const overlayRight={position:'fixed',inset:0,zIndex:14900,background:'rgba(4,15,34,.64)',display:'flex',justifyContent:'flex-end'};
const queueStyle={width:'min(620px,100vw)',height:'100vh',overflow:'auto',background:'#f5f8fc',padding:18,boxShadow:'-24px 0 70px rgba(0,0,0,.24)'};
const overlayCenter={position:'fixed',inset:0,zIndex:15000,background:'rgba(4,15,34,.66)',display:'grid',placeItems:'center',padding:16};
const reviewStyle={width:'min(760px,100%)',maxHeight:'92vh',overflow:'auto',background:'#f5f8fc',borderRadius:26,padding:18,boxShadow:'0 30px 90px rgba(0,0,0,.32)'};
const warning={padding:11,borderRadius:13,background:'#fff5e8',color:'#9a5100',fontSize:11,fontWeight:850};
const noticeStyle={marginTop:12,padding:11,borderRadius:12,background:'#eef5ff',color:'#245487',fontWeight:850,fontSize:12};
const secondary={border:'1px solid #d7e0eb',background:'#fff',borderRadius:13,padding:12,fontWeight:900};
const primary={border:0,background:'#ff6b00',color:'#fff',borderRadius:13,padding:12,fontWeight:950,display:'flex',gap:7,alignItems:'center',justifyContent:'center'};
