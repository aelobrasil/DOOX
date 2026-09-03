const CONFIG = {
  spreadsheetId: '1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB',
  version: '6.0',
  timezone: 'America/Sao_Paulo',
  maxEpisodeSponsors: 10,
  whatsapp: '5514981150675'
};

const SHEETS = {
  PEDIDOS: 'PEDIDOS',
  CLIENTES: 'CLIENTES',
  PAGAMENTOS: 'PAGAMENTOS',
  MATERIAIS: 'MATERIAIS',
  EPISODIOS: 'EPISÓDIOS',
  PROGRAMACAO: 'PROGRAMAÇÃO',
  VEICULACOES: 'VEICULAÇÕES',
  VAGAS: 'VAGAS',
  COMPROVANTES: 'COMPROVANTES',
  DASHBOARD: 'DASHBOARD'
};

const PRICING = {
  'Sponsor Overlay': [
    { start: 30, end: 120, label: '00:30–02:00', price: 39.90 },
    { start: 120, end: 240, label: '02:00–04:00', price: 49.90 },
    { start: 240, end: 390, label: '04:00–06:30', price: 59.90 },
    { start: 390, end: 540, label: '06:30–09:00', price: 69.90 },
    { start: 540, end: 660, label: '09:00–11:00', price: 79.90 }
  ],
  'Sponsor Overlay + Áudio': [
    { start: 30, end: 120, label: '00:30–02:00', price: 49.90 },
    { start: 120, end: 240, label: '02:00–04:00', price: 59.90 },
    { start: 240, end: 390, label: '04:00–06:30', price: 69.90 },
    { start: 390, end: 540, label: '06:30–09:00', price: 79.90 },
    { start: 540, end: 660, label: '09:00–11:00', price: 89.90 }
  ]
};

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  if (p.action === 'lookup' && p.requestId) {
    const result = lookupRequest_(String(p.requestId));
    return jsonOrJsonp_(result, p.callback);
  }

  return jsonOrJsonp_({
    ok: true,
    service: 'DOOX-HOCCO-API',
    version: CONFIG.version
  }, p.callback);
}
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Payload ausente.' });
    }

    const payload = normalizePayload_(JSON.parse(e.postData.contents));
    const result = registerRequest_(payload);

    return json_(result);
  } catch (error) {
    return json_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}


function normalizePayload_(data) {
  data = data || {};
  return {
    clientRequestId: data.clientRequestId || data.requestId || '',
    name: data.name || data.company || '',
    company: data.company || '',
    email: data.email || '',
    whatsapp: data.whatsapp || data.phone || '',
    type: data.type || 'empresa',
    modality: normalizeModality_(data.modality || data.mode || ''),
    moment: data.moment || '',
    quantity: data.quantity || data.qty || 1,
    episode: data.episode || 'EP01',
    profile: data.profile || data.handle || '',
    observation: data.observation || data.obs || '',
    termsAccepted: data.termsAccepted === true || data.terms === true,
    rulesAccepted: data.rulesAccepted === true || data.rules === true
  };
}


function normalizeModality_(value) {
  const v = String(value || '').trim();
  const aliases = {
    'Overlay + Áudio': 'Sponsor Overlay + Áudio',
    'Sponsor Overlay + Audio': 'Sponsor Overlay + Áudio',
    'Overlay + Audio': 'Sponsor Overlay + Áudio'
  };
  return aliases[v] || v;
}

function getRowObject_(headers, rowValues) {
  const out = {};
  headers.forEach((header, index) => out[String(header)] = rowValues[index]);
  return out;
}

function lookupRequest_(requestId) {
  const ss = openSpreadsheet_();
  ensureSheets_(ss);
  const sheet = ss.getSheetByName(SHEETS.PEDIDOS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: false, pending: true };

  const headers = values[0].map(String);
  const requestIndex = headers.indexOf('Client Request ID');
  if (requestIndex === -1) return { ok: false, error: 'Coluna Client Request ID não encontrada.' };

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][requestIndex] || '') === String(requestId)) {
      const row = getRowObject_(headers, values[i]);
      return requestResponseFromRow_(row, true);
    }
  }
  return { ok: false, pending: true };
}

