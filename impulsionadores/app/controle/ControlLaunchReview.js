'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Image as ImageIcon, LockKeyhole, Rocket, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { todayBR } from '../../lib/config';

const CLOSED=['recusado','reembolso_pendente','reembolsado','cancelado'];
const LABEL={almoco:'Almoço',tarde:'Tarde',noite:'Noite',dia:'Dia inteiro'};
const LIVE_STATUS=new Set(['ativo','finalizado']);

function money(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function brDate(value){return value?new Date(`${value}T12:00:00-03:00`).toLocaleDateString('pt-BR'):'—'}

export default function ControlLaunchReview(){
  const [admin,setAdmin]=useState(false);
  const [rows,setRows]=useState([]);
  const [queueOpen,setQueueOpen]=useState(false);
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data:a}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!a)return;
    setAdmin(true);
    const {data:reqs}=await supabase.from('hype_solicitacoes').select('*').order('created_at',{ascending:false}).limit(300);
    const list=reqs||[];
    const ids=list.map((r)=>r.id);
    let agenda=[];
    if(ids.length){
      const {data}=await supabase.from('hype_agenda').select('id,solicitacao_id,hype_date,quadro,status').in('solicitacao_id',ids).neq('status','cancelado').limit(3000);
      agenda=data||[];
    }
    const byRequest=new Map();
    agenda.forEach((a)=>{if(!byRequest.has(a.solicitacao_id))byRequest.set(a.solicitacao_id,[]);byRequest.get(a.solicitacao_id).push(a)});
    setRows(list.map((r)=>{
      const slots=byRequest.get(r.id)||[];
      return {...r,_agenda:slots,_live:slots.some((a)=>LIVE_STATUS.has(a.status)),_staging:slots.some((a)=>a.status==='pre_hype')};
    }));
  }

  useEffect(()=>{
    let alive=true;let timer;
    (async()=>{if(alive)await load()})();
    timer=setInterval(()=>{if(alive)load()},30000);
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    if(!admin)return;
    const bind=()=>document.querySelectorAll('.requestCard').forEach((card)=>{
      if(card.dataset.launchReviewBound==='1')return;
      const ref=card.querySelector('.requestMain small')?.textContent?.trim();
      const r=rows.find((x)=>x.payment_reference===ref);
      if(!r)return;
      card.dataset.launchReviewBound='1';
      card.querySelectorAll('.actions button.positive').forEach((b)=>b.style.display='none');
      if(CLOSED.includes(r.status)||r._live)return;
      const actions=card.querySelector('.actions');if(!actions)return;
      const btn=document.createElement('button');btn.type='button';btn.className='positive';btn.dataset.hoccoReview='1';btn.innerHTML='ÚLTIMA REVISÃO';
      btn.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();setNotice('');setSelected(r)});
      actions.prepend(btn);
    });
    bind();
    const o=new MutationObserver(bind);o.observe(document.body,{childList:true,subtree:true});
    return()=>o.disconnect();
  },[rows,admin]);

  const reviewRows=useMemo(()=>rows.filter((r)=>{
    const createdToday=String(r.created_at||'').slice(0,10)===todayBR();
    const waitingReview=r.payment_status==='confirmado'&&!r._live&&!CLOSED.includes(r.status);
    return createdToday||waitingReview;
  }),[rows]);
  const quadro1=reviewRows.filter((r)=>r.periodo!=='dia');
  const quadro2=reviewRows.filter((r)=>r.periodo==='dia');
  const pendingCount=reviewRows.filter((r)=>!r._live&&!CLOSED.includes(r.status)).length;

  async function findNextDate(period,preferred){
    const start=preferred&&preferred>=todayBR()?preferred:todayBR();
    const {data:future}=await supabase.from('hype_agenda').select('hype_date,quadro,status').gte('hype_date',start).neq('status','cancelado').limit(3000);
    const list=future||[];
    let base=new Date(`${start}T12:00:00-03:00`);
    const hour=Number(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date()));
    for(let i=0;i<60;i+=1){
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(base);
      const boards=period==='dia'?['almoco','tarde','noite']:[period];
      const ok=boards.every((b)=>{
        const full=list.filter((x)=>x.hype_date===date&&x.quadro===b&&x.status!=='cancelado').length>=10;
        const started=date===todayBR()&&(b==='almoco'?hour>=11:b==='tarde'?hour>=14:hour>=18);
        return !full&&!started;
      });
      if(ok)return date;
      base=new Date(base.getTime()+86400000);
    }
    throw new Error('Sem vaga disponível nos próximos 60 dias.');
  }

  async function subir(){
    const r=selected;if(!r||busy)return;
    if(r._live)return setNotice('Esta solicitação já foi publicada para os membros.');
    if(r.payment_status!=='confirmado')return setNotice('Pagamento ainda não está confirmado.');
    if(!r.logo_url)return setNotice('Falta a foto de perfil/logo.');
    if(!r.capa_url)return setNotice('Falta a foto de capa.');
    setBusy(true);setNotice('');
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const {data:existingAgenda,error:existingError}=await supabase.from('hype_agenda').select('id,status').eq('solicitacao_id',r.id).neq('status','cancelado');
      if(existingError)throw existingError;
      if((existingAgenda||[]).some((a)=>LIVE_STATUS.has(a.status)))throw new Error('Esta solicitação já está publicada.');
      if((existingAgenda||[]).length){
        const {error}=await supabase.from('hype_agenda').update({status:'cancelado',updated_at:new Date().toISOString()}).eq('solicitacao_id',r.id).eq('status','pre_hype');
        if(error)throw error;
      }

      let {data:company}=await supabase.from('hype_empresas').select('*').eq('cnpj',r.cnpj).maybeSingle();
      const companyPayload={
        razao_social:r.razao_social,nome_fantasia:r.nome_fantasia,cnpj:r.cnpj,whatsapp:r.whatsapp,email:r.email,
        cidade:r.cidade,uf:r.uf,segmento:r.segmento,logo_url:r.logo_url,capa_url:r.capa_url,instagram:r.instagram,
        site_url:r.site_url,desconto_padrao:r.desconto,condicoes:r.condicoes,beneficio_validade:r.beneficio_validade,
        ativo:true,updated_at:new Date().toISOString()
      };
      if(company){
        const {data,error}=await supabase.from('hype_empresas').update(companyPayload).eq('id',company.id).select().single();if(error)throw error;company=data;
      }else{
        const {data,error}=await supabase.from('hype_empresas').insert(companyPayload).select().single();if(error)throw error;company=data;
      }

      const date=await findNextDate(r.periodo,r.data_preferida);
      const boards=r.periodo==='dia'?['almoco','tarde','noite']:[r.periodo];
      const agendaRows=boards.map((quadro)=>({
        empresa_id:company.id,solicitacao_id:r.id,hype_date:date,quadro,periodo_origem:r.periodo,tamanho:r.tamanho,
        valor_pago:r.valor,valor_tabela:r.valor_tabela||r.valor,valor_cobrado:r.valor_cobrado||r.valor,
        valor_recebido:r.valor_recebido||r.valor,tipo_comercial:r.tipo_comercial||'pix',financeiro_status:'recebido',
        desconto:r.desconto,status:'ativo',created_by:user.id
      }));
      const {error:agendaError}=await supabase.from('hype_agenda').insert(agendaRows);if(agendaError)throw agendaError;
      const {error:reqError}=await supabase.from('hype_solicitacoes').update({empresa_id:company.id,status:'programado',updated_at:new Date().toISOString()}).eq('id',r.id);if(reqError)throw reqError;
      await supabase.from('hocco_admin_audit').insert({
        admin_user_id:user.id,action:'final_review_publish',entity_type:'hype_solicitacao',entity_id:r.id,
        metadata:{date,boards,periodo_origem:r.periodo,quadro_operacional:r.periodo==='dia'?2:1}
      });
      const updated={...r,status:'programado',empresa_id:company.id,_live:true,_staging:false,_agenda:agendaRows};
      setRows((all)=>all.map((x)=>x.id===r.id?updated:x));setSelected(updated);
      setNotice(r.periodo==='dia'?`SUBIU · Quadro 2 · Dia inteiro em ${brDate(date)} · visível em Almoço, Tarde e Noite.`:`SUBIU · Quadro 1 · ${LABEL[r.periodo]} em ${brDate(date)}.`);
    }catch(e){setNotice(e.message||'Não foi possível subir a empresa.');}
    finally{setBusy(false)}
  }

  function openReview(row){setQueueOpen(false);setNotice('');setSelected(row)}

  if(!admin)return null;
  return <>
    <button type="button" onClick={()=>setQueueOpen(true)} style={{position:'fixed',right:18,bottom:176,zIndex:8100,border:0,borderRadius:999,background:'#ff6b00',color:'#fff',padding:'11px 15px',fontSize:11,fontWeight:950,boxShadow:'0 12px 34px rgba(255,107,0,.25)',cursor:'pointer'}}>SOLICITAÇÕES DO DIA · {pendingCount}</button>

    {queueOpen&&typeof document!=='undefined'&&createPortal(<div onMouseDown={(e)=>{if(e.target===e.currentTarget)setQueueOpen(false)}} style={{position:'fixed',inset:0,zIndex:14900,background:'rgba(4,15,34,.64)',display:'flex',justifyContent:'flex-end'}}><aside style={{width:'min(620px,100vw)',height:'100vh',overflow:'auto',background:'#f5f8fc',padding:18,boxShadow:'-24px 0 70px rgba(0,0,0,.24)'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:12,position:'sticky',top:0,zIndex:3,background:'#f5f8fc',paddingBottom:12,borderBottom:'1px solid #dfe6ef'}}><div><small style={{fontWeight:950,color:'#ff6b00'}}>CONTROLE ANTES DE PUBLICAR</small><h2 style={{margin:'4px 0'}}>Solicitações do dia</h2><p style={{margin:0,color:'#6d7d92',fontSize:12}}>Nada chega ao membro antes da Última revisão e do clique em SUBIR.</p></div><button onClick={()=>setQueueOpen(false)} style={{border:0,background:'#fff',borderRadius:12,padding:8,cursor:'pointer'}}><X/></button></header>
      <QueueSection title="QUADRO 1 · POR PERÍODO" subtitle="Almoço · Tarde · Noite" rows={quadro1} onReview={openReview}/>
      <QueueSection title="QUADRO 2 · DIA INTEIRO" subtitle="Contratação única exibida nos três momentos" rows={quadro2} onReview={openReview}/>
      {!reviewRows.length&&<div style={{marginTop:18,padding:24,textAlign:'center',border:'1px dashed #ccd7e4',borderRadius:18,color:'#76869a'}}>Nenhuma solicitação aguardando revisão.</div>}
    </aside></div>,document.body)}

    {selected&&typeof document!=='undefined'&&createPortal(<div onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}} style={{position:'fixed',inset:0,zIndex:15000,background:'rgba(4,15,34,.66)',display:'grid',placeItems:'center',padding:16}}><section style={{width:'min(760px,100%)',maxHeight:'92vh',overflow:'auto',background:'#f5f8fc',borderRadius:26,padding:18,boxShadow:'0 30px 90px rgba(0,0,0,.32)'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:12}}><div><small style={{fontWeight:950,color:'#ff6b00'}}>ÚLTIMA REVISÃO · {selected.periodo==='dia'?'QUADRO 2':'QUADRO 1'}</small><h2 style={{margin:'4px 0'}}>Como ficará no Hype</h2><p style={{margin:0,color:'#6d7d92',fontSize:12}}>Confira pagamento, capa, perfil, benefício e período. Só depois use SUBIR.</p></div><button onClick={()=>setSelected(null)} style={{border:0,background:'#fff',borderRadius:12,padding:8,cursor:'pointer'}}><X/></button></header>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(250px,.85fr)',gap:14,marginTop:16}}>
        <div style={{background:'#fff',borderRadius:22,overflow:'hidden',border:'1px solid #dce5f0',boxShadow:'0 16px 40px rgba(20,50,90,.1)'}}>
          <div style={{height:230,background:'#eaf0f7',position:'relative',overflow:'hidden'}}>{selected.capa_url?<img src={selected.capa_url} alt="Capa" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:'#8898aa'}}><ImageIcon size={34}/></div>}<div style={{position:'absolute',inset:'auto 14px 12px 14px',display:'flex',alignItems:'end',gap:10}}><div style={{width:62,height:62,borderRadius:16,background:'#fff',padding:5,boxShadow:'0 8px 20px rgba(0,0,0,.16)'}}>{selected.logo_url?<img src={selected.logo_url} alt="Perfil" style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:12}}/>:<ImageIcon/>}</div><div style={{background:'rgba(255,255,255,.94)',borderRadius:13,padding:'8px 11px'}}><b style={{display:'block',color:'#102844'}}>{selected.nome_fantasia}</b><small style={{color:'#6b7d92'}}>{selected.segmento}</small></div></div></div>
          <div style={{padding:14}}><div style={{background:'#eef5ff',borderRadius:12,padding:'10px 12px',fontWeight:900,color:'#075eea'}}><LockKeyhole size={15} style={{verticalAlign:'middle',marginRight:6}}/>Ajude a liberar até {Number(selected.desconto||0)}%</div><button disabled style={{marginTop:10,width:'100%',border:0,borderRadius:13,padding:12,background:'#075eea',color:'#fff',fontWeight:950}}>⚡ HYPAR PARA LIBERAR</button></div>
        </div>
        <div style={{display:'grid',gap:9,alignContent:'start'}}>
          <Check label="Pagamento" ok={selected.payment_status==='confirmado'} value={selected.payment_status==='confirmado'?`Confirmado · ${money(selected.valor_recebido||selected.valor)}`:selected.payment_status}/>
          <Check label="Foto de capa" ok={Boolean(selected.capa_url)} value={selected.capa_url?'Recebida':'Pendente'}/>
          <Check label="Perfil / logo" ok={Boolean(selected.logo_url)} value={selected.logo_url?'Recebido':'Pendente'}/>
          <Check label="Período" ok value={selected.periodo==='dia'?'QUADRO 2 · DIA INTEIRO':`QUADRO 1 · ${LABEL[selected.periodo]||selected.periodo}`}/>
          {selected.periodo==='dia'&&<div style={{padding:11,borderRadius:13,background:'#fff5e8',color:'#9a5100',fontSize:11,fontWeight:850}}>Dia inteiro fica no Quadro 2 do Control. Depois de SUBIR, a mesma contratação aparece ao membro nos momentos Almoço, Tarde e Noite.</div>}
          <Check label="Benefício potencial" ok value={`Até ${Number(selected.desconto||0)}%`}/>
          <Check label="Data preferida" ok value={brDate(selected.data_preferida)}/>
          <Check label="Status de publicação" ok={selected._live} value={selected._live?'Já publicado':'Ainda privado'}/>
        </div>
      </div>
      {notice&&<div style={{marginTop:12,padding:11,borderRadius:12,background:'#eef5ff',color:'#245487',fontWeight:850,fontSize:12}}>{notice}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.35fr',gap:9,marginTop:14}}><button onClick={()=>{setSelected(null);setQueueOpen(true)}} style={{border:'1px solid #d7e0eb',background:'#fff',borderRadius:13,padding:12,fontWeight:900}}>VOLTAR ÀS SOLICITAÇÕES</button><button onClick={subir} disabled={busy||selected._live||CLOSED.includes(selected.status)||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url} style={{border:0,background:'#ff6b00',color:'#fff',borderRadius:13,padding:12,fontWeight:950,opacity:(busy||selected._live||CLOSED.includes(selected.status)||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url)?.45:1}}><Rocket size={16} style={{verticalAlign:'middle',marginRight:7}}/>{selected._live?'JÁ ESTÁ NO HYPE':busy?'SUBINDO...':'SUBIR PARA O HYPE'}</button></div>
    </section></div>,document.body)}
  </>;
}

