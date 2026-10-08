'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function todayBR(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

export default function CompanyDateGuard(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname?.startsWith('/empresa'))return;
    const apply=()=>{
      const input=document.querySelector('input[name="data_preferida"]');
      if(!input)return;
      const today=todayBR();
      input.min=today;
      if(input.value&&input.value<today)input.value=today;
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[pathname]);
  return null;
}
