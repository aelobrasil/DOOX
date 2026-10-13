'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Gift, LockKeyhole, RefreshCw, Sparkles, Trophy, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const LIVE = new Set(['published','eligibility_closed','drawn','completed']);

function dt(value){
  if(!value)return '—';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
function humanStatus(status){
  return ({published:'INSCRIÇÕES ABERTAS',eligibility_closed:'ELEGIBILIDADE FECHADA',drawn:'RODADA REALIZADA',completed:'ENCERRADO',inscrito:'INSCRITO',elegivel:'ELEGÍVEL',nao_elegivel:'NÃO ELEGÍVEL',selecionado:'SELECIONADO',suplente:'SUPLENTE',nao_selecionado:'NÃO SELECIONADO',confirmado:'CONFIRMADO',entregue:'ENTREGUE',cancelado:'CANCELADO'})[status]||String(status||'').toUpperCase();
}
function requirementRows(e){
  if(!e)return [];
  return [
    e.min_hc!=null && {key:'hc',label:'HC',current:Number(e.hc||0),required:Number(e.min_hc),suffix:' HC'},
    e.min_xp!=null && {key:'xp',label:'XP',current:Number(e.xp||0),required:Number(e.min_xp),suffix:' XP'},
    e.min_streak!=null && {key:'streak',label:'Frequência consecutiva',current:Number(e.streak||0),required:Number(e.min_streak),suffix:' dias'},
    e.min_active_days_30!=null && {key:'active',label:'Frequência nos últimos 30 dias',current:Number(e.active_days_30||0),required:Number(e.min_active_days_30),suffix:' dias'},
    e.min_missions_30!=null && {key:'missions',label:'Missões nos últimos 30 dias',current:Number(e.missions_30||0),required:Number(e.min_missions_30),suffix:' missões'},
    e.min_level!=null && {key:'level',label:'Nível HOCCO',current:Number(e.level||1),required:Number(e.min_level),suffix:''},
  ].filter(Boolean).map((r)=>({...r,pass:r.current>=r.required}));
}

export default function HoccoDrops(){
  const [user,setUser]=useState(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState('');
  const [drops,setDrops]=useState([]);
  const [registrations,setRegistrations]=useState([]);
  const [eligibility,setEligibility]=useState({});
  const [selectedId,setSelectedId]=useState(null);

  async function load(){
    setLoading(true);
    const {data:{user:current}}=await supabase.auth.getUser();
    if(!current){setLoading(false);return;}
    setUser(current);
    const since=new Date(Date.now()-30*86400000).toISOString();
    const [{data:rows,error},{data:regs}]=await Promise.all([
      supabase.from('hocco_drops')
        .select('id,titulo,mensagem,etiqueta,benefit,image_url,local_info,public_rules,opportunity_type,eligibility_mode,min_hc,min_xp,min_streak,min_active_days_30,min_missions_30,min_level,slots,waitlist_size,sponsor_name_snapshot,sponsor_logo_url_snapshot,starts_at,ends_at,status,priority')
        .in('status',[...LIVE]).gte('ends_at',since).order('priority',{ascending:false}).order('starts_at',{ascending:false}).limit(40),
      supabase.from('hocco_drop_inscricoes').select('*').eq('user_id',current.id).order('enrolled_at',{ascending:false}).limit(100),
    ]);
    if(error){setNotice('Não foi possível carregar os Drops agora.');setLoading(false);return;}
    const list=rows||[];
    setDrops(list);
    setRegistrations(regs||[]);
    const pairs=await Promise.all(list.map(async(d)=>{
      const {data}=await supabase.rpc('hocco_drop_eligibility',{p_drop_id:d.id,p_user_id:current.id});
      return [d.id,data||null];
    }));
    const map={};pairs.forEach(([id,e])=>{map[id]=e});setEligibility(map);
    setSelectedId((old)=>old&&list.some((d)=>d.id===old)?old:(list[0]?.id||null));
    setLoading(false);
  }

  useEffect(()=>{
    let alive=true;
    load();
    const timer=setInterval(()=>{if(alive&&document.visibilityState==='visible')load()},60000);
    return()=>{alive=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{if(open)load()},[open]);

  const selected=useMemo(()=>drops.find((d)=>d.id===selectedId)||drops[0]||null,[drops,selectedId]);
  const reg=selected?registrations.find((r)=>r.drop_id===selected.id):null;
  const elig=selected?eligibility[selected.id]:null;
  const requirements=requirementRows(elig);
  const activeCount=drops.filter((d)=>d.status==='published'&&new Date(d.ends_at)>new Date()).length;
  const myOpen=registrations.filter((r)=>['inscrito','elegivel','selecionado','suplente','confirmado'].includes(r.status)).length;

  async function participate(){
    if(!selected||busy)return;
    setBusy(true);setNotice('');
    const {error}=await supabase.rpc('participar_drop',{p_drop_id:selected.id});
    setBusy(false);
    if(error){setNotice(String(error.message||'').includes('not_eligible')?'Você ainda não cumpre os requisitos desta oportunidade.':'Não foi possível registrar sua participação.');return;}
    setNotice('Participação registrada. Se houver mais elegíveis do que vagas, a HOCCO fará a rodada aleatória.');
    await load();
  }

  async function confirmSelection(){
    if(!selected||busy)return;
    setBusy(true);setNotice('');
    const {error}=await supabase.rpc('confirmar_selecao_drop',{p_drop_id:selected.id});
    setBusy(false);
    if(error){setNotice('Não foi possível confirmar a seleção.');return;}
    setNotice('Seleção confirmada. A HOCCO seguirá com as instruções de entrega/participação.');
    await load();
  }

  if(!user)return null;

  return <>
    <button type="button" onClick={()=>setOpen(true)} style={S.launcher} aria-label="Abrir Drops HOCCO">
      <Gift size={18}/><span><b>DROPS</b><small>{activeCount?`${activeCount} aberto${activeCount>1?'s':''}`:myOpen?`${myOpen} em andamento`:'HOCCO'}</small></span>{activeCount>0&&<em>{activeCount}</em>}
    </button>

    {open&&<div style={S.overlay} onClick={()=>setOpen(false)}>
      <section style={S.panel} onClick={(e)=>e.stopPropagation()}>
        <header style={S.head}>
          <div><small style={S.eyebrow}>ACESSO · BENEFÍCIOS · EXPERIÊNCIAS</small><h1 style={S.h1}>Drops HOCCO</h1><p style={S.muted}>Cumpra os requisitos, entre na rodada e acompanhe sua participação.</p></div>
          <div style={{display:'flex',gap:8}}><button style={S.iconBtn} onClick={load} aria-label="Atualizar"><RefreshCw size={17}/></button><button style={S.iconBtn} onClick={()=>setOpen(false)} aria-label="Fechar"><X size={18}/></button></div>
        </header>

        {notice&&<div style={S.notice}>{notice}</div>}
        {loading&&<div style={S.empty}>Carregando Drops...</div>}
        {!loading&&!drops.length&&<div style={S.empty}><Gift/><b>Nenhum Drop disponível agora.</b><span>Quando uma nova oportunidade abrir, ela aparecerá aqui.</span></div>}

        {!!drops.length&&<div style={S.layout}>
          <aside style={S.list}>
            {drops.map((d)=>{const r=registrations.find((x)=>x.drop_id===d.id);const e=eligibility[d.id];return <button key={d.id} onClick={()=>setSelectedId(d.id)} style={{...S.dropRow,...(selected?.id===d.id?S.dropRowActive:{})}}>
              <div style={S.logoBox}>{d.sponsor_logo_url_snapshot?<img src={d.sponsor_logo_url_snapshot} alt="" style={S.logo}/>:<Sparkles size={19}/>}</div>
              <div style={{minWidth:0,flex:1,textAlign:'left'}}><small style={S.rowMeta}>{d.opportunity_type==='company'?'EMPRESA · 500+ HC QUANDO HC FOR CRITÉRIO':'DROP · ACESSO A PARTIR DE 100 HC QUANDO HC FOR CRITÉRIO'}</small><b style={S.rowTitle}>{d.titulo}</b><span style={S.rowSub}>{r?humanStatus(r.status):e?.eligible?'VOCÊ ESTÁ ELEGÍVEL':humanStatus(d.status)}</span></div>
            </button>})}
          </aside>

          {selected&&<article style={S.detail}>
            {selected.image_url&&<img src={selected.image_url} alt="" style={S.heroImage}/>} 
            <div style={S.detailTop}><div><small style={S.eyebrow}>{selected.etiqueta||'DROP HOCCO'}</small><h2 style={S.h2}>{selected.titulo}</h2>{selected.sponsor_name_snapshot&&<p style={S.sponsor}>Oferecido por <b>{selected.sponsor_name_snapshot}</b></p>}</div><span style={S.status}>{reg?humanStatus(reg.status):humanStatus(selected.status)}</span></div>

            <p style={S.message}>{selected.benefit||selected.mensagem}</p>
            {selected.benefit&&selected.mensagem&&<p style={S.secondaryText}>{selected.mensagem}</p>}
            <div style={S.facts}><span><Users size={14}/><b>{selected.slots}</b> vaga{selected.slots!==1?'s':''}</span><span><Clock3 size={14}/>até {dt(selected.ends_at)}</span>{selected.local_info&&<span>{selected.local_info}</span>}</div>

            <section style={S.reqBox}>
              <div style={S.reqHead}><div><small style={S.eyebrow}>ELEGIBILIDADE</small><h3 style={{margin:'4px 0'}}>Como participar</h3></div>{elig&&<b style={{color:elig.eligible?'#08785a':'#9a5b00'}}>{elig.eligible?'ELEGÍVEL':'AINDA NÃO ELEGÍVEL'}</b>}</div>
              <p style={S.secondaryText}>{selected.eligibility_mode==='all'?'Você precisa cumprir todos os critérios abaixo.':'Você precisa cumprir pelo menos um dos critérios abaixo.'}</p>
              <div style={S.requirements}>{requirements.map((r)=><div key={r.key} style={{...S.requirement,borderColor:r.pass?'#bfe7d8':'#e2e8f0',background:r.pass?'#f3fbf7':'#fff'}}><span>{r.pass?<CheckCircle2 size={17}/>:<LockKeyhole size={17}/>}</span><div><b>{r.label}</b><small>{r.current.toLocaleString('pt-BR')}{r.suffix} / {r.required.toLocaleString('pt-BR')}{r.suffix}</small></div><strong>{r.pass?'OK':Math.max(0,r.required-r.current).toLocaleString('pt-BR')+' faltam'}</strong></div>)}</div>
            </section>

            <div style={S.randomBox}><Trophy size={19}/><div><b>Rodada HOCCO</b><p>Se houver mais pessoas elegíveis do que vagas, a seleção é aleatória entre os participantes elegíveis. O resultado fica registrado pela HOCCO.</p></div></div>

            {selected.public_rules&&<details style={S.rules}><summary>Regras desta oportunidade</summary><p>{selected.public_rules}</p></details>}

            {!reg&&selected.status==='published'&&<button disabled={busy||!elig?.eligible} style={{...S.primary,...(!elig?.eligible?S.disabled:{})}} onClick={participate}>{elig?.eligible?'PARTICIPAR DA RODADA':'CUMPRA UM REQUISITO PARA PARTICIPAR'}</button>}
            {reg&&['inscrito','elegivel'].includes(reg.status)&&<div style={S.memberState}><CheckCircle2/><div><b>Sua participação está registrada.</b><span>A elegibilidade será verificada novamente no fechamento da rodada.</span></div></div>}
            {reg?.status==='selecionado'&&<button disabled={busy} style={S.primary} onClick={confirmSelection}>CONFIRMAR MINHA PARTICIPAÇÃO</button>}
            {reg?.status==='suplente'&&<div style={S.memberState}><Clock3/><div><b>Você está como suplente.</b><span>Se uma vaga abrir, a HOCCO poderá promovê-lo seguindo a ordem registrada da rodada.</span></div></div>}
            {reg?.status==='nao_selecionado'&&<div style={S.memberState}><Users/><div><b>Você participou da rodada.</b><span>Desta vez não foi selecionado. Seu HC e sua progressão permanecem normalmente.</span></div></div>}
            {['confirmado','entregue'].includes(reg?.status)&&<div style={S.memberState}><CheckCircle2/><div><b>{reg.status==='entregue'?'Benefício entregue.':'Participação confirmada.'}</b><span>Acompanhe as instruções enviadas pela HOCCO.</span></div></div>}
          </article>}
        </div>}
      </section>
    </div>}
  </>;
}

const S={
  launcher:{position:'fixed',left:16,bottom:'calc(84px + env(safe-area-inset-bottom))',zIndex:175,border:'1px solid #dce7f7',borderRadius:16,background:'#fff',color:'#102844',padding:'10px 12px',display:'flex',alignItems:'center',gap:9,boxShadow:'0 14px 38px rgba(9,38,83,.16)',cursor:'pointer',maxWidth:'calc(100vw - 32px)'},
  overlay:{position:'fixed',inset:0,zIndex:25000,background:'rgba(4,15,34,.68)',padding:12,overflow:'auto',display:'grid',placeItems:'center'},
  panel:{width:'min(1120px,100%)',maxHeight:'calc(100dvh - 24px)',overflow:'auto',background:'#f5f8fc',borderRadius:24,padding:18,color:'#10213b',boxShadow:'0 30px 90px rgba(0,0,0,.30)',minWidth:0},
  head:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',padding:'2px 2px 15px',borderBottom:'1px solid #dfe6ef'},eyebrow:{fontSize:9,fontWeight:950,letterSpacing:'.12em',color:'#075eea'},h1:{fontSize:28,margin:'4px 0'},h2:{fontSize:27,margin:'5px 0 2px'},muted:{margin:0,color:'#6f8096',fontSize:12,lineHeight:1.5},iconBtn:{width:42,height:42,border:'1px solid #dce4ef',borderRadius:12,background:'#fff',display:'grid',placeItems:'center',cursor:'pointer'},notice:{margin:'12px 0',padding:11,borderRadius:12,background:'#eaf3ff',color:'#214e88',fontSize:11,fontWeight:800},empty:{minHeight:220,display:'grid',placeItems:'center',alignContent:'center',gap:8,color:'#718198',textAlign:'center'},layout:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(320px,100%),1fr))',gap:14,marginTop:14},list:{display:'grid',gap:8,alignContent:'start',minWidth:0},dropRow:{width:'100%',border:'1px solid #e0e7f0',borderRadius:16,background:'#fff',padding:11,display:'flex',alignItems:'center',gap:10,cursor:'pointer',minWidth:0},dropRowActive:{borderColor:'#8bb8fb',boxShadow:'0 0 0 3px #075eea10'},logoBox:{width:44,height:44,borderRadius:12,background:'#edf4ff',color:'#075eea',display:'grid',placeItems:'center',flex:'0 0 auto'},logo:{width:'100%',height:'100%',objectFit:'contain',borderRadius:10,padding:4},rowMeta:{fontSize:7.5,color:'#72839a',fontWeight:900},rowTitle:{display:'block',fontSize:13,margin:'3px 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},rowSub:{display:'block',fontSize:9,color:'#075eea',fontWeight:900},detail:{background:'#fff',border:'1px solid #dfe6ef',borderRadius:20,padding:20,minWidth:0},heroImage:{width:'100%',maxHeight:240,objectFit:'cover',borderRadius:16,marginBottom:14},detailTop:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'},sponsor:{margin:'4px 0 0',fontSize:11,color:'#66788f'},status:{fontSize:8,fontWeight:950,color:'#075eea',background:'#edf4ff',borderRadius:999,padding:'7px 9px',whiteSpace:'nowrap'},message:{fontSize:15,lineHeight:1.5,color:'#263e5b'},secondaryText:{fontSize:11,lineHeight:1.55,color:'#6d7e94'},facts:{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'},reqBox:{border:'1px solid #dfe7f1',borderRadius:17,padding:15,background:'#fbfdff'},reqHead:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'},requirements:{display:'grid',gap:8,marginTop:10},requirement:{display:'grid',gridTemplateColumns:'auto minmax(0,1fr) auto',alignItems:'center',gap:9,border:'1px solid #e2e8f0',borderRadius:12,padding:10},randomBox:{display:'flex',gap:11,marginTop:14,padding:13,borderRadius:14,background:'#071f49',color:'#fff'},rules:{marginTop:14,border:'1px solid #dfe6ef',borderRadius:12,padding:11,fontSize:11,color:'#5f7188'},primary:{width:'100%',border:0,borderRadius:13,padding:14,marginTop:14,background:'#075eea',color:'#fff',fontWeight:950,cursor:'pointer'},disabled:{background:'#dce4ef',color:'#7a899a',cursor:'not-allowed'},memberState:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:14,padding:13,borderRadius:13,background:'#f1f7ff',color:'#28527f'}
};