function requestResponseFromRow_(row, found) {
  return {
    ok: true,
    found: !!found,
    code: row['Código DOOX'] || '',
    status: row['Status'] || '',
    modality: row['Modalidade'] || '',
    moment: row['Momento Desejado'] || '',
    rangeLabel: row['Faixa Comercial'] || '',
    unitPrice: row['Valor Unitário'] || '',
    quantity: row['Quantidade'] || '',
    total: row['Valor Total'] || '',
    episode: row['Episódio'] || ''
  };
}

function appendPedidoByHeaders_(sheet, valuesByHeader) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(header => Object.prototype.hasOwnProperty.call(valuesByHeader, header) ? valuesByHeader[header] : '');
  sheet.appendRow(row);
}

/**
 * Teste controlado da conexão Apps Script -> Google Sheets.
 * Não deve ser executado para pedidos reais.
 * Ele grava uma linha claramente marcada como TESTE na aba PEDIDOS.
 */
function testSpreadsheet() {
  const ss = openSpreadsheet_();
  ensureSheets_(ss);
  const sheet = ss.getSheetByName(SHEETS.PEDIDOS);
  const code = 'TESTE-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const now = new Date();

  appendPedidoByHeaders_(sheet, {
    'Data/Hora': now,
    'Código DOOX': code,
    'Nome': 'TESTE DE INTEGRAÇÃO',
    'Empresa': 'DOOX',
    'E-mail': 'teste@doox.local',
    'WhatsApp': '00000000000',
    'Tipo': 'Empresa',
    'Modalidade': 'Sponsor Overlay',
    'Momento Desejado': '03:00',
    'Faixa Comercial': '02:00–04:00',
    'Valor Unitário': 49.90,
    'Quantidade': 1,
    'Valor Total': 49.90,
    'Status': 'TESTE',
    'Reserva/Vaga': 'NÃO CONSUMIR VAGA',
    'Episódio': 'EP01',
    '@ / Perfil / Site': '@teste',
    'Observação': 'Criado pela função testSpreadsheet',
    'Termos Aceitos': 'SIM',
    'Regras Aceitas': 'SIM',
    'Data de Registro': now,
    'Observações Internas': '',
    'Client Request ID': 'TEST-' + Utilities.getUuid()
  });

  SpreadsheetApp.flush();
  return { ok: true, test: true, code: code, sheet: SHEETS.PEDIDOS, row: sheet.getLastRow() };
}

/**
 * Registra uma solicitação real enviada pelo site.
 */
function registerRequest_(data) {
  const validation = validateRequest_(data);
  if (!validation.ok) return validation;

  const commercial = calculateCommercial_(data.modality, data.moment);
  if (!commercial.ok) return commercial;

  const qty = Math.max(1, Number(data.quantity || 1));
  const episode = String(data.episode || 'EP01').trim();

  if (data.modality === 'Empresa Patrocinadora do Episódio') {
    const available = getEpisodeSponsorAvailability_(episode);
    if (qty > available) return { ok: false, error: `Não há vagas suficientes. Disponíveis: ${available}.` };
  }

  const ss = openSpreadsheet_();
  ensureSheets_(ss);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = ss.getSheetByName(SHEETS.PEDIDOS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const requestIdIndex = headers.indexOf('Client Request ID');
    const requestId = String(data.clientRequestId || '').trim();

    if (requestId && requestIdIndex >= 0 && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, requestIdIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat();
      const foundAt = ids.findIndex(v => String(v || '') === requestId);
      if (foundAt >= 0) {
        const rowNumber = foundAt + 2;
        const rowValues = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
        return requestResponseFromRow_(getRowObject_(headers, rowValues), false);
      }
    }

    const finalCommercial = calculateCommercial_(data.modality, data.moment);
    const unitPrice = finalCommercial.unitPrice;
    const total = unitPrice * qty;
    const code = makeDooxCode_(episode, sheet);
    const now = new Date();

    appendPedidoByHeaders_(sheet, {
      'Data/Hora': now,
      'Código DOOX': code,
      'Nome': safe_(data.name || ''),
      'Empresa': safe_(data.company || ''),
      'E-mail': safe_(data.email || ''),
      'WhatsApp': safe_(data.whatsapp || ''),
      'Tipo': safe_(data.type || ''),
      'Modalidade': safe_(data.modality || ''),
      'Momento Desejado': safe_(data.moment || ''),
      'Faixa Comercial': finalCommercial.rangeLabel,
      'Valor Unitário': unitPrice,
      'Quantidade': qty,
      'Valor Total': total,
      'Status': 'SOLICITADO',
      'Reserva/Vaga': 'RESERVA PENDENTE',
      'Episódio': episode,
      '@ / Perfil / Site': safe_(data.profile || ''),
      'Observação': safe_(data.observation || ''),
      'Termos Aceitos': data.termsAccepted === true ? 'SIM' : 'NÃO',
      'Regras Aceitas': data.rulesAccepted === true ? 'SIM' : 'NÃO',
      'Data de Registro': now,
      'Observações Internas': '',
      'Client Request ID': requestId
    });

    SpreadsheetApp.flush();
    return { ok: true, code: code, status: 'SOLICITADO', episode: episode, modality: data.modality,
      moment: data.moment, rangeLabel: finalCommercial.rangeLabel, unitPrice: unitPrice, quantity: qty, total: total };
  } finally {
    lock.releaseLock();
  }
}

