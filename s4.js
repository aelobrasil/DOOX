
(function(){
  const overlay=document.getElementById('paymentOverlay');
  const close=document.getElementById('paymentClose');
  const qr=document.getElementById('paymentQr');
  const payload=document.getElementById('pixPayload');
  const amount=document.getElementById('paymentAmount');
  const paymentState=document.getElementById('paymentState');
  const code=document.getElementById('paymentCode');
  const reported=document.getElementById('paymentReported');
  const tracking=document.getElementById('trackingCard');
  const trackingStatus=document.getElementById('trackingStatus');
  const trackingSteps=document.getElementById('statusSteps');
  const trackingLink=document.getElementById('trackingLink');
  const portalUpdated=document.getElementById('portalUpdated');
  const portalRefreshBtn=document.getElementById('portalRefreshBtn');
  const statusChangeNotice=document.getElementById('statusChangeNotice');
  const clientObservation=document.getElementById('clientObservation');
  const clientObservationText=document.getElementById('clientObservationText');
  const portalProgressBar=document.getElementById('portalProgressBar');
  const portalProgressText=document.getElementById('portalProgressText');
  const portalSummaryTitle=document.getElementById('portalSummaryTitle');
  const portalSummaryText=document.getElementById('portalSummaryText');
  const portalReject=document.getElementById('portalReject');
  const portalRejectText=document.getElementById('portalRejectText');
  const portalInstructions=document.getElementById('portalInstructions');
  const portalInstructionsTitle=document.getElementById('portalInstructionsTitle');
  const portalInstructionsList=document.getElementById('portalInstructionsList');
  const portalLoading=document.getElementById('portalLoading');
  let currentToken='';
  let lastStatus='';
  let pollTimer=null;
  let loading=false;

  function show(){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false')}
  function hide(){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');stopPolling()}
  close?.addEventListener('click',hide);
  overlay?.addEventListener('click',e=>{if(e.target===overlay)hide()});

  function trackingUrl(token){return location.origin+'/?acompanhamento='+encodeURIComponent(token)}
  function renderSteps(steps){
    trackingSteps.innerHTML=(steps||[]).map(x=>`<div class="statusStep ${x.state==='completed'?'done':''} ${x.state==='current'?'current':''}"><i></i><span>${x.label}</span></div>`).join('');
  }
  function renderPayment(data){
    if(!data||!data.payment)return;
    currentToken=data.trackingToken||currentToken;
    const newStatus=data.status||'';
    const changed=!!lastStatus && newStatus!==lastStatus;
    code.textContent=data.code||'—';
    amount.textContent=data.payment.amountLabel||'—';
    payload.value=data.payment.pixPayload||'';
    qr.innerHTML='';
    if(data.payment.available && data.payment.pixPayload && window.QRCode){
      new QRCode(qr,{text:data.payment.pixPayload,width:220,height:220,colorDark:'#111111',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    } else {
      qr.innerHTML='<span class="muted">O pagamento ainda não foi liberado pela DOOX.</span>';
    }
    const paymentStatus=String(data.payment.status||'').toUpperCase();
    const paymentConfirmed=paymentStatus==='PAGAMENTO RECEBIDO';
    const paymentReported=paymentStatus==='PAGAMENTO INFORMADO';
    reported.disabled=!data.payment.available || paymentConfirmed || paymentReported;
    reported.style.opacity=(data.payment.available && !paymentConfirmed && !paymentReported)?'':'0.5';
    reported.textContent=paymentConfirmed?'PAGAMENTO CONFIRMADO ✓':(paymentReported?'PAGAMENTO INFORMADO ✓':'JÁ REALIZEI O PAGAMENTO');
    if(paymentState){
      paymentState.textContent=paymentConfirmed?'Pagamento confirmado pela DOOX.':(paymentReported?'Pagamento informado. A DOOX fará a conferência.':(data.payment.available?'Pagamento disponível agora.':''));
    }
    trackingStatus.textContent=data.statusLabel||newStatus||'—';
    const pct=Math.max(0,Math.min(100,Number(data.progressPercent)||0));
    if(portalProgressBar)portalProgressBar.style.width=pct+'%';
    if(portalProgressText)portalProgressText.textContent=pct+'%';
    if(portalSummaryTitle)portalSummaryTitle.textContent=data.statusLabel||newStatus||'Acompanhamento';
    if(portalSummaryText){
      portalSummaryText.textContent = newStatus==='REJEITADO' ? 'A participação não foi aprovada. Consulte a justificativa abaixo.' : (newStatus==='FINALIZADO' ? 'Participação finalizada.' : 'O pedido continua sendo atualizado pela DOOX.');
    }
    if(portalReject){
      const rejected=newStatus==='REJEITADO';
      portalReject.classList.toggle('show',rejected);
      if(portalRejectText)portalRejectText.textContent=data.rejectionReason||data.observationClient||'A DOOX não aprovou esta participação.';
    }
    if(portalInstructions && data.instructions){
      portalInstructions.style.display='block';
      if(portalInstructionsTitle)portalInstructionsTitle.textContent=data.instructions.title||'Materiais necessários';
      if(portalInstructionsList)portalInstructionsList.innerHTML=(data.instructions.items||[]).map(item=>'<li>'+String(item).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]||m))+'</li>').join('');
    }
    if(newStatus==='REJEITADO' && portalInstructions)portalInstructions.style.display='none';
    if(clientObservationText){clientObservationText.textContent=data.observationClient||'';}
    if(clientObservation){clientObservation.style.display=data.observationClient?'block':'none';}
    renderSteps(data.steps);
    if(data.updatedAt){
      try{portalUpdated.textContent=new Date(data.updatedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch(_){portalUpdated.textContent=data.updatedAt}
    }else portalUpdated.textContent='agora';
    if(currentToken){trackingLink.href=trackingUrl(currentToken);trackingLink.textContent='Abrir página privada de acompanhamento ↗';}
    if(changed){
      statusChangeNotice.textContent='Status atualizado: '+(data.statusLabel||newStatus)+'.';
      statusChangeNotice.style.display='block';
      setTimeout(()=>{statusChangeNotice.style.display='none'},5000);
    }
    lastStatus=newStatus;
  }
  async function loadToken(token,open=true){
    if(!token || loading)return;
    currentToken=token; loading=true;
    if(portalLoading)portalLoading.style.display='inline-flex';
    try{
      const r=await fetch('/api/request?action=pedido&token='+encodeURIComponent(token),{method:'GET',headers:{'Accept':'application/json'},cache:'no-store'});
      const data=await r.json();
      if(!data.ok)throw new Error(data.error||'Pedido não encontrado.');
      renderPayment(data);
      tracking.classList.add('show');
      if(open)show();
    }catch(e){
      trackingStatus.textContent='Não localizado';
      trackingSteps.innerHTML='<div class="statusStep current"><i></i><span>Não foi possível carregar este pedido.</span></div>';
      if(open)show();
    }finally{loading=false;if(portalLoading)portalLoading.style.display='none'}
  }
  function startPolling(){
    stopPolling();
    if(!currentToken)return;
    pollTimer=setInterval(()=>loadToken(currentToken,false),1000);
  }
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
  document.getElementById('pixCopy')?.addEventListener('click',async()=>{
    if(!payload.value)return;
    try{await navigator.clipboard.writeText(payload.value);document.getElementById('pixCopy').textContent='COPIADO ✓';setTimeout(()=>document.getElementById('pixCopy').textContent='COPIAR',1800)}catch(_){payload.select();document.execCommand('copy')}
  });
  portalRefreshBtn?.addEventListener('click',()=>{if(currentToken)loadToken(currentToken,false)});
  document.getElementById('openTracking')?.addEventListener('click',()=>{tracking.classList.add('show');if(currentToken){loadToken(currentToken,false);startPolling()}});
  reported?.addEventListener('click',async()=>{
    if(!currentToken)return;
    reported.disabled=true;
    try{
      const r=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'informarPagamento',token:currentToken})});
      const data=await r.json();
      if(!data.ok)throw new Error(data.error||'Não foi possível informar o pagamento.');
      reported.textContent='PAGAMENTO INFORMADO ✓';
      alert('Pagamento informado. A DOOX fará a conferência manual.');
      await loadToken(currentToken,false);
    }catch(e){alert(e.message||'Não foi possível informar o pagamento.');reported.disabled=false}
  });
  window.DOOX_showOrderPortal=function(data){
    if(!data?.trackingToken)return;
    currentToken=data.trackingToken;
    lastStatus='';
    loadToken(currentToken,true).then(startPolling);
  };
  const token=new URLSearchParams(location.search).get('acompanhamento') || new URLSearchParams(location.search).get('pagamento');
  if(token){currentToken=token;setTimeout(()=>loadToken(token,true).then(startPolling),120)}
})();
