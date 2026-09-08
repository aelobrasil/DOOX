
/* V9 — final interaction controller */
(function(){
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const stateKey='doox_hocco_state_v9';
  const sendCountKey='doox_hocco_whatsapp_count_v9';
  const draftKey='doox_hocco_pre_solicitacao_v8';

  function readState(){try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch(e){return {}}}
  function writeState(v){localStorage.setItem(stateKey,JSON.stringify(v))}
  function readDraft(){try{return JSON.parse(localStorage.getItem(draftKey)||'null')}catch(e){return null}}

  // ----- Navigation: direct, reliable, and mutually synchronized -----
  const viewIds=['home','companies','people','preview','poster','how','doox','request'];
  function showView(id){
    if(!viewIds.includes(id) || !$('#'+id)) id='home';
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
    $$('.tab[data-go]').forEach(t=>t.classList.toggle('active',t.dataset.go===id));
    history.replaceState(null,'','#'+id);
    window.scrollTo({top:0,behavior:'smooth'});
    // Keep request fields and simulation state synchronized.
    syncDraftToRequest();
    return id;
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-go]');
    if(btn){
      const id=btn.dataset.go;
      if(id && viewIds.includes(id)){e.preventDefault();e.stopImmediatePropagation();showView(id);return;}
    }
    const previewBtn=e.target.closest('[data-preview]');
    if(previewBtn){
      e.preventDefault();e.stopImmediatePropagation();
      const key=previewBtn.dataset.preview;
      const mode=$('#mode');
      if(mode && mode.querySelector(`option[value="${key}"]`)){mode.value=key;mode.dispatchEvent(new Event('change',{bubbles:true}))}
      showView('preview');
      setTimeout(()=>runSimulation(),300);
    }
  },true);

  // ----- Simulator: actual visual sequences -----
  const mode=$('#mode'), tier=$('#priceTier'), moment=$('#moment'), screen=$('#screen');
  const play=$('#playDemo'), simImage=$('#simImage'), inputName=$('#inputName'), inputHandle=$('#inputHandle');
  const pName=$('#pName'),pHandle=$('#pHandle'),sponsorName=$('#sponsorName'),sponsorHandle=$('#sponsorHandle');
  const focus=$('#simFocus'), visual=$('#ovVisual'), individual=$('#ovIndividual'), sponsor=$('#ovSponsor');
  const wave1=$('#footerWave1'),wave2=$('#footerWave2');
  const timeBadge=$('#timeBadge'),creditClock=$('#creditClock'),audioBadge=$('#audioBadge');

  const momentInfo={
    essential:{range:'00:30–02:00',label:'Primeira faixa · menor atenção'},
    regular:{range:'02:00–04:00',label:'Segunda faixa · atenção normal'},
    valued:{range:'04:00–06:30',label:'Terceira faixa · maior interesse'},
    premium:{range:'06:30–09:00',label:'Quarta faixa · alta atenção'},
    special:{range:'09:00–11:00',label:'Quinta faixa · atenção excepcional'}
  };
  const tierText={essential:'00:30–02:00 · R$ 39,90',regular:'02:00–04:00 · R$ 49,90',valued:'04:00–06:30 · R$ 59,90',premium:'06:30–09:00 · R$ 69,90',special:'09:00–11:00 · R$ 79,90'};
  const audioText={essential:'00:30–02:00 · R$ 49,90',regular:'02:00–04:00 · R$ 59,90',valued:'04:00–06:30 · R$ 69,90',premium:'06:30–09:00 · R$ 79,90',special:'09:00–11:00 · R$ 89,90'};

  function clearSimulation(){
    [wave1,wave2,visual,individual,sponsor,focus].forEach(x=>{if(x){x.classList.remove('show');}});
    if(screen)screen.classList.remove('isCredits','phone','price-essential','price-regular','price-valued','price-premium','price-special');
    if(audioBadge)audioBadge.style.display='none';
  }
  function updateSimLabels(){
    if(!mode)return;
    const m=mode.value;
    const info={
      footer:{where:'Durante o episódio',how:'10 empresas por bloco · ~5s por exibição',desc:'Rodapé coletivo com logo/identidade, nome fantasia, @ e segmento. Um segundo bloco pode reaparecer mais adiante.',price:'R$ 49,90',ctx:'2 exibições separadas'},
      overlay:{where:'Durante o episódio',how:'Visual individual · ~5s',desc:'A marca aparece individualmente sobre a imagem. A faixa representa um intervalo aproximado do episódio.',price:tierText[tier?.value]||'R$ 39,90',ctx:momentInfo[moment?.value]?.label||'Faixa aproximada'},
      audio:{where:'Durante o episódio',how:'Visual + chamada sonora · ~5s',desc:'A marca aparece individualmente acompanhada de uma chamada sonora curta que atua como gatilho de atenção.',price:audioText[tier?.value]||'R$ 49,90',ctx:momentInfo[moment?.value]?.label||'Faixa aproximada'},
      individual:{where:'Créditos',how:'Lista de nomes e @',desc:'Tela preta com nomes/@ em composição coletiva de créditos.',price:'R$ 9,90',ctx:'Após a história'},
      sponsor:{where:'Pós-créditos',how:'HOCCO + empresa + @',desc:'Tela preta com apresentação institucional da empresa participante do episódio.',price:'R$ 89,90',ctx:'Após a história e créditos'}
    }[m];
    if(!info)return;
    $('#simWhere')&&( $('#simWhere').textContent=info.where );
    $('#simHow')&&( $('#simHow').textContent=info.how );
    $('#simDescription')&&( $('#simDescription').textContent=info.desc );
    $('#simPriceInfo')&&( $('#simPriceInfo').textContent=info.price );
    $('#simWhereLarge')&&( $('#simWhereLarge').textContent=info.where );
    $('#simPriceLarge')&&( $('#simPriceLarge').textContent=info.price );
    $('#simDurationLarge')&&( $('#simDurationLarge').textContent=(m==='individual'||m==='sponsor')?'Apresentação de créditos':'≈ 5 segundos' );
    $('#simContextLarge')&&( $('#simContextLarge').textContent=info.ctx );
    $('#priceLogic')&&( $('#priceLogic').innerHTML = m==='footer' ? '<strong>Regra de preço:</strong> valor único de <strong>R$ 49,90</strong>.' : '<strong>Regra de preço:</strong> o valor acompanha a faixa/momento escolhido.' );
    renderSimulationTimeline();
    return info;
  }

  function setBrand(){
    const n=(inputName?.value||'').trim()||'SUA EMPRESA',h=(inputHandle?.value||'').trim()||'@suaempresa';
    if(pName)pName.textContent=n;if(pHandle)pHandle.textContent=h;
    if(sponsorName)sponsorName.textContent=n;if(sponsorHandle)sponsorHandle.textContent=h;
    $('#fpName')&&($('#fpName').textContent=n);$('#fpHandle')&&($('#fpHandle').textContent=h);
    $('#indName')&&($('#indName').textContent=h);
  }

  function runSimulation(){
    if(!mode || !screen)return;
    setBrand();updateSimLabels();clearSimulation();
    const m=mode.value;
    animateSimulationTimeline();
    if(m==='footer'){
      screen.classList.add('footer-demo');
      if(timeBadge){timeBadge.style.display='block';timeBadge.innerHTML='EXIBIÇÃO <span>≈ 5s</span>'}
      if(creditClock)creditClock.style.display='none';
      if(wave1){void wave1.offsetWidth;wave1.classList.add('show')}
      if(wave2){
        setTimeout(()=>{wave1?.classList.remove('show');void wave2.offsetWidth;wave2.classList.add('show')},5900)
        setTimeout(()=>wave2?.classList.remove('show'),11100)
      }
      if(focus){focus.style.left='2.5%';focus.style.right='2.5%';focus.style.bottom='3%';focus.style.top='auto';focus.style.height='18%';focus.classList.add('show')}
    }else if(m==='overlay'||m==='audio'){
      const t=tier?.value||'essential';
      screen.classList.add('price-'+t);
      screen.dataset.moment=t;
      if(timeBadge){timeBadge.style.display='block';timeBadge.innerHTML='INSERÇÃO <span>≈ 5s</span>'}
      if(creditClock)creditClock.style.display='none';
      if(audioBadge)audioBadge.style.display=m==='audio'?'block':'none';
      visual?.classList.add('show');
      if(focus){focus.style.left='3%';focus.style.top='3%';focus.style.width='57%';focus.style.height='20%';focus.style.right='auto';focus.style.bottom='auto';focus.classList.add('show')}
      setTimeout(()=>visual?.classList.remove('show'),5700);
      setTimeout(()=>focus?.classList.remove('show'),5700);
    }else if(m==='individual'){
      screen.classList.add('isCredits');
      if(timeBadge)timeBadge.style.display='none';
      if(creditClock)creditClock.style.display='block';
      individual?.classList.add('show');
      setTimeout(()=>individual?.classList.remove('show'),6500);
    }else{
      screen.classList.add('isCredits');
      if(timeBadge)timeBadge.style.display='none';
      if(creditClock)creditClock.style.display='block';
      sponsor?.classList.add('show');
      setTimeout(()=>sponsor?.classList.remove('show'),6500);
    }
  }

  // Capture phase prevents stale/duplicate simulation handlers from fighting with V9.
  if(play)play.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();runSimulation()},true);
  [mode,tier,moment].forEach(el=>el?.addEventListener('change',e=>{e.stopImmediatePropagation();updateSimLabels()},true));
  [inputName,inputHandle].forEach(el=>el?.addEventListener('input',setBrand));
  $$('.device').forEach(b=>b.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    $$('.device').forEach(x=>x.classList.remove('active'));b.classList.add('active');screen?.classList.toggle('phone',b.dataset.device==='phone');
  },true));
  updateSimLabels();


  // ----- Request form and cross-tab synchronization -----
  // A comunicação externa é centralizada em /api/request, que usa o mesmo Web App do Apps Script.
  const req={
    type:$('#reqType'), mode:$('#reqMode'), tier:$('#reqPriceTier'), moment:$('#reqMoment'),
    qty:$('#reqQty'), name:$('#reqName'), phone:$('#reqPhone'), email:$('#reqEmail'),
    handle:$('#reqHandle'), obs:$('#reqObs'), terms:$('#acceptTerms')
  };

  function syncDraftToRequest(){
    const d=readDraft(); if(!d)return;
    if(req.type && d.type)req.type.value=d.type;
    if(req.mode && d.mode){req.mode.value=d.mode;req.mode.dispatchEvent(new Event('change',{bubbles:true}))}
    setTimeout(()=>{
      const tierEl=$('#reqPriceTier');
      if(tierEl && d.tier && tierEl.tagName==='SELECT'){
        [...tierEl.options].some(o=>{if(o.textContent===d.tier){tierEl.value=o.value;return true}return false});
      } else if(tierEl && d.tier){tierEl.value=d.tier}
      if(req.moment && d.moment)req.moment.value=d.moment;
      if(req.qty && d.qty)req.qty.value=d.qty;
      if(req.name && d.name)req.name.value=d.name;
      if(req.phone && d.phone)req.phone.value=d.phone;
      if(req.email && d.email)req.email.value=d.email;
      if(req.handle && d.handle)req.handle.value=d.handle;
      if(req.obs && d.obs)req.obs.value=d.obs;
      if(req.terms && d.terms)req.terms.checked=true;
      if(typeof window.updateSummary==='function')window.updateSummary();
      if(typeof window.updateSummaryAndFields==='function')window.updateSummaryAndFields();
    },20);
  }

  // Keep this controller self-contained. It must not depend on variables
  // declared inside the previous script block, otherwise a click can fail silently.
  function saveCurrentDraft(){
    const m=req.mode?.value||'';
    const q=Math.max(1,Number(req.qty?.value)||1);
    const tierEl=$('#reqPriceTier');
    const tierLabel=tierEl?.value || 'Modalidade fixa';
    const data={
      type:req.type?.value||'empresa',
      mode:m,
      tier:tierLabel,
      moment:req.moment?.value||'',
      qty:q,
      name:req.name?.value||'',
      phone:req.phone?.value||'',
      email:req.email?.value||'',
      handle:(req.handle?.value||'').trim().toLowerCase().match(/^@?(suaempresa|seuperfil|empresaaqui|exemplo)$/)?'':(req.handle?.value||''),
      obs:req.obs?.value||'',
      terms:Boolean(req.terms?.checked),
      rules:Boolean(req.terms?.checked),
      clientRequestId:(window.crypto?.randomUUID?window.crypto.randomUUID():('req-'+Date.now()+'-'+Math.random().toString(36).slice(2))),
      savedAt:new Date().toISOString()
    };
    localStorage.setItem(draftKey,JSON.stringify(data));
  }
  Object.values(req).forEach(el=>el?.addEventListener('input',saveCurrentDraft));
  Object.values(req).forEach(el=>el?.addEventListener('change',saveCurrentDraft));

  // Exact WhatsApp submission message, with second-submission trigger.
  const send=$('#sendWhatsapp');
  function trackingUrlFromToken(token){return location.origin+'/?acompanhamento='+encodeURIComponent(token)}

  function buildApiPayload(){
    const modeValue=req.mode?.value||'';
    const modeMax=req.mode?.value==='Presença no Rodapé'||req.mode?.value==='Apoiador Individual'?50:(req.mode?.value==='Empresa Patrocinadora do Episódio'?1:10);
    const quantity=Math.min(modeMax,Math.max(1,Number(req.qty?.value)||1));
    const momentValue=req.moment?.disabled?'Definido pela produção':(req.moment?.value||'Definido pela produção');
    const id=(window.crypto?.randomUUID?window.crypto.randomUUID():('req-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
    return {
      clientRequestId:id,
      name:req.name?.value.trim()||'',
      company:(req.type?.value||'empresa')==='empresa'?(req.name?.value.trim()||''):'',
      type:req.type?.value||'empresa',
      whatsapp:req.phone?.value||'',
      email:req.email?.value.trim()||'',
      profile:(()=>{const v=(req.handle?.value||'').trim(); return /^(?:@)?(?:suaempresa|seuperfil|empresaaqui|exemplo)$/i.test(v)?'':v;})(),
      modality:modeValue,
      moment:momentValue,
      quantity:quantity,
      observation:req.obs?.value.trim()||'',
      termsAccepted:Boolean(req.terms?.checked),
      rulesAccepted:Boolean(req.terms?.checked)
    };
  }

  async function registerInSheets(payload){
    const response=await fetch('/api/request',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok || !data || !data.ok){
      throw new Error(data?.error||'Não foi possível registrar a solicitação.');
    }
    return data;
  }

  function setSubmissionStatus(step,text,detail){
    const box=document.getElementById('submissionStatus');
    const stepEl=document.getElementById('submissionStep');
    const textEl=document.getElementById('submissionText');
    const detailEl=document.getElementById('submissionDetail');
    if(box)box.classList.add('show');
    if(stepEl)stepEl.textContent=step;
    if(textEl)textEl.textContent=text;
    if(detailEl)detailEl.textContent=detail||'';
  }
  function hideSubmissionStatus(){document.getElementById('submissionStatus')?.classList.remove('show')}

  function setSendBusy(busy){
    if(!send)return;
    send.disabled=busy;
    send.dataset.originalText=send.dataset.originalText||send.textContent;
    send.textContent=busy?'VALIDANDO SOLICITAÇÃO...':send.dataset.originalText;
    send.style.opacity=busy?'0.65':'';
    send.style.pointerEvents=busy?'none':'';
  }

  function markWhatsAppSubmission(){
    let count=Number(localStorage.getItem(sendCountKey)||'0')+1;
    localStorage.setItem(sendCountKey,String(count));
    const s=readState();s.lastSubmissionCount=count;s.lastSubmissionAt=new Date().toISOString();writeState(s);
    if(count>=2){
      $('#chatLauncher')?.classList.remove('v9Hidden');
      $('#chatLauncher')?.classList.add('v9Pulse');
    }
    return count;
  }
  if(send)send.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(send.dataset.busy==='1')return;
    const n=req.name?.value.trim()||'';
    const email=req.email?.value.trim()||'';
    const phone=(req.phone?.value||'').replace(/\D/g,'');
    if(!n){alert('Informe seu nome ou empresa.');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){alert('Informe um e-mail válido.');return}
    if(!/^(?:55)?(?:\d{10,11})$/.test(phone)){alert('Informe um telefone brasileiro válido com DDD.');return}
    if(!req.terms?.checked){alert('Aceite os Termos de Uso e as Regras de Participação para continuar.');return}

    // Show progress immediately, before any storage/network work.
    send.dataset.busy='1';
    setSendBusy(true);
    setSubmissionStatus('1/4','Validando sua solicitação','Verificando os dados informados.');

    try {
      saveCurrentDraft();
    } catch (storageError) {
      console.warn('Não foi possível salvar o rascunho local.', storageError);
    }
    const apiPayload=buildApiPayload();

    let registered;
    try{
      setSubmissionStatus('2/4','Confirmando participação','Verificando modalidade, faixa e disponibilidade.');
      await new Promise(r=>setTimeout(r,250));
      setSubmissionStatus('3/4','Registrando sua solicitação','Os dados estão sendo enviados para o sistema DOOX.');
      registered=await registerInSheets(apiPayload);
      setSubmissionStatus('4/4','Solicitação registrada ✓','Código '+(registered.code||'DOOX')+' confirmado. Preparando o atendimento.');
    }catch(err){
      console.error(err);
      setSubmissionStatus('ERRO','Não foi possível registrar a solicitação',err&&err.message?err.message:'Verifique sua conexão e tente novamente. Nenhum atendimento foi iniciado.');
      send.dataset.busy='0';
      setSendBusy(false);
      return;
    }

    const trackingResultWrap=document.getElementById('trackingResultWrap');
    const trackingResultLink=document.getElementById('trackingResultLink');
    if(registered?.trackingToken){
      const publicTrackingUrl=trackingUrlFromToken(registered.trackingToken);
      if(trackingResultLink){trackingResultLink.href=publicTrackingUrl;}
      if(trackingResultWrap)trackingResultWrap.style.display='block';
      try{window.history.replaceState({},'',publicTrackingUrl);}catch(_){ }
    }

    // O WhatsApp recebe apenas as instruções comerciais necessárias ao cliente.
    // Nenhuma referência técnica a planilhas, Script ou infraestrutura interna é exibida.
    const publicTrackingUrl=registered?.trackingToken ? trackingUrlFromToken(registered.trackingToken) : '';
    const paymentUrl=registered?.trackingToken ? location.origin+'/?pagamento='+encodeURIComponent(registered.trackingToken) : '';
    const instructions=registered?.instructions||{title:'Próximos passos',items:['A equipe DOOX orientará os próximos passos pelo atendimento.']};
    const checklist=(instructions.items||[]).map((item,i)=>`${i+1}. ${item}`).join('\n');
    const greeting=`Olá! Seja bem-vindo(a) à HOCCO.\n\nSua solicitação ${registered.code||''} — ${registered.modality||apiPayload.modality||''} foi registrada.\n\nMATERIAIS NECESSÁRIOS\n${instructions.title}\n${checklist}\n\nPAGAMENTO\nValor: R$ ${(Number(registered.total)||0).toFixed(2).replace('.',',')}\nAcesse a área segura para pagar e acompanhar os dados do PIX:\n${paymentUrl}\n\nAPÓS O PAGAMENTO\nEnvie aqui no WhatsApp o comprovante para conferência da DOOX.\n\nACOMPANHAMENTO DO PEDIDO\nAcesse sua área privada pelo link abaixo. Ele fica vinculado somente a este pedido:\n${publicTrackingUrl}\n\nA DOOX seguirá com a análise, produção e veiculação conforme o fluxo desta solicitação.`;
    const waUrl=`https://wa.me/5514981150675?text=${encodeURIComponent(greeting)}`;
    try{ localStorage.removeItem(draftKey); }catch(_){}

    markWhatsAppSubmission();
    if(Number(localStorage.getItem(sendCountKey)||0)>=2) setTimeout(()=>$('#chatLauncher')?.classList.remove('v9Pulse'),9000);
    send.dataset.busy='0';
    setSendBusy(false);

    // Mostra SEMPRE uma saída manual. Isso evita que o cliente fique preso caso
    // o Android/navegador bloqueie a navegação automática após o fetch assíncrono.
    setSubmissionStatus('✓','Solicitação registrada','Sua solicitação foi registrada. O pagamento e o acompanhamento já estão vinculados a este pedido.');
    if(typeof window.DOOX_showOrderPortal==='function'){ window.DOOX_showOrderPortal(registered); }
    const finalWrap=document.getElementById('whatsappFinalizeWrap');
    const finalBtn=document.getElementById('whatsappFinalize');
    if(finalWrap) finalWrap.style.display='block';
    if(finalBtn){
      finalBtn.onclick=()=>window.location.assign(waUrl);
      finalBtn.focus({preventScroll:true});
    }

    // O WhatsApp não abre sozinho: o cliente primeiro vê o pagamento e o acompanhamento.
    // A abertura continua disponível no botão CONTINUAR NO WHATSAPP.
  },true);

  // ----- Chat assistant: appears only after the second WhatsApp submission -----
  const launcher=$('#chatLauncher'),panel=$('#chatPanel'),close=$('#chatClose'),min=$('#chatMin'),minimized=$('#v9ChatMinimized'),body=$('#chatBody');
  function renderChat(){
    const d=readDraft();
    if(!body)return;
    if(!d){
      body.innerHTML='<div class="chatBubble">Ainda não há uma pré-solicitação salva. Abra a participação para começar.</div><div class="chatActions"><button class="chatBtn primary" id="chatStart" type="button">Começar</button><button class="chatBtn secondary" id="chatClose2" type="button">Fechar</button></div>';
      $('#chatStart')?.addEventListener('click',()=>{showView('request');panel?.classList.remove('open')});
      $('#chatClose2')?.addEventListener('click',()=>panel?.classList.remove('open'));
      return;
    }
    body.innerHTML=`<div class="chatBubble">Olá. Eu sou <b>Alex Hocc</b>. Encontrei uma pré-solicitação salva neste navegador.</div>
<div class="chatCard"><strong>${d.mode||'Participação'}</strong><div class="chatMeta">Tipo: ${d.type==='pessoa'?'Pessoa':'Empresa'}<br>Faixa/preço: ${d.tier||'Modalidade fixa'}<br>Momento: ${d.moment||'Definido pela produção'}<br>Quantidade: ${d.qty||1}<br>Nome/Empresa: ${d.name||'Não informado'}<br>E-mail: ${d.email||'Não informado'}<br>WhatsApp: ${d.phone||'Não informado'}<br>@/Perfil: ${d.handle||'Não informado'}</div><div class="chatSaved">Salvo neste navegador. Sem banco de dados.</div></div>
<div class="chatBubble">Você pode confirmar esta participação ou editar os dados antes de eu preparar um novo envio.</div>
<div class="chatActions"><button class="chatBtn secondary" id="chatEdit" type="button">Editar participação</button><button class="chatBtn primary" id="chatConfirm" type="button">Confirmar e enviar</button></div>`;
    $('#chatEdit')?.addEventListener('click',()=>{syncDraftToRequest();showView('request');panel?.classList.remove('open')});
    $('#chatConfirm')?.addEventListener('click',()=>{syncDraftToRequest();showView('request');setTimeout(()=>send?.click(),250)});
  }
  function openChat(){renderChat();panel?.classList.add('open');launcher?.classList.remove('v9Pulse')}
  launcher?.classList.toggle('v9Hidden',Number(localStorage.getItem(sendCountKey)||0)<2);
  launcher?.addEventListener('click',openChat);
  close?.addEventListener('click',()=>panel?.classList.remove('open'));
  min?.addEventListener('click',()=>{panel?.classList.remove('open');minimized?.classList.add('on')});
  minimized?.addEventListener('click',()=>{minimized.classList.remove('on');openChat()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){panel?.classList.remove('open');minimized?.classList.remove('on')}});

  // Cross-tab/browser-sync: if the user opens another tab, selection and submission count are reused locally.
  window.addEventListener('storage',e=>{
    if(e.key===draftKey){syncDraftToRequest()}
    if(e.key===sendCountKey){
      const c=Number(e.newValue||0);
      launcher?.classList.toggle('v9Hidden',c<2);
      if(c>=2)launcher?.classList.add('v9Pulse');
    }
  });

  // Start in the correct view and synchronize any prior draft.
  const initial=(location.hash||'').slice(1);
  showView(viewIds.includes(initial)?initial:'home');
  syncDraftToRequest();
})();