function QueueSection({title,subtitle,rows,onReview}){
  return <section style={{marginTop:16}}><div><small style={{fontSize:9,fontWeight:950,color:'#718096'}}>{title}</small><p style={{margin:'3px 0 8px',fontSize:11,color:'#8390a0'}}>{subtitle}</p></div><div style={{display:'grid',gap:9}}>{rows.map((r)=><article key={r.id} style={{background:'#fff',border:'1px solid #dfe7f0',borderRadius:16,padding:12,display:'grid',gridTemplateColumns:'48px 1fr auto',gap:10,alignItems:'center'}}><div style={{width:48,height:48,borderRadius:12,overflow:'hidden',background:'#eef3f8',display:'grid',placeItems:'center'}}>{r.logo_url?<img src={r.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<ImageIcon size={19}/>}</div><div><b style={{display:'block',fontSize:12,color:'#18304d'}}>{r.nome_fantasia}</b><small style={{display:'block',marginTop:3,color:'#75859a'}}>{r.payment_reference} · {r.periodo==='dia'?'DIA INTEIRO':LABEL[r.periodo]} · {money(r.valor)}</small><small style={{display:'block',marginTop:3,fontWeight:850,color:r.payment_status==='confirmado'?'#08785a':'#ad6500'}}>{r.payment_status==='confirmado'?'PAGAMENTO CONFIRMADO':String(r.payment_status).replaceAll('_',' ').toUpperCase()} · {r.capa_url&&r.logo_url?'MATERIAIS OK':'MATERIAL PENDENTE'}</small></div><button onClick={()=>onReview(r)} disabled={r._live||CLOSED.includes(r.status)} style={{border:0,borderRadius:11,padding:'9px 10px',background:r._live?'#edf1f5':'#075eea',color:r._live?'#7c8795':'#fff',fontSize:9,fontWeight:950,cursor:r._live?'default':'pointer'}}>{r._live?'PUBLICADO':'ÚLTIMA REVISÃO'}</button></article>)}{!rows.length&&<div style={{padding:14,borderRadius:13,background:'#fff',color:'#8794a5',fontSize:11}}>Nenhuma solicitação neste quadro.</div>}</div></section>
}

function Check({label,ok,value}){return <div style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:13,padding:11,display:'grid',gridTemplateColumns:'22px 1fr',gap:8,alignItems:'center'}}>{ok?<CheckCircle2 size={18} color="#0b8a5b"/>:<ShieldCheck size={18} color="#c46b00"/>}<div><small style={{display:'block',color:'#7b899b',fontSize:9,fontWeight:900}}>{label.toUpperCase()}</small><b style={{fontSize:12,color:'#18304d'}}>{String(value||'—').replaceAll('_',' ')}</b></div></div>}
