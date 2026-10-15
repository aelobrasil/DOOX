'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function SupportShortcut(){
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
  return null;
}
