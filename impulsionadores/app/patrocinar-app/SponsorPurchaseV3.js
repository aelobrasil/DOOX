'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { PIX_BANK, PIX_CITY, PIX_RECEIVER, brl } from '../../lib/config';
import { pixPayload } from '../../lib/pix';
import './sponsor-purchase-v3.css';

const PLANS={7:{days:7,price:49.90,label:'7 dias'},30:{days:30,price:189.90,label:'30 dias'}};
const BOARDS={1:'Início',2:'Ofertas',3:'Missões',4:'Drops / Experiências',5:'Perfil'};
const DESTINOS=['whatsapp','instagram','facebook','youtube','tiktok','site'];
const WAITING=new Set(['SOLICITADO','AGUARDANDO PAGAMENTO']);

export default function SponsorPurchaseV3(){
  const [user,setUser]=useState(null),[rows,setRows]=useState([]),[availability,setAvailability]=useState([]),[planDays,setPlanDays]=useState(7),[logo,setLogo]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[payment,setPayment]=useState(null);
  const plan=PLANS[planDays];
  const active=useMemo(()=>rows.filter((r)=>r.status==='ATIVO'&&r.fim_at&&new Date(r.fim_at)>new Date()),[rows]);

  useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user)return location.replace('/');setUser(data.user);load(data.user.id)})},[]);
  async function load(uid=user?.id){if(!uid)return;const [r,a]=await Promise.all([supabase.from('hocco_patrocinios').select('*').eq('user_id',uid).order('created_at',{ascending:false}),supabase.rpc('marcas_permanentes_disponibilidade')]);setRows(r.data||[]);setAvailability(a.data||[])}
  function boardInfo(n){return availability.find((x)=>Number(x.quadro)===Number(n))||{ocupadas:0,livres:5,fila:0}}

  async function upload(event){const file=event.target.files?.[0];if(!file||!user)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4*1024*1024)return setMsg('Use PNG, JPG ou WEBP de até 4 MB.');setBusy(true);const ext=file.type==='image/png'?'png':file.type==='image/jpeg'?'jpg':'webp';const path=`${user.id}/sponsors/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from('impulsionadores-avatars').upload(path,file,{contentType:file.type});if(error){setBusy(false);return setMsg('Não foi possível enviar o logo.')}const {data}=supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);setLogo(data.publicUrl);setBusy(false);setMsg('Logo recebido.')}

  async function submit(event){event.preventDefault();if(!logo)return setMsg('Envie o logo.');const form=new FormData(event.currentTarget);const url=String(form.get('destino_url')||'').trim();if(!/^https:\/\//i.test(url))return setMsg('Informe um link completo começando por https://');const payload={user_id:user.id,nome_fantasia:String(form.get('nome_fantasia')||'').trim(),logo_url:logo,destino_tipo:String(form.get('destino_tipo')),destino_url:url,quadro:Number(form.get('quadro')),plano_dias:plan.days,valor:plan.price,status:'SOLICITADO'};setBusy(true);const {data,error}=await supabase.from('hocco_patrocinios').insert(payload).select().single();setBusy(false);if(error)return setMsg('Não foi possível criar a solicitação.');setPayment(data);setLogo('');event.currentTarget.reset();setMsg('Solicitação criada. O período começa somente após pagamento confirmado e aprovação.');await load()}
  async function paid(id){const {error}=await supabase.rpc('informar_pagamento_patrocinio',{p_id:id});setMsg(error?'Não foi possível informar o pagamento.':'Pagamento informado. A HOCCO fará a conferência antes da ativação.');if(!error)setPayment(null);await load()}
  async function renew(row,days){setBusy(true);const {data,error}=await supabase.rpc('renovar_patrocinio',{p_id:row.id,p_plano_dias:days});setBusy(false);if(error)return setMsg('Não foi possível criar a renovação.');setPayment(data);await load()}
  async function copy(text){try{await navigator.clipboard.writeText(text);setMsg('PIX copiado.')}catch{setMsg('Copie o código PIX manualmente.')}}

  if(!user)return <div className="sponsorV3Splash"><b>HOCCO <i>Hype</i></b><span>Preparando patrocínio...</span></div>;
  return <main className="sponsorV3"><header><button onClick={()=>location.href='/app'}><ArrowLeft/></button><div><b>HOCCO</b><i>Hype</i><span>MARCAS PERMANENTES</span></div></header><section className="sponsorV3Shell">
    <div className="sponsorV3Hero"><div><small>PATROCÍNIO DO APP</small><h1>Sua marca nos pontos mais vistos da jornada.</h1><p>Somente o logo, sem poluir a interface. Até 5 marcas em cada um dos 5 quadros; o clique leva direto ao canal escolhido.</p></div><strong>25<br/><span>posições</span></strong></div>
    {!!active.length&&<section className="sponsorV3Active"><h2>Ativos</h2>{active.map((r)=><article key={r.id}><img src={r.logo_url} alt=""/><div><b>{r.nome_fantasia}</b><small>{BOARDS[r.quadro]||`Quadro ${r.quadro}`} · até {new Date(r.fim_at).toLocaleString('pt-BR')}</small></div><button onClick={()=>renew(r,7)}><RefreshCw/> 7 dias</button><button onClick={()=>renew(r,30)}><RefreshCw/> 30 dias</button></article>)}</section>}
    <div className="sponsorV3Plans">{Object.values(PLANS).map((p)=><button key={p.days} className={planDays===p.days?'active':''} onClick={()=>setPlanDays(p.days)}><small>MARCA {p.days}</small><b>{brl(p.price)}</b><span>{p.label}</span></button>)}</div>
    <form className="sponsorV3Form" onSubmit={submit}><fieldset><legend>1 · Escolha o quadro</legend><div className="sponsorV3Boards">{Object.entries(BOARDS).map(([n,name])=>{const info=boardInfo(n);return <label key={n}><input type="radio" name="quadro" value={n} defaultChecked={n==='1'}/><span><b>{name}</b><small>{info.livres} de 5 vagas livres{Number(info.fila)?` · ${info.fila} na fila`:''}</small></span></label>})}</div><p>Se o quadro estiver lotado, a marca aprovada entra na fila. O prazo contratado começa quando ela realmente ficar ativa.</p></fieldset>
      <fieldset><legend>2 · Marca e destino</legend><div className="sponsorV3Grid"><label>Nome fantasia<input name="nome_fantasia" minLength="2" maxLength="100" required/></label><label>Destino<select name="destino_tipo">{DESTINOS.map((x)=><option key={x}>{x}</option>)}</select></label><label className="wide">Link direto<input name="destino_url" type="url" placeholder="https://..." required/></label></div><label className={`sponsorV3Upload ${logo?'ready':''}`}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/>{logo?<><img src={logo} alt=""/><span><CheckCircle2/> Logo recebido</span></>:<><ImageIcon/><b>ENVIAR LOGO</b><small>PNG, JPG ou WEBP · até 4 MB</small></>}</label></fieldset>
      <section className="sponsorV3Summary"><div><b>{BOARDS[1]} / Ofertas / Missões / Drops / Perfil</b><small>Até 5 marcas por quadro · logo + link direto</small></div><strong>{brl(plan.price)}</strong></section><label className="sponsorV3Check"><input type="checkbox" required/> Entendo que o patrocínio compra exposição institucional e não garante cliques ou vendas.</label>{msg&&<div className="sponsorV3Msg">{msg}</div>}<button className="sponsorV3Primary" disabled={busy}>SOLICITAR · {brl(plan.price)} / {plan.label.toUpperCase()}</button></form>
    {payment&&<Payment row={payment} copy={copy} paid={paid}/>} 
    {!!rows.length&&<section className="sponsorV3History"><h2>Meus patrocínios</h2>{rows.map((r)=><article key={r.id}><img src={r.logo_url} alt=""/><div><b>{r.nome_fantasia}</b><small>{r.payment_reference} · {r.status} · {BOARDS[r.quadro]||`Quadro ${r.quadro}`} · {r.plano_dias} dias</small></div><strong>{brl(r.valor)}</strong>{WAITING.has(r.status)&&<button onClick={()=>setPayment(r)}>VER PIX</button>}{r.status==='ENCERRADO'&&<><button onClick={()=>renew(r,7)}>RENOVAR 7</button><button onClick={()=>renew(r,30)}>RENOVAR 30</button></>}</article>)}</section>}
  </section></main>
}
function Payment({row,copy,paid}){const code=pixPayload(row.valor,row.payment_reference);return <section className="sponsorV3Payment"><div><small>PAGAMENTO</small><h2>{row.nome_fantasia}</h2><b>{brl(row.valor)}</b><span>{PIX_RECEIVER}</span><span>{PIX_BANK}</span><span>{PIX_CITY}</span></div><QRCodeSVG value={code} size={190}/><div><textarea readOnly value={code}/><button onClick={()=>copy(code)}><Copy/> COPIAR PIX</button>{row.payment_status==='aguardando'&&<button className="primary" onClick={()=>paid(row.id)}>JÁ FIZ O PIX</button>}</div></section>}
