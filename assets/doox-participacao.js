/* DOOX CORE — cadastro + materiais
   Frontend bridge for the V68 Site 1.
   Backend remains the source of truth.
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
      { type: 'AUDIO', label: 'Áudio da inserção', hint: 'MP3 ou WAV · até 15 MB' }
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

  async function uploadMaterial(pedidoId, spec) {
    const input = $(`material_${spec.type}`);
    const file = input?.files?.[0];
    if (!file) throw new Error(`Material obrigatório ausente: ${spec.label}.`);

    const dataUrl = await fileToDataUrl(file);
    const result = await postJson(`${MATERIALS_API}?action=upload`, {
      pedidoId,
      materialType: spec.type,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      base64: dataUrl
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
      type: type === 'empresa' ? 'Empresa' : 'Pessoa',
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
    button.textContent = 'REGISTRANDO…';
    if (success) { success.style.display = 'block'; success.innerHTML = '<b>Registrando solicitação…</b><br><span style="display:block;margin-top:7px;color:#666">O pedido será criado no DOOX CORE antes do envio dos materiais.</span>'; }

    try {
      const order = await postJson(API, { action: 'registerRequest', ...payload });
      const pedidoId = order.technicalId || order.id || order.pedidoId;
      if (!pedidoId) throw new Error('O DOOX CORE criou a solicitação, mas não retornou o identificador técnico do pedido.');

      const specs = requiredMaterials(payload.modality);
      for (const spec of specs) {
        button.textContent = `ENVIANDO ${spec.type}…`;
        await uploadMaterial(pedidoId, spec);
      }

      const tracking = order.trackingUrl || `${location.origin}/?token=${encodeURIComponent(order.trackingToken || '')}`;
      const total = Number(order.total ?? order.valorTotal ?? 0);
      const unit = Number(order.unitPrice ?? order.valorUnitario ?? 0);
      const code = order.code || order.codigoDoox || '—';

      const wa = 'https://wa.me/5514981150675?text=' + encodeURIComponent(
        `Olá, DOOX. Minha solicitação foi registrada.\n\nCódigo DOOX: ${code}\nModalidade: ${payload.modality}\nQuantidade: ${payload.quantity}\nValor total: ${brl(total)}\n\nAcompanhamento: ${tracking}`
      );

      if (success) {
        success.innerHTML = `<b>Solicitação registrada.</b><br>Código DOOX: <b>${escapeHtml(code)}</b><br>Modalidade: <b>${escapeHtml(payload.modality)}</b><br>Quantidade: <b>${payload.quantity}</b><br>Valor unitário: <b>${brl(unit)}</b><br>Valor total: <b>${brl(total)}</b><br><b>Materiais:</b> recebidos pelo DOOX CORE<div class="actions"><a class="pill orange" href="${escapeHtml(tracking)}">VER PAGAMENTO / ACOMPANHAMENTO</a><a class="pill dark" target="_blank" rel="noopener" href="${escapeHtml(wa)}">WHATSAPP OFICIAL</a></div>`;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      sessionStorage.removeItem('dooxClientRequestId');
    } catch (error) {
      if (success) {
        success.innerHTML = `<b>Não foi possível concluir a solicitação.</b><br><span style="display:block;margin-top:8px">${escapeHtml(error?.message || error)}</span><div class="actions"><button type="button" class="pill light" id="retrySubmitCore">TENTAR NOVAMENTE</button></div>`;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('retrySubmitCore')?.addEventListener('click', () => { success.innerHTML = ''; button.focus(); });
      } else {
        alert(error?.message || error);
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
