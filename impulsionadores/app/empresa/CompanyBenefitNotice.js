'use client';

import { useEffect } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';

export default function CompanyBenefitNotice(){
  useEffect(()=>{
    let host=null;
    function apply(){
      const fieldsets=[...document.querySelectorAll('.companyForm fieldset')];
      const benefit=fieldsets.find((f)=>f.querySelector('legend')?.textContent?.includes('Benefício HOCCO'));
      if(!benefit)return;
      const help=benefit.querySelector('.fieldHelp');
      if(help)help.innerHTML='<b>Benefício potencial.</b> O percentual só é liberado para a comunidade se sua empresa vencer um dos Hypes. O pagamento compra exposição, nunca vitória.';
      if(!document.getElementById('hocco-benefit-rule-host')){
        host=document.createElement('div');
        host.id='hocco-benefit-rule-host';
        host.style.cssText='margin:10px 0 14px;padding:13px 14px;border-radius:14px;background:#eef6ff;border:1px solid #d9e9ff;color:#24405f;font-size:13px;line-height:1.45';
        host.innerHTML='<b style="display:block;color:#075eea;margin-bottom:3px">🏆 DESCONTO CONDICIONADO À VITÓRIA</b>Informe o maior benefício que sua empresa pode liberar. Durante a disputa ele aparece bloqueado como “Libere até X%”. Somente vencedoras liberam cupom, condições e contato.';
        benefit.querySelector('legend')?.insertAdjacentElement('afterend',host);
      }
    }
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>{observer.disconnect();host?.remove()};
  },[]);
  return null;
}
