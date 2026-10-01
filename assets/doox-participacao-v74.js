/* HOCCO — solicitação + materiais
   Fluxo público de participação.
   A operação interna permanece no servidor.
*/
(function () {
  'use strict';

  const API = '/api/doox';
  const MATERIALS_API = '/api/materials';
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
      box.innerHTML = '<div class="material">Selecione uma modalidade para visualizar os materiais.</div>';
      return;
    }

    if (!list.length) {
      box.innerHTML = '<div class="material"><b>Nenhum arquivo obrigatório.</b><br>Para Apoiador Individual, basta conferir os dados de identificação antes do aceite.</div>';
      return;
    }

    box.innerHTML = list.map((m) => `
      <label class="material" style="display:grid;gap:8px">
        <span><b>${escapeHtml(m.label)}</b><br><small>${escapeHtml(m.hint)}</small></span>
        <input type="file" id="material_${m.type}" data-material-type="${m.type}" accept="${ACCEPT[m.type].join(',')}" required>
        <span id="material_status_${m.type}" class="sim-note" style="color:#666">Arquivo ainda não selecionado.</span>
      </label>
    `).join('');

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
      if (status) status.textContent = 'Arquivo ainda não selecionado.';
      return false;
    }

    if (file.size > LIMITS[spec.type]) {
      input.value = '';
      if (status) status.textContent = `Arquivo excede o limite de ${spec.type === 'AUDIO' ? '15 MB' : '5 MB'}.`;
      return false;
    }

    const allowed = ACCEPT[spec.type];
    if (allowed.length && !allowed.includes(file.type)) {
      input.value = '';
      if (status) status.textContent = 'Formato não permitido para esta modalidade.';
      return false;
    }

    if (status) status.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB · pronto para envio.`;
    return true;
  }

  function validateMaterials() {
    const specs = requiredMaterials(currentMode());
    for (const spec of specs) {
      const input = $(`material_${spec.type}`);
      if (!input?.files?.[0] || !validateMaterialInput(input, spec)) {
        alert(`Envie o material obrigatório: ${spec.label}.`);
        input?.focus();
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
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
    } catch (_) {
      throw new Error('Não foi possível conectar ao serviço DOOX.');
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('O serviço DOOX retornou uma resposta inválida.'); }
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || data.details || `Erro HTTP ${response.status}.`);
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
    if (status) status.textContent = `${file.name} · enviado com sucesso.`;
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
    const clientRequestId = sessionStorage.getItem('dooxClientRequestId') || crypto.randomUUID();
    sessionStorage.setItem('dooxClientRequestId', clientRequestId);

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
    if (payload.type === 'Pessoa' && payload.modality !== 'Apoiador Individual') return 'Pessoa física participa somente como Apoiador Individual.';
    if (payload.type === 'Empresa' && payload.modality === 'Apoiador Individual') return 'Apoiador Individual é exclusivo para pessoa física.';
    if (!payload.name || !payload.whatsapp || !payload.email) return 'Preencha nome, WhatsApp e E-mail.';
    if (payload.type === 'Empresa' && !payload.segment) return 'Informe o segmento da empresa.';
    if (!payload.termsAccepted || !payload.rulesAccepted) return 'Aceite os Termos de Uso e as Regras de Participação para continuar.';
    if (payload.type === 'Empresa' && !payload.companyTermsAccepted) return 'Leia até o final e aceite o Termo de Participação Empresarial para continuar.';
    if (payload.website) return 'Solicitação inválida.';
    if (payload.type === 'Empresa' && payload.discount > 0 && !payload.couponSuffix) return 'Informe o código do cupom HOCCO.';
    return '';
  }

  function clientErrorMessage(error) {
    const raw = String(error?.message || error || '').trim();
    if (!raw) return 'Não foi possível concluir a solicitação agora. Tente novamente.';
    const internal = [
      'Tipo de participação inválido.',
      'serviço interno',
      'Storage DOOX',
      'O Storage',
      'identificador interno',
      'Ação de materiais inválida.',
      'Token não corresponde ao pedido.'
    ];
    if (internal.some((term) => raw.includes(term))) {
      return 'Não foi possível concluir a solicitação agora. Confira os dados e tente novamente.';
    }
    if (/falha no envio do/i.test(raw) || /arquivo armazenado/i.test(raw) || /url de upload/i.test(raw)) {
      return 'Não foi possível concluir o envio dos materiais. Seu Código DOOX foi preservado para esta solicitação.';
    }
    return raw;
  }

  function confirmationLinks(code, tracking) {
    const safeCode = escapeHtml(code || '—');
    const safeTracking = escapeHtml(tracking || '#');
    return `<div class="actions"><a class="pill orange" href="${safeTracking}">VER PAGAMENTO / ACOMPANHAMENTO</a><button type="button" class="pill dark" id="copyCodeButton">COPIAR CÓDIGO</button></div><div id="copyCodeStatus" class="sim-note" style="color:#666;margin-top:8px"></div>`;
  }

  async function registerAndUpload() {
    const button = $('submit');
    const success = $('success');
    if (!button || button.dataset.busy === '1') return;

    const payload = buildPayload();
    const validation = validateForm(payload);
    if (validation) return alert(validation);
    if (!validateMaterials()) return;

    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = 'FINALIZANDO…';

    let order = null;
    let pedidoId = '';
    let code = '';
    let tracking = '';

    try {
      // Primeiro registra a solicitação. O mesmo retorno já contém o Código DOOX
      // e o acompanhamento que serão usados durante toda a operação.
      order = await postJson(API, { action: 'registerRequest', ...payload });
      pedidoId = order.technicalId || order.id || order.pedidoId;
      code = order.code || order.codigoDoox || '';
      tracking = order.trackingUrl || `${location.origin}/?token=${encodeURIComponent(order.trackingToken || '')}`;

      if (!pedidoId || !code || !order.trackingToken) {
        throw new Error('A solicitação foi criada, mas não foi possível gerar o código de acompanhamento.');
      }

      // O cliente recebe o código imediatamente, antes do envio dos materiais.
      if (success) {
        success.style.display = 'block';
        success.innerHTML = `<b>Solicitação registrada.</b><br>Seu Código DOOX é <b>${escapeHtml(code)}</b>.<br><span style="display:block;margin-top:7px;color:#666">Agora estamos concluindo o envio dos materiais escolhidos.</span>`;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const specs = requiredMaterials(payload.modality);
      for (const spec of specs) {
        button.textContent = `ENVIANDO ${spec.type === 'AUDIO' ? 'ÁUDIO' : 'LOGO'}…`;
        await uploadMaterial(pedidoId, order.trackingToken, spec);
      }

      const total = Number(order.total ?? order.valorTotal ?? 0);
      const unit = Number(order.unitPrice ?? order.valorUnitario ?? 0);
      const wa = 'https://wa.me/5514981150675?text=' + encodeURIComponent(
        `Olá, DOOX. Minha solicitação foi registrada.\n\nCódigo DOOX: ${code}\nModalidade: ${payload.modality}\nQuantidade: ${payload.quantity}\nValor total: ${brl(total)}\n\nAcompanhamento: ${tracking}`
      );

      if (success) {
        success.innerHTML = `<b>Solicitação concluída.</b><br>Código DOOX: <b>${escapeHtml(code)}</b><br>Modalidade: <b>${escapeHtml(payload.modality)}</b><br>Quantidade: <b>${payload.quantity}</b><br>Valor unitário: <b>${brl(unit)}</b><br>Valor total: <b>${brl(total)}</b><br><b>Materiais:</b> recebidos com sucesso.<br><span style="display:block;margin-top:8px;color:#666">Guarde seu Código DOOX. Ele identifica esta solicitação e será usado no acompanhamento.</span>${confirmationLinks(code, tracking)}<a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">WHATSAPP OFICIAL</a>`;
        const copyBtn = $('copyCodeButton');
        copyBtn?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code);
            $('copyCodeStatus').textContent = 'Código copiado.';
          } catch (_) {
            $('copyCodeStatus').textContent = `Código: ${code}`;
          }
        }, { once: true });
      }

      sessionStorage.removeItem('dooxClientRequestId');
    } catch (error) {
      const message = clientErrorMessage(error);
      if (success) {
        if (code && tracking) {
          const wa = 'https://wa.me/5514981150675?text=' + encodeURIComponent(
            `Olá, DOOX. Minha solicitação foi criada e preciso concluir o envio dos materiais.\n\nCódigo DOOX: ${code}\nAcompanhamento: ${tracking}`
          );
          success.innerHTML = `<b>Solicitação registrada.</b><br>Seu Código DOOX é <b>${escapeHtml(code)}</b>.<br><span style="display:block;margin-top:8px">${escapeHtml(message)}</span><div class="actions"><a class="pill orange" href="${escapeHtml(tracking)}">ACOMPANHAR SOLICITAÇÃO</a><a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">CONCLUIR PELO WHATSAPP</a></div><div class="sim-note" style="color:#666;margin-top:8px">Não faça um novo pedido. Use este mesmo Código DOOX para esta solicitação.</div>`;
        } else {
          success.innerHTML = `<b>Não foi possível concluir a solicitação.</b><br><span style="display:block;margin-top:8px">${escapeHtml(message)}</span><div class="actions"><button type="button" class="pill light" id="retrySubmitCore">TENTAR NOVAMENTE</button></div>`;
          $('retrySubmitCore')?.addEventListener('click', () => { success.innerHTML = ''; button.focus(); });
        }
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(message);
      }
    } finally {
      button.dataset.busy = '0';
      button.disabled = false;
      button.textContent = 'FECHAR PEDIDO';
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
