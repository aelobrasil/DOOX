'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Image as ImageIcon, LockKeyhole, Rocket, ShieldCheck, X, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { todayBR } from '../../lib/config';

const FINAL=['programado','recusado','reembolso_pendente','reembolsado','cancelado'];
const LABEL={almoco:'Almoço',tarde:'Tarde',noite:'Noite',dia:'Dia inteiro'};

export default function ControlLaunchReview(){
  const [admin,setAdmin]=useState(false);
  const [rows,setRows]=useState([]);
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let alive=true;let timer;
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();if(!user||!alive)return;
      const {data:a}=await supabase.from('hocco_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(!a||!alive)return;
      setAdmin(true);
      const {data}=await supabase.from('hype_solicitacoes').select('*').order('created_at',{ascending:false}).limit(300);
      if(alive)setRows(data||[]);
    }
    load();timer=setInterval(load,30000);return()=>{alive=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    if(!admin)return;
    const bind=()=>document.querySelectorAll('.requestCard').forEach((card)=>{
      if(card.dataset.launchReviewBound==='1')return;
      const ref=card.querySelector('.requestMain small')?.textContent?.trim();const r=rows.find((x)=>x.payment_reference===ref);if(!r)return;
      card.dataset.launchReviewBound='1';
      card.querySelectorAll('.actions button.positive').forEach((b)=>b.style.display='none');
      if(FINAL.includes(r.status))return;
      const actions=card.querySelector('.actions');if(!actions)return;
      const btn=document.createElement('button');btn.type='button';btn.className='positive';btn.dataset.hoccoReview='1';btn.innerHTML='ÚLTIMA REVISÃO';
      btn.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();setNotice('');setSelected(r)});actions.prepend(btn);
    });
    bind();const o=new MutationObserver(bind);o.observe(document.body,{childList:true,subtree:true});return()=>o.disconnect();
  },[rows,admin]);

  const todayRows=useMemo(()=>rows.filter((r)=>String(r.created_at||'').slice(0,10)===todayBR()||(!FINAL.includes(r.status)&&r.payment_status==='confirmado')),[rows]);

  async function findNextDate(period,preferred){
    const start=preferred&&preferred>=todayBR()?preferred:todayBR();
    const {data:future}=await supabase.from('hype_agenda').select('hype_date,quadro,status').gte('hype_date',start).neq('status','cancelado').limit(3000);
    const list=future||[];let base=new Date(`${start}T12:00:00-03:00`);
    const hour=Number(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date()));
    for(let i=0;i<60;i+=1){
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(base);
      const boards=period==='dia'?['almoco','tarde','noite']:[period];
      const ok=boards.every((b)=>{const full=list.filter((x)=>x.hype_date===date&&x.quadro===b).length>=10;const started=date===todayBR()&&(b==='almoco'?hour>=11:b==='tarde'?hour>=14:hour>=18);return !full&&!started});
      if(ok)return date;base=new Date(base.getTime()+86400000);
    }
    throw new Error('Sem vaga disponível nos próximos 60 dias.');
  }

  async function subir(){
    const r=selected;if(!r||busy)return;
    if(r.payment_status!=='confirmado')return setNotice('Pagamento ainda não está confirmado.');
    if(!r.logo_url)return setNotice('Falta a foto de perfil/logo.');
    if(!r.capa_url)return setNotice('Falta a foto de capa.');
    setBusy(true);setNotice('');
    try{
      const {data:existingAgenda}=await supabase.from('hype_agenda').select('id').eq('solicitacao_id',r.id).neq('status','cancelado').limit(1);
      if(existingAgenda?.length)throw new Error('Esta solicitação já possui agenda ativa.');
      let {data:company}=await supabase.from('hype_empresas').select('*').eq('cnpj',r.cnpj).maybeSingle();
      const companyPayload={razao_social:r.razao_social,nome_fantasia:r.nome_fantasia,cnpj:r.cnpj,whatsapp:r.whatsapp,email:r.email,cidade:r.cidade,uf:r.uf,segmento:r.segmento,logo_url:r.logo_url,capa_url:r.capa_url,instagram:r.instagram,site_url:r.site_url,desconto_padrao:r.desconto,condicoes:r.condicoes,beneficio_validade:r.beneficio_validade,ativo:true,updated_at:new Date().toISOString()};
      if(company){const {data,error}=await supabase.from('hype_empresas').update(companyPayload).eq('id',company.id).select().single();if(error)throw error;company=data}
      else{const {data,error}=await supabase.from('hype_empresas').insert(companyPayload).select().single();if(error)throw error;company=data}
      const date=await findNextDate(r.periodo,r.data_preferida);
      const boards=r.periodo==='dia'?['almoco','tarde','noite']:[r.periodo];
      const {data:{user}}=await supabase.auth.getUser();
      const agendaRows=boards.map((quadro)=>({empresa_id:company.id,solicitacao_id:r.id,hype_date:date,quadro,periodo_origem:r.periodo,tamanho:r.tamanho,valor_pago:r.valor,valor_tabela:r.valor_tabela||r.valor,valor_cobrado:r.valor_cobrado||r.valor,valor_recebido:r.valor_recebido||r.valor,tipo_comercial:r.tipo_comercial||'pix',financeiro_status:'recebido',desconto:r.desconto,status:'pre_hype',created_by:user.id}));
      const {error:agendaError}=await supabase.from('hype_agenda').insert(agendaRows);if(agendaError)throw agendaError;
      const {error:reqError}=await supabase.from('hype_solicitacoes').update({empresa_id:company.id,status:'programado',updated_at:new Date().toISOString()}).eq('id',r.id);if(reqError)throw reqError;
      await supabase.from('hocco_admin_audit').insert({admin_user_id:user.id,action:'final_review_publish',entity_type:'hype_solicitacao',entity_id:r.id,metadata:{date,boards,periodo_origem:r.periodo}});
      setNotice(r.periodo==='dia'?`SUBIU · Dia inteiro em ${date} · Almoço + Tarde + Noite.`:`SUBIU · ${LABEL[r.periodo]} em ${date}.`);
      setRows((all)=>all.map((x)=>x.id===r.id?{...x,status:'programado',empresa_id:company.id}:x));setSelected((s)=>({...s,status:'programado'}));
    }catch(e){setNotice(e.message||'Não foi possível subir a empresa.');}
    finally{setBusy(false)}
  }

  if(!admin)return null;
  return <>
    <button type="button" onClick={()=>setSelected(todayRows.find((r)=>!FINAL.includes(r.status))||todayRows[0]||null)} style={{position:'fixed',right:18,bottom:176,zIndex:8100,border:0,borderRadius:999,background:'#ff6b00',color:'#fff',padding:'11px 15px',fontSize:11,fontWeight:950,boxShadow:'0 12px 34px rgba(255,107,0,.25)',cursor:'pointer'}}>SOLICITAÇÕES DO DIA · {todayRows.length}</button>
    {selected&&typeof document!=='undefined'&&createPortal(<div onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null)}} style={{position:'fixed',inset:0,zIndex:15000,background:'rgba(4,15,34,.66)',display:'grid',placeItems:'center',padding:16}}><section style={{width:'min(720px,100%)',maxHeight:'92vh',overflow:'auto',background:'#f5f8fc',borderRadius:26,padding:18,boxShadow:'0 30px 90px rgba(0,0,0,.32)'}}>
      <header style={{display:'flex',justifyContent:'space-between',gap:12}}><div><small style={{fontWeight:950,color:'#ff6b00'}}>ÚLTIMA REVISÃO</small><h2 style={{margin:'4px 0'}}>Como ficará no Hype</h2><p style={{margin:0,color:'#6d7d92',fontSize:12}}>Confira pagamento, capa, perfil, benefício e período. Só depois use SUBIR.</p></div><button onClick={()=>setSelected(null)} style={{border:0,background:'#fff',borderRadius:12,padding:8,cursor:'pointer'}}><X/></button></header>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(250px,.85fr)',gap:14,marginTop:16}}>
        <div style={{background:'#fff',borderRadius:22,overflow:'hidden',border:'1px solid #dce5f0',boxShadow:'0 16px 40px rgba(20,50,90,.1)'}}>
          <div style={{height:210,background:'#eaf0f7',position:'relative',overflow:'hidden'}}>{selected.capa_url?<img src={selected.capa_url} alt="Capa" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:'#8898aa'}}><ImageIcon size={34}/></div>}<div style={{position:'absolute',inset:'auto 14px 12px 14px',display:'flex',alignItems:'end',gap:10}}><div style={{width:62,height:62,borderRadius:16,background:'#fff',padding:5,boxShadow:'0 8px 20px rgba(0,0,0,.16)'}}>{selected.logo_url?<img src={selected.logo_url} alt="Perfil" style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:12}}/>:<ImageIcon/>}</div><div style={{background:'rgba(255,255,255,.94)',borderRadius:13,padding:'8px 11px'}}><b style={{display:'block',color:'#102844'}}>{selected.nome_fantasia}</b><small style={{color:'#6b7d92'}}>{selected.segmento}</small></div></div></div>
          <div style={{padding:14}}><div style={{background:'#eef5ff',borderRadius:12,padding:'10px 12px',fontWeight:900,color:'#075eea'}}><LockKeyhole size={15} style={{verticalAlign:'middle',marginRight:6}}/>Ajude a liberar até {Number(selected.desconto||0)}%</div><button disabled style={{marginTop:10,width:'100%',border:0,borderRadius:13,padding:12,background:'#075eea',color:'#fff',fontWeight:950}}>⚡ HYPAR PARA LIBERAR</button></div>
        </div>
        <div style={{display:'grid',gap:9,alignContent:'start'}}><Check label="Pagamento" ok={selected.payment_status==='confirmado'} value={selected.payment_status}/><Check label="Foto de capa" ok={Boolean(selected.capa_url)} value={selected.capa_url?'Recebida':'Pendente'}/><Check label="Perfil / logo" ok={Boolean(selected.logo_url)} value={selected.logo_url?'Recebido':'Pendente'}/><Check label="Período" ok value={selected.periodo==='dia'?'QUADRO 2 · DIA INTEIRO':`QUADRO 1 · ${LABEL[selected.periodo]||selected.periodo}`}/>{selected.periodo==='dia'&&<div style={{padding:11,borderRadius:13,background:'#fff5e8',color:'#9a5100',fontSize:11,fontWeight:850}}>Dia Inteiro ocupará Almoço + Tarde + Noite, mas continuará identificado como contratação única do Quadro 2.</div>}<Check label="Benefício potencial" ok value={`Até ${Number(selected.desconto||0)}%`}/><Check label="Status" ok={!FINAL.includes(selected.status)||selected.status==='programado'} value={selected.status}/></div>
      </div>
      {notice&&<div style={{marginTop:12,padding:11,borderRadius:12,background:'#eef5ff',color:'#245487',fontWeight:850,fontSize:12}}>{notice}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.35fr',gap:9,marginTop:14}}><button onClick={()=>setSelected(null)} style={{border:'1px solid #d7e0eb',background:'#fff',borderRadius:13,padding:12,fontWeight:900}}>VOLTAR</button><button onClick={subir} disabled={busy||selected.status==='programado'||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url} style={{border:0,background:'#ff6b00',color:'#fff',borderRadius:13,padding:12,fontWeight:950,opacity:(busy||selected.status==='programado'||selected.payment_status!=='confirmado'||!selected.logo_url||!selected.capa_url)?.45:1}}><Rocket size={16} style={{verticalAlign:'middle',marginRight:7}}/>{selected.status==='programado'?'JÁ ESTÁ NO HYPE':busy?'SUBINDO...':'SUBIR PARA O HYPE'}</button></div>
    </section></div>,document.body)}
  </>;
}

function Check({label,ok,value}){return <div style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:13,padding:11,display:'grid',gridTemplateColumns:'22px 1fr',gap:8,alignItems:'center'}}>{ok?<CheckCircle2 size={18} color="#0b8a5b"/>:<ShieldCheck size={18} color="#c46b00"/>}<div><small style={{display:'block',color:'#7b899b',fontSize:9,fontWeight:900}}>{label.toUpperCase()}</small><b style={{fontSize:12,color:'#18304d'}}>{String(value||'—').replaceAll('_',' ')}</b></div></div>}
