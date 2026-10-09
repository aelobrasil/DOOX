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
    if(!window.confirm('Excluir sua conta Hype? Seus dados pessoais serão anonimizados. Registros mínimos de auditoria, financeiro e métricas agregadas podem ser preservados.'))return;
    if(window.prompt('Para confirmar, digite EXCLUIR')!=='EXCLUIR')return;

    setBusy(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('not_authenticated');

      const {data,error}=await supabase.rpc('excluir_minha_conta_hype');
      if(error||!data?.ok)throw error||new Error('delete_failed');

      try{
        const {data:files}=await supabase.storage.from('impulsionadores-avatars').list(user.id,{limit:100});
        const paths=(files||[]).map((file)=>`${user.id}/${file.name}`);
        if(paths.length)await supabase.storage.from('impulsionadores-avatars').remove(paths);
      }catch(error){console.warn('Não foi possível remover todos os arquivos do perfil.',error);}

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
  const supportText='Olá! Preciso de suporte com minha conta no aplicativo Hype da HOCCO.';

  return createPortal(
    <section style={{marginTop:18,display:'grid',gap:10,paddingBottom:10}} aria-label="Conta e suporte">
      <a href={whatsappUrl(HOCCO_WHATSAPP,supportText)} target="_blank" rel="noreferrer" className="outline" style={{textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><MessageCircle size={18}/> SUPORTE HOCCO</a>
      <button type="button" onClick={deleteAccount} disabled={busy} style={{width:'100%',border:'1px solid #fecaca',background:'#fff7f7',color:'#b91c1c',borderRadius:14,padding:'13px 16px',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Trash2 size={18}/>{busy?'EXCLUINDO CONTA...':'APAGAR CONTA'}</button>
      <small style={{color:'#6b7280',lineHeight:1.45,textAlign:'center'}}>Ao excluir, seus dados pessoais são anonimizados. A HOCCO mantém apenas registros mínimos necessários para auditoria, financeiro, prevenção a fraude e métricas agregadas.</small>
    </section>,
    target
  );
}
