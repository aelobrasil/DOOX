const CONFIG = {
  spreadsheetId: '', // Deixe vazio se o script estiver vinculado à planilha.
  timezone: 'America/Sao_Paulo',
  companySponsorLimit: 10,
  overlaySlots: 10,
};

const STATUS = 'SOLICITADO';

const PRICE_RULES = {
  'Sponsor Overlay': [
    ['00:30–02:00', 39.90],
    ['02:00–04:00', 49.90],
    ['04:00–06:30', 59.90],
    ['06:30–09:00', 69.90],
    ['09:00–11:00', 79.90],
  ],
  'Overlay + Áudio': [
    ['00:30–02:00', 49.90],
    ['02:00–04:00', 59.90],
    ['04:00–06:30', 69.90],
    ['06:30–09:00', 79.90],
    ['09:00–11:00', 89.90],
  ],
};

const FIXED_PRICES = {
  'Presença no Rodapé': 49.90,
  'Apoiador Individual': 9.90,
  'Empresa Patrocinadora do Episódio': 89.90,
};

function getSpreadsheet_() {
  if (CONFIG.spreadsheetId) return SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return json_({ ok: true, service: 'DOOX-HOCCO-API', version: '1.0' });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const result = registerRequest_(payload);
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  let data;
  try { data = JSON.parse(raw); }
  catch (_) { throw new Error('Payload JSON inválido.'); }
  if (!data || typeof data !== 'object') throw new Error('Payload ausente.');
  return data;
}

function registerRequest_(data) {
  const ss = getSpreadsheet_();
  if (!ss) throw new Error('Planilha não encontrada. Vincule este script a uma planilha Google.');
  setupSheets_(ss);

  const validation = validateAndPrice_(data);
  if (!validation.ok) throw new Error(validation.error);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (alreadyExists_(ss, data.clientRequestId)) {
      return { ok: true, duplicate: true, code: alreadyExists_(ss, data.clientRequestId) };
    }

    enforceCapacity_(ss, validation.mode, data.episode || 'EP01', validation.qty);

    const code = nextCode_(ss, data.episode || 'EP01');
    const now = new Date();
    const sheet = ss.getSheetByName('PEDIDOS');
    sheet.appendRow([
      code,
      now,
      data.name || '',
      data.type === 'pessoa' ? 'PESSOA' : 'EMPRESA',
      data.phone || '',
      data.email || '',
      data.handle || '',
      data.mode || '',
      validation.moment,
      validation.range,
      validation.unitPrice,
      validation.qty,
      validation.total,
      data.episode || 'EP01',
      STATUS,
      data.terms === true,
      data.rules === true,
      data.obs || '',
      data.clientRequestId || '',
      now,
      ''
    ]);

    return {
      ok: true,
      duplicate: false,
      code,
      status: STATUS,
      mode: validation.mode,
      moment: validation.moment,
      range: validation.range,
      unitPrice: validation.unitPrice,
      quantity: validation.qty,
      total: validation.total,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateAndPrice_(data) {
  const mode = String(data.mode || '').trim();
  const qty = Math.max(1, Number(data.qty) || 1);
  if (!mode) return { ok: false, error: 'Modalidade não informada.' };
  if (!data.name) return { ok: false, error: 'Nome/empresa não informado.' };
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) return { ok: false, error: 'E-mail inválido.' };
  const phone = String(data.phone || '').replace(/\D/g, '');
  if (!/^(?:55)?\d{10,11}$/.test(phone)) return { ok: false, error: 'WhatsApp brasileiro inválido.' };
  if (data.terms !== true) return { ok: false, error: 'Termos de Uso não aceitos.' };
  if (data.rules !== true) return { ok: false, error: 'Regras de Participação não aceitas.' };

  if (PRICE_RULES[mode]) {
    const requested = String(data.moment || '').trim();
    const hit = PRICE_RULES[mode].find(r => r[0] === requested);
    if (!hit) return { ok: false, error: 'Momento/faixa inválido para a modalidade.' };
    return { ok: true, mode, moment: requested, range: hit[0], unitPrice: hit[1], qty, total: hit[1] * qty };
  }

  if (FIXED_PRICES[mode] == null) return { ok: false, error: 'Modalidade não reconhecida.' };
  if (mode === 'Empresa Patrocinadora do Episódio' && qty > CONFIG.companySponsorLimit) {
    return { ok: false, error: 'Quantidade acima do limite de 10 vagas por episódio.' };
  }
  return { ok: true, mode, moment: data.moment || 'Definido pela produção', range: 'Modalidade fixa', unitPrice: FIXED_PRICES[mode], qty, total: FIXED_PRICES[mode] * qty };
}

function setupSheets_(ss) {
  const schemas = {
    'PEDIDOS': ['Código DOOX','Data/Hora','Nome / Empresa','Tipo','WhatsApp','E-mail','@ / Perfil / Site','Modalidade','Momento desejado','Faixa comercial','Valor unitário','Quantidade','Valor total','Episódio','Status','Termos aceitos','Regras aceitas','Observações','ID da solicitação','Última atualização','Link comprovante'],
    'CLIENTES': ['Código','Nome / Empresa','Tipo','WhatsApp','E-mail','@ / Perfil / Site','Data primeiro pedido','Observações'],
    'PAGAMENTOS': ['Código DOOX','Valor','Forma','Solicitado em','Pago em','Status','Comprovante','Conferido por','Observações'],
    'MATERIAIS': ['Código DOOX','Logo','Foto','Áudio','Texto','Recebido em','Aprovado em','Status','Observações'],
    'EPISÓDIOS': ['Episódio','Data prevista','Data publicada','URL','Status','Observações'],
    'PROGRAMAÇÃO': ['Código DOOX','Episódio','Modalidade','Faixa contratada','Minuto efetivo','Duração','Bloco/ordem','Status','Observações'],
    'VEICULAÇÕES': ['Código DOOX','Episódio','Data publicação','URL episódio','Minuto efetivo','Duração','Evidência/arquivo','Comprovante','Data emissão','Observações'],
    'VAGAS': ['Episódio','Produto','Limite','Reservadas','Confirmadas','Disponíveis','Atualizado em'],
    'COMPROVANTES': ['Código DOOX','Tipo documento','URL/Arquivo','Gerado em','Enviado em','Status','Observações'],
    'DASHBOARD': ['Indicador','Valor'],
  };
  Object.keys(schemas).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,schemas[name].length).setValues([schemas[name]]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,schemas[name].length).setFontWeight('bold');
    }
  });
}

