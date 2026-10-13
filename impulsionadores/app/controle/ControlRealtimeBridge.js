'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const TABLES=['impulsionadores_perfis','hype_solicitacoes','hype_agenda','hype_financeiro_ledger','impulsionadores_impulsoes','hocco_experiencias','hocco_experiencia_inscricoes','hocco_drops','hocco_drop_inscricoes','hocco_patrocinadores','hocco_patrocinios','hocco_admin_audit'];

export default function ControlRealtimeBridge(){
  const timer=useRef(null);
  useEffect(()=>{
    const channel=supabase.channel('hocco-control-live');
    const invalidate=()=>{
      clearTimeout(timer.current);
      timer.current=setTimeout(()=>{
        window.dispatchEvent(new CustomEvent('hocco:realtime-refresh'));
        const refresh=document.querySelector('.controlTopRight button');
        if(refresh&&!refresh.disabled)refresh.click();
      },650);
    };
    TABLES.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table},invalidate));
    channel.subscribe();
    const heartbeat=setInterval(()=>{
      if(document.visibilityState!=='visible')return;
      const title=document.querySelector('.controlTop h1')?.textContent?.trim();
      if(title==='Hype'){const refresh=document.querySelector('.controlTopRight button');if(refresh&&!refresh.disabled)refresh.click();}
    },30000);
    return()=>{clearTimeout(timer.current);clearInterval(heartbeat);supabase.removeChannel(channel)};
  },[]);
  return null;
}