function validateRequest_(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Solicitação inválida.' };
  }

  const required = ['name', 'email', 'whatsapp', 'modality', 'moment'];
  for (const field of required) {
    if (!String(data[field] || '').trim()) {
      return { ok: false, error: `Campo obrigatório ausente: ${field}.` };
    }
  }

  if (data.termsAccepted !== true || data.rulesAccepted !== true) {
    return {
      ok: false,
      error: 'Termos de Uso e Regras de Participação precisam ser aceitos.'
    };
  }

  const allowed = [
    'Presença no Rodapé',
    'Sponsor Overlay',
    'Sponsor Overlay + Áudio',
    'Apoiador Individual',
    'Empresa Patrocinadora do Episódio'
  ];

  if (!allowed.includes(data.modality)) {
    return { ok: false, error: 'Modalidade inválida.' };
  }

  const qty = Number(data.quantity || 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
    return { ok: false, error: 'Quantidade inválida.' };
  }

  return { ok: true };
}

function calculateCommercial_(modality, moment) {
  if (modality === 'Presença no Rodapé') {
    return {
      ok: true,
      rangeLabel: 'Preço fixo',
      unitPrice: 49.90
    };
  }

  if (modality === 'Apoiador Individual') {
    return {
      ok: true,
      rangeLabel: 'Créditos pós-episódio',
      unitPrice: 9.90
    };
  }

  if (modality === 'Empresa Patrocinadora do Episódio') {
    return {
      ok: true,
      rangeLabel: 'Patrocínio do episódio',
      unitPrice: 89.90
    };
  }

  const ranges = PRICING[modality];
  const directLabel = String(moment || '').trim().replace(/\s+/g, '');
  const byLabel = ranges.find(r => r.label.replace(/\s+/g, '') === directLabel);
  if (byLabel) {
    return { ok: true, rangeLabel: byLabel.label, unitPrice: byLabel.price };
  }

  const seconds = parseMomentToSeconds_(moment);
  if (seconds === null) {
    return {
      ok: false,
      error: 'Momento inválido. Use HH:MM, MM:SS ou uma faixa comercial válida.'
    };
  }

  const found = ranges.find(r => seconds >= r.start && seconds < r.end);

  if (!found) {
    return {
      ok: false,
      error: 'O momento escolhido está fora das faixas comerciais disponíveis.'
    };
  }

  return {
    ok: true,
    rangeLabel: found.label,
    unitPrice: found.price
  };
}