function alreadyExists_(ss, clientRequestId) {
  if (!clientRequestId) return null;
  const sh = ss.getSheetByName('PEDIDOS');
  if (sh.getLastRow() < 2) return null;
  const values = sh.getRange(2,19,sh.getLastRow()-1,1).getValues().flat();
  const idx = values.indexOf(clientRequestId);
  if (idx < 0) return null;
  return sh.getRange(idx + 2,1).getValue();
}

function enforceCapacity_(ss, mode, episode, qty) {
  if (mode !== 'Empresa Patrocinadora do Episódio') return;
  const sh = ss.getSheetByName('PEDIDOS');
  if (sh.getLastRow() < 2) return;
  // H:N = modalidade, momento, faixa, valor unitário, quantidade, valor total, episódio
  const rows = sh.getRange(2,8,sh.getLastRow()-1,7).getValues();
  const confirmedOrPending = rows.reduce((sum, r) => {
    const sameMode = String(r[0] || '') === mode;
    const sameEpisode = String(r[6] || 'EP01') === String(episode || 'EP01');
    const qtyExisting = Number(r[4]) || 0;
    return sum + (sameMode && sameEpisode ? qtyExisting : 0);
  }, 0);
  if (confirmedOrPending + qty > CONFIG.companySponsorLimit) {
    throw new Error(`As 10 vagas de Empresa Patrocinadora do ${episode} já foram atingidas ou reservadas.`);
  }
}

function nextCode_(ss, episode) {
  const sh = ss.getSheetByName('PEDIDOS');
  const year = Utilities.formatDate(new Date(), CONFIG.timezone, 'yy');
  const ep = String(episode || 'EP01').replace(/\D/g,'').padStart(2,'0');
  const last = sh.getLastRow();
  let seq = 1;
  if (last >= 2) {
    const vals = sh.getRange(2,1,last-1,1).getValues().flat();
    vals.forEach(v => {
      const m = String(v).match(/DOOX-\d{2}-EP\d{2}-(\d{4})$/);
      if (m) seq = Math.max(seq, Number(m[1]) + 1);
    });
  }
  return `DOOX-${year}-EP${ep}-${String(seq).padStart(4,'0')}`;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
