'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { todayBR } from '../../lib/config';

export default function MemberGovernanceBridge(){
  const [state,setState]=useState(null);
  const [daily,setDaily]=useState(null);
  const userRef=useRef(null);

  useEffect(()=>{
    let alive=true,channel;
    async function boot(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||!alive)return;
      userRef.current=user;
      await refresh(user.id);
      channel=supabase.channel(`member-governance-${user.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'impulsionadores_perfis',filter:`user_id=eq.${user.id}`},()=>refresh(user.id))
        .on('postgres_changes',{event:'*',schema:'public',table:'hc_diario',filter:`user_id=eq.${user.id}`},()=>refresh(user.id))
        .subscribe();
    }
    boot();
    const timer=setInterval(()=>{if(userRef.current&&document.visibilityState==='visible')refresh(userRef.current.id)},30000);
    return()=>{alive=false;clearInterval(timer);if(channel)supabase.removeChannel(channel)};
  },[]);

  useEffect(()=>{
    if(!daily||state!=='active')return;
    const normalize=()=>normalizeMemberCopy(daily);
    normalize();
    const observer=new MutationObserver(normalize);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[daily,state]);

  async function refresh(uid){
    const [{data:p},{data:d}]=await Promise.all([
      supabase.from('impulsionadores_perfis').select('governance_status,governance_reason').eq('user_id',uid).maybeSingle(),
      supabase.from('hc_diario').select('hc_earned,frequency_hc,hype_hc,boards_hyped').eq('user_id',uid).eq('activity_date',todayBR()).maybeSingle(),
    ]);
    setState(p?.governance_status||'active');
    setDaily(d||{hc_earned:0,frequency_hc:0,hype_hc:0,boards_hyped:0});
    if(typeof navigator!=='undefined'){
      const pending=Number(d?.hc_earned||0)<3?1:0;
      if(pending&&'setAppBadge' in navigator)navigator.setAppBadge(pending).catch(()=>{});
    }
  }

  if(state==='suspended')return <GovernanceBlock title="Conta temporariamente suspensa" text="Sua conta está preservada, mas novas ações estão bloqueadas até a revisão da HOCCO."/>;
  if(state==='anonymized')return <GovernanceBlock title="Conta anonimizada" text="Esta conta foi encerrada e os dados pessoais foram anonimizados. O histórico operacional que precisa ser preservado permanece sem identificação pública."/>;
  return null;
}

function normalizeMemberCopy(daily){
  const root=document.querySelector('.memberApp');
  if(!root)return;
  root.querySelectorAll('.metricCard').forEach(card=>{
    const label=card.querySelector('b')?.textContent?.trim();
    if(label==='Saldo HC'){const note=card.querySelector('span');if(note)note.textContent='1 presença + até 2 Hypes/dia';}
    if(label==='HC de hoje'){const value=card.querySelector('strong');if(value)value.textContent=`${Number(daily.hc_earned||0)}/3`;}
  });
  root.querySelectorAll('.microMission').forEach(row=>{if(row.querySelector('span')?.textContent?.trim()==='Entrou no Hype'){const reward=row.querySelector('b');if(reward)reward.textContent='+1 HC · +5 XP';}});
  root.querySelectorAll('.missionRow').forEach(row=>{if(row.querySelector('div b')?.textContent?.trim()==='Presença Hype'){const reward=row.querySelector('em');if(reward)reward.textContent='+1 HC · +5 XP';}});
  const replacements=new Map([
    ['máx. 2 por dia','até 3 por dia'],
    ['Entrar em um novo dia mantém sua ofensiva. O teto continua sendo 2 HC por dia.','Entrar em um novo dia mantém sua ofensiva e rende 1 HC de presença. Com os Hypes, o teto é 3 HC por dia.'],
    ['Mesmo completando todas as missões, o máximo absoluto é 2 HC por dia.','O máximo é 3 HC por dia: 1 HC de presença + até 2 HC pelos Hypes dos quadros.'],
    ['O limite continua sendo 2 HC por dia.','O limite é de até 3 HC por dia: 1 de presença + até 2 de Hype.'],
  ]);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{const t=node.nodeValue?.trim();if(replacements.has(t))node.nodeValue=node.nodeValue.replace(t,replacements.get(t));});
  root.querySelectorAll('.hcCap h2').forEach(el=>{el.textContent=`${Number(daily.hc_earned||0)}/3 HC conquistados hoje`;});
}

function GovernanceBlock({title,text}){
  return <div style={S.overlay}><section style={S.card}><ShieldAlert size={32}/><small>HOCCO · GOVERNANÇA DA CONTA</small><h1>{title}</h1><p>{text}</p><button onClick={async()=>{await supabase.auth.signOut();location.replace('/')}}>SAIR DA CONTA</button></section></div>;
}
const S={overlay:{position:'fixed',inset:0,zIndex:60000,background:'#f5f8fc',display:'grid',placeItems:'center',padding:18},card:{width:'min(520px,100%)',background:'#fff',border:'1px solid #dce4ee',borderRadius:22,padding:24,color:'#10213b',boxShadow:'0 24px 80px rgba(10,30,60,.16)',display:'grid',gap:12,textAlign:'center'},};