function parseMomentToSeconds_(value) {
  const text = String(value || '').trim();
  const parts = text.split(':').map(Number);

  if (parts.some(n => Number.isNaN(n) || n < 0)) return null;

  if (parts.length === 2) {
    const mm = parts[0];
    const ss = parts[1];
    return mm * 60 + ss;
  }

  if (parts.length === 1) {
    const mm = parts[0];
    return mm * 60;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function getEpisodeSponsorAvailability_(episode) {
  const ss = openSpreadsheet_();
  ensureSheets_(ss);

  const sheet = ss.getSheetByName(SHEETS.PEDIDOS);
  const values = sheet.getDataRange().getValues();

  let used = 0;

  for (let i = 1; i < values.length; i++) {
    const modality = String(values[i][7] || '');
    const ep = String(values[i][15] || '');
    const status = String(values[i][13] || '').toUpperCase();

    const activeStatuses = [
      'SOLICITADO',
      'EM ANÁLISE',
      'AGUARDANDO PAGAMENTO',
      'PAGAMENTO RECEBIDO',
      'MATERIAL PENDENTE',
      'MATERIAL RECEBIDO',
      'EM PRODUÇÃO',
      'PROGRAMADO',
      'PUBLICADO'
    ];

    if (
      modality === 'Empresa Patrocinadora do Episódio' &&
      ep === episode &&
      activeStatuses.includes(status)
    ) {
      used += Number(values[i][11] || 1);
    }
  }

  return Math.max(0, CONFIG.maxEpisodeSponsors - used);
}

function makeDooxCode_(episode, sheet) {
  const year = Utilities.formatDate(new Date(), CONFIG.timezone, 'yy');
  const ep = String(episode || 'EP08').toUpperCase().replace(/\s+/g, '');
  const values = sheet.getDataRange().getValues();

  let max = 0;

  for (let i = 1; i < values.length; i++) {
    const code = String(values[i][1] || '');
    const match = code.match(/-(\d{4})$/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }

  const next = String(max + 1).padStart(4, '0');
  return `DOOX-${year}-${ep}-${next}`;
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId);
}

function ensureSheets_(ss) {
  const headers = {
    [SHEETS.PEDIDOS]: [
      'Data/Hora','Código DOOX','Nome','Empresa','E-mail','WhatsApp','Tipo',
      'Modalidade','Momento Desejado','Faixa Comercial','Valor Unitário',
      'Quantidade','Valor Total','Status','Reserva/Vaga','Episódio',
      '@ / Perfil / Site','Observação','Termos Aceitos','Regras Aceitas',
      'Data de Registro','Observações Internas','Client Request ID'
    ],
    [SHEETS.CLIENTES]: ['Código DOOX','Nome','Empresa','E-mail','WhatsApp','Tipo','Perfil','Primeiro Registro','Último Registro'],
    [SHEETS.PAGAMENTOS]: ['Código DOOX','Cliente','Valor','Forma','Status','Data Cobrança','Data Pagamento','Comprovante','Conferido Por','Observação'],
    [SHEETS.MATERIAIS]: ['Código DOOX','Logo','Foto','Áudio','Texto','Status','Data Recebimento','Data Aprovação','Canal','Observação'],
    [SHEETS.EPISODIOS]: ['Episódio','Título','Data Prevista','Data Publicação','Status','URL','Observações'],
    [SHEETS.PROGRAMACAO]: ['Código DOOX','Episódio','Modalidade','Faixa Contratada','Minuto Efetivo','Duração','Bloco/Ordem','Status','Observação'],
    [SHEETS.VEICULACOES]: ['Código DOOX','Episódio','Data Publicação','URL','Minuto Efetivo','Duração','Evidência','Status','Comprovante'],
    [SHEETS.VAGAS]: ['Episódio','Modalidade','Capacidade','Reservadas','Disponíveis','Observação'],
    [SHEETS.COMPROVANTES]: ['Código DOOX','Tipo Documento','Arquivo/URL','Data Geração','Data Envio','Enviado Para','Status'],
    [SHEETS.DASHBOARD]: ['Indicador','Valor']
  };

  Object.keys(headers).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers[name].length).setValues([headers[name]]);
      sheet.setFrozenRows(1);
    } else {
      const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      const missing = headers[name].filter(h => !existing.includes(h));
      if (missing.length) {
        sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      }
    }
  });
}

function jsonOrJsonp_(obj, callback) {
  const cb = String(callback || '').trim();
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$\\.]*$/.test(cb)) {
    return ContentService
      .createTextOutput(`${cb}(${JSON.stringify(obj)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(obj);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safe_(value) {
  return String(value == null ? '' : value).trim();
}
