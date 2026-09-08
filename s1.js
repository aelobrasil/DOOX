
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  // Opening splash
  const splash = $('#openingSplash');
  setTimeout(() => splash?.classList.add('opening-hidden'), 1700);

  // SPA navigation
  const views = $$('.view');
  const tabs = $$('.tab[data-go]');
  const back = $('#backGlobal');
  const navHistory = [];
  let suppressHistory = false;
  let lastScrollY = window.scrollY;
  let chromeTimer = null;
  let chromeVisible = true;

  function activeView(){ return $('.view.active'); }
  function setChrome(show){
    chromeVisible = show;
    $('.top')?.classList.toggle('ui-hidden', !show);
    back?.classList.toggle('ui-hidden', !show);
  }
  function scheduleChromeHide(){
    clearTimeout(chromeTimer);
    chromeTimer=setTimeout(()=>setChrome(false),5000);
  }
  function revealChrome(){ setChrome(true); scheduleChromeHide(); }
  function go(id, push=true){
    if(!$('#'+id)) return false;
    const current=activeView();
    if(current?.id===id){ window.scrollTo({top:0,behavior:'smooth'}); revealChrome(); return true; }
    if(push && current && !suppressHistory) navHistory.push(current.id);
    views.forEach(v=>v.classList.toggle('active',v.id===id));
    tabs.forEach(t=>t.classList.toggle('active',t.dataset.go===id));
    window.scrollTo({top:0,behavior:'smooth'});
    back?.classList.toggle('show',id!=='home');
    revealChrome();
    return true;
  }
  function closeMobileMenu(){
    const menu=$('#mobileMenu'), list=$('.tabs');
    if(window.innerWidth<981 && menu && list) list.style.display='none';
  }
  tabs.forEach(b=>b.addEventListener('click',()=>{go(b.dataset.go);closeMobileMenu()}));
  $$('[data-go]:not(.tab)').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  back?.addEventListener('click',()=>{ const prev=navHistory.pop()||'home'; suppressHistory=true; go(prev,false); suppressHistory=false; });
  $('#mobileMenu')?.addEventListener('click',()=>{
    const list=$('.tabs'); if(!list) return;
    list.style.display=list.style.display==='flex'?'none':'flex';
    if(list.style.display==='flex') Object.assign(list.style,{position:'absolute',top:'74px',left:'0',right:'0',padding:'10px',background:'#fff',border:'1px solid #eee',borderRadius:'20px',boxShadow:'0 20px 50px #0002',flexWrap:'wrap'});
  });

  // Chrome hides after 5s and returns only after an upward scroll / user scroll gesture.
  revealChrome();
  window.addEventListener('scroll',()=>{
    const y=window.scrollY, delta=y-lastScrollY;
    if(delta>6){ setChrome(false); clearTimeout(chromeTimer); }
    else if(delta<-6){ revealChrome(); }
    else if(y<20){ revealChrome(); }
    lastScrollY=y;
  },{passive:true});

  // Simulator
  const screen=$('#screen'), mode=$('#mode'), moment=$('#moment'), priceTier=$('#priceTier');
  const inputName=$('#inputName'), inputHandle=$('#inputHandle');
  const previewName=$('#previewName'), simImage=$('#simImage'), simFocus=$('#simFocus');
  const ovFooter=$('#ovFooter'), ovVisual=$('#ovVisual'), ovIndividual=$('#ovIndividual'), ovSponsor=$('#ovSponsor');
  const timeBadge=$('#timeBadge'), creditClock=$('#creditClock'), audioBadge=$('#audioBadge');
  const simWhere=$('#simWhere'), simHow=$('#simHow'), simDescription=$('#simDescription'), simPriceInfo=$('#simPriceInfo'), simDisclaimer=$('#simDisclaimer');
  const simMetaMode=$('#simMode');
  const simTimeline=$('#simTimeline'), simTimelineTitle=$('#simTimelineTitle'), simTimelineHint=$('#simTimelineHint'), simRangeLabel=$('#simRangeLabel'), simEditorialLabel=$('#simEditorialLabel'), simPlayhead=$('#simPlayhead');
  const rangePositions={essential:[14,27],regular:[28,42],valued:[43,60],premium:[61,78],special:[79,96]};

  const priceOptions={
    footer:[['fixed','R$ 49,90']],
    overlay:[['essential','00:30–02:00 · R$ 39,90'],['regular','02:00–04:00 · R$ 49,90'],['valued','04:00–06:30 · R$ 59,90'],['premium','06:30–09:00 · R$ 69,90'],['special','09:00–11:00 · R$ 79,90']],
    audio:[['essential','00:30–02:00 · R$ 49,90'],['regular','02:00–04:00 · R$ 59,90'],['valued','04:00–06:30 · R$ 69,90'],['premium','06:30–09:00 · R$ 79,90'],['special','09:00–11:00 · R$ 89,90']]
  };
  const momentLabels={
    essential:'00:30–02:00 · menor atenção', regular:'02:00–04:00 · atenção normal', valued:'04:00–06:30 · maior interesse', premium:'06:30–09:00 · alta atenção', special:'09:00–11:00 · atenção excepcional'
  };
  const modes={
    footer:{title:'PRESENÇA NO RODAPÉ',where:'Durante o episódio',how:'Grupo visual · aproximadamente 5s',desc:'Até 10 empresas podem ser apresentadas em um mesmo bloco. Logo em fundo, nome e @ ficam integrados à faixa inferior.',disclaimer:'Valor fixo de R$ 49,90. A produção organiza os grupos e busca evitar concorrentes diretos no mesmo bloco.'},
    overlay:{title:'SPONSOR OVERLAY',where:'Durante o episódio',how:'Inserção visual · aproximadamente 5s',desc:'A marca aparece individualmente sobre a imagem. A faixa escolhida representa um intervalo aproximado do episódio, não um minuto garantido.',disclaimer:'A posição exata pode variar conforme a edição e a construção narrativa.'},
    audio:{title:'OVERLAY + ÁUDIO',where:'Durante o episódio',how:'Visual + chamada sonora · aproximadamente 5s',desc:'A marca entra individualmente acompanhada de uma chamada sonora curta, usada como gatilho de atenção e aprovada pela produção.',disclaimer:'O áudio só é utilizado quando o contexto sonoro comporta a modalidade.'},
    individual:{title:'APOIADOR INDIVIDUAL',where:'Créditos',how:'Lista de nomes / @',desc:'A tela fica preta e apresenta a relação de apoiadores. O nome ou @ entra em uma rotação coletiva.',disclaimer:'Apresentação ilustrativa; posição e ordem podem variar.'},
    sponsor:{title:'EMPRESA PATROCINADORA DO EPISÓDIO',where:'Pós-créditos',how:'HOCCO + empresa + @',desc:'A tela fica preta e apresenta a empresa como participante da sustentação comercial do episódio.',disclaimer:'Imagem, posição e composição são demonstrativas.'}
  };
  function renderSimulationTimeline(){
    const m=mode?.value||'overlay';
    const timed=['overlay','audio'].includes(m);
    $$('.simBand').forEach(b=>b.classList.toggle('active',timed && b.dataset.band===moment?.value));
    if(!simTimelineTitle||!simRangeLabel||!simEditorialLabel||!simTimelineHint)return;
    if(m==='footer'){
      simTimelineTitle.textContent='Presença coletiva no episódio';
      simTimelineHint.textContent='O bloco é organizado pela DOOX conforme a edição.';
      simRangeLabel.textContent='Bloco coletivo · aproximadamente 5s por exibição';
      simEditorialLabel.textContent='RODAPÉ';
      if(simPlayhead){simPlayhead.style.transition='none';simPlayhead.style.left='12%';}
    }else if(timed){
      const key=moment?.value||'essential', info=momentInfo[key]||momentInfo.essential, pos=rangePositions[key]||rangePositions.essential;
      simTimelineTitle.textContent=info.label;
      simTimelineHint.textContent='O minuto exato dentro desta faixa não é garantido.';
      simRangeLabel.textContent=info.range;
      simEditorialLabel.textContent=m==='audio'?'OVERLAY + ÁUDIO':'SPONSOR OVERLAY';
      if(simPlayhead){simPlayhead.style.transition='none';simPlayhead.style.left=pos[0]+'%';}
    }else if(m==='individual'){
      simTimelineTitle.textContent='Créditos do episódio';
      simTimelineHint.textContent='A posição e a ordem da rotação podem variar.';
      simRangeLabel.textContent='Após a história'; simEditorialLabel.textContent='APOIADOR INDIVIDUAL';
      if(simPlayhead){simPlayhead.style.transition='none';simPlayhead.style.left='95%';}
    }else{
      simTimelineTitle.textContent='Pós-créditos';
      simTimelineHint.textContent='Apresentação institucional demonstrativa.';
      simRangeLabel.textContent='Pós-créditos'; simEditorialLabel.textContent='PATROCÍNIO DO EPISÓDIO';
      if(simPlayhead){simPlayhead.style.transition='none';simPlayhead.style.left='97%';}
    }
  }

  function animateSimulationTimeline(){
    if(!simPlayhead || !mode)return;
    const m=mode.value;
    if(['overlay','audio'].includes(m)){
      const p=rangePositions[moment?.value||'essential']||rangePositions.essential;
      simPlayhead.style.left=p[0]+'%';
      requestAnimationFrame(()=>{requestAnimationFrame(()=>{simPlayhead.style.transition='left 5.2s cubic-bezier(.18,.72,.18,1)';simPlayhead.style.left=p[1]+'%';});});
    }
  }

  const simImages=['pov-demo-01.jpg','pov-demo-02.jpg','simulacao-cinematica.jpg','overlay-cinematic.png'];
  let simImageIndex=0;

  function resetOverlays(){
    [ovFooter,ovVisual,ovIndividual,ovSponsor,simFocus].forEach(x=>x?.classList.remove('show'));
  }
  function refreshPriceOptions(){
    const opts=priceOptions[mode.value];
    if(opts){
      priceTier.innerHTML=opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
      priceTier.disabled=true;
      const desired=moment?.value||opts[0][0];
      priceTier.value=opts.some(([v])=>v===desired)?desired:opts[0][0];
    } else {
      priceTier.innerHTML='<option value="fixed">Modalidade fixa</option>';
      priceTier.value='fixed';
      priceTier.disabled=true;
    }
  }
  function syncTierToMoment(){
    if(!priceTier || !moment) return;
    const opts=priceOptions[mode?.value];
    if(opts){
      const key=moment.value||opts[0][0];
      priceTier.value=opts.some(([v])=>v===key)?key:opts[0][0];
    }
  }
  function parsePrice(text){
    const m=(text||'').match(/R\$\s*([0-9]+),([0-9]{2})/); return m?Number(`${m[1]}.${m[2]}`):null;
  }
  function updatePreview(){
    if(!mode||!screen) return;
    const m=mode.value, cfg=modes[m];
    resetOverlays();
    screen.classList.remove('isCredits','footer-demo','phone','price-essential','price-regular','price-valued','price-premium','price-special');
    const n=(inputName?.value||'').trim()||'SUA EMPRESA', h=(inputHandle?.value||'').trim()||'@suaempresa';
    $('#pName')&&( $('#pName').textContent=n ); $('#pHandle')&&( $('#pHandle').textContent=h ); $('#fpName')&&( $('#fpName').textContent=n ); $('#fpHandle')&&( $('#fpHandle').textContent=h ); $('#indName')&&( $('#indName').textContent=h ); $('#sponsorName')&&( $('#sponsorName').textContent=n ); $('#sponsorHandle')&&( $('#sponsorHandle').textContent=h );
    previewName.textContent=cfg.title;
    simWhere&&(simWhere.textContent=cfg.where); simHow&&(simHow.textContent=cfg.how); simDescription&&(simDescription.textContent=cfg.desc); simDisclaimer&&(simDisclaimer.textContent=cfg.disclaimer);
    syncTierToMoment();
    const tierText=priceTier?.options[priceTier.selectedIndex]?.text||'';
    const tier=parsePrice(tierText);
    simPriceInfo&&(simPriceInfo.textContent=m==='footer'?'Valor fixo: R$ 49,90':(['overlay','audio'].includes(m)?`Faixa/preço automático: ${tierText}`:`Valor: ${tierText||cfg.disclaimer}`));
    if(simMetaMode) simMetaMode.textContent=cfg.title;
    simImageIndex=(simImageIndex+1)%simImages.length; if(simImage){simImage.style.display='block';simImage.src=simImages[simImageIndex]||'hocco-universe.png';}
    const isTimed=['footer','overlay','audio'].includes(m);
    if(timeBadge){timeBadge.style.display=isTimed?'block':'none';timeBadge.innerHTML=isTimed?'DURAÇÃO <span>≈ 5s</span>':'';}
    if(creditClock) creditClock.style.display=isTimed?'none':'block';
    if(audioBadge) audioBadge.style.display=m==='audio'?'block':'none';
    const disabledCredits=['individual','sponsor'].includes(m);
    if(moment){moment.disabled=disabledCredits; if(!disabledCredits && !moment.value) moment.value='essential';}
    if(m==='footer'){
      screen.classList.add('footer-demo','price-fixed');
      $('#sceneLabel').textContent='RODAPÉ · '+(momentLabels[moment.value]||'distribuição editorial');
      simFocus.style.left='2%';simFocus.style.right='2%';simFocus.style.bottom='2%';simFocus.style.top='auto';simFocus.style.height='14%';
      ovFooter.classList.add('show');
    } else if(m==='overlay' || m==='audio'){
      screen.dataset.moment=priceTier.value;
      screen.classList.add('price-'+priceTier.value);
      $('#sceneLabel').textContent=momentLabels[priceTier.value]||'FAIXA APROXIMADA';
      simFocus.style.left='2%';simFocus.style.top='3%';simFocus.style.width='58%';simFocus.style.height='22%';simFocus.style.right='auto';simFocus.style.bottom='auto';
      ovVisual.classList.add('show');
    } else if(m==='individual'){
      screen.classList.add('isCredits');$('#sceneLabel').textContent='TELA PRETA · CRÉDITOS';simFocus.style.left='18%';simFocus.style.right='18%';simFocus.style.top='12%';simFocus.style.bottom='12%';simFocus.style.height='auto';ovIndividual.classList.add('show');
    } else {
      screen.classList.add('isCredits');$('#sceneLabel').textContent='TELA PRETA · PÓS-CRÉDITOS';simFocus.style.left='16%';simFocus.style.right='16%';simFocus.style.top='10%';simFocus.style.bottom='14%';simFocus.style.height='auto';ovSponsor.classList.add('show');
    }
  }
  mode?.addEventListener('change',()=>{refreshPriceOptions();updatePreview();});
  moment?.addEventListener('change',()=>{syncTierToMoment();updatePreview();});
  priceTier?.addEventListener('change',e=>{e.preventDefault();syncTierToMoment();updatePreview();});
  [inputName,inputHandle].forEach(x=>x?.addEventListener('input',updatePreview));
  $$('.device').forEach(b=>b.addEventListener('click',()=>{$$('.device').forEach(x=>x.classList.remove('active'));b.classList.add('active');screen.classList.toggle('phone',b.dataset.device==='phone');}));
  $('#playDemo')?.addEventListener('click',()=>{
    updatePreview();
    [ovFooter,ovVisual,ovIndividual,ovSponsor,simFocus].forEach(x=>x?.classList.remove('show'));
    requestAnimationFrame(()=>{
      const target=({footer:ovFooter,overlay:ovVisual,audio:ovVisual,individual:ovIndividual,sponsor:ovSponsor})[mode.value];
      simFocus?.classList.add('show'); target?.classList.add('show');
    });
    setTimeout(()=>{targetForMode()?.classList.remove('show');},6000);
  });
  function targetForMode(){return ({footer:ovFooter,overlay:ovVisual,audio:ovVisual,individual:ovIndividual,sponsor:ovSponsor})[mode.value];}

  window.goPreview=(key)=>{ if(mode && modes[key]){ mode.value=key; refreshPriceOptions(); updatePreview(); go('preview'); } };

  // Buttons "Ver na simulação"
  $$('[data-preview]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.preview;
    if(mode && modes[key]){ mode.value=key; refreshPriceOptions(); updatePreview(); go('preview'); }
  }));
  $('#proceedFromPreview')?.addEventListener('click',()=>{
    const map={footer:'Presença no Rodapé',overlay:'Sponsor Overlay',audio:'Overlay + Áudio',individual:'Apoiador Individual',sponsor:'Empresa Patrocinadora do Episódio'};
    const key=mode.value, target=map[key];
    const isPerson=key==='individual';
    const rt=$('#reqType'), rm=$('#reqMode'), rp=$('#reqPriceTier'), rmm=$('#reqMoment'), rn=$('#reqName'), rh=$('#reqHandle');
    if(rt){rt.value=isPerson?'pessoa':'empresa';rt.dispatchEvent(new Event('change'));}
    setTimeout(()=>{
      if(rm&&target){rm.value=target;rm.dispatchEvent(new Event('change'));}
      if(rn)rn.value=inputName.value; if(rh)rh.value=inputHandle.value;
      if(rp) rp.value=key==='footer'||key==='individual'||key==='sponsor'?'Modalidade fixa':(priceTier?.options[priceTier.selectedIndex]?.text||'');
      const mapMoment={essential:'00:30–02:00',regular:'02:00–04:00',valued:'04:00–06:30',premium:'06:30–09:00',special:'09:00–11:00'};
      if(rmm && !rmm.disabled)rmm.value=mapMoment[moment.value]||mapMoment.essential;
      updateRequestSummary();
      go('request');
    },30);
  });
  refreshPriceOptions();updatePreview();

  // Request catalog/form
  const prices={'Presença no Rodapé':49.9,'Sponsor Overlay':39.9,'Overlay + Áudio':49.9,'Apoiador Individual':9.9,'Empresa Patrocinadora do Episódio':89.9};
  const requestOptions={empresa:['Presença no Rodapé','Sponsor Overlay','Overlay + Áudio','Empresa Patrocinadora do Episódio'],pessoa:['Apoiador Individual']};
  const requestRanges={
    'Sponsor Overlay':['00:30–02:00 · R$ 39,90','02:00–04:00 · R$ 49,90','04:00–06:30 · R$ 59,90','06:30–09:00 · R$ 69,90','09:00–11:00 · R$ 79,90'],
    'Overlay + Áudio':['00:30–02:00 · R$ 49,90','02:00–04:00 · R$ 59,90','04:00–06:30 · R$ 69,90','06:30–09:00 · R$ 79,90','09:00–11:00 · R$ 89,90']
  };
  const rangeKeyByText={'00:30–02:00':'essential','02:00–04:00':'regular','04:00–06:30':'valued','06:30–09:00':'premium','09:00–11:00':'special'};
  function requestRangePriceLabel(m, rangeText){
    const labels=requestRanges[m]||[];
    return labels.find(x=>x.startsWith(rangeText+' · ')) || labels[0] || '';
  }
  const reqType=$('#reqType'),reqMode=$('#reqMode'),reqMoment=$('#reqMoment'),reqQty=$('#reqQty'),reqPriceTier=$('#reqPriceTier'),reqCatalog=$('#requestCatalog');
  const reqName=$('#reqName'),reqPhone=$('#reqPhone'),reqEmail=$('#reqEmail'),reqHandle=$('#reqHandle'),reqObs=$('#reqObs'),acceptTerms=$('#acceptTerms'),sumText=$('#sumText'),sumPrice=$('#sumPrice');
  function money(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  function fillRequestModes(){
    const arr=requestOptions[reqType?.value]||requestOptions.empresa;
    if(reqMode){reqMode.innerHTML=arr.map(x=>`<option>${x}</option>`).join('');}
    renderCatalog();updateSummaryAndFields();
  }
  function currentPrice(){
    const m=reqMode?.value||'';
    if(requestRanges[m]){
      const label=requestRangePriceLabel(m, reqMoment?.value||'00:30–02:00');
      return parsePrice(label)||null;
    }
    return prices[m]??null;
  }
  function renderCatalog(){
    if(!reqCatalog)return;
    const arr=requestOptions[reqType?.value]||[];
    reqCatalog.innerHTML=arr.map(x=>{
      const p=x==='Sponsor Overlay'?'A partir de R$ 39,90':x==='Overlay + Áudio'?'A partir de R$ 49,90':money(prices[x]);
      const sub=x==='Presença no Rodapé'?'Preço único · até 10 empresas por bloco · 50 no episódio':x==='Sponsor Overlay'?'5 faixas de preço · limite operacional de 10':x==='Overlay + Áudio'?'5 faixas de preço · limite operacional de 10':x==='Empresa Patrocinadora do Episódio'?'Preço fixo · 1 vaga por episódio':'Créditos · até 50 participações';
      return `<button type="button" class="requestChoice ${reqMode?.value===x?'active':''}" data-choice="${x}"><small>${reqType?.value==='empresa'?'EMPRESA':'PESSOA'}</small><strong>${x}</strong><span>${p}</span><small>${sub}</small></button>`
    }).join('');
    $$('[data-choice]',reqCatalog).forEach(b=>b.addEventListener('click',()=>{reqMode.value=b.dataset.choice;updateSummaryAndFields();renderCatalog();}));
  }
  function updateSummaryAndFields(){
    if(!reqMode?.value)return;
    const m=reqMode.value;
    const person=m==='Apoiador Individual';
    const timed=Boolean(requestRanges[m]);
    if(reqMoment){
      reqMoment.disabled=person || m==='Empresa Patrocinadora do Episódio';
      if(reqMoment.disabled) reqMoment.value='Após a história / definido pela produção';
      if(timed && !rangeKeyByText[reqMoment.value]) reqMoment.value='00:30–02:00';
    }
    const old=$('#reqPriceTier');
    if(old){
      if(timed){
        const sel=document.createElement('select');
        sel.id='reqPriceTier'; sel.className=old.className||''; sel.disabled=true;
        sel.innerHTML=(requestRanges[m]||[]).map(x=>`<option value="${x}">${x}</option>`).join('');
        old.replaceWith(sel);
      } else if(old.tagName!=='INPUT' || old.value!=='Modalidade fixa'){
        const inp=document.createElement('input');
        inp.id='reqPriceTier'; inp.readOnly=true; inp.value='Modalidade fixa'; inp.className=old.className||''; old.replaceWith(inp);
      }
    }
    if(reqQty){
      reqQty.max=(m==='Empresa Patrocinadora do Episódio')?'1':'';
      if(m==='Empresa Patrocinadora do Episódio' && Number(reqQty.value)>1) reqQty.value='1';
    }
    if(timed){
      const sel=$('#reqPriceTier');
      const label=requestRangePriceLabel(m, reqMoment?.value||'00:30–02:00');
      if(sel && label) sel.value=label;
    }
    renderCatalog();updateSummary();
  }
  function updateSummary(){
    const m=reqMode?.value||''; const q=Math.max(1,Number(reqQty?.value)||1); const p=currentPrice();
    if(sumText)sumText.textContent=`${q} × ${m}`;
    if(sumPrice)sumPrice.textContent=p==null?'A definir após análise':money(p*q);
  }
  function updateRequestSummary(){updateSummary();}
  window.updateSummary=updateSummary;
  window.updateSummaryAndFields=updateSummaryAndFields;
  reqType?.addEventListener('change',fillRequestModes);reqMode?.addEventListener('change',updateSummaryAndFields);reqMoment?.addEventListener('change',()=>{updateSummaryAndFields();});reqQty?.addEventListener('input',updateSummary);fillRequestModes();

  // WhatsApp finalization is handled by the consolidated controller below.

  // Legal modal
const legalData={
terms:{title:'Termos de Uso',content:`<p class="updated">Última atualização: 1 de setembro de 2026.</p><h3>1. Objeto do site</h3><p>Este site apresenta modalidades de participação relacionadas ao universo audiovisual HOCCO e permite o envio de solicitações para atendimento pelo WhatsApp informado no próprio site. O site tem finalidade informativa e de solicitação inicial.</p><h3>2. Solicitação não é contratação automática</h3><p>O envio do formulário ou da mensagem pelo WhatsApp não constitui, por si só, aprovação, contratação concluída, reserva definitiva, confirmação de pagamento, garantia de publicação ou garantia de exibição em episódio específico. Cada solicitação pode ser analisada antes de qualquer confirmação.</p><h3>3. Momentos desejados e encaixe final</h3><p>Quando o participante escolhe uma faixa aproximada, essa escolha representa uma preferência de posicionamento dentro de um episódio médio de cerca de 12 minutos. A demonstração é ilustrativa. O encaixe efetivo pode depender de disponibilidade, planejamento, edição, duração, narrativa, segurança operacional, materiais aprovados e demais necessidades da produção.</p><h3>4. Materiais e responsabilidade do solicitante</h3><p>Quem envia nome, marca, logotipo, imagem, áudio, texto, endereço de perfil ou outro material declara possuir os direitos e autorizações necessários para seu uso. O solicitante permanece responsável pela veracidade das informações e pela licitude do material enviado.</p><h3>5. Análise e recusa</h3><p>Solicitações ou materiais podem não ser aceitos quando forem incompatíveis com a proposta do projeto, tecnicamente inadequados, potencialmente ilegais, ofensivos, enganosos, violadores de direitos de terceiros ou inadequados ao contexto audiovisual. A ausência de aprovação não gera obrigação de publicação.</p><h3>6. Valores, disponibilidade e vagas</h3><p>Os valores apresentados no site são referências comerciais das modalidades indicadas e podem estar sujeitos a análise conforme modalidade, quantidade, disponibilidade e condições específicas. A indicação de vagas representa a estrutura operacional planejada e não cria, isoladamente, uma reserva em favor de quem apenas acessa a página.</p><h3>7. Pagamento e confirmação</h3><p>Quando houver pagamento, as condições aplicáveis, forma de pagamento e confirmação deverão seguir a orientação comunicada durante o atendimento. Nenhuma participação deve ser considerada confirmada apenas porque o usuário enviou um comprovante; a confirmação depende da verificação aplicável ao processo.</p><h3>8. Alterações, cancelamentos e impossibilidade de execução</h3><p>Pedidos, materiais ou programações podem exigir ajustes por motivos técnicos, editoriais, de calendário ou de produção. Situações de cancelamento, reembolso, crédito ou remanejamento deverão ser tratadas conforme as circunstâncias concretas e as condições comunicadas no atendimento, observada a legislação aplicável.</p><h3>9. Propriedade intelectual</h3><p>HOCCO, DOOX, identidade visual, layout, textos próprios, marcas, elementos audiovisuais e demais conteúdos protegidos não podem ser reproduzidos, explorados ou utilizados fora das permissões aplicáveis. A participação de uma empresa ou pessoa não transfere propriedade sobre o projeto audiovisual.</p><h3>10. Limitação da simulação</h3><p>As telas de simulação demonstram possibilidades visuais. Elas não constituem prova de posicionamento definitivo, frame definitivo, tempo exato, audiência garantida, alcance mínimo, resultado comercial ou promessa de desempenho.</p><h3>11. Conduta no uso do site</h3><p>É proibido tentar comprometer a segurança ou o funcionamento do site, inserir códigos maliciosos, realizar uso automatizado abusivo, fornecer dados fraudulentos ou utilizar o site para finalidades ilícitas.</p><h3>12. Alterações destes termos</h3><p>Estes Termos podem ser atualizados quando necessário. A versão exibida no site é a referência para o uso realizado após sua publicação, sem prejuízo de condições específicas já confirmadas em atendimentos anteriores.</p><h3>13. Legislação aplicável</h3><p>As relações decorrentes do uso do site e das solicitações deverão observar a legislação brasileira aplicável. Eventuais questões serão tratadas pelos canais de atendimento e, quando necessário, pelos meios legalmente competentes.</p><h3>14. Atendimento</h3><p>O canal de atendimento utilizado para as solicitações é o WhatsApp oficial informado no site. O envio de mensagem representa início do atendimento, não confirmação automática.</p><h3>15. Acessibilidade e disponibilidade</h3><p>A DOOX busca manter o site acessível e funcional. Instabilidades temporárias, manutenção, indisponibilidade de serviços de terceiros ou limitações de rede podem ocorrer.</p><h3>16. Aceite</h3><p>Ao continuar utilizando o site, o usuário declara ter lido e compreendido estes Termos e concordado com as regras aplicáveis.</p>`},
rules:{title:'Regras de Participação',content:`<p class="updated">Última atualização: 1 de setembro de 2026.</p><h3>1. O que é contratado</h3><p>O participante solicita uma modalidade de presença. A participação não compra roteiro, edição, controle narrativo, minuto exato ou poder de decisão sobre o episódio.</p><h3>2. Faixas aproximadas e preço</h3><p>Para Sponsor Overlay e Overlay + Áudio, o participante escolhe uma faixa/momento comercial. Essa escolha determina automaticamente o preço da modalidade: 00:30–02:00, 02:00–04:00, 04:00–06:30, 06:30–09:00 ou 09:00–11:00. A posição final e o minuto exato dentro da faixa podem variar conforme a edição, a narrativa e a disponibilidade do episódio.</p><h3>3. Presença no Rodapé</h3><p>Valor único de R$ 49,90. As marcas são organizadas em grupos de até 10 empresas por bloco. A duração atual é aproximada de 5 segundos por bloco e pode ser atualizada no formato. Logo/imagem, nome e @ são integrados após análise e confirmação.</p><h3>4. Concorrência direta</h3><p>A produção buscará evitar empresas concorrentes diretas no mesmo bloco de Rodapé. Isso não representa exclusividade de segmento e a composição final dos grupos permanece sob organização da produção.</p><h3>5. Overlay + Áudio</h3><p>A chamada sonora curta é integrada à entrada da marca como gatilho de atenção. Não concede ao participante controle sobre a narrativa ou liberdade para inserir qualquer fala, música ou mensagem sem análise.</p><h3>6. Materiais</h3><p>Logo, imagem e demais materiais não são enviados pelo site. Após a análise e confirmação da solicitação, a equipe orientará o envio pelo canal oficial indicado.</p><h3>7. Aprovação</h3><p>O envio ao WhatsApp representa solicitação para análise. A participação somente é confirmada após a validação aplicável.</p>`},policy:{title:'Política DOOX para HOCCO',content:`<p class="updated">Última atualização: 1 de setembro de 2026.</p><h3>1. Finalidade</h3><p>Esta política descreve os princípios utilizados para organizar participações de empresas e pessoas no universo HOCCO, buscando preservar a compreensão do público e a coerência audiovisual das presenças aprovadas.</p><h3>2. Participação não é controle narrativo</h3><p>A presença de uma empresa ou pessoa não representa compra de roteiro, compra de opinião, controle sobre acontecimentos, obrigação de fala do protagonista ou garantia de que a narrativa será adaptada para promover um participante.</p><h3>3. Separação entre formatos</h3><p>As modalidades empresariais e pessoais possuem finalidades distintas. Empresas podem utilizar formatos de presença comercial e institucional. Pessoas podem participar nos formatos pessoais disponibilizados. A organização pode atualizar a estrutura de modalidades conforme a evolução do projeto.</p><h3>4. Momento, faixa e preço</h3><p>Para as modalidades com faixas comerciais, o participante escolhe a faixa/momento apresentado no site e essa escolha determina o preço correspondente. A DOOX não garante um minuto exato: o posicionamento dentro da faixa é definido conforme o contexto real do episódio, disponibilidade, edição e narrativa.</p><h3>5. Integridade da experiência</h3><p>Uma participação não deve ser posicionada de forma a ocultar informações essenciais, prejudicar diálogos relevantes, induzir o público a erro ou comprometer de maneira desnecessária a compreensão da história. Quando necessário, o posicionamento pode ser ajustado.</p><h3>6. Materiais permitidos</h3><p>Podem ser solicitados nome, logotipo, imagem, texto, perfil, site ou áudio, conforme a modalidade. Todo material pode passar por avaliação técnica e contextual. A aprovação de um pedido não implica autorização para qualquer material futuro.</p><h3>7. Conteúdo incompatível</h3><p>Não serão aceitos, entre outros, materiais ilícitos, fraudulentos, discriminatórios, sexualmente inadequados ao contexto, violentos de forma indevida, enganosos ou que violem direitos de terceiros. Também podem ser recusados materiais que criem risco jurídico, reputacional ou técnico para o projeto.</p><h3>8. Transparência comercial</h3><p>Quando a natureza da presença exigir identificação ou comunicação específica, a apresentação deverá observar a legislação e as práticas aplicáveis. A forma visual utilizada no episódio pode variar de acordo com a modalidade e a produção.</p><h3>9. Privacidade e dados enviados</h3><p>Os dados fornecidos na solicitação são utilizados para identificar o interessado, responder ao pedido, organizar a participação e manter registros operacionais relacionados ao atendimento. Podem incluir nome, telefone, modalidade, perfil, observações e materiais enviados.</p><h3>10. Compartilhamento e retenção</h3><p>Os dados não são destinados à venda como produto de terceiros. Informações podem ser acessadas por pessoas envolvidas no atendimento e na operação quando necessário para processar a solicitação. Registros podem ser mantidos pelo período necessário para atendimento, organização, segurança e cumprimento de obrigações aplicáveis.</p><h3>11. Segurança</h3><p>São adotadas medidas razoáveis para reduzir acessos indevidos e uso inadequado dos dados. Nenhum ambiente digital pode garantir risco zero; por isso, o usuário também deve evitar o envio de informações desnecessariamente sensíveis pelos campos públicos ou pelo WhatsApp.</p><h3>12. Direitos do titular</h3><p>O titular pode solicitar informações sobre os dados pessoais tratados no contexto do atendimento e, quando aplicável, pedir correção, atualização ou outras medidas previstas na legislação brasileira. Solicitações devem ser encaminhadas pelos canais oficiais de contato utilizados no atendimento.</p><h3>13. Dados de navegação e armazenamento local</h3><p>O site pode utilizar armazenamento local do navegador para preferências e fluxo de navegação. O usuário pode limpar esses dados nas configurações do navegador. O site evita armazenar dados pessoais desnecessários no lado do cliente.</p><h3>14. Segurança e prevenção de abuso</h3><p>Podem ser usados mecanismos como validação de formato de telefone, campo de controle antirobô, limites temporais e verificação de origem no ambiente de hospedagem. Essas medidas reduzem abuso, mas não representam garantia absoluta contra ataques.</p><h3>15. Acesso geográfico</h3><p>A operação comercial da DOOX neste site é destinada ao Brasil. O ambiente hospedado na Vercel pode restringir acessos internacionais por mecanismos de infraestrutura. A classificação geográfica é técnica e pode apresentar exceções.</p><h3>16. Contato e solicitações de dados</h3><p>Dúvidas, correções ou solicitações relacionadas a dados pessoais podem ser encaminhadas pelo canal oficial de atendimento informado no site.</p><h3>17. Atualizações da política</h3><p>Esta política pode ser revisada para refletir mudanças operacionais, técnicas ou legais. A data de atualização exibida identifica a versão publicada nesta página.</p>`}
};
  const legal=$('#legal'),legalTitle=$('#legalTitle'),legalContent=$('#legalContent');
  $$('[data-legal]').forEach(b=>b.addEventListener('click',()=>{const d=legalData[b.dataset.legal];if(!d)return;legalTitle.textContent=d.title;legalContent.innerHTML=d.content;legal.classList.add('open')}));
  $('#closeLegal')?.addEventListener('click',()=>legal.classList.remove('open'));
  legal?.addEventListener('click',e=>{if(e.target===legal)legal.classList.remove('open')});

  // Initial page + deep-link support
  const initial=(location.hash||'').replace('#',''); if(initial && $('#'+initial)?.classList.contains('view')) go(initial,false); else go('home',false);
})();
