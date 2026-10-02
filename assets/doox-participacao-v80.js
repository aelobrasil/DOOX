/* HOCCO — solicitação + materiais · HOCCO API V1.3
   Fluxo público de participação.
   A operação interna permanece no servidor.
*/
(function () {
  'use strict';

  const PUBLIC_FLOW_VERSION = '2026.10.02-v81-hocco-v1.3';
  const API = '/api/hocco-v1';
  const MATERIALS_API = '/api/hocco-materials-v1';
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

      const trackingBlock = tracking ? confirmationLinks(code, tracking) : `<div class="actions"><button type="button" class="pill dark" id="copyCodeButton">COPIAR CÓDIGO</button></div><div id="copyCodeStatus" class="sim-note" style="color:#666;margin-top:8px"></div>`;
      showStatus(`<b>Solicitação concluída.</b><br>Solicitação: <b>${escapeHtml(code)}</b><br>Modalidade: <b>${escapeHtml(payload.modality)}</b><br>Quantidade: <b>${payload.quantity}</b><br>Valor unitário: <b>${brl(unit)}</b><br>Valor total: <b>${brl(total)}</b><br>${specs.length ? '<b>Materiais:</b> recebidos com sucesso.<br>' : ''}<span style="display:block;margin-top:8px;color:#666">Guarde o número da solicitação. Ele identifica este pedido durante todo o atendimento.</span>${trackingBlock}<a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">WHATSAPP OFICIAL</a>`);

      const copyBtn = $('copyCodeButton');
      copyBtn?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          if ($('copyCodeStatus')) $('copyCodeStatus').textContent = 'Código copiado.';
        } catch (_) {
          if ($('copyCodeStatus')) $('copyCodeStatus').textContent = `Código: ${code}`;
        }
      });

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
