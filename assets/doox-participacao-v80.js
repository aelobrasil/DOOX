/* HOCCO — solicitação + materiais · HOCCO API V1.3
   Fluxo público de participação.
   A operação interna permanece no servidor.
*/
(function () {
  'use strict';

  const PUBLIC_FLOW_VERSION = '2026.10.02-v81-hocco-v1.3';
  const API = '/api/hocco-v1';
  const MATERIALS_API = '/api/hocco-materials-v1';
  const PIX_KEY = 'c9316176-6f92-413e-9209-63ae6f661ba9';
  const LIMITS = { LOGO: 5 * 1024 * 1024, AUDIO: 15 * 1024 * 1024, IMAGEM: 10 * 1024 * 1024, OUTRO: 10 * 1024 * 1024 };
  const ACCEPT = {
    LOGO: ['image/jpeg', 'image/png', 'image/webp'],
    AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'],
    IMAGEM: ['image/jpeg', 'image/png', 'image/webp'],
    OUTRO: []
  };

  const requiredByMode = {
    'Presença no Rodapé': [{ type: 'LOGO', label: 'Logo da empresa', hint: 'JPG, PNG ou WebP · até 5 MB' }],
    'Sponsor Overlay': [{ type: 'LOGO', label: 'Logo da empresa', hint: 'JPG, PNG ou WebP · até 5 MB' }],
    'Overlay + Áudio': [
      { type: 'LOGO', label: 'Logo da empresa', hint: 'JPG, PNG ou WebP · até 5 MB' },
      { type: 'AUDIO', label: 'Áudio da CTA', hint: 'MP3 ou WAV · até 15 MB' }
    ],
    'Empresa Patrocinadora do Episódio': [{ type: 'LOGO', label: 'Logo da empresa', hint: 'JPG, PNG ou WebP · até 5 MB' }],
    'Apoiador Individual': []
  };

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
  const RETURN_KEY = 'hocco:lastRequest:v1';
  function saveLastRequest(order, payload, code, tracking) {
    try {
      localStorage.setItem(RETURN_KEY, JSON.stringify({
        numero: Number(order?.numero || 0), code: code || order?.codigo_doox || '',
        token: String(order?.trackingToken || ''), tracking: tracking || '', modality: payload.modality || '',
        moment: payload.moment || '', quantity: payload.quantity || 1, audience: payload.audience || payload.ptype || 'empresa',
        name: payload.name || '', company: payload.company || '', profile: payload.profile || '', segment: payload.segment || '', savedAt: Date.now()
      }));
    } catch (_) {}
  }
  function getLastRequest(){ try{return JSON.parse(localStorage.getItem(RETURN_KEY)||'null')}catch(_){return null} }
  function prefillFromLast(editMode){
    const last=getLastRequest(); if(!last)return;
    const audience=last.audience==='pessoa'?'pessoa':'empresa', radio=document.querySelector('input[name="ptype"][value="'+audience+'"]');
    if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}))}
    setTimeout(()=>{
      if($('mode')){$('mode').value=last.modality||'';$('mode').dispatchEvent(new Event('change',{bubbles:true}))}
      setTimeout(()=>{if($('range')&&last.moment){$('range').value=last.moment;$('range').dispatchEvent(new Event('change',{bubbles:true}))}},100);
      if($('qty')){$('qty').value=last.quantity||1;$('qty').dispatchEvent(new Event('input',{bubbles:true}))}
      if($('name'))$('name').value=last.name||''; if($('fantasy'))$('fantasy').value=last.company||'';
      if($('profile'))$('profile').value=last.profile||''; if($('segment'))$('segment').value=last.segment||'';
      $('participar')?.scrollIntoView({behavior:'smooth',block:'start'});
      if(editMode) showStatus('<b>Inserção carregada para edição.</b><br><span style="display:block;margin-top:6px">Revise os dados e envie uma nova solicitação. O pedido já registrado permanece preservado no histórico.</span>');
    },140);
  }
  function renderReturnPanel(){
    const last=getLastRequest(); if(!last?.code&&!last?.numero)return;
    const host=document.createElement('aside');host.className='hocco-return';host.innerHTML='<button class="hocco-return-close" type="button" aria-label="Fechar">×</button><small>BEM-VINDO DE VOLTA</small><strong>'+escapeHtml(last.name||last.company||'HOCCO')+'</strong><span>Última solicitação <b>'+escapeHtml(last.code||('#'+String(last.numero).padStart(6,'0')))+'</b></span><em>'+escapeHtml(last.modality||'Participação HOCCO')+'</em><div><button type="button" data-return="continue">CONTINUAR →</button><button type="button" data-return="repeat">SOLICITAR NOVAMENTE</button><button type="button" data-return="edit">EDITAR INSERÇÃO</button></div>';
    document.body.appendChild(host);
    host.querySelector('.hocco-return-close')?.addEventListener('click',()=>host.remove());
    host.querySelector('[data-return="continue"]')?.addEventListener('click',()=>{if($('trackNumber'))$('trackNumber').value=last.code||String(last.numero).padStart(6,'0');if($('track'))$('track').value=last.token||'';$('acompanhar')?.scrollIntoView({behavior:'smooth'});if(last.token)setTimeout(()=>$('trackBtn')?.click(),350)});
    host.querySelector('[data-return="repeat"]')?.addEventListener('click',()=>prefillFromLast(false));
    host.querySelector('[data-return="edit"]')?.addEventListener('click',()=>prefillFromLast(true));
  }

  function currentAudience() {
    const checked = document.querySelector('input[name="ptype"]:checked');
    return checked?.value || 'empresa';
  }

  function currentMode() { return $('mode')?.value || ''; }
  function currentRange() { return $('range')?.value || ''; }
  function currentQuantity() { return Math.max(1, Number($('qty')?.value || 1)); }

  function requiredMaterials(mode) {
    return requiredByMode[mode] || [];
  }

  function renderMaterials() {
    const box = $('materials');
    if (!box) return;
    const list = requiredMaterials(currentMode());

    if (!currentMode()) {
      box.innerHTML = '<div class="material">Selecione uma modalidade para visualizar os materiais obrigatórios.</div>';
      return;
    }

    if (!list.length) {
      box.innerHTML = '<div class="material"><b>Nenhum arquivo obrigatório.</b><br>Para Apoiador Individual, basta conferir os dados de identificação antes do aceite.</div>';
      return;
    }

    box.innerHTML = list.map((m) => {
      const buttonText = m.type === 'AUDIO' ? 'ENVIAR ÁUDIO CTA' : 'ENVIAR LOGO';
      return `
        <div class="material-upload" data-material-card="${m.type}">
          <div class="material-upload-head">
            <span><b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.hint)}</small></span>
          </div>
          <input class="material-file-input" type="file" id="material_${m.type}" data-material-type="${m.type}" accept="${ACCEPT[m.type].join(',')}" required>
          <button type="button" class="pill dark material-upload-button" data-file-target="material_${m.type}">${buttonText}</button>
          <span id="material_status_${m.type}" class="material-upload-status">Nenhum arquivo selecionado.</span>
        </div>`;
    }).join('') + '<div class="materials-help">Os arquivos são enviados somente depois que sua solicitação é registrada. O mesmo número da solicitação identifica o pedido e seus materiais.</div>';

    box.querySelectorAll('[data-file-target]').forEach((button) => {
      button.addEventListener('click', () => $(button.dataset.fileTarget)?.click());
    });

    list.forEach((m) => {
      const input = $(`material_${m.type}`);
      if (!input) return;
      input.addEventListener('change', () => validateMaterialInput(input, m));
    });
  }

  function validateMaterialInput(input, spec) {
    const status = $(`material_status_${spec.type}`);
    const file = input.files?.[0];
    if (!file) {
      if (status) { status.textContent = 'Nenhum arquivo selecionado.'; status.className = 'material-upload-status'; }
      return false;
    }

    if (file.size > LIMITS[spec.type]) {
      input.value = '';
      if (status) { status.textContent = `Arquivo excede o limite de ${spec.type === 'AUDIO' ? '15 MB' : '5 MB'}.`; status.className = 'material-upload-status error'; }
      return false;
    }

    const allowed = ACCEPT[spec.type];
    if (allowed.length && !allowed.includes(file.type)) {
      input.value = '';
      if (status) { status.textContent = 'Formato não permitido para esta modalidade.'; status.className = 'material-upload-status error'; }
      return false;
    }

    if (status) { status.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB · pronto para envio.`; status.className = 'material-upload-status ready'; }
    return true;
  }

  function validateMaterials() {
    const specs = requiredMaterials(currentMode());
    for (const spec of specs) {
      const input = $(`material_${spec.type}`);
      if (!input?.files?.[0] || !validateMaterialInput(input, spec)) {
        showStatus(`<b>Material obrigatório.</b><br><span style="display:block;margin-top:8px">Selecione ${escapeHtml(spec.label)} antes de finalizar a solicitação.</span>`, 'error');
        const card = document.querySelector(`[data-material-card="${spec.type}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }
    return true;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function postJson(url, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('A solicitação demorou mais que o esperado. Tente novamente.');
      throw new Error('Não foi possível conectar ao serviço de solicitações.');
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('O servidor retornou uma resposta inválida.'); }
    if (!response.ok || data.ok === false) {
      const err = new Error(data.message || data.error || data.details || `Erro HTTP ${response.status}.`);
      err.code = data.code || '';
      err.reference = data.reference || '';
      throw err;
    }
    return data;
  }

  async function uploadMaterial(pedidoId, trackingToken, spec) {
    const input = $(`material_${spec.type}`);
    const file = input?.files?.[0];
    if (!file) throw new Error(`Material obrigatório ausente: ${spec.label}.`);

    const prepared = await postJson(`${MATERIALS_API}?action=prepare_upload`, {
      pedidoId,
      trackingToken,
      materialType: spec.type,
      fileName: file.name,
      mimeType: file.type,
      size: file.size
    });

    const upload = prepared.upload;
    if (!upload?.signed_url || !upload?.storage_path) throw new Error('O Storage não retornou os dados de upload.');

    const put = await fetch(upload.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!put.ok) {
      const text = await put.text().catch(() => '');
      throw new Error(`Falha no envio do ${spec.type}: ${text || `HTTP ${put.status}`}`);
    }

    const result = await postJson(`${MATERIALS_API}?action=register`, {
      pedidoId,
      trackingToken,
      materialType: spec.type,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath: upload.storage_path
    });

    const status = $(`material_status_${spec.type}`);
    if (status) { status.textContent = `${file.name} · enviado com sucesso.`; status.className = 'material-upload-status ready'; }
    return result;
  }

  function buildPayload() {
    const type = currentAudience();
    const mode = currentMode();
    const discountSelect = $('discount');
    const customDiscount = $('discountCustom');
    const rawDiscount = discountSelect?.value === 'outro' ? Number(customDiscount?.value || 0) : Number(discountSelect?.value || 0);
    const discount = type === 'empresa' ? Math.max(0, Math.min(100, Math.round(rawDiscount || 0))) : 0;
    const couponSuffix = type === 'empresa' && discount > 0 ? String($('couponSuffix')?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) : '';
    const coupon = couponSuffix ? `HOCCO${couponSuffix}` : '';
    const clientRequestId = sessionStorage.getItem('hoccoClientRequestId') || crypto.randomUUID();
    sessionStorage.setItem('hoccoClientRequestId', clientRequestId);

    return {
      clientRequestId,
      name: $('name')?.value.trim() || '',
      company: type === 'empresa' ? (($('fantasy')?.value.trim()) || ($('name')?.value.trim()) || '') : '',
      type: type === 'empresa' ? 'EMPRESA' : 'PESSOA_FISICA',
      tipo_participacao: type === 'empresa' ? 'EMPRESA' : 'PESSOA_FISICA',
      ptype: type,
      audience: type,
      whatsapp: ($('whatsapp')?.value || '').replace(/\D/g, ''),
      email: $('email')?.value.trim() || '',
      profile: $('profile')?.value.trim() || '',
      segment: $('segment')?.value.trim() || '',
      modality: mode,
      moment: currentRange(),
      quantity: currentQuantity(),
      discount,
      benefit: discount ? `${discount}% de desconto para quem vier pela HOCCO` : '',
      coupon,
      couponSuffix,
      logoName: $('material_LOGO')?.files?.[0]?.name || '',
      observation: $('obs')?.value.trim() || '',
      termsAccepted: $('terms')?.checked === true,
      rulesAccepted: $('rules')?.checked === true,
      companyTermsAccepted: type === 'empresa' ? $('companyTerms')?.checked === true : false,
      companyTermsVersion: type === 'empresa' ? '1.0-2026-09-20' : '',
      website: $('website')?.value || ''
    };
  }

  function validateForm(payload) {
    if (!payload.modality) return 'Selecione uma modalidade.';
    if (['Sponsor Overlay', 'Overlay + Áudio'].includes(payload.modality) && !payload.moment) return 'Selecione o momento/faixa da participação.';
    if (payload.type === 'PESSOA_FISICA' && payload.modality !== 'Apoiador Individual') return 'Pessoa física participa somente como Apoiador Individual.';
    if (payload.type === 'EMPRESA' && payload.modality === 'Apoiador Individual') return 'Apoiador Individual é exclusivo para pessoa física.';
    if (!payload.name || !payload.whatsapp || !payload.email) return 'Preencha nome, WhatsApp e E-mail.';
    if (payload.type === 'EMPRESA' && !payload.segment) return 'Informe o segmento da empresa.';
    if (!payload.termsAccepted || !payload.rulesAccepted) return 'Aceite os Termos de Uso e as Regras de Participação para continuar.';
    if (payload.type === 'EMPRESA' && !payload.companyTermsAccepted) return 'Leia até o final e aceite o Termo de Participação Empresarial para continuar.';
    if (payload.website) return 'Solicitação inválida.';
    if (payload.type === 'EMPRESA' && payload.discount > 0 && !payload.couponSuffix) return 'Informe o código do cupom HOCCO.';
    return '';
  }

  function clientErrorMessage(error) {
    const raw = String(error?.message || error || '').trim();
    if (!raw) return 'Não foi possível concluir a solicitação agora. Tente novamente.';
    if (/falha no envio do/i.test(raw) || /arquivo armazenado/i.test(raw) || /url de upload/i.test(raw) || /envio do material/i.test(raw)) {
      return 'Não foi possível concluir o envio dos materiais. O número da sua solicitação foi preservado.';
    }
    const userFacing = [
      /Selecione uma modalidade/i,
      /momento\/faixa/i,
      /faixa/i,
      /quantidade/i,
      /disponibilidade/i,
      /vagas/i,
      /preço/i,
      /valor/i,
      /Pessoa física participa somente/i,
      /Apoiador Individual é exclusivo/i,
      /Preencha nome, WhatsApp e E-mail/i,
      /Informe o segmento da empresa/i,
      /Aceite os Termos/i,
      /Termo de Participação Empresarial/i,
      /Informe o código do cupom/i,
      /Material obrigatório ausente/i,
      /Arquivo excede o limite/i,
      /Formato não permitido/i,
      /A solicitação demorou mais que o esperado/i,
      /Não foi possível conectar ao serviço de solicitações/i
    ];
    if (userFacing.some((rx) => rx.test(raw))) return raw;
    return 'Não foi possível concluir a solicitação agora. Confira os dados e tente novamente.';
  }

  function showStatus(html, tone = 'normal') {
    const success = $('success');
    if (!success) return;
    success.style.display = 'block';
    success.style.background = tone === 'error' ? '#fff5f3' : '#eff8f0';
    success.style.borderColor = tone === 'error' ? '#f2c7bf' : '#cce8d0';
    success.innerHTML = html;
  }

  function confirmationLinks(code, tracking) {
    const safeCode = escapeHtml(code || '—');
    const safeTracking = escapeHtml(tracking || '#');
    return `<div class="actions"><a class="pill orange" href="${safeTracking}">VER PAGAMENTO / ACOMPANHAMENTO</a><button type="button" class="pill dark" id="copyCodeButton">COPIAR SOLICITAÇÃO</button></div><div id="copyCodeStatus" class="sim-note" style="color:#666;margin-top:8px"></div>`;
  }

  async function registerAndUpload() {
    const button = $('submit');
    const success = $('success');
    if (!button || button.dataset.busy === '1') return;

    const payload = buildPayload();
    const validation = validateForm(payload);
    if (validation) {
      showStatus(`<b>Revise a solicitação.</b><br><span style="display:block;margin-top:8px">${escapeHtml(validation)}</span>`, 'error');
      success?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!validateMaterials()) return;

    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'FINALIZANDO…';
    showStatus('<b>Enviando sua solicitação…</b><br><span style="display:block;margin-top:7px;color:#666">Não feche esta página até aparecer o número da sua solicitação.</span>');

    let order = null;
    let pedidoId = '';
    let code = '';
    let tracking = '';

    try {
      order = await postJson(API, { action: 'registerRequest', ...payload });
      pedidoId = String(order.technicalId || order.id || order.pedidoId || '').trim();
      code = String(order.numeroExibicao || (order.numero ? `#${String(order.numero).padStart(6, '0')}` : '')).trim();
      tracking = order.trackingUrl || (order.trackingToken ? `${location.origin}/?token=${encodeURIComponent(order.trackingToken)}` : '');

      if (!pedidoId || !code) {
        throw new Error('A solicitação não retornou sua identificação completa.');
      }

      showStatus(`<b>Solicitação registrada.</b><br>Sua solicitação é <strong class="code">${escapeHtml(code)}</strong>.<br><span class="submit-progress">Estamos concluindo o envio dos materiais.</span>`);
      success?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const specs = requiredMaterials(payload.modality);
      if (specs.length && !order.trackingToken) {
        throw new Error('Não foi possível autorizar o envio dos materiais desta solicitação.');
      }

      for (const spec of specs) {
        button.textContent = `ENVIANDO ${spec.type === 'AUDIO' ? 'ÁUDIO' : 'LOGO'}…`;
        await uploadMaterial(pedidoId, order.trackingToken, spec);
      }

      const total = Number(order.total ?? order.valorTotal ?? 0);
      const unit = Number(order.unitPrice ?? order.valorUnitario ?? 0);
      const wa = 'https://wa.me/5514981150675?text=' + encodeURIComponent(
        `Olá, DOOX. Minha solicitação foi registrada.\n\nSolicitação: ${code}\nModalidade: ${payload.modality}\nQuantidade: ${payload.quantity}\nValor total: ${brl(total)}${tracking ? `\n\nAcompanhamento: ${tracking}` : ''}`
      );

      const trackingBlock = tracking ? confirmationLinks(code, tracking) : `<div class="actions"><button type="button" class="pill dark" id="copyCodeButton">COPIAR SOLICITAÇÃO</button></div><div id="copyCodeStatus" class="sim-note" style="color:#666;margin-top:8px"></div>`;
      const pixBlock = `<div style="margin-top:14px;padding:13px 14px;border:1px solid #ddd;border-radius:14px;background:#fff"><b>PAGAMENTO PIX</b><div style="font-size:12px;color:#666;margin-top:5px">Valor: <b>${brl(total)}</b></div><div style="font-size:11px;word-break:break-all;margin-top:8px">${PIX_KEY}</div><div class="actions" style="margin-top:9px"><button type="button" class="pill orange" id="copyPixKeyButton">COPIAR CHAVE PIX</button></div><div id="copyPixKeyStatus" class="sim-note" style="color:#666;margin-top:6px">A confirmação do pagamento é feita pela HOCCO após o recebimento.</div></div>`;
      showStatus(`<b>Solicitação concluída.</b><br>Solicitação: <b>${escapeHtml(code)}</b><br>Modalidade: <b>${escapeHtml(payload.modality)}</b><br>Quantidade: <b>${payload.quantity}</b><br>Valor unitário: <b>${brl(unit)}</b><br>Valor total: <b>${brl(total)}</b><br>${specs.length ? '<b>Materiais:</b> recebidos com sucesso.<br>' : ''}<span style="display:block;margin-top:8px;color:#666">Guarde o número da solicitação. Ele identifica este pedido durante todo o atendimento.</span>${pixBlock}${trackingBlock}<a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">WHATSAPP OFICIAL</a>`);

      const pixBtn = $('copyPixKeyButton');
      pixBtn?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(PIX_KEY); if ($('copyPixKeyStatus')) $('copyPixKeyStatus').textContent = 'Chave Pix copiada.'; }
        catch (_) { if ($('copyPixKeyStatus')) $('copyPixKeyStatus').textContent = `Chave Pix: ${PIX_KEY}`; }
      });

      const copyBtn = $('copyCodeButton');
      copyBtn?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          if ($('copyCodeStatus')) $('copyCodeStatus').textContent = 'Código copiado.';
        } catch (_) {
          if ($('copyCodeStatus')) $('copyCodeStatus').textContent = `Código: ${code}`;
        }
      });

      saveLastRequest(order, payload, code, tracking);
      sessionStorage.removeItem('hoccoClientRequestId');
      button.dataset.completed = '1';
      button.disabled = true;
      button.textContent = 'PEDIDO REGISTRADO';
    } catch (error) {
      const message = clientErrorMessage(error);
      const reference = String(error?.reference || error?.code || '').trim();
      const referenceHtml = reference ? `<div class="sim-note" style="color:#777;margin-top:8px">Referência técnica: ${escapeHtml(reference)}</div>` : '';
      if (code) {
        const wa = 'https://wa.me/5514981150675?text=' + encodeURIComponent(
          `Olá, DOOX. Minha solicitação foi registrada e preciso concluir uma etapa.\n\nSolicitação: ${code}${tracking ? `\nAcompanhamento: ${tracking}` : ''}`
        );
        showStatus(`<b>Solicitação registrada.</b><br>Sua solicitação é <b>${escapeHtml(code)}</b>.<br><span style="display:block;margin-top:8px">${escapeHtml(message)}</span>${referenceHtml}<div class="actions">${tracking ? `<a class="pill orange" href="${escapeHtml(tracking)}">ACOMPANHAR SOLICITAÇÃO</a>` : ''}<a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">CONTINUAR PELO WHATSAPP</a></div><div class="sim-note" style="color:#666;margin-top:8px">Não envie uma nova solicitação. Use este mesmo número.</div>`, 'error');
      } else {
        showStatus(`<b>Não foi possível concluir a solicitação.</b><br><span style="display:block;margin-top:8px">${escapeHtml(message)}</span>${referenceHtml}<div class="actions"><button type="button" class="pill light" id="retrySubmit">TENTAR NOVAMENTE</button></div>`, 'error');
        $('retrySubmit')?.addEventListener('click', () => {
          if (success) success.innerHTML = '';
          button.focus();
        });
      }
      success?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      button.dataset.busy = '0';
      if (button.dataset.completed === '1') {
        button.disabled = true;
        button.textContent = 'PEDIDO REGISTRADO';
      } else {
        button.disabled = false;
        button.textContent = code ? 'PEDIDO REGISTRADO — CONCLUIR MATERIAIS' : 'TENTAR FINALIZAR NOVAMENTE';
      }
    }
  }

  function install() {
    renderMaterials();
    setTimeout(renderReturnPanel, 650);

    $('mode')?.addEventListener('change', () => setTimeout(renderMaterials, 0));
    document.querySelectorAll('input[name="ptype"]').forEach((r) => r.addEventListener('change', () => setTimeout(renderMaterials, 0)));
    $('submit')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      registerAndUpload();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

/* HOCCO V82 UI */
(()=>{
  const css=document.createElement('link'); css.rel='stylesheet'; css.href='/assets/hocco-v82.css?v=96.0.0'; document.head.appendChild(css);
  const init=()=>{
    document.body.classList.add('v82');
    const nav=document.querySelector('.navlinks');
    if(nav){
      nav.innerHTML='<a href="#" data-v82-scroll="top">HOCCO</a><a href="#empresa-ho" data-v82-scroll="empresa-ho">Como funciona</a><a href="#simulacao" data-v82-scroll="simulacao">Para empresas</a><a href="#acompanhar" data-v82-scroll="acompanhar">Acompanhar</a><button class="pill orange" data-v82-scroll="participar">PARTICIPAR DA HOCCO →</button>';
    }
    document.querySelectorAll('[data-v82-scroll]').forEach(el=>el.addEventListener('click',e=>{
      e.preventDefault(); const id=el.dataset.v82Scroll;
      if(id==='top') return window.scrollTo({top:0,behavior:'smooth'});
      document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
    const hero=document.querySelector('.hero');
    if(hero){
      const eye=hero.querySelector('.eyebrow'), title=hero.querySelector('h1'), p=hero.querySelector('.hero-copy p'), actions=hero.querySelector('.hero-actions');
      if(eye) eye.textContent='SÉRIE ORIGINAL DOOX';
      if(title) title.innerHTML='HOCCO';
      if(p) p.textContent='Uma série construída enquanto a história acontece. Vida real, empresas e projetos acompanhados de dentro, em POV.';
      if(actions) actions.innerHTML='<a class="v82-link" href="https://www.youtube.com/@hoccpov" target="_blank" rel="noopener">ASSISTIR HOCCO ↗</a><button class="pill orange" data-v82-join>PARTICIPAR DA SÉRIE →</button>';
      actions?.querySelector('[data-v82-join]')?.addEventListener('click',()=>document.getElementById('simulacao')?.scrollIntoView({behavior:'smooth'}));
      if(!document.querySelector('.v82-context')){
        const strip=document.createElement('div'); strip.className='v82-context';
        strip.innerHTML='<div class="v82-context-inner"><b>HOCCO</b><span>SÉRIE BIOGRÁFICA</span><span>POV</span><span>VIDA REAL</span><span>EMPRESAS</span><span>PROJETOS</span></div>';
        hero.insertAdjacentElement('afterend',strip);
      }
    }
    const sim=document.getElementById('simulacao');
    const simHead=sim?.querySelector('.section-head h2'); if(simHead) simHead.textContent='SUA EMPRESA DENTRO DA HISTÓRIA.';
    const participar=document.getElementById('participar');
    const partHead=participar?.querySelector('.section-head h2'); if(partHead) partHead.textContent='ENTRE NA HISTÓRIA.';
    setupSteps();
  };
  function setupSteps(){
    const shell=document.querySelector('#participar .form-shell'); if(!shell||shell.dataset.v82Steps) return;
    const steps=[...shell.querySelectorAll(':scope > .step')]; if(steps.length<2) return;
    shell.dataset.v82Steps='1';
    const groups=[
      {label:'01 Participação',from:0,to:Math.min(2,steps.length-1)},
      {label:'02 Dados',from:Math.min(3,steps.length-1),to:Math.min(4,steps.length-1)},
      {label:'03 Materiais',from:Math.min(5,steps.length-1),to:Math.min(5,steps.length-1)},
      {label:'04 Revisão',from:Math.min(6,steps.length-1),to:steps.length-1}
    ].filter((g,i,a)=>g.from<=g.to && !a.slice(0,i).some(x=>x.from===g.from&&x.to===g.to));
    let page=0;
    const progress=document.createElement('div'); progress.className='v82-form-progress';
    const nav=document.createElement('div'); nav.className='v82-form-nav';
    nav.innerHTML='<button type="button" class="v82-prev">← VOLTAR</button><button type="button" class="v82-next">CONTINUAR →</button>';
    shell.prepend(progress); shell.append(nav);
    const render=()=>{
      steps.forEach(s=>s.classList.remove('v82-step-active'));
      const g=groups[page]; for(let i=g.from;i<=g.to;i++) steps[i]?.classList.add('v82-step-active');
      progress.innerHTML=groups.map((x,i)=>'<button type="button" data-page="'+i+'" class="'+(i===page?'active':'')+'">'+x.label+'</button>').join('');
      progress.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=Number(b.dataset.page);render();shell.scrollIntoView({behavior:'smooth',block:'start'})});
      nav.querySelector('.v82-prev').style.visibility=page===0?'hidden':'visible';
      nav.querySelector('.v82-next').style.display=page===groups.length-1?'none':'inline-flex';
    };
    nav.querySelector('.v82-prev').onclick=()=>{if(page>0){page--;render();}};
    nav.querySelector('.v82-next').onclick=()=>{if(page<groups.length-1){page++;render();}};
    render();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

/* V103 — rounded, bounded visual system */
(()=>{const apply=()=>{if(document.getElementById('dooxV103Rounded'))return;const s=document.createElement('style');s.id='dooxV103Rounded';s.textContent=`
header{top:12px!important;width:min(calc(100% - 24px),1440px)!important;margin:0 auto!important;left:0!important;right:0!important;border-radius:42px!important;overflow:hidden!important}
header .nav{max-width:none!important;width:100%!important}
main>section>.container{width:min(calc(100% - 32px),1240px)!important;margin-left:auto!important;margin-right:auto!important}
.doox-footer-min{width:min(calc(100% - 24px),1440px)!important;margin:56px auto 12px!important;border-radius:42px!important;overflow:hidden!important}
.pill,input,select{border-radius:999px!important}
textarea{border-radius:24px!important}
.type-card,.mode-card,.form-shell,.sim-shell,.tracking-result,.totalbox,.review,.company-term-wrap,.info-note,.info-grid article,#requestSummary{border-radius:28px!important}
.info-box,.company-term-box,.legal-box{border-radius:42px!important}
.legal-close,.company-term-close{border-radius:50%!important}
.doox-d5-row{border-radius:22px!important;padding-left:18px!important;padding-right:18px!important;transition:background .22s ease,transform .22s ease!important}
.doox-d5-row:hover{background:rgba(9,9,9,.045)!important;transform:translateX(4px)}
.footer-links button,.footer-links a{border-radius:999px!important;padding:8px 12px!important}
@media(max-width:760px){header{top:8px!important;width:calc(100% - 16px)!important}.doox-footer-min{width:calc(100% - 16px)!important;margin:36px auto 8px!important;border-radius:28px!important}main>section>.container{width:calc(100% - 20px)!important}.info-box,.company-term-box,.legal-box{border-radius:28px!important}}
`;document.head.appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply()})();

/* V103.1 — hero uses the same minimal HOCCO language */
(()=>{const apply=()=>{if(document.getElementById('dooxV103Hero'))return;const s=document.createElement('style');s.id='dooxV103Hero';s.textContent=`
.v95-home{background:#f1efe9!important;color:#090909!important;padding-top:clamp(120px,14vw,190px)!important}
.v95-home .v95-grid{display:block!important}
.v95-home .v95-cinema{min-height:auto!important;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important;padding:0!important}
.v95-home .v95-cinema-shade,.v95-home .v95-play{display:none!important}
.v95-home .v95-cinema-copy{position:static!important;max-width:1080px!important;padding:clamp(24px,4vw,56px) 0 clamp(42px,7vw,92px)!important;color:#090909!important}
.v95-home .v95-cinema-copy>span{display:inline-flex!important;color:#ff5a00!important;background:transparent!important;border:0!important;padding:0!important;font-size:12px!important;font-weight:800!important;letter-spacing:.16em!important}
.v95-home .v95-cinema-copy h1{color:#090909!important;font-size:clamp(92px,20vw,290px)!important;line-height:.72!important;letter-spacing:-.09em!important;margin:22px 0 34px!important}
.v95-home .v95-cinema-copy h2{color:#090909!important;font-size:clamp(34px,5.4vw,78px)!important;line-height:.94!important;letter-spacing:-.055em!important;max-width:1050px!important;margin:0 0 28px!important}
.v95-home .v95-cinema-copy p{color:#5f5b54!important;font-size:clamp(17px,1.6vw,22px)!important;line-height:1.5!important;max-width:720px!important;margin:0 0 36px!important}
.v95-home .v95-actions{display:flex!important;gap:12px!important;flex-wrap:wrap!important}
.v95-home .v95-actions a,.v95-home .v95-actions button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:52px!important;padding:0 22px!important;border-radius:999px!important;font-size:12px!important;font-weight:800!important;letter-spacing:.08em!important;text-decoration:none!important;transition:transform .2s ease,background .2s ease!important}
.v95-home .v95-actions a{background:#090909!important;color:#fff!important;border:1px solid #090909!important}
.v95-home .v95-actions button{background:#ff5a00!important;color:#fff!important;border:1px solid #ff5a00!important}
.v95-home .v95-actions a:hover,.v95-home .v95-actions button:hover{transform:translateY(-2px)!important}
.v95-home .v95-dashboard{display:none!important}
.v95-home .v95-strip{background:transparent!important;color:#090909!important;border-top:1px solid #b9b5ab!important;border-bottom:1px solid #b9b5ab!important;border-radius:0!important;box-shadow:none!important}
@media(max-width:760px){.v95-home{padding-top:100px!important}.v95-home .v95-cinema-copy h1{font-size:clamp(78px,27vw,150px)!important}.v95-home .v95-actions{align-items:stretch!important}.v95-home .v95-actions a,.v95-home .v95-actions button{width:100%!important}}
`;document.head.appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply()})();

/* V104 — Concept 1 ESSENCIA, full-site visual system */
(()=>{const apply=()=>{if(document.getElementById('dooxV104Essencia'))return;const s=document.createElement('style');s.id='dooxV104Essencia';s.textContent=`
:root{--ess-bg:#f4f0e8;--ess-paper:#fbf8f1;--ess-ink:#0a0a09;--ess-muted:#676158;--ess-line:#d8d1c5;--ess-orange:#ff5a16;--ess-r:26px;--ess-r2:38px}
html,body{background:var(--ess-bg)!important;color:var(--ess-ink)!important}
body{font-family:Arial,Helvetica,sans-serif!important}
header{background:rgba(251,248,241,.91)!important;color:var(--ess-ink)!important;border:1px solid rgba(10,10,9,.09)!important;box-shadow:0 10px 36px rgba(30,24,18,.06)!important;backdrop-filter:blur(18px)!important}
header .brand,header a{color:var(--ess-ink)!important}.brand-dot{background:var(--ess-orange)!important}
header .nav-cta{background:var(--ess-orange)!important;color:#fff!important;border-color:var(--ess-orange)!important}
main>section{background:var(--ess-bg)!important;color:var(--ess-ink)!important;border:0!important}
main>section:nth-of-type(even){background:var(--ess-paper)!important}
.eyebrow,.section-kicker,.rule-kicker{color:var(--ess-orange)!important;letter-spacing:.14em!important}
h1,h2,h3,h4,strong,b{color:var(--ess-ink)}
p,.muted,.hint,small{color:var(--ess-muted)}
.business-grid,.request-layout,.sim-grid,.tracking-grid{gap:clamp(24px,4vw,56px)!important}
.business-entry,.participation,.simulator,#acompanhar{padding-top:clamp(70px,9vw,130px)!important;padding-bottom:clamp(70px,9vw,130px)!important}
.business-entry h2,.participation h2,.simulator h2,#acompanhar h2{font-size:clamp(42px,6vw,86px)!important;line-height:.94!important;letter-spacing:-.055em!important}
.business-rule,.type-card,.mode-card,.form-shell,.sim-shell,.tracking-result,.totalbox,.review,.company-term-wrap,.info-note,.request-summary{background:var(--ess-paper)!important;color:var(--ess-ink)!important;border:1px solid var(--ess-line)!important;box-shadow:none!important;border-radius:var(--ess-r)!important}
.type-card:hover,.mode-card:hover{border-color:var(--ess-orange)!important;transform:translateY(-2px)!important}
.type-card.selected,.mode-card.selected{border-color:var(--ess-ink)!important;background:#fff!important}
input,select,textarea{background:#fff!important;color:var(--ess-ink)!important;border:1px solid var(--ess-line)!important;box-shadow:none!important}
input:focus,select:focus,textarea:focus{border-color:var(--ess-orange)!important;outline:3px solid rgba(255,90,22,.10)!important}
button,.pill{box-shadow:none!important}
.orange,.primary,.cta-primary{background:var(--ess-orange)!important;color:#fff!important;border-color:var(--ess-orange)!important}
.v95-strip{background:transparent!important;color:var(--ess-ink)!important;border-color:var(--ess-line)!important}
.doox-d5-index{border-color:var(--ess-line)!important}
.doox-d5-row{color:var(--ess-ink)!important;border-color:var(--ess-line)!important}
.doox-d5-row b{color:var(--ess-orange)!important}
.info-modal.open,.company-term-modal.open,.legal-modal.open{background:rgba(15,12,9,.62)!important}
.info-box,.company-term-box,.legal-box{background:var(--ess-paper)!important;color:var(--ess-ink)!important;border-radius:var(--ess-r2)!important}
.info-head,.company-term-headbar,.legal-head{background:var(--ess-ink)!important}
.info-body,.company-term-scroll,.legal-body,.legal-content{background:var(--ess-paper)!important}
.doox-footer-min{background:var(--ess-ink)!important;color:#fff!important;border:0!important}
.doox-footer-min .footer-brand,.doox-footer-min a,.doox-footer-min button,.doox-footer-min span{color:#fff!important}
.doox-footer-min .footer-links button,.doox-footer-min .footer-links a{background:transparent!important;border:1px solid rgba(255,255,255,.16)!important}
.doox-footer-min .footer-links button:hover,.doox-footer-min .footer-links a:hover{background:var(--ess-orange)!important;border-color:var(--ess-orange)!important}
@media(max-width:760px){.business-entry,.participation,.simulator,#acompanhar{padding-top:64px!important;padding-bottom:64px!important}}
`;document.head.appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply()})();

/* V105 — full-site Essencia enforcement + official HOCCO motto */
(()=>{const apply=()=>{if(document.getElementById('dooxV105Full'))return;
const hero=document.querySelector('.v95-cinema-copy h2');if(hero)hero.innerHTML='Você chegou<br>no meio da história.';
const s=document.createElement('style');s.id='dooxV105Full';s.textContent=`
:root{--h-bg:#f5f0e7;--h-paper:#fffaf2;--h-ink:#090908;--h-muted:#625d55;--h-line:#d8d0c3;--h-orange:#ff5a16}
html,body,main,main>section,.business-entry,.participation,.simulator,.formats,.tracking,.legal-body,.info-body,.company-term-scroll{background:var(--h-bg)!important;color:var(--h-ink)!important}
main>section:nth-of-type(even){background:var(--h-paper)!important}
body *{border-color:var(--h-line)}
h1,h2,h3,h4,h5,h6,strong,b,label,.title,.section-title{color:var(--h-ink)!important}
p,small,.muted,.hint,.sub,.desc{color:var(--h-muted)!important}
.eyebrow,.section-kicker,.rule-kicker,[class*="kicker"]{color:var(--h-orange)!important}
a{color:inherit}
header{background:rgba(255,250,242,.94)!important;color:var(--h-ink)!important}
header a{color:var(--h-ink)!important}
.v95-home,.v95-home *{border-color:var(--h-line)}
.v95-home{background:var(--h-bg)!important}
.v95-cinema-copy h2{color:var(--h-ink)!important}
.v95-cinema-copy p{color:var(--h-muted)!important}
.v95-actions a{background:var(--h-ink)!important;color:#fff!important}
.v95-actions button,.nav-cta,.orange,.primary{background:var(--h-orange)!important;color:#fff!important;border-color:var(--h-orange)!important}
.v95-strip,.doox-d5-index,.doox-d5-row{background:transparent!important;color:var(--h-ink)!important}
.v95-dashboard,.v95-episode,.v95-capacity,.v95-mini-grid article,.v95-control{background:var(--h-paper)!important;color:var(--h-ink)!important}
.business-entry,.business-grid,.business-rule,.participation,.simulator,#simulacao,#participar,#formatos,#acompanhar{color:var(--h-ink)!important}
.type-card,.mode-card,.format-card,.form-shell,.sim-shell,.tracking-result,.totalbox,.review,.company-term-wrap,.info-note,.request-summary,.step-card,.price-card{background:var(--h-paper)!important;color:var(--h-ink)!important;box-shadow:none!important}
.type-card *, .mode-card *, .format-card *, .form-shell *, .sim-shell *, .tracking-result *, .totalbox *, .review *, .company-term-wrap *{color:inherit}
input,select,textarea{background:#fff!important;color:var(--h-ink)!important;border-color:var(--h-line)!important}
input::placeholder,textarea::placeholder{color:#8a8379!important}
input:focus,select:focus,textarea:focus{border-color:var(--h-orange)!important;outline-color:rgba(255,90,22,.12)!important}
button:not(.primary):not(.orange):not(.nav-cta):not(.legal-close):not(.company-term-close){color:var(--h-ink)}
.info-modal.open,.company-term-modal.open,.legal-modal.open{background:rgba(12,10,8,.66)!important}
.info-box,.company-term-box,.legal-box{background:var(--h-paper)!important;color:var(--h-ink)!important}
.info-head,.company-term-headbar,.legal-head{background:var(--h-ink)!important;color:#fff!important}
.info-head *,.company-term-headbar *,.legal-head *{color:#fff!important}
.info-body,.company-term-scroll,.legal-body,.legal-content{background:var(--h-paper)!important;color:var(--h-ink)!important}
.legal-tabs{background:#eee7dc!important}
.doox-footer-min{background:var(--h-ink)!important;color:#fff!important}
.doox-footer-min *{color:#fff!important}
.doox-footer-min button,.doox-footer-min a{background:transparent!important}
[style*="#10233f"],[style*="#183454"],[style*="#24486f"],[style*="#687487"],[style*="#5d6b7e"],[style*="#69778a"],[style*="#526176"]{color:var(--h-ink)!important}
`;document.head.appendChild(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply()})();
