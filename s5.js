
(function(){
  const qs=new URLSearchParams(location.search);
  const token=qs.get('acompanhamento');
  const page=document.getElementById('orderPortalPage');
  if(!token || !page) return;
  document.body.classList.add('portal-only');
  page.classList.add('active');
  // Portal is intentionally a separate visual context; the public site remains out of this view.
  Array.from(document.body.children).forEach(el=>{ if(el!==page && !el.classList.contains('portalPrint')) el.style.display='none'; });
  const busy=document.getElementById('orderPortalBusy');
  const status=document.getElementById('orderPortalStatus');
  const sub=document.getElementById('orderPortalSub');
  const code=document.getElementById('orderPortalCode');
  const modality=document.getElementById('orderPortalModality');
  const episode=document.getElementById('orderPortalEpisode');
  const quantity=document.getElementById('orderPortalQuantity');
  const pct=document.getElementById('orderPortalPct');
  const bar=document.getElementById('orderPortalBar');
  const timeline=document.getElementById('orderPortalTimeline');
  const msg=document.getElementById('orderPortalMessage');
  const msgTitle=document.getElementById('orderPortalMessageTitle');
  const msgText=document.getElementById('orderPortalMessageText');
  const receipt=document.getElementById('orderPortalReceipt');
  const receiptBtn=document.getElementById('orderPortalReceiptBtn');
  const portalPayment=document.getElementById('orderPortalPayment');
  const portalPaymentAmount=document.getElementById('portalPaymentAmount');
  const portalPaymentState=document.getElementById('portalPaymentState');
  const portalPaymentQr=document.getElementById('portalPaymentQr');
  const portalPaymentPix=document.getElementById('portalPaymentPix');
  const portalPaymentCopy=document.getElementById('portalPaymentCopy');
  const portalPaymentProof=document.getElementById('portalPaymentProof');
  const paymentMode=new URLSearchParams(location.search).get('pagamento') ? true : false;
  let latest=null, timer=null, loading=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function render(d){
    latest=d;
    code.textContent=d.code||'—';
    status.textContent=d.statusLabel||d.status||'—';
    modality.textContent=d.modality||'—';
    episode.textContent=d.episode||'A definir';
    quantity.textContent=d.quantity||1;
    const payment=d.payment||{};
    const paymentVisible=paymentMode && !!payment.available;
    if(portalPayment){
      portalPayment.classList.toggle('show',paymentVisible);
      if(paymentVisible){
        portalPaymentAmount.textContent=payment.amountLabel||'—';
        const confirmed=String(payment.status||'').toUpperCase()==='PAGAMENTO RECEBIDO';
        const reported=String(payment.status||'').toUpperCase()==='PAGAMENTO INFORMADO';
        portalPaymentState.textContent=confirmed?'Pagamento confirmado pela DOOX.':(reported?'Pagamento informado. Envie o comprovante pelo WhatsApp para conferência.':'Pagamento disponível. Após pagar, envie o comprovante pelo WhatsApp.');
        portalPaymentPix.value=payment.pixPayload||'';
        portalPaymentQr.innerHTML='';
        if(payment.pixPayload && window.QRCode){ new QRCode(portalPaymentQr,{text:payment.pixPayload,width:200,height:200,colorDark:'#111111',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M}); } else { portalPaymentQr.innerHTML='<span>PIX indisponível nesta etapa.</span>'; }
        portalPaymentProof.disabled=confirmed;
        portalPaymentProof.style.opacity=confirmed?'0.5':'1';
      }
    }
    const n=Math.max(0,Math.min(100,Number(d.progressPercent)||0)); pct.textContent=n+'%'; bar.style.width=n+'%';
    const st=d.status||'';
    sub.textContent=st==='FINALIZADO'?'Participação finalizada e registrada pela DOOX. O comprovante está disponível abaixo.':st==='REJEITADO'?'A participação não foi aprovada. Veja a mensagem abaixo.':st==='MATERIAL PENDENTE'?'Aguardamos os materiais necessários para continuar.':'O andamento desta solicitação é atualizado pela DOOX.';
    timeline.innerHTML=(d.steps||[]).map(x=>`<div class="statusStep ${x.state==='completed'?'done':''} ${x.state==='current'?'current':''}"><i></i><span>${esc(x.label)}</span></div>`).join('');
    const text=d.observationClient||d.rejectionReason||'';
    msg.classList.toggle('show',!!text);
    msgTitle.textContent=d.rejectionReason?'PARTICIPAÇÃO RECUSADA':'MENSAGEM DA DOOX';
    msgText.textContent=text;
    const eligible=!!(d.receipt&&d.receipt.eligible);
    receipt.classList.toggle('show',eligible); receiptBtn.style.display=eligible?'inline-block':'none';
  }
  async function load(){
    if(loading)return; loading=true; busy.style.visibility='visible';
    try{ const r=await fetch('/api/request?action=pedido&token='+encodeURIComponent(token),{cache:'no-store',headers:{Accept:'application/json'}}); const d=await r.json(); if(!d.ok)throw new Error(d.error||'Pedido não encontrado.'); render(d);}
    catch(e){ status.textContent='Pedido não localizado'; sub.textContent=e.message||'Não foi possível consultar este acompanhamento.'; timeline.innerHTML=''; }
    finally{loading=false;busy.style.visibility='hidden';}
  }
  function start(){ if(timer)clearInterval(timer); timer=setInterval(load,1000); }
  function makeReceipt(){
    if(!latest || !(latest.receipt&&latest.receipt.eligible))return;
    const r=latest.receipt;
    const issued=new Date().toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'});
    const root=document.getElementById('portalPrint');
    root.innerHTML=`<div class="portalPrintBox"><div class="portalPrintTitle">DOOX · COMPROVANTE DE VEICULAÇÃO</div><span class="portalPrintTag">VEICULADO / FINALIZADO</span><div class="portalPrintGrid"><div class="portalPrintCell"><small>Código DOOX</small><b>${esc(r.code)}</b></div><div class="portalPrintCell"><small>Empresa / Nome</small><b>${esc(r.nameOrCompany||'—')}</b></div><div class="portalPrintCell"><small>Modalidade</small><b>${esc(r.modality||'—')}</b></div><div class="portalPrintCell"><small>Episódio</small><b>${esc(r.episode||'—')}</b></div><div class="portalPrintCell"><small>Quantidade</small><b>${esc(r.quantity||1)}</b></div><div class="portalPrintCell"><small>Emissão</small><b>${esc(issued)}</b></div></div><div class="portalPrintFoot">Este documento comprova que a solicitação identificada pelo código ${esc(r.code)} foi concluída no fluxo operacional da DOOX e registrada como veiculada. Documento gerado a partir do acompanhamento privado do pedido.</div></div>`;
    document.body.classList.add('portal-print-mode'); window.print(); setTimeout(()=>document.body.classList.remove('portal-print-mode'),1000);
  }
  document.getElementById('orderPortalRefresh')?.addEventListener('click',load); receiptBtn?.addEventListener('click',makeReceipt);
  document.getElementById('orderPortalShare')?.addEventListener('click',async()=>{
    const shareUrl=location.href;
    try{
      if(navigator.share){ await navigator.share({title:'DOOX · acompanhamento',text:'Acompanhar meu pedido '+(latest?.code||''),url:shareUrl}); }
      else { await navigator.clipboard.writeText(shareUrl); const b=document.getElementById('orderPortalShare'); if(b){b.textContent='LINK COPIADO ✓';setTimeout(()=>b.textContent='COMPARTILHAR PEDIDO',1800);} }
    }catch(_){}
  });
  document.getElementById('orderPortalInstall')?.addEventListener('click',()=>document.getElementById('installAppBtn')?.click());
  portalPaymentCopy?.addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(portalPaymentPix.value||''); portalPaymentCopy.textContent='COPIADO ✓'; setTimeout(()=>portalPaymentCopy.textContent='COPIAR',1800);}catch(_){portalPaymentPix.select();document.execCommand('copy');portalPaymentCopy.textContent='COPIADO ✓';setTimeout(()=>portalPaymentCopy.textContent='COPIAR',1800);} });
  portalPaymentProof?.addEventListener('click',async()=>{
    try{
      const r=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'informarPagamento',token})});
      const d=await r.json(); if(!d.ok)throw new Error(d.error||'Não foi possível registrar o pagamento informado.');
    }catch(e){ alert(e.message||'Não foi possível registrar o pagamento.'); return; }
    const waText=`Olá! Sou o responsável pelo pedido ${latest?.code||''}. Já realizei o pagamento e estou enviando o comprovante por aqui.

Código DOOX: ${latest?.code||''}`;
    window.open('https://wa.me/5514981150675?text='+encodeURIComponent(waText),'_blank','noopener');
  });
  load(); start();
})();
