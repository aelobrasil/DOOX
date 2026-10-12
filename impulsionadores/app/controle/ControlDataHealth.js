'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, HardDrive, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function mb(value){ return `${(Number(value||0)/1024/1024).toFixed(1)} MB`; }
function pct(value){ return `${Number(value||0).toFixed(2)}%`; }
function when(value){ return value ? new Date(value).toLocaleString('pt-BR') : '—'; }

export default function ControlDataHealth(){
  const [health,setHealth]=useState(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  useEffect(()=>{ load(); },[]);
  async function load(){
    const {data,error}=await supabase.rpc('admin_data_health');
    if(!error&&data)setHealth(data);
  }
  async function run(){
    if(!confirm('Executar agora a manutenção de ciclo de vida? Somente dados já elegíveis pela política serão limpos.'))return;
    setBusy(true); setMsg('Executando manutenção segura...');
    const {data,error}=await supabase.rpc('admin_run_data_lifecycle');
    setBusy(false);
    setMsg(error ? `Falha: ${error.message}` : data?.skipped ? 'Banco saudável: a manutenção completa recente ainda é válida.' : 'Manutenção concluída.');
    await load();
  }

  const status=health?.status||'VERIFICANDO';
  const deleted=useMemo(()=>health?.last_run?.deleted||{},[health]);
  if(!health)return null;

  return <>
    <button onClick={()=>setOpen(true)} style={S.launch}><Database size={16}/><span>DB {pct(health.db_pct)}</span><b>{status}</b></button>
    {open&&<div style={S.backdrop}>
      <section style={S.panel}>
        <header style={S.head}><div><small style={S.kicker}>HOCCO CONTROL · CAPACIDADE</small><h2 style={S.title}>Saúde do Supabase</h2><p style={S.muted}>O banco mede a própria ocupação e acelera a limpeza de dados temporários antes de atingir a reserva operacional.</p></div><button style={S.close} onClick={()=>setOpen(false)}><X/></button></header>
        <div style={S.grid}>
          <Metric icon={Database} title="Banco Postgres" value={`${mb(health.db_bytes)} / ${mb(health.db_quota_bytes)}`} percent={health.db_pct}/>
          <Metric icon={HardDrive} title="Storage" value={`${mb(health.storage_bytes)} / ${mb(health.storage_quota_bytes)}`} percent={health.storage_pct}/>
          <div style={S.card}><ShieldCheck/><small>STATUS</small><strong>{status}</strong><span>20% de reserva operacional protegida</span></div>
        </div>
        <section style={S.rules}>
          <b>Gatilhos automáticos</b>
          <div><span>0–54%</span><strong>VERDE</strong><em>manutenção normal</em></div>
          <div><span>55–64%</span><strong>AMARELO</strong><em>antecipa TEMP</em></div>
          <div><span>65–74%</span><strong>LARANJA</strong><em>limpeza intensificada</em></div>
          <div><span>75–79%</span><strong>VERMELHO</strong><em>retenção reduzida</em></div>
          <div><span>≥80%</span><strong>PROTEÇÃO</strong><em>reserva para novas operações</em></div>
        </section>
        <section style={S.last}><div><small>ÚLTIMA MANUTENÇÃO</small><b>{when(health.last_run?.finished_at)}</b><span>{health.last_run?.success===false?'Falhou':'Concluída'} · status {health.last_run?.status||'—'}</span></div><div><small>ROTINA</small><b>A cada hora</b><span>Em VERDE, manutenção pesada no máximo a cada 12h.</span></div></section>
        <section style={S.deleted}><b>Último expurgo elegível</b><div>{Object.entries(deleted).map(([key,value])=><span key={key}>{key.replaceAll('_',' ')} <strong>{Number(value||0).toLocaleString('pt-BR')}</strong></span>)}</div></section>
        <p style={S.note}>Protegidos da limpeza automática: contas ativas, saldo atual de HC/XP, pagamentos, financeiro, contratos, empresas ativas, relatórios consolidados e auditoria administrativa necessária. Hype bruto só é apagado quando existe relatório consolidado correspondente.</p>
        {msg&&<div style={S.msg}>{msg}</div>}
        <div style={S.actions}><button style={S.secondary} onClick={load}><RefreshCw size={15}/> Atualizar</button><button style={S.primary} disabled={busy} onClick={run}>{busy?'PROCESSANDO...':'MANUTENÇÃO AGORA'}</button></div>
      </section>
    </div>}
  </>;
}

function Metric({icon:Icon,title,value,percent}){ return <div style={S.card}><Icon/><small>{title}</small><strong>{value}</strong><div style={S.bar}><i style={{width:`${Math.min(100,Number(percent||0))}%`}}/></div><span>{pct(percent)} utilizado</span></div>; }

const S={
  launch:{position:'fixed',right:16,bottom:18,zIndex:9100,border:'1px solid #dfe6ee',borderRadius:999,background:'#fff',color:'#10213b',padding:'10px 14px',fontWeight:900,fontSize:11,display:'flex',alignItems:'center',gap:7,boxShadow:'0 12px 34px rgba(16,33,59,.16)',cursor:'pointer'},
  backdrop:{position:'fixed',inset:0,zIndex:32000,background:'rgba(5,15,31,.7)',backdropFilter:'blur(7px)',display:'grid',placeItems:'center',padding:16},
  panel:{width:'min(980px,96vw)',maxHeight:'92vh',overflow:'auto',background:'#f5f8fc',borderRadius:26,padding:22,color:'#10213b',fontFamily:'system-ui',boxShadow:'0 30px 100px rgba(0,0,0,.38)'},
  head:{display:'flex',justifyContent:'space-between',gap:18},kicker:{fontSize:10,fontWeight:900,letterSpacing:'.12em',color:'#075eea'},title:{fontSize:30,margin:'5px 0'},muted:{color:'#6c7d93',fontSize:13,lineHeight:1.55,maxWidth:720},close:{border:0,background:'transparent',cursor:'pointer'},
  grid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,margin:'18px 0'},card:{background:'#fff',border:'1px solid #e0e7ef',borderRadius:17,padding:15,display:'grid',gap:6},
  bar:{height:7,borderRadius:99,background:'#edf1f6',overflow:'hidden'},
  rules:{background:'#fff',border:'1px solid #e0e7ef',borderRadius:18,padding:16,display:'grid',gap:8},last:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10,marginTop:10},deleted:{background:'#fff',border:'1px solid #e0e7ef',borderRadius:18,padding:16,marginTop:10},note:{fontSize:12,color:'#607187',lineHeight:1.55},msg:{padding:10,borderRadius:11,background:'#eef5ff',fontSize:12,fontWeight:700},actions:{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12},secondary:{border:'1px solid #d9e2ec',background:'#fff',borderRadius:11,padding:'10px 12px',fontWeight:800,display:'flex',alignItems:'center',gap:6,cursor:'pointer'},primary:{border:0,background:'#075eea',color:'#fff',borderRadius:11,padding:'10px 13px',fontWeight:900,cursor:'pointer'},
};
