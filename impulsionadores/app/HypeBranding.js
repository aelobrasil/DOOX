'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function HypeBranding(){
  const pathname=usePathname();
  useEffect(()=>{
    document.title=pathname==='/controle'?'HOCCO Control':'HOCCO.';
  },[pathname]);
  return null;
}
