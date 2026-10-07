'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HOCCO_WHATSAPP, whatsappUrl } from '../lib/config';

export default function SupportShortcut(){
  const pathname=usePathname();
  const [target,setTarget]=useState(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    async function guardDeletedAccount(){
      const {data:{user}}=await supabase.auth.getUser();
      if(!user||cancelled)return;
      const {data}=await supabase.from('impulsionadores_contas_excluidas').select('deleted_at').eq('user_id',user.id).maybeSingle();
      if(data&&!cancelled){
        await supabase.auth.signOut({scope:'global'}).catch(()=>{});
        if(location.pathname==='/app')location.replace('/?conta=excluida');
      }
    }
    guardDeletedAccount();
    const {data}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(guardDeletedAccount,0);
    });
    return()=>{cancelled=true;data.subscription.unsubscribe()};
  },[]);

  useEffect(()=>{
    if(pathname!=='/app'){setTarget(null);return}
    const check=()=>{
      const profileOpen=Boolean(document.querySelector('.memberApp .profile'));
      setTarget(profileOpen?document.querySelector('.memberApp .liveShell'):null);
    };
    check();
    const observer=new MutationObserver(check);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[pathname]);

  async function deleteAccount(){
    if(busy)return;
    const first=window.confirm('Excluir sua conta HOCCO? Seus dados pessoais serão anonimizados. Registros mínimos de auditoria, financeiro e métricas podem ser preservados.');
    if(!first)return;
    const typed=window.prompt('Para confirmar, digite EXCLUIR');
    if(typed!=='EXCLUIR')return;

    setBusy(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('not_authenticated');

      const [profileRes,sessionsRes,votesRes,eventsRes,impulsesRes]=await Promise.all([
        supabase.from('impulsionadores_perfis').select('xp,nivel,hc,impulsos,missoes_concluidas,ciclos,selos,ofensiva_dias,total_dias_ativos,maior_ofensiva,created_at').eq('user_id',user.id).maybeSingle(),
        supabase.from('impulsionadores_sessoes').select('active_seconds').eq('user_id',user.id),
        supabase.from('hype_votos').select('*',{count:'exact',head:true}).eq('user_id',user.id),
        supabase.from('impulsionadores_eventos').select('*',{count:'exact',head:true}).eq('user_id',user.id),
        supabase.from('impulsionadores_impulsoes').select('*',{count:'exact',head:true}).eq('user_id',user.id),
      ]);

      const p=profileRes.data||{};
      const summary={
        account_created_at:p.created_at||null,
        xp:Number(p.xp||0),level:Number(p.nivel||1),hc:Number(p.hc||0),
        hypes_profile:Number(p.impulsos||0),missions:Number(p.missoes_concluidas||0),
        cycles:Number(p.ciclos||0),badges:Number(p.selos||0),streak_days:Number(p.ofensiva_dias||0),
        active_days:Number(p.total_dias_ativos||0),best_streak:Number(p.maior_ofensiva||0),
        active_seconds:(sessionsRes.data||[]).reduce((sum,row)=>sum+Number(row.active_seconds||0),0),
        hype_votes:votesRes.count||0,events:eventsRes.count||0,impulses:impulsesRes.count||0,
      };

      const now=new Date().toISOString();
      const archived=await supabase.from('impulsionadores_contas_excluidas').insert({user_id:user.id,deleted_at:now,summary});
      if(archived.error&&archived.error.code!=='23505')throw archived.error;

      const [profileUpdate,contactUpdate,sessionUpdate]=await Promise.all([
        supabase.from('impulsionadores_perfis').update({nome_publico:'Conta excluída',username:null,bio:null,avatar_url:null,deleted_at:now,updated_at:now}).eq('user_id',user.id),
        supabase.from('impulsionadores_contatos').update({email:null,telefone:'REMOVIDO',updated_at:now}).eq('user_id',user.id),
        supabase.from('impulsionadores_sessoes').update({user_agent:null}).eq('user_id',user.id),
      ]);
      if(profileUpdate.error||contactUpdate.error)throw profileUpdate.error||contactUpdate.error;
      if(sessionUpdate.error)console.warn('Sessões não puderam ser totalmente anonimizadas.');

      await Promise.allSettled([
        supabase.from('impulsionadores_pwa_status').delete().eq('user_id',user.id),
        supabase.from('impulsionadores_push_subscriptions').delete().eq('user_id',user.id),
      ]);

      try{
        const {data:files}=await supabase.storage.from('impulsionadores-avatars').list(user.id,{limit:100});
        const avatarPaths=(files||[]).filter((file)=>file.name.startsWith('avatar.')).map((file)=>`${user.id}/${file.name}`);
        if(avatarPaths.length)await supabase.storage.from('impulsionadores-avatars').remove(avatarPaths);
      }catch{}

      await supabase.auth.signOut({scope:'global'}).catch(()=>{});
      localStorage.removeItem('hocco_app_installed');
      location.replace('/?conta=excluida');
    }catch(error){
      console.error('Account deletion error',error);
      window.alert('Não foi possível concluir a exclusão com segurança. Fale com o Suporte HOCCO.');
      setBusy(false);
    }
  }

  if(pathname!=='/app'||!target)return null;
  const supportText='Olá! Preciso de suporte com minha conta no aplicativo HOCCO.';

  return createPortal(
    <section style={{marginTop:18,display:'grid',gap:10,paddingBottom:10}} aria-label="Conta e suporte">
      <a href={whatsappUrl(HOCCO_WHATSAPP,supportText)} target="_blank" rel="noreferrer" className="outline" style={{textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><MessageCircle size={18}/> SUPORTE HOCCO</a>
      <button type="button" onClick={deleteAccount} disabled={busy} style={{width:'100%',border:'1px solid #fecaca',background:'#fff7f7',color:'#b91c1c',borderRadius:14,padding:'13px 16px',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Trash2 size={18}/>{busy?'EXCLUINDO CONTA...':'APAGAR CONTA'}</button>
      <small style={{color:'#6b7280',lineHeight:1.45,textAlign:'center'}}>Ao excluir, seus dados pessoais são anonimizados. A HOCCO pode manter somente registros mínimos necessários para auditoria, financeiro, prevenção a fraude e métricas agregadas.</small>
    </section>,
    target
  );
}
