'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const SUPPORT='5514991808104';

export default function SupportShortcut(){
  const pathname=usePathname();
  if(pathname?.startsWith('/controle'))return null;
  const text='Olá! Preciso de suporte com minha conta no aplicativo HOCCO.';
  return <a href={`https://wa.me/${SUPPORT}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" aria-label="Suporte HOCCO no WhatsApp" style={{position:'fixed',right:16,bottom:86,zIndex:80,display:'inline-flex',alignItems:'center',gap:8,padding:'11px 14px',borderRadius:999,background:'#111827',color:'#fff',textDecoration:'none',fontSize:12,fontWeight:800,boxShadow:'0 10px 30px rgba(17,24,39,.22)'}}><MessageCircle size={17}/><span>SUPORTE HOCCO</span></a>;
}
