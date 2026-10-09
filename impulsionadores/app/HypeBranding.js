'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function HypeBranding(){
  const pathname=usePathname();
  useEffect(()=>{
    document.title=pathname==='/controle'?'HOCCO Control':'Hype';
    let tries=0;
    const apply=()=>{
      tries+=1;
      if(pathname==='/app'){
        const header=document.querySelector('.memberApp > header');
        const logo=header?.querySelector('.logo');
        const pill=header?.querySelector('.pill');
        if(logo)logo.textContent='HYPE';
        if(pill)pill.textContent='HOCCO';
        if(logo&&pill)return true;
      }
      if(pathname==='/'){
        const brand=document.querySelector('.authBrand');
        const main=brand?.querySelector('b');
        const sub=brand?.querySelector('span');
        if(main)main.textContent='HYPE';
        if(sub)sub.textContent='HOCCO';
        if(main&&sub)return true;
      }
      return pathname!=='/'&&pathname!=='/app';
    };
    if(apply())return;
    const timer=setInterval(()=>{if(apply()||tries>24)clearInterval(timer)},250);
    return()=>clearInterval(timer);
  },[pathname]);
  return null;
}
