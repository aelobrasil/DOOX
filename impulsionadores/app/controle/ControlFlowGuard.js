'use client';

import { useEffect } from 'react';

export default function ControlFlowGuard(){
  useEffect(()=>{
    function apply(){
      document.querySelectorAll('.requestCard .actions button.positive').forEach((button)=>{
        if(button.dataset.hoccoReview==='1')return;
        button.style.display='none';
        button.disabled=true;
      });

      document.querySelectorAll('.quickForm').forEach((form)=>{
        if(form.dataset.hoccoFlowGuard==='1')return;
        const submit=form.querySelector('button[type="submit"],button:not([type])');
        if(!submit||!String(submit.textContent||'').includes('PRÉ-HYPE'))return;
        form.dataset.hoccoFlowGuard='1';
        submit.disabled=true;
        submit.style.opacity='.45';
        submit.style.cursor='not-allowed';
        submit.textContent='ENTRADA RÁPIDA PAUSADA';
        const note=document.createElement('div');
        note.dataset.hoccoInjected='flow-guard';
        note.style.cssText='margin-top:10px;padding:11px 12px;border-radius:12px;background:#fff5e8;color:#8a4b00;font-size:11px;font-weight:800;line-height:1.45';
        note.textContent='Para evitar empresas presas no Pré-Hype, novas publicações passam por Solicitações do dia → Última revisão → SUBIR.';
        submit.insertAdjacentElement('afterend',note);
      });
    }
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
