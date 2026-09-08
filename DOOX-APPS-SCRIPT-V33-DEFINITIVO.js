/*****
 * DOOX / HOCCO — Apps Script — MVP OPERACIONAL
 *
 * OBJETIVO
 * - Usar a planilha EXISTENTE.
 * - Manter o contrato do Web App usado pelo site V20.
 * - Operar com apenas 2 abas visíveis: PEDIDO e PAGAMENTO.
 * - Receber pedidos do site via doPost().
 * - Guardar Observações corretamente.
 * - Calcular preço no servidor.
 * - Gerar Código DOOX.
 * - Controlar pedidos, pagamentos, episódios e veiculações; clientes são dados do próprio pedido, sem cadastro permanente.
 * - Permitir arquivamento mensal antes do reset.
 *
 * IMPORTANTE
 * - O SPREADSHEET_ID abaixo é o da planilha operacional existente.
 * - Não execute resetarEstruturaAntiga() mais de uma vez na mesma migração.
 *****/

const CONFIG = {
  // PLANILHA EXISTENTE
  SPREADSHEET_ID: '1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB',

  // PASTA PARA ARQUIVOS MENSAIS / BACKUP
  // Deixe vazio para o sistema criar uma pasta automaticamente.
  ARCHIVE_FOLDER_ID: '',
  ARCHIVE_FOLDER_NAME: 'DOOX — HOCCO — ARQUIVOS',

  TIMEZONE: Session.getScriptTimeZone() || 'America/Sao_Paulo',

  // Limite padrão
  MAX_QTY_DEFAULT: 50,

  // MODALIDADES + PREÇOS — FONTE ÚNICA DE VERDADE
  MODALIDADES: {

    'Presença no Rodapé': {
      min: 1, max: 50, pricing: { flat: 49.90 }
    },

    'Sponsor Overlay': {
      min: 1, max: 10, pricing: {
        ranges: [
          { moment: '00:30–02:00', unit: 39.90, label: '00:30–02:00 · R$ 39,90' },
          { moment: '02:00–04:00', unit: 49.90, label: '02:00–04:00 · R$ 49,90' },
          { moment: '04:00–06:30', unit: 59.90, label: '04:00–06:30 · R$ 59,90' },
          { moment: '06:30–09:00', unit: 69.90, label: '06:30–09:00 · R$ 69,90' },
          { moment: '09:00–11:00', unit: 79.90, label: '09:00–11:00 · R$ 79,90' }
        ]
      }
    },

    'Overlay + Áudio': {
      min: 1, max: 10, pricing: {
        ranges: [
          { moment: '00:30–02:00', unit: 49.90, label: '00:30–02:00 · R$ 49,90' },
          { moment: '02:00–04:00', unit: 59.90, label: '02:00–04:00 · R$ 59,90' },
          { moment: '04:00–06:30', unit: 69.90, label: '04:00–06:30 · R$ 69,90' },
          { moment: '06:30–09:00', unit: 79.90, label: '06:30–09:00 · R$ 79,90' },
          { moment: '09:00–11:00', unit: 89.90, label: '09:00–11:00 · R$ 89,90' }
        ]
      }
    },

    'Apoiador Individual': {
      min: 1, max: 50, pricing: { flat: 9.90 }
    },

    'Empresa Patrocinadora do Episódio': {
      min: 1, max: 1, pricing: { flat: 89.90 }
    }
  },

  // PIX — chave aleatória informada pelo responsável da operação.
  PIX_KEY: 'c9316176-6f92-413e-9209-63ae6f661ba9',
  PIX_MERCHANT_NAME: 'DOOX STUDIOS',
  PIX_MERCHANT_CITY: 'LENCOIS PAULISTA',
  PIX_TXID: '***',

  // Instruções comerciais por modalidade — fonte única para WhatsApp e portal.
  CLIENT_INSTRUCTIONS: {
    'Presença no Rodapé': {
      title: 'Materiais para Presença no Rodapé',
      items: ['Logo da empresa em boa qualidade', 'Nome fantasia da empresa', 'Rede social que deseja destacar (ex.: @empresa)', 'Segmento da empresa']
    },
    'Sponsor Overlay': {
      title: 'Materiais para Sponsor Overlay',
      items: ['Logo da empresa em boa qualidade', 'Nome da empresa', 'Rede social que deseja destacar', 'Texto curto da mensagem ou chamada', 'Imagem ou material visual que deseja utilizar', 'Observações importantes para a produção']
    },
    'Overlay + Áudio': {
      title: 'Materiais para Overlay + Áudio',
      items: ['Logo da empresa em boa qualidade', 'Nome da empresa', 'Rede social que deseja destacar', 'Texto curto da mensagem ou chamada', 'Imagem ou material visual', 'Áudio ou roteiro curto para a locução', 'Observações importantes para a produção']
    },
    'Empresa Patrocinadora do Episódio': {
      title: 'Materiais para Patrocínio do Episódio',
      items: ['Logo da empresa em boa qualidade', 'Nome fantasia da empresa', 'Rede social que deseja destacar', 'Texto institucional curto', 'Imagem ou material visual da empresa']
    },
    'Apoiador Individual': {
      title: 'Dados para Apoiador Individual',
      items: ['Nome que deseja utilizar na identificação', 'Rede social, se desejar divulgá-la']
    }
  }
};

/*************************************************
 * ESTRUTURA DAS ABAS
 *************************************************/

const SHEETS = {
  PEDIDOS: {
    name: 'PEDIDO',
    headers: [
      'Código DOOX','Data/Hora','Nome / Empresa','Tipo','WhatsApp','E-mail','@ / Perfil / Site',
      'Modalidade','Episódio','Momento desejado','Faixa comercial','Valor unitário','Quantidade','Valor total',
      'Status','Termos','Regras','Observações','Observação Cliente','Criado em','Atualizado em','Reserva',
      'Client Request ID','Token de Acompanhamento','Última Notificação'
    ]
  },
  PAGAMENTOS: {
    name: 'PAGAMENTO',
    headers: [
      'Código DOOX','Data/Hora','Nome / Empresa','Valor devido','Forma de pagamento','Status pagamento',
      'Data pagamento','Status do Pedido','Observação','Atualizado em'
    ]
  },
  EPISODIOS: {
    name: '_EPISÓDIOS',
    headers: [
      'Código Episódio','Número','Data prevista','Status',
      'Capacidade Rodapé','Ocupado Rodapé','Vagas Rodapé',
      'Capacidade Sponsor Overlay','Ocupado Sponsor Overlay','Vagas Sponsor Overlay',
      'Capacidade Overlay + Áudio','Ocupado Overlay + Áudio','Vagas Overlay + Áudio',
      'Capacidade Apoiador Individual','Ocupado Apoiador Individual','Vagas Apoiador Individual',
      'Capacidade Empresa Patrocinadora','Ocupado Empresa Patrocinadora','Vagas Empresa Patrocinadora',
      'Observação','Atualizado em'
    ]
  },
  LOG: {
    name: '_LOG',
    headers: ['Data/Hora','Código DOOX','Ação','Status anterior','Status novo','Observação','Operador']
  },
  VEICULACOES: {
    name: '_VEICULAÇÕES',
    headers: ['Código DOOX','Episódio','Nome / Empresa','Modalidade','Momento efetivo','Status','Data publicação','Observação','Atualizado em']
  }
};

/*************************************************
 * WEB APP
 * CONTRATO COMPATÍVEL COM O SITE V20
 *************************************************/


function getClientInstructions_(modality) {
  const key = String(modality || '').trim();
  const cfg = CONFIG.CLIENT_INSTRUCTIONS[key] || { title: 'Materiais necessários', items: ['A DOOX informará os materiais necessários conforme a análise do pedido.'] };
  return { title: cfg.title, items: cfg.items.slice() };
}

function getSimulationSpec_(modality, moment) {
  const m = String(modality || '').trim();
  const k = String(moment || '').trim();
  const ranges = {
    '00:30–02:00': { label: 'Primeira faixa · menor atenção', unit: 39.90, audioUnit: 49.90 },
    '02:00–04:00': { label: 'Segunda faixa · atenção normal', unit: 49.90, audioUnit: 59.90 },
    '04:00–06:30': { label: 'Terceira faixa · maior interesse', unit: 59.90, audioUnit: 69.90 },
    '06:30–09:00': { label: 'Quarta faixa · alta atenção', unit: 69.90, audioUnit: 79.90 },
    '09:00–11:00': { label: 'Quinta faixa · atenção excepcional', unit: 79.90, audioUnit: 89.90 }
  };
  if (m === 'Presença no Rodapé') return { mode: 'footer', title: 'PRESENÇA NO RODAPÉ', where: 'Durante o episódio', duration: '≈ 5 segundos', range: 'Bloco coletivo', unitPrice: 49.90, exactMinute: false, copy: 'Até 10 empresas podem aparecer juntas no mesmo bloco; a DOOX organiza a composição conforme a edição.' };
  if (m === 'Sponsor Overlay') {
    const r = ranges[k] || ranges['00:30–02:00'];
    return { mode: 'overlay', title: 'SPONSOR OVERLAY', where: 'Durante o episódio', duration: '≈ 5 segundos', range: k || '00:30–02:00', rangeLabel: r.label, unitPrice: r.unit, exactMinute: false, copy: 'A faixa representa um intervalo comercial. O minuto exato dentro dela é definido pela produção.' };
  }
  if (m === 'Overlay + Áudio') {
    const r = ranges[k] || ranges['00:30–02:00'];
    return { mode: 'audio', title: 'OVERLAY + ÁUDIO', where: 'Durante o episódio', duration: '≈ 5 segundos', range: k || '00:30–02:00', rangeLabel: r.label, unitPrice: r.audioUnit, exactMinute: false, copy: 'A faixa representa um intervalo comercial. O momento exato e a presença do áudio dependem da edição.' };
  }
  if (m === 'Apoiador Individual') return { mode: 'individual', title: 'APOIADOR INDIVIDUAL', where: 'Créditos', duration: 'Apresentação de créditos', range: 'Após a história', unitPrice: 9.90, exactMinute: false, copy: 'A ordem e a posição da identificação podem variar dentro da rotação de créditos.' };
  if (m === 'Empresa Patrocinadora do Episódio') return { mode: 'sponsor', title: 'EMPRESA PATROCINADORA DO EPISÓDIO', where: 'Pós-créditos', duration: 'Apresentação institucional', range: 'Pós-créditos', unitPrice: 89.90, exactMinute: false, copy: 'Apresentação institucional demonstrativa; posição e composição são definidas pela produção.' };
  return { mode: '', title: m, where: '', duration: '', range: '', unitPrice: 0, exactMinute: false, copy: '' };
}

function migrateOperationalSheetNames_(ss) {
  const aliases = [
    ['PEDIDOS', SHEETS.PEDIDOS.name],
    ['PAGAMENTOS', SHEETS.PAGAMENTOS.name],
    ['EPISÓDIOS', SHEETS.EPISODIOS.name],
    ['VEICULAÇÕES', SHEETS.VEICULACOES.name],
    ['LOG', SHEETS.LOG.name]
  ];
  aliases.forEach(function(pair) {
    const oldSheet = ss.getSheetByName(pair[0]);
    const newSheet = ss.getSheetByName(pair[1]);
    if (oldSheet && !newSheet) oldSheet.setName(pair[1]);
  });

  const legacy = ss.getSheetByName('CLIENTE') || ss.getSheetByName('CLIENTES');
  if (legacy && !ss.getSheetByName('_CLIENTE_LEGADO')) {
    try { legacy.setName('_CLIENTE_LEGADO'); } catch (_) {}
  } else if (legacy) {
    try { legacy.hideSheet(); } catch (_) {}
  }
}

function ensureEditTrigger_(ss) {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(t => t.getHandlerFunction() === 'DOOX_onEdit' && t.getEventType() === ScriptApp.EventType.ON_EDIT);
  if (!exists) {
    ScriptApp.newTrigger('DOOX_onEdit').forSpreadsheet(ss).onEdit().create();
  }
}

function showOnlyOperationalSheets_(ss) {
  const visible = [SHEETS.PAGAMENTOS.name];
  ss.getSheets().forEach(sheet => {
    try {
      if (visible.indexOf(sheet.getName()) >= 0) sheet.showSheet();
      else sheet.hideSheet();
    } catch (_) {}
  });
}

function applyStatusValidationToRow_(sheet, row, headerName) {
  const map = headerMap_(sheet);
  const col = map[headerName];
  if (!col || row < 2) return;
  const current = String(sheet.getRange(row, col).getValue() || '').trim().toUpperCase();
  const options = allowedNextStatuses_(current).slice();
  if (current && options.indexOf(current) === -1) options.unshift(current);
  if (!options.length) {
    // Mesmo em status terminal, mantemos a validação visível para não
    // transformar a célula em um campo comum após o primeiro uso.
    if (current) options.push(current);
    else return;
  }
  sheet.getRange(row, col).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true).setAllowInvalid(false).build());
}

function ensureStatusValidation_(sheet) {
  const map = headerMap_(sheet);
  const statusCol = map['Status'];
  if (!statusCol) return;
  const lastRow = Math.max(2, sheet.getLastRow());
  const allStatuses = [
    'SOLICITADO','EM ANÁLISE','AGUARDANDO PAGAMENTO','PAGAMENTO RECEBIDO',
    'MATERIAL PENDENTE','MATERIAL RECEBIDO','EM PRODUÇÃO','PROGRAMADO',
    'PUBLICADO','FINALIZADO','REJEITADO','CANCELADO','ARQUIVADO'
  ];
  sheet.getRange(2, statusCol, lastRow - 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(allStatuses, true)
      .setAllowInvalid(false)
      .build());
  sheet.getRange(1, statusCol).setBackground('#ff6900').setFontColor('#ffffff').setFontWeight('bold');
}

function ensurePaymentValidations_(sheet) {
  const map = headerMap_(sheet);
  const pedidoCol = map['Status do Pedido'];
  const payCol = map['Status pagamento'];
  const lastRow = Math.max(2, sheet.getLastRow());
  const orderStatuses = [
    'SOLICITADO','EM ANÁLISE','AGUARDANDO PAGAMENTO','PAGAMENTO RECEBIDO',
    'MATERIAL PENDENTE','MATERIAL RECEBIDO','EM PRODUÇÃO','PROGRAMADO',
    'PUBLICADO','FINALIZADO','REJEITADO','CANCELADO','ARQUIVADO'
  ];
  if (pedidoCol) {
    sheet.getRange(2, pedidoCol, lastRow - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(orderStatuses, true)
        .setAllowInvalid(false)
        .build());
    sheet.getRange(1, pedidoCol).setBackground('#ff6900').setFontColor('#ffffff').setFontWeight('bold');
  }
  if (payCol) {
    const paymentStatuses = ['AGUARDANDO PAGAMENTO','PAGAMENTO RECEBIDO'];
    sheet.getRange(2, payCol, lastRow - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(paymentStatuses, true)
        .setAllowInvalid(false)
        .build());
    sheet.getRange(1, payCol).setBackground('#ff6900').setFontColor('#ffffff').setFontWeight('bold');
  }
}

function DOOX_onEdit(e) {
  try {
    if (!e || !e.range || e.range.getRow() < 2 || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (name !== SHEETS.PEDIDOS.name && name !== SHEETS.PAGAMENTOS.name) return;
    const map = headerMap_(sheet);
    const col = e.range.getColumn();

    if (name === SHEETS.PEDIDOS.name && col === map['Status']) {
      const code = String(sheet.getRange(e.range.getRow(), map['Código DOOX']).getValue() || '').trim();
      const requested = String(e.range.getValue() || '').trim().toUpperCase();
      const old = String(e.oldValue || '').trim().toUpperCase();
      if (!code || !requested) return;
      if (requested === 'REJEITADO') {
        const reason = String(sheet.getRange(e.range.getRow(), map['Observação Cliente']).getValue() || '').trim();
        if (!reason) { e.range.setValue(old); SpreadsheetApp.getActive().toast('Informe primeiro o motivo em Observação Cliente.', 'DOOX', 5); return; }
      }
      try {
        if (requested === 'PAGAMENTO RECEBIDO') {
          confirmarPagamento(code, 'PIX', 'Pagamento conferido e confirmado pela DOOX.');
        } else {
          atualizarStatusPedido_(getSpreadsheet_(), code, requested, { action: 'ALTERAÇÃO PELO STATUS', observation: requested === 'REJEITADO' ? String(sheet.getRange(e.range.getRow(), map['Observação Cliente']).getValue() || '').trim() : '', operator: 'OPERADOR' });
        }
        sincronizarPagamentoComPedido_(getSpreadsheet_(), code);
        refreshStatusDropdowns_(getSpreadsheet_(), code);
        SpreadsheetApp.getActive().toast('Status atualizado: ' + requested, 'DOOX', 3);
      } catch (err) {
        e.range.setValue(old);
        SpreadsheetApp.getActive().toast(err.message || String(err), 'DOOX — atenção', 6);
      }
      return;
    }

    if (name === SHEETS.PAGAMENTOS.name && col === map['Status do Pedido']) {
      const code = String(sheet.getRange(e.range.getRow(), map['Código DOOX']).getValue() || '').trim();
      const requested = String(e.range.getValue() || '').trim().toUpperCase();
      const old = String(e.oldValue || '').trim().toUpperCase();
      if (!code || !requested) return;
      try {
        const pedido = findPedidoByCode_(getSpreadsheet_(), code);
        if (!pedido) throw new Error('Pedido não encontrado: ' + code);
        if (requested === 'REJEITADO') {
          const reason = String(sheet.getRange(e.range.getRow(), map['Observação']).getValue() || '').trim();
          if (!reason) throw new Error('Informe o motivo na coluna Observação antes de recusar.');
          atualizarStatusPedido_(getSpreadsheet_(), code, requested, { action: 'ALTERAÇÃO PELO PAGAMENTO', observation: reason, operator: 'OPERADOR' });
        } else if (requested === 'PAGAMENTO RECEBIDO') {
          confirmarPagamento(code, 'PIX', 'Pagamento conferido e confirmado pela DOOX.');
        } else {
          atualizarStatusPedido_(getSpreadsheet_(), code, requested, { action: 'ALTERAÇÃO PELO PAGAMENTO', operator: 'OPERADOR' });
        }
        refreshStatusDropdowns_(getSpreadsheet_(), code);
        SpreadsheetApp.getActive().toast('Status do pedido atualizado: ' + requested, 'DOOX', 3);
      } catch (err) {
        e.range.setValue(old);
        SpreadsheetApp.getActive().toast(err.message || String(err), 'DOOX — atenção', 6);
      }
      return;
    }

    if (name === SHEETS.PAGAMENTOS.name && col === map['Status pagamento']) {
      const code = String(sheet.getRange(e.range.getRow(), map['Código DOOX']).getValue() || '').trim();
      const requested = String(e.range.getValue() || '').trim().toUpperCase();
      if (!code || !requested) return;
      try {
        if (requested === 'PAGAMENTO RECEBIDO') confirmarPagamento(code, 'PIX', 'Pagamento conferido e confirmado pela DOOX.');
        else atualizarPagamento(code, requested, '', 'Status financeiro atualizado pelo operador.');
        SpreadsheetApp.getActive().toast('Pagamento atualizado: ' + requested, 'DOOX', 3);
      } catch (err) {
        SpreadsheetApp.getActive().toast(err.message || String(err), 'DOOX — atenção', 6);
      }
    }
  } catch (_) {}
}

function refreshStatusDropdowns_(ss, code) {
  const pedido = findPedidoByCode_(ss, code);
  if (!pedido) return;
  const validation = function(current) {
    const cur = String(current || '').trim().toUpperCase();
    if (!cur) return null;
    const opts = allowedNextStatuses_(cur).slice();
    if (opts.indexOf(cur) === -1) opts.unshift(cur);
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(opts, true)
      .setAllowInvalid(false)
      .build();
  };

  const ps = getSheet_(ss, SHEETS.PEDIDOS.name);
  const pm = headerMap_(ps);
  if (pm['Status']) {
    const rule = validation(pedido.status);
    if (rule) ps.getRange(pedido.row, pm['Status']).setDataValidation(rule);
  }

  const pay = getPaymentRecord_(ss, code);
  if (pay) {
    const sh = getSheet_(ss, SHEETS.PAGAMENTOS.name);
    const m = headerMap_(sh);
    if (m['Status do Pedido']) {
      const rule = validation(pedido.status);
      if (rule) sh.getRange(pay.row, m['Status do Pedido']).setDataValidation(rule);
      sh.getRange(pay.row, m['Status do Pedido']).setValue(pedido.status);
    }
    if (m['Status pagamento']) {
      const payCurrent = String(sh.getRange(pay.row, m['Status pagamento']).getValue() || '').trim().toUpperCase();
      const payOpts = ['AGUARDANDO PAGAMENTO','PAGAMENTO INFORMADO','PAGAMENTO RECEBIDO'];
      if (payOpts.indexOf(payCurrent) === -1) payOpts.unshift(payCurrent);
      sh.getRange(pay.row, m['Status pagamento']).setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(payOpts.filter(Boolean), true)
        .setAllowInvalid(false).build());
    }
  }
}

function sincronizarPagamentoComPedido_(ss, code) {
  const pedido = findPedidoByCode_(ss, code);
  const pay = getPaymentRecord_(ss, code);
  if (!pedido || !pay) return;
  const sh = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const m = headerMap_(sh);
  if (m['Status do Pedido']) sh.getRange(pay.row, m['Status do Pedido']).setValue(pedido.status);
  sh.getRange(pay.row, m['Atualizado em']).setValue(new Date());
}

function executarAcaoPedido_(codigo, acao, observacao) {
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  const action = String(acao || '').trim().toUpperCase();
  if (!codigo || !action) return { ok: true, ignored: true };
  if (action === 'ANALISAR') return atualizarStatusPedido_(ss, codigo, 'EM ANÁLISE', { action: 'ANALISAR' });
  if (action === 'APROVAR') return atualizarStatusPedido_(ss, codigo, 'AGUARDANDO PAGAMENTO', { action: 'APROVAR' });
  if (action === 'CONFIRMAR PAGAMENTO') return confirmarPagamento(codigo, 'PIX', observacao || 'Pagamento conferido e confirmado pela DOOX.');
  if (action === 'AGUARDAR MATERIAL') return atualizarStatusPedido_(ss, codigo, 'MATERIAL PENDENTE', { action: 'AGUARDAR MATERIAL' });
  if (action === 'RECEBER MATERIAL') return atualizarStatusPedido_(ss, codigo, 'MATERIAL RECEBIDO', { action: 'RECEBER MATERIAL' });
  if (action === 'APROVAR MATERIAL') return atualizarStatusPedido_(ss, codigo, 'EM PRODUÇÃO', { action: 'APROVAR MATERIAL' });
  if (action === 'PROGRAMAR') return atualizarStatusPedido_(ss, codigo, 'PROGRAMADO', { action: 'PROGRAMAR' });
  if (action === 'PUBLICAR') return atualizarStatusPedido_(ss, codigo, 'PUBLICADO', { action: 'PUBLICAR' });
  if (action === 'FINALIZAR') return atualizarStatusPedido_(ss, codigo, 'FINALIZADO', { action: 'FINALIZAR' });
  if (action === 'CANCELAR') return atualizarStatusPedido_(ss, codigo, 'CANCELADO', { action: 'CANCELAR', observation: observacao || 'Pedido cancelado pela DOOX.' });
  if (action === 'ARQUIVAR') return atualizarStatusPedido_(ss, codigo, 'ARQUIVADO', { action: 'ARQUIVAR' });
  if (action === 'RECUSAR PARTICIPAÇÃO') return recusarParticipacao(codigo, observacao);
  throw new Error('Ação não reconhecida: ' + action);
}

function recusarParticipacao(codigo, motivo) {
  const reason = String(motivo || '').trim();
  if (!reason) throw new Error('Informe o motivo da recusa na coluna "Observação Cliente" antes de escolher RECUSAR PARTICIPAÇÃO.');
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  const result = atualizarStatusPedido_(ss, codigo, 'REJEITADO', { action: 'RECUSAR PARTICIPAÇÃO', observation: reason, operator: 'OPERADOR' });
  const sheet = getSheet_(ss, SHEETS.PEDIDOS.name);
  const found = findRowByFirstColumn_(sheet, codigo);
  const map = headerMap_(sheet);
  sheet.getRange(found.row, map['Observação Cliente']).setValue(reason);
  return { ok: true, code: codigo, status: 'REJEITADO', statusLabel: 'Participação recusada', reason: reason };
}

function doGet(e) {

  try {

    const params = (e && e.parameter)
      ? e.parameter
      : {};

    const action = String(
      params.action || 'health'
    ).trim();


    if (action === 'health') {

      return json_({
        ok: true,
        service: 'DOOX HOCCO MVP',
        version: 'V33-DEFINITIVO',
        spreadsheet: CONFIG.SPREADSHEET_ID,
        timestamp: new Date().toISOString()
      });

    }


    if (action === 'testSpreadsheet') {

      const ss = getSpreadsheet_();

      return json_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: ss.getSheets().map(
          s => s.getName()
        )
      });

    }


    if (action === 'pedido') {

      const token = String(params.token || '').trim();

      if (!token) {
        throw new Error('Token de acompanhamento não informado.');
      }

      return json_(getPublicOrderStatus_(token));

    }


    if (action === 'contract') {

      return json_({
        ok: true,
        service: 'DOOX HOCCO MVP',

        acceptedPostActions: [
          'registerRequest',
          'testSpreadsheet',
          'informarPagamento',
          'confirmarPagamento',
          'atualizarStatus',
          'publicarObservacao'
        ],

        acceptedGetActions: [
          'health',
          'testSpreadsheet',
          'contract',
          'pedido'
        ],

        fields: [
          'clientRequestId',
          'name',
          'company',
          'type',
          'whatsapp',
          'email',
          'profile',
          'modality',
          'moment',
          'quantity',
          'observation',
          'termsAccepted',
          'rulesAccepted',
          'trackingToken'
        ]
      });

    }


    return json_({
      ok: true,
      message: 'DOOX Web App ativo.'
    });

  }

  catch (err) {

    return jsonError_(err);

  }
}


/*************************************************
 * POST
 *************************************************/

function doPost(e) {

  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const body = parsePostBody_(e);

    const action = String(
      body.action || 'registerRequest'
    ).trim();


    if (action === 'testSpreadsheet') {

      const ss = getSpreadsheet_();

      return json_({
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheets: ss.getSheets().map(
          s => s.getName()
        )
      });

    }


    if (action === 'informarPagamento') {
      return json_(informarPagamento_(body));
    }

    if (action === 'confirmarPagamento') {
      return json_(confirmarPagamento(body.code, body.formaPagamento || 'PIX', body.observacao || 'Pagamento conferido e confirmado pela DOOX.'));
    }

    if (action === 'atualizarStatus') {
      const ss = getSpreadsheet_();
      ensureOperationalStructure_(ss);
      return json_(atualizarStatusPedido_(ss, body.code, body.status, { action: body.actionLabel || 'ATUALIZAR STATUS', observation: body.observacao || '' }));
    }

    if (action === 'publicarObservacao') {
      return json_(publicarObservacaoCliente(body.code, body.observacao || ''));
    }

    if (action !== 'registerRequest') {
      throw new Error('Ação não reconhecida: ' + action);
    }


    return json_(
      registerRequest_(body)
    );

  }

  catch (err) {

    console.error(
      err && err.stack
        ? err.stack
        : err
    );

    return jsonError_(err);

  }

  finally {

    lock.releaseLock();

  }
}


/*************************************************
 * REGISTRO DE PEDIDO
 *************************************************/

function informarPagamento_(raw) {
  const token = String(raw.token || '').trim();
  if (!token) throw new Error('Token de acompanhamento não informado.');
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  const pedido = findPedidoByTrackingToken_(ss, token);
  if (!pedido) throw new Error('Pedido não encontrado ou token inválido.');
  const status = String(pedido.status || '').toUpperCase();
  const allowedStatuses = ['SOLICITADO', 'EM ANÁLISE', 'AGUARDANDO PAGAMENTO'];
  if (allowedStatuses.indexOf(status) === -1) {
    return { ok: true, code: pedido.code, status: status, message: 'O pagamento não está disponível nesta etapa.' };
  }
  const sheet = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const found = findRowByFirstColumn_(sheet, pedido.code);
  if (!found) throw new Error('Registro financeiro não encontrado.');
  const map = headerMap_(sheet);
  sheet.getRange(found.row, map['Status pagamento']).setValue('PAGAMENTO INFORMADO');
  sheet.getRange(found.row, map['Observação']).setValue('Cliente informou pagamento pelo portal. Aguardando conferência manual.');
  sheet.getRange(found.row, map['Atualizado em']).setValue(new Date());
  return { ok: true, code: pedido.code, status: 'AGUARDANDO PAGAMENTO', paymentReported: true, message: 'Pagamento informado. A DOOX fará a conferência.' };
}


function registerRequest_(raw) {

  const ss = getSpreadsheet_();

  // Garante estrutura mínima sem apagar nada.
  ensureOperationalStructure_(ss);


  const r = normalizeRequest_(raw);

  validateRequest_(r);


  // PREVENÇÃO DE DUPLICIDADE
  if (r.clientRequestId) {

    const existing =
      findPedidoByClientRequestId_(
        ss,
        r.clientRequestId
      );

    if (existing) {

      return {

        ok: true,

        duplicate: true,

        message:
          'Pedido já registrado anteriormente.',

        code: existing.code,
        trackingToken: existing.trackingToken,
        modality: existing.modality,
        quantity: existing.quantity,
        status: existing.status,
        total: existing.total,
        instructions: getClientInstructions_(existing.modality),
        order: existing

      };

    }
  }


  // PREÇO DEFINIDO PELO BACKEND
  const price =
    getPriceInfo_(
      r.modality,
      r.moment,
      r.quantity
    );


  // CÓDIGO DOOX
  const code =
    nextOrderCode_();


  const now =
    new Date();

  // Token privado e aleatório usado pelo portal do cliente.
  // O código DOOX continua sendo a identificação comercial;
  // o token funciona como chave de acesso ao acompanhamento.
  const trackingToken =
    createTrackingToken_();


  const pedidoSheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const map =
    headerMap_(
      pedidoSheet
    );


  const row =
    new Array(
      SHEETS.PEDIDOS.headers.length
    ).fill('');


  put_(
    row,
    map,
    'Código DOOX',
    code
  );

  put_(
    row,
    map,
    'Data/Hora',
    now
  );

  put_(
    row,
    map,
    'Nome / Empresa',
    r.nameOrCompany
  );

  put_(
    row,
    map,
    'Tipo',
    r.type
  );

  put_(
    row,
    map,
    'WhatsApp',
    r.whatsapp
  );

  put_(
    row,
    map,
    'E-mail',
    r.email
  );

  put_(
    row,
    map,
    '@ / Perfil / Site',
    r.profile
  );

  put_(
    row,
    map,
    'Modalidade',
    r.modality
  );

  // O episódio fica vazio até a reserva/análise.
  put_(
    row,
    map,
    'Episódio',
    ''
  );

  put_(
    row,
    map,
    'Momento desejado',
    r.moment
  );

  put_(
    row,
    map,
    'Faixa comercial',
    price.tierLabel
  );

  put_(
    row,
    map,
    'Valor unitário',
    price.unitPrice
  );

  put_(
    row,
    map,
    'Quantidade',
    r.quantity
  );

  put_(
    row,
    map,
    'Valor total',
    price.total
  );

  put_(
    row,
    map,
    'Status',
    'SOLICITADO'
  );

  put_(
    row,
    map,
    'Termos',
    r.termsAccepted
      ? 'ACEITO'
      : 'NÃO ACEITO'
  );

  put_(
    row,
    map,
    'Regras',
    r.rulesAccepted
      ? 'ACEITO'
      : 'NÃO ACEITO'
  );

  // CORREÇÃO IMPORTANTE:
  // o conteúdo digitado no site entra aqui.
  put_(
    row,
    map,
    'Observações',
    r.observation
  );

  put_(
    row,
    map,
    'Observação Cliente',
    ''
  );

  put_(
    row,
    map,
    'Criado em',
    now
  );

  put_(
    row,
    map,
    'Atualizado em',
    now
  );

  put_(
    row,
    map,
    'Reserva',
    'NÃO RESERVADO'
  );

  put_(
    row,
    map,
    'Client Request ID',
    r.clientRequestId
  );

  put_(
    row,
    map,
    'Token de Acompanhamento',
    trackingToken
  );

  put_(
    row,
    map,
    'Última Notificação',
    ''
  );


  pedidoSheet.appendRow(row);

  const newRow = pedidoSheet.getLastRow();
  applyStatusValidationToRow_(pedidoSheet, newRow, 'Status');

  /*************************************************
   * PAGAMENTO
   *
   * O pagamento permanece manual.
   * A planilha apenas controla o estado.
   *************************************************/

  const pagamentoSheet =
    getSheet_(
      ss,
      SHEETS.PAGAMENTOS.name
    );


  pagamentoSheet.appendRow([code, now, r.nameOrCompany, price.total, '', 'AGUARDANDO PAGAMENTO', '', 'SOLICITADO', '', now]);
  const newPaymentRow = pagamentoSheet.getLastRow();
  applyStatusValidationToRow_(pagamentoSheet, newPaymentRow, 'Status do Pedido');

  formatDataRows_(
    pedidoSheet
  );

  formatDataRows_(
    pagamentoSheet
  );


  return {

    ok: true,

    duplicate: false,

    message:
      'Solicitação registrada com sucesso.',

    code: code,


    modality: r.modality,

    tier: price.tierLabel,

    unitPrice: price.unitPrice,

    quantity: r.quantity,

    total: price.total,

    status: 'SOLICITADO',

    reservation:
      'NÃO RESERVADO',

    trackingToken:
      trackingToken,

    trackingAction:
      'pedido',

    observation:
      r.observation,

    instructions: getClientInstructions_(r.modality),
    simulation: getSimulationSpec_(r.modality, r.moment),
    payment: { available: true, path: '/?pagamento=' + encodeURIComponent(trackingToken) },
    tracking: { available: true, path: '/?acompanhamento=' + encodeURIComponent(trackingToken) },

    row: newRow

  };

}


/*************************************************
 * NORMALIZAÇÃO
 *************************************************/

function normalizeRequest_(raw) {

  const body =
    raw || {};


  const name =
    clean_(body.name);


  const company =
    clean_(body.company);


  const nameOrCompany =
    company || name;


  return {

    clientRequestId:
      clean_(
        body.clientRequestId ||
        body.client_request_id
      ),

    nameOrCompany:
      nameOrCompany,

    name:
      name,

    company:
      company,

    type:
      normalizeType_(
        body.type
      ),

    whatsapp:
      clean_(
        body.whatsapp ||
        body.phone
      ),

    email:
      clean_(
        body.email
      ),

    profile:
      clean_(
        body.profile ||
        body.handle
      ),

    modality:
      normalizeModality_(
        body.modality ||
        body.mode
      ),

    moment:
      clean_(
        body.moment
      ),

    quantity:
      toPositiveInt_(
        body.quantity ||
        body.qty
      ),

    observation:
      clean_(
        body.observation ||
        body.obs ||
        body.observacao
      ),

    termsAccepted:
      toBool_(
        body.termsAccepted !== undefined
          ? body.termsAccepted
          : body.terms
      ),

    rulesAccepted:
      toBool_(
        body.rulesAccepted !== undefined
          ? body.rulesAccepted
          : body.rules
      )

  };

}


/*************************************************
 * VALIDAÇÃO
 *************************************************/

function validateRequest_(r) {

  const required = [

    [
      'Nome / Empresa',
      r.nameOrCompany
    ],

    [
      'Tipo',
      r.type
    ],

    [
      'WhatsApp',
      r.whatsapp
    ],

    [
      'Modalidade',
      r.modality
    ],

    [
      'Momento desejado',
      r.moment
    ]

  ];


  required.forEach(
    ([label, value]) => {

      if (!value) {

        throw new Error(
          'Campo obrigatório ausente: ' +
          label
        );

      }

    }
  );


  if (!r.quantity) {

    throw new Error(
      'Quantidade inválida. Informe uma quantidade maior que zero.'
    );

  }


  if (!r.termsAccepted) {

    throw new Error(
      'Os Termos precisam ser aceitos.'
    );

  }


  if (!r.rulesAccepted) {

    throw new Error(
      'As Regras precisam ser aceitas.'
    );

  }


  const cfg =
    CONFIG.MODALIDADES[
      r.modality
    ];


  if (!cfg) {

    throw new Error(
      'Modalidade inválida: ' +
      r.modality
    );

  }


  if (
    r.quantity < cfg.min ||
    r.quantity > cfg.max
  ) {
    throw new Error(
      'Quantidade inválida para "' + r.modality +
      '". Limite: ' + cfg.min + ' a ' + cfg.max + '.'
    );
  }

  if (cfg.pricing && cfg.pricing.ranges) {
    const valid = cfg.pricing.ranges.some(x => x.moment === r.moment);
    if (!valid) {
      throw new Error('Faixa/momento inválido para ' + r.modality + '.');
    }
  }

}


/*************************************************
 * PREÇOS
 *************************************************/

function getPriceInfo_(modality, moment, quantity) {
  const cfg = CONFIG.MODALIDADES[modality];
  if (!cfg) throw new Error('Modalidade sem tabela de preço: ' + modality);

  let unitPrice = null;
  let tierLabel = 'Única';
  let normalizedMoment = String(moment || '').trim();

  if (cfg.pricing.flat !== undefined) {
    unitPrice = Number(cfg.pricing.flat);
  } else if (cfg.pricing.ranges) {
    const range = cfg.pricing.ranges.find(x => x.moment === normalizedMoment);
    if (!range) throw new Error('Momento/faixa não encontrado para ' + modality + '.');
    unitPrice = Number(range.unit);
    tierLabel = range.label;
  } else {
    throw new Error('Configuração de preço inválida para ' + modality + '.');
  }

  return {
    unitPrice: unitPrice,
    quantity: quantity,
    total: round2_(unitPrice * quantity),
    tierLabel: tierLabel,
    moment: normalizedMoment
  };
}

function normalizePixText_(value, maxLen) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, '')
    .trim().substring(0, maxLen);
}

function crc16Ccitt_(text) {
  let crc = 0xFFFF;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function pixField_(id, value) {
  const v = String(value || '');
  return id + String(v.length).padStart(2, '0') + v;
}

function buildPixPayload_(amount, code) {
  const merchantName = normalizePixText_(CONFIG.PIX_MERCHANT_NAME, 25);
  const merchantCity = normalizePixText_(CONFIG.PIX_MERCHANT_CITY, 15);
  const key = String(CONFIG.PIX_KEY || '').trim();
  const txid = String(CONFIG.PIX_TXID || '***').trim().substring(0, 25);
  const amt = Number(amount).toFixed(2);
  const accountInfo = pixField_('00', 'BR.GOV.BCB.PIX') + pixField_('01', key);
  const payloadNoCrc =
    pixField_('00', '01') +
    pixField_('26', accountInfo) +
    pixField_('52', '0000') +
    pixField_('53', '986') +
    pixField_('54', amt) +
    pixField_('58', 'BR') +
    pixField_('59', merchantName) +
    pixField_('60', merchantCity) +
    pixField_('62', pixField_('05', txid)) +
    '6304';
  return payloadNoCrc + crc16Ccitt_(payloadNoCrc);
}

function getPaymentRecord_(ss, code) {
  const sheet = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const vals = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0] || '').trim() === String(code || '').trim()) {
      return { row: i + 2, status: String(vals[i][5] || ''), updatedAt: vals[i][9] || '' };
    }
  }
  return null;
}

function buildPublicPayment_(ss, pedido) {
  const status = String(pedido.status || '').toUpperCase();
  const payment = getPaymentRecord_(ss, pedido.code);
  const paymentAvailableStatuses = ['SOLICITADO', 'EM ANÁLISE', 'AGUARDANDO PAGAMENTO'];
  const result = {
    available: paymentAvailableStatuses.indexOf(status) !== -1,
    status: payment ? payment.status : '',
    amount: null,
    amountLabel: '',
    pixKey: CONFIG.PIX_KEY,
    pixPayload: '',
    orderCode: pedido.code
  };
  if (!result.available) return result;

  const sheet = getSheet_(ss, SHEETS.PEDIDOS.name);
  const map = headerMap_(sheet);
  const row = sheet.getRange(pedido.row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const total = Number(row[map['Valor total'] - 1] || 0);
  result.amount = round2_(total);
  result.amountLabel = 'R$ ' + result.amount.toFixed(2).replace('.', ',');
  result.pixPayload = buildPixPayload_(result.amount, pedido.code);
  return result;
}



/*************************************************
 * PAGAMENTOS
 *************************************************/

function atualizarPagamento(codigo, status, formaPagamento, observacao) {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const found = findRowByFirstColumn_(sheet, codigo);
  if (!found) throw new Error('Pagamento não encontrado para o código: ' + codigo);
  const map = headerMap_(sheet);
  const oldStatus = String(found.values[map['Status pagamento'] - 1] || '').trim().toUpperCase();
  let normalizedStatus = String(status || '').trim().toUpperCase();
  if (normalizedStatus === 'PAGO') normalizedStatus = 'PAGAMENTO RECEBIDO';
  if (!normalizedStatus) normalizedStatus = 'AGUARDANDO PAGAMENTO';
  sheet.getRange(found.row, map['Forma de pagamento']).setValue(formaPagamento || '');
  sheet.getRange(found.row, map['Status pagamento']).setValue(normalizedStatus);
  if (observacao !== undefined) sheet.getRange(found.row, map['Observação']).setValue(observacao || '');
  const now = new Date();
  sheet.getRange(found.row, map['Atualizado em']).setValue(now);
  if (normalizedStatus === 'PAGAMENTO RECEBIDO') {
    sheet.getRange(found.row, map['Data pagamento']).setValue(now);
  }
  logAction_(ss, codigo, 'ATUALIZAR PAGAMENTO', oldStatus, normalizedStatus, observacao || '', 'OPERADOR');
  return { ok: true, code: codigo, paymentStatus: normalizedStatus };
}

function confirmarPagamento(codigo, formaPagamento, observacao) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const pedido = findPedidoByCode_(ss, codigo);
    if (!pedido) throw new Error('Pedido não encontrado: ' + codigo);
    const statusAtual = String(pedido.status || '').toUpperCase();
    const allowedOrderStatuses = ['SOLICITADO','EM ANÁLISE','AGUARDANDO PAGAMENTO'];
    if (allowedOrderStatuses.indexOf(statusAtual) === -1) {
      throw new Error('Não é possível confirmar pagamento nesta etapa. Status atual: ' + statusAtual);
    }
    const payResult = atualizarPagamento(codigo, 'PAGAMENTO RECEBIDO', formaPagamento || 'PIX', observacao || 'Pagamento conferido e confirmado pela DOOX.');
    if (statusAtual === 'AGUARDANDO PAGAMENTO') {
      atualizarStatusPedido_(ss, codigo, 'PAGAMENTO RECEBIDO', { action: 'CONFIRMAR PAGAMENTO', observation: observacao || 'Pagamento confirmado no financeiro.' });
      sincronizarPagamentoComPedido_(ss, codigo);
    }
    refreshStatusDropdowns_(ss, codigo);
    return { ok: true, code: codigo, status: findPedidoByCode_(ss, codigo).status, paymentStatus: payResult.paymentStatus, message: 'Pagamento confirmado.' };
  } finally {
    lock.releaseLock();
  }
}

/*************************************************
 * STATUS DO PEDIDO
 *************************************************/

function allowedNextStatuses_(current) {
  const next = {
    'SOLICITADO': ['EM ANÁLISE', 'REJEITADO', 'CANCELADO'],
    'EM ANÁLISE': ['AGUARDANDO PAGAMENTO', 'REJEITADO', 'CANCELADO'],
    'AGUARDANDO PAGAMENTO': ['PAGAMENTO RECEBIDO', 'CANCELADO'],
    'PAGAMENTO RECEBIDO': ['MATERIAL PENDENTE', 'CANCELADO'],
    'MATERIAL PENDENTE': ['MATERIAL RECEBIDO', 'CANCELADO'],
    'MATERIAL RECEBIDO': ['EM PRODUÇÃO', 'MATERIAL PENDENTE', 'CANCELADO'],
    'EM PRODUÇÃO': ['PROGRAMADO', 'CANCELADO'],
    'PROGRAMADO': ['PUBLICADO', 'CANCELADO'],
    'PUBLICADO': ['FINALIZADO'],
    'FINALIZADO': ['ARQUIVADO'],
    'REJEITADO': ['ARQUIVADO'],
    'CANCELADO': ['ARQUIVADO'],
    'ARQUIVADO': []
  };
  return next[current] || [];
}

function atualizarStatusPedido_(ss, codigo, status, meta) {
  const sheet = getSheet_(ss, SHEETS.PEDIDOS.name);
  const found = findRowByFirstColumn_(sheet, codigo);
  if (!found) throw new Error('Pedido não encontrado: ' + codigo);

  const map = headerMap_(sheet);
  const current = String(found.values[map['Status'] - 1] || '').trim().toUpperCase();
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized) throw new Error('Status não informado.');
  if (current !== normalized && allowedNextStatuses_(current).indexOf(normalized) === -1) {
    throw new Error('Transição de status não permitida: ' + current + ' → ' + normalized);
  }

  const now = new Date();
  sheet.getRange(found.row, map['Status']).setValue(normalized);
  sheet.getRange(found.row, map['Atualizado em']).setValue(now);
  if (map['Última Notificação']) sheet.getRange(found.row, map['Última Notificação']).setValue(now);

  if (meta && meta.observation && map['Observações']) {
    sheet.getRange(found.row, map['Observações']).setValue(meta.observation);
  }
  if (normalized === 'REJEITADO' && meta && meta.observation && map['Observação Cliente']) {
    sheet.getRange(found.row, map['Observação Cliente']).setValue(meta.observation);
  }
  sincronizarPagamentoComPedido_(ss, codigo);
  logAction_(ss, codigo, (meta && meta.action) || 'ATUALIZAR STATUS', current, normalized, (meta && meta.observation) || '', (meta && meta.operator) || 'OPERADOR');
  refreshStatusDropdowns_(ss, codigo);

  return { ok: true, code: codigo, status: normalized, previousStatus: current, nextAction: nextActionForStatus_(normalized) };
}

function atualizarStatus(codigo, status) {
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  return atualizarStatusPedido_(ss, codigo, status, { action: 'ATUALIZAR STATUS' });
}

function nextActionForStatus_(status) {
  const map = {
    'SOLICITADO': 'ANALISAR',
    'EM ANÁLISE': 'APROVAR / REJEITAR',
    'AGUARDANDO PAGAMENTO': 'AGUARDAR PAGAMENTO',
    'PAGAMENTO RECEBIDO': 'RECEBER MATERIAL',
    'MATERIAL PENDENTE': 'RECEBER MATERIAL',
    'MATERIAL RECEBIDO': 'APROVAR MATERIAL',
    'EM PRODUÇÃO': 'PROGRAMAR',
    'PROGRAMADO': 'REGISTRAR VEICULAÇÃO',
    'PUBLICADO': 'FINALIZAR',
    'FINALIZADO': 'ARQUIVAR / REUTILIZAR VAGA',
    'REJEITADO': 'ARQUIVAR',
    'CANCELADO': 'ARQUIVAR',
    'ARQUIVADO': '—'
  };
  return map[status] || '—';
}

function publicarObservacaoCliente(codigo, observacao) {
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  const sheet = getSheet_(ss, SHEETS.PEDIDOS.name);
  const found = findRowByFirstColumn_(sheet, codigo);
  if (!found) throw new Error('Pedido não encontrado: ' + codigo);
  const map = headerMap_(sheet);
  const text = String(observacao || '').trim();
  sheet.getRange(found.row, map['Observação Cliente']).setValue(text);
  sheet.getRange(found.row, map['Atualizado em']).setValue(new Date());
  logAction_(ss, codigo, 'OBSERVAÇÃO PARA CLIENTE', String(found.values[map['Status'] - 1] || ''), String(found.values[map['Status'] - 1] || ''), text, 'OPERADOR');
  return { ok: true, code: codigo, observationClient: text };
}

function logAction_(ss, codigo, action, beforeStatus, afterStatus, observation, operator) {
  const sheet = getSheet_(ss, SHEETS.LOG.name);
  sheet.appendRow([new Date(), codigo || '', action || '', beforeStatus || '', afterStatus || '', observation || '', operator || 'OPERADOR']);
}

/*************************************************
 * VEICULAÇÃO
 *************************************************/

function registrarVeiculacao(
  codigo,
  episodio,
  momentoEfetivo,
  status,
  observacao
) {

  const ss =
    getSpreadsheet_();


  ensureOperationalStructure_(ss);


  const pedido =
    findPedidoByCode_(
      ss,
      codigo
    );


  if (!pedido) {

    throw new Error(
      'Pedido não encontrado: ' +
      codigo
    );

  }


  const sheet =
    getSheet_(
      ss,
      SHEETS.VEICULACOES.name
    );


  const now =
    new Date();


  sheet.appendRow([

    codigo,

    episodio ||
      pedido.episode ||
      '',

    pedido.nameOrCompany,

    pedido.modality,

    momentoEfetivo ||
      pedido.moment,

    status ||
      'PROGRAMADO',

    '',

    observacao ||
      '',

    now

  ]);


  atualizarStatusPedido_(
    ss,
    codigo,
    status === 'PUBLICADO'
      ? 'PUBLICADO'
      : 'PROGRAMADO'
  );


  if (
    status ===
    'PUBLICADO'
  ) {

    const map =
      headerMap_(
        sheet
      );


    const row =
      sheet.getLastRow();


    sheet
      .getRange(
        row,
        map['Data publicação']
      )
      .setValue(
        new Date()
      );

  }


  return {

    ok: true,

    code: codigo,

    status:
      status ||
      'PROGRAMADO'

  };

}


/*************************************************
 * SETUP MVP
 *
 * NÃO APAGA A ESTRUTURA ANTIGA.
 *************************************************/

function setupMVP() {

  const ss =
    getSpreadsheet_();


  const result =
    setupMVP_(
      ss
    );

  removerAbasNaoUtilizadas_(ss);


  return {

    ok: true,

    message:
      'DOOX MVP preparado com sucesso.',

    spreadsheet:
      ss.getName(),

    spreadsheetId:
      ss.getId(),

    sheets:
      result

  };

}



function removerAbasNaoUtilizadas_(ss) {
  // Limpeza definitiva solicitada: remove abas que não fazem parte da operação
  // nem do núcleo técnico necessário ao funcionamento. Isso é executado apenas
  // no setupMVP(), nunca durante pedidos/status/pagamentos.
  const keep = new Set([
    SHEETS.PAGAMENTOS.name,
    SHEETS.PEDIDOS.name,
    SHEETS.EPISODIOS.name,
    SHEETS.VEICULACOES.name,
    SHEETS.LOG.name
  ]);
  ss.getSheets().slice().forEach(function(sheet) {
    if (keep.has(sheet.getName())) return;
    if (ss.getSheets().length <= keep.size) return;
    try { ss.deleteSheet(sheet); } catch (_) {}
  });
}

function ensureOperationalStructure_(ss) {
  // Rotinas de produção NÃO devem executar o setup completo.
  // Apenas garantimos que as duas abas operacionais e as abas técnicas existam
  // e que os cabeçalhos estejam presentes. Isso evita travamentos por formatação,
  // filtros e validações repetidas a cada requisição/status/pagamento.
  migrateOperationalSheetNames_(ss);
  Object.keys(SHEETS).forEach(function(key) {
    const def = SHEETS[key];
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) sheet = ss.insertSheet(def.name);
    ensureHeaders_(sheet, def.headers);
  });
  return true;
}

function ensureOperationalStatusDropdowns_(ss) {
  const p = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const m = headerMap_(p);
  const last = p.getLastRow();
  if (last < 2 || !m['Status do Pedido']) return;
  const statusCol = m['Status do Pedido'];
  const rows = p.getRange(2, statusCol, last - 1, 1).getValues();
  for (let i = 0; i < rows.length; i++) {
    const current = String(rows[i][0] || '').trim().toUpperCase();
    if (!current) continue;
    const opts = allowedNextStatuses_(current).slice();
    if (opts.indexOf(current) === -1) opts.unshift(current);
    if (!opts.length) opts.push(current);
    p.getRange(i + 2, statusCol).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(opts, true).setAllowInvalid(false).build());
  }
}

function setupMVP_(
  ss
) {

  migrateOperationalSheetNames_(ss);

  const names =
    [];


  Object.keys(
    SHEETS
  ).forEach(
    key => {

      const def =
        SHEETS[key];


      let sheet =
        ss.getSheetByName(
          def.name
        );


      if (!sheet) {

        sheet =
          ss.insertSheet(
            def.name
          );

      }


      ensureHeaders_(
        sheet,
        def.headers
      );


      if (def.name === SHEETS.PEDIDOS.name || def.name === SHEETS.PAGAMENTOS.name) {
        formatSheet_(sheet, def.headers);
        if (def.name === SHEETS.PEDIDOS.name) ensureStatusValidation_(sheet);
        if (def.name === SHEETS.PAGAMENTOS.name) ensurePaymentValidations_(sheet);
      } else {
        if (sheet.getFrozenRows() < 1) { try { sheet.setFrozenRows(1); } catch (_) {} }
      }
      if (def.name.charAt(0) === '_') { try { sheet.hideSheet(); } catch (_) {} }

      names.push(
        def.name
      );

    }
  );


  showOnlyOperationalSheets_(ss);
  ensureEditTrigger_(ss);
  ensureOperationalStatusDropdowns_(ss);

  // Dados de episódio continuam internos e não aparecem como aba operacional.
  const episodeSheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  if (
    episodeSheet.getLastRow() < 2
  ) {

    createEpisode_(
      ss,
      new Date()
    );

  }


  return names;

}


function createEpisode_(ss, when) {
  const sheet = getSheet_(ss, SHEETS.EPISODIOS.name);
  const now = when instanceof Date ? when : new Date();
  const lastRow = sheet.getLastRow();
  let nextNumber = 1;
  if (lastRow >= 2) {
    const nums = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat()
      .map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0);
    if (nums.length) nextNumber = Math.max.apply(null, nums) + 1;
  }
  const code = 'EP' + String(nextNumber).padStart(2, '0');
  const row = [
    code, nextNumber, now, 'ABERTO',
    50, 0, 50,
    10, 0, 10,
    10, 0, 10,
    50, 0, 50,
    1, 0, 1,
    '', now
  ];
  sheet.appendRow(row);
  return { code: code, number: nextNumber, row: sheet.getLastRow(), status: 'ABERTO' };
}

/*************************************************
 * MIGRAÇÃO INICIAL
 *
 * ATENÇÃO:
 * - Faz backup de TODAS as abas existentes.
 * - Depois substitui a estrutura antiga.
 * - Execute uma única vez.
 *************************************************/

function resetarEstruturaAntiga() {

  const ss =
    getSpreadsheet_();


  const stamp =
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      'yyyyMMdd-HHmmss'
    );


  if (
    !ss ||
    !ss.getId()
  ) {

    throw new Error(
      'Não foi possível acessar a planilha operacional.'
    );

  }


  /*************************************************
   * 1 — BACKUP COMPLETO
   *************************************************/

  const archive =
    archiveWorkbook_(
      ss,
      'DOOX — HOCCO — BACKUP MIGRAÇÃO — ' +
      stamp
    );


  /*************************************************
   * 2 — CRIA ABAS TEMPORÁRIAS
   *
   * Isso evita conflito com nomes das abas antigas.
   *************************************************/

  const tempSheets =
    [];


  Object.keys(
    SHEETS
  ).forEach(
    key => {

      const def =
        SHEETS[key];


      const tmpName =
        '__MVP_TMP__' +
        key +
        '__' +
        stamp;


      const sheet =
        ss.insertSheet(
          tmpName
        );


      ensureHeaders_(
        sheet,
        def.headers
      );


      formatSheet_(
        sheet,
        def.headers
      );


      tempSheets.push({

        tempName:
          tmpName,

        finalName:
          def.name

      });

    }
  );


  /*************************************************
   * 3 — REMOVE TODAS AS ABAS ANTIGAS
   *************************************************/

  const tempNames =
    tempSheets.map(
      x => x.tempName
    );


  ss.getSheets()
    .slice()
    .forEach(
      sheet => {

        if (
          tempNames.indexOf(
            sheet.getName()
          ) === -1
        ) {

          ss.deleteSheet(
            sheet
          );

        }

      }
    );


  /*************************************************
   * 4 — RENOMEIA AS TEMPORÁRIAS
   *************************************************/

  tempSheets.forEach(
    item => {

      const sheet =
        ss.getSheetByName(
          item.tempName
        );


      if (!sheet) {

        throw new Error(
          'Aba temporária não encontrada: ' +
          item.tempName
        );

      }


      sheet.setName(
        item.finalName
      );

    }
  );


  /*************************************************
   * 5 — SEQUÊNCIAS
   *
   * Pedido continua sequencial para não duplicar
   * códigos históricos.
   *
   * Clientes e episódios recomeçam a numeração.
   *************************************************/

  PropertiesService
    .getScriptProperties()
    .deleteProperty(
      'DOOX_CLIENT_SEQ'
    );


  PropertiesService
    .getScriptProperties()
    .deleteProperty(
      'DOOX_EPISODE_SEQ'
    );


  /*************************************************
   * 6 — PRIMEIRO EPISÓDIO
   *************************************************/

  createEpisode_(
    ss,
    new Date()
  );


  return {

    ok: true,

    message:
      'Estrutura antiga arquivada e substituída pelo MVP.',

    archiveUrl:
      archive.url,

    archiveId:
      archive.id,

    sheets:
      Object.keys(
        SHEETS
      ).map(
        k => SHEETS[k].name
      )

  };

}


/*************************************************
 * FECHAMENTO MENSAL
 *************************************************/

function fecharMesEArquivar() {

  const ss =
    getSpreadsheet_();


  ensureOperationalStructure_(ss);


  const month =
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      'yyyy-MM'
    );


  const archiveName =
    'DOOX — HOCCO — ARQUIVO — ' +
    month;


  const archive =
    archiveOperationalSheets_(
      ss,
      archiveName
    );


  /*************************************************
   * LIMPA OS DADOS
   *************************************************/

  clearOperationalData_(ss);


  /*************************************************
   * NOVO EPISÓDIO
   *************************************************/

  const episode =
    createEpisode_(
      ss,
      new Date()
    );


  /*************************************************
   * REGISTRA CONTROLE DO FECHAMENTO
   *************************************************/

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'LAST_MONTH_CLOSE',
      new Date().toISOString()
    );


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'LAST_MONTH_ARCHIVE_URL',
      archive.url
    );


  return {

    ok: true,

    closedMonth:
      month,

    archiveName:
      archiveName,

    archiveUrl:
      archive.url,

    archiveId:
      archive.id,

    newEpisode:
      episode,

    message:
      'Mês arquivado e operação resetada com sucesso.'

  };

}


/*************************************************
 * LIMPEZA DO OPERACIONAL
 *************************************************/

function clearOperationalData_(ss) {

  const names = [

    SHEETS.PEDIDOS.name,

    SHEETS.PAGAMENTOS.name,

    SHEETS.EPISODIOS.name,

    SHEETS.VEICULACOES.name

  ];




  names.forEach(
    name => {

      const sheet =
        getSheet_(
          ss,
          name
        );


      const lastRow =
        sheet.getLastRow();


      const defKey =
        Object.keys(
          SHEETS
        ).find(
          k =>
            SHEETS[k].name === name
        );


      const lastCol =
        Math.max(

          sheet.getLastColumn(),

          SHEETS[
            defKey
          ]
            .headers.length

        );


      if (
        lastRow >= 2
      ) {

        sheet
          .getRange(
            2,
            1,
            lastRow - 1,
            lastCol
          )
          .clearContent();

      }

    }
  );

}


/*************************************************
 * ARQUIVAMENTO COMPLETO
 *************************************************/

function archiveWorkbook_(
  sourceSs,
  archiveName
) {

  const folder =
    getArchiveFolder_();


  const archiveSs =
    SpreadsheetApp.create(
      archiveName
    );


  const sourceSheets =
    sourceSs.getSheets();


  const copied =
    [];


  sourceSheets.forEach(
    sourceSheet => {

      const copiedSheet =
        sourceSheet.copyTo(
          archiveSs
        );


      copiedSheet.setName(
        uniqueSheetName_(
          archiveSs,
          sourceSheet.getName()
        )
      );


      copied.push({

        source:
          sourceSheet.getName(),

        target:
          copiedSheet.getName(),

        rows:
          sourceSheet.getLastRow(),

        columns:
          sourceSheet.getLastColumn()

      });

    }
  );


  /*************************************************
   * REMOVE ABA PADRÃO VAZIA
   *************************************************/

  const sheets =
    archiveSs.getSheets();


  if (

    sheets.length > 1 &&

    /^Sheet1$|^Página1$|^Planilha1$/i
      .test(
        sheets[0].getName()
      )

  ) {

    archiveSs.deleteSheet(
      sheets[0]
    );

  }


  /*************************************************
   * MOVE PARA PASTA
   *************************************************/

  const file =
    DriveApp.getFileById(
      archiveSs.getId()
    );


  folder.addFile(
    file
  );


  try {

    DriveApp
      .getRootFolder()
      .removeFile(
        file
      );

  }

  catch (_) {

    // Não é crítico.

  }


  /*************************************************
   * VERIFICAÇÃO
   *************************************************/

  copied.forEach(
    item => {

      const targetSheet =
        archiveSs.getSheetByName(
          item.target
        );


      if (!targetSheet) {

        throw new Error(
          'Falha ao arquivar a aba: ' +
          item.source
        );

      }


      if (

        targetSheet.getLastRow() <
        item.rows &&

        item.rows > 0

      ) {

        throw new Error(
          'Verificação do arquivo falhou na aba: ' +
          item.source
        );

      }

    }
  );


  return {

    id:
      archiveSs.getId(),

    url:
      archiveSs.getUrl(),

    name:
      archiveSs.getName(),

    sheets:
      copied

  };

}


/*************************************************
 * ARQUIVAMENTO OPERACIONAL MENSAL
 *************************************************/

function archiveOperationalSheets_(
  sourceSs,
  archiveName
) {

  const folder =
    getArchiveFolder_();


  const archiveSs =
    SpreadsheetApp.create(
      archiveName
    );


  const copied =
    [];


  Object.keys(
    SHEETS
  ).forEach(
    key => {

      const sourceSheet =
        sourceSs.getSheetByName(
          SHEETS[key].name
        );


      if (!sourceSheet) {
        return;
      }


      const copiedSheet =
        sourceSheet.copyTo(
          archiveSs
        );


      copiedSheet.setName(
        uniqueSheetName_(
          archiveSs,
          sourceSheet.getName()
        )
      );


      copied.push({

        source:
          sourceSheet.getName(),

        target:
          copiedSheet.getName(),

        rows:
          sourceSheet.getLastRow(),

        columns:
          sourceSheet.getLastColumn()

      });

    }
  );


  const sheets =
    archiveSs.getSheets();


  if (

    sheets.length > 1 &&

    /^Sheet1$|^Página1$|^Planilha1$/i
      .test(
        sheets[0].getName()
      )

  ) {

    archiveSs.deleteSheet(
      sheets[0]
    );

  }


  const file =
    DriveApp.getFileById(
      archiveSs.getId()
    );


  folder.addFile(
    file
  );


  try {

    DriveApp
      .getRootFolder()
      .removeFile(
        file
      );

  }

  catch (_) {}


  copied.forEach(
    item => {

      const targetSheet =
        archiveSs.getSheetByName(
          item.target
        );


      if (!targetSheet) {

        throw new Error(
          'Falha ao arquivar a aba operacional: ' +
          item.source
        );

      }

    }
  );


  return {

    id:
      archiveSs.getId(),

    url:
      archiveSs.getUrl(),

    name:
      archiveSs.getName(),

    sheets:
      copied

  };

}


/*************************************************
 * PASTA DE ARQUIVOS
 *************************************************/

function getArchiveFolder_() {

  const props =
    PropertiesService
      .getScriptProperties();


  let folderId =
    CONFIG.ARCHIVE_FOLDER_ID ||
    props.getProperty(
      'DOOX_ARCHIVE_FOLDER_ID'
    );


  if (folderId) {

    try {

      return DriveApp
        .getFolderById(
          folderId
        );

    }

    catch (_) {

      // Cria outra pasta.

    }

  }


  const existing =
    DriveApp
      .getFoldersByName(
        CONFIG.ARCHIVE_FOLDER_NAME
      );


  const folder =
    existing.hasNext()

      ? existing.next()

      : DriveApp.createFolder(
          CONFIG.ARCHIVE_FOLDER_NAME
        );


  props.setProperty(
    'DOOX_ARCHIVE_FOLDER_ID',
    folder.getId()
  );


  return folder;

}


/*************************************************
 * TESTE OPERACIONAL V30
 * Valida a nova estrutura de duas abas visíveis,
 * instruções por modalidade e recusa com justificativa.
 *************************************************/
function TESTE_OPERACAO_V30() {
  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);
  const visible = ss.getSheets().filter(s => !s.isSheetHidden()).map(s => s.getName());
  const expected = [SHEETS.PAGAMENTOS.name];
  if (JSON.stringify(visible.sort()) !== JSON.stringify(expected.slice().sort())) {
    throw new Error('Estrutura visível inesperada. Visíveis: ' + visible.join(', '));
  }

  const id = 'TESTE-V30-' + Date.now();
  const pedido = registerRequest_({
    action: 'registerRequest', clientRequestId: id,
    name: 'TESTE DOOX V30', company: 'TESTE DOOX V30', type: 'Empresa',
    whatsapp: '14999999999', email: 'teste-v30@doox.local', profile: '@teste.doox.v30',
    modality: 'Sponsor Overlay', moment: '04:00–06:30', quantity: 1,
    observation: 'TESTE V30 — excluir depois.', termsAccepted: true, rulesAccepted: true
  });
  if (!pedido.ok || !pedido.instructions || pedido.instructions.items.length < 1) throw new Error('Instruções da modalidade não foram retornadas.');

  const rejected = recusarParticipacao(pedido.code, 'Material incompatível com as especificações editoriais da HOCCO.');
  if (!rejected.ok || rejected.status !== 'REJEITADO') throw new Error('Falha no fluxo de recusa.');
  const publicData = getPublicOrderStatus_(pedido.trackingToken);
  if (!publicData.ok || publicData.status !== 'REJEITADO' || publicData.rejectionReason !== 'Material incompatível com as especificações editoriais da HOCCO.') {
    throw new Error('A justificativa da recusa não chegou ao acompanhamento público.');
  }
  return { ok: true, visibleSheets: visible, code: pedido.code, rejection: publicData.rejectionReason, instructions: pedido.instructions };
}

/*************************************************
 * TESTE DO SISTEMA
 *************************************************/

function testarSistema() {

  const ss =
    getSpreadsheet_();


  ensureOperationalStructure_(ss);


  return {

    ok: true,

    spreadsheetId:
      ss.getId(),

    spreadsheetName:
      ss.getName(),

    sheets:
      ss.getSheets().map(
        s => s.getName()
      ),

    firstEpisode:
      getSheet_(
        ss,
        SHEETS.EPISODIOS.name
      )
        .getRange(
          2,
          1
        )
        .getValue() ||
      ''

  };

}


/*************************************************
 * TESTE DE PEDIDO
 *************************************************/

function TESTE_PEDIDO_V11() {

  const clientRequestId =
    'TESTE-V11-' + Date.now();

  const result = registerRequest_({

    action:
      'registerRequest',

    clientRequestId:
      clientRequestId,

    name:
      'TESTE DOOX V11',

    company:
      'TESTE DOOX V11',

    type:
      'Empresa',

    whatsapp:
      '14999999999',

    email:
      'teste-v11@doox.local',

    profile:
      '@teste.doox.v11',

    modality:
      'Sponsor Overlay',

    moment:
      '04:00–06:30',

    quantity:
      1,

    observation:
      'TESTE INTERNO V11 — pode ser excluído pela função LIMPAR_TESTES_V11.',

    termsAccepted:
      true,

    rulesAccepted:
      true

  });

  Logger.log('TESTE_PEDIDO_V11:');
  Logger.log(JSON.stringify(result, null, 2));

  return result;

}


/*************************************************
 * TESTE COMPLETO DE ACOMPANHAMENTO V11
 * Cria um pedido de teste e percorre:
 * SOLICITADO -> AGUARDANDO PAGAMENTO
 * -> consulta pública -> informar pagamento
 * -> confirmação manual -> PAGAMENTO RECEBIDO.
 * Não usa doPost(e), portanto pode ser executado
 * diretamente pelo editor do Apps Script.
 *************************************************/
function TESTE_ACOMPANHAMENTO_V11() {

  const clientRequestId = 'TESTE-V11-ACOMP-' + Date.now();

  const pedido = registerRequest_({
    action: 'registerRequest',
    clientRequestId: clientRequestId,
    name: 'TESTE ACOMPANHAMENTO DOOX V11',
    company: 'TESTE ACOMPANHAMENTO DOOX V11',
    type: 'Empresa',
    whatsapp: '14999999999',
    email: 'teste-acomp-v11@doox.local',
    profile: '@teste.acomp.v11',
    modality: 'Sponsor Overlay',
    moment: '04:00–06:30',
    quantity: 1,
    observation: 'TESTE INTERNO V11 — acompanhamento e pagamento.',
    termsAccepted: true,
    rulesAccepted: true
  });

  Logger.log('1) PEDIDO CRIADO:');
  Logger.log(JSON.stringify(pedido, null, 2));

  const ss = getSpreadsheet_();

  // 1. Consulta pública enquanto SOLICITADO. O Pix já deve estar disponível.
  const antes = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('2) ACOMPANHAMENTO — antes de liberar pagamento:');
  Logger.log(JSON.stringify(antes, null, 2));

  if (!antes.ok) throw new Error('Falha na consulta inicial do acompanhamento.');
  if (antes.status !== 'SOLICITADO') {
    throw new Error('Status inicial inesperado: ' + antes.status);
  }
  if (antes.payment.available !== true) {
    throw new Error('Pagamento deveria estar disponível em SOLICITADO.');
  }
  if (Number(antes.payment.amount) !== Number(pedido.total)) {
    throw new Error(
      'Valor inicial do acompanhamento diferente do pedido: ' +
      antes.payment.amount + ' x ' + pedido.total
    );
  }
  if (!antes.payment.pixPayload) {
    throw new Error('PIX Copia e Cola não foi gerado no acompanhamento inicial.');
  }

  // 2. O status operacional precisa respeitar as transições: SOLICITADO -> EM ANÁLISE -> AGUARDANDO PAGAMENTO.
  const emAnalise = atualizarStatusPedido_(
    ss,
    pedido.code,
    'EM ANÁLISE',
    { action: 'TESTE — ANALISAR' }
  );
  Logger.log('3) STATUS ALTERADO PARA EM ANÁLISE:');
  Logger.log(JSON.stringify(emAnalise, null, 2));

  const liberado = atualizarStatusPedido_(
    ss,
    pedido.code,
    'AGUARDANDO PAGAMENTO',
    { action: 'TESTE — LIBERAR PAGAMENTO' }
  );
  Logger.log('4) STATUS ALTERADO PARA AGUARDANDO PAGAMENTO:');
  Logger.log(JSON.stringify(liberado, null, 2));

  // 3. Consulta pública deve continuar trazendo valor + Pix.
  const depoisLiberacao = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('5) ACOMPANHAMENTO — pagamento liberado:');
  Logger.log(JSON.stringify(depoisLiberacao, null, 2));

  if (!depoisLiberacao.ok) throw new Error('Falha na consulta após liberar pagamento.');
  if (depoisLiberacao.status !== 'AGUARDANDO PAGAMENTO') {
    throw new Error('Status após liberação inesperado: ' + depoisLiberacao.status);
  }
  if (depoisLiberacao.payment.available !== true) {
    throw new Error('Pagamento deveria estar disponível.');
  }
  if (Number(depoisLiberacao.payment.amount) !== Number(pedido.total)) {
    throw new Error(
      'Valor do acompanhamento diferente do pedido: ' +
      depoisLiberacao.payment.amount + ' x ' + pedido.total
    );
  }
  if (!depoisLiberacao.payment.pixPayload) {
    throw new Error('PIX Copia e Cola não foi gerado no acompanhamento.');
  }

  // 4. Cliente informa que pagou. Isso NÃO confirma o pagamento.
  const informado = informarPagamento_({
    token: pedido.trackingToken
  });
  Logger.log('6) CLIENTE INFORMOU PAGAMENTO:');
  Logger.log(JSON.stringify(informado, null, 2));

  if (!informado.ok || informado.paymentReported !== true) {
    throw new Error('Falha ao registrar o aviso de pagamento.');
  }
  if (informado.status !== 'AGUARDANDO PAGAMENTO') {
    throw new Error('O aviso do cliente alterou indevidamente o status do pedido.');
  }

  // 5. Confirmação manual pelo operador: uma única operação deve atualizar financeiro + pedido.
  const confirmado = confirmarPagamento(
    pedido.code,
    'PIX',
    'TESTE INTERNO V11 — pagamento confirmado manualmente.'
  );
  Logger.log('7) PAGAMENTO CONFIRMADO NO FINANCEIRO:');
  Logger.log(JSON.stringify(confirmado, null, 2));

  if (!confirmado.ok || confirmado.paymentStatus !== 'PAGAMENTO RECEBIDO') {
    throw new Error('CONFIRMAR PAGAMENTO não confirmou o financeiro corretamente.');
  }

  // 6. A confirmação única deve ter levado o pedido a PAGAMENTO RECEBIDO.
  const pedidoDepoisPagamento = findPedidoByCode_(ss, pedido.code);
  const statusFinal = String(pedidoDepoisPagamento && pedidoDepoisPagamento.status || '').toUpperCase();
  Logger.log('8) STATUS FINAL DO PEDIDO:');
  Logger.log(JSON.stringify({ ok: true, code: pedido.code, status: statusFinal }, null, 2));

  if (statusFinal !== 'PAGAMENTO RECEBIDO') {
    throw new Error('CONFIRMAR PAGAMENTO deveria atualizar o pedido para PAGAMENTO RECEBIDO. Status: ' + statusFinal);
  }

  // 7. Consulta final pública.
  const final = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('9) ACOMPANHAMENTO FINAL:');
  Logger.log(JSON.stringify(final, null, 2));

  if (!final.ok) throw new Error('Falha na consulta final do acompanhamento.');
  if (final.status !== 'PAGAMENTO RECEBIDO') {
    throw new Error('Status final inesperado: ' + final.status);
  }

  Logger.log('========================================');
  Logger.log('TESTE_ACOMPANHAMENTO_V11: APROVADO');
  Logger.log('Código: ' + pedido.code);
  Logger.log('Token: ' + pedido.trackingToken);
  Logger.log('Valor: R$ ' + Number(pedido.total).toFixed(2));
  Logger.log('========================================');

  return {
    ok: true,
    code: pedido.code,
    trackingToken: pedido.trackingToken,
    total: pedido.total,
    finalStatus: final.status
  };
}


// Compatibilidade com o nome antigo do teste.
function testarPedidoMVP() {
  return TESTE_PEDIDO_V11();
}


/*************************************************
 * TESTE DO PIX V11
 * Não cria pedido nem altera planilhas.
 *************************************************/

function TESTE_PIX_V11() {

  const valor = 59.90;

  // buildPixPayload_ usa a configuração PIX do V11 e recebe
  // apenas o valor (e, opcionalmente, o código do pedido).
  const payload = buildPixPayload_(valor, 'TESTE-PIX-V11');

  Logger.log('TESTE_PIX_V11 — valor: R$ ' + valor.toFixed(2));
  Logger.log('PIX COPIA E COLA:');
  Logger.log(payload);

  return {
    ok: true,
    amount: valor,
    payload: payload
  };

}


/*************************************************
 * LIMPEZA SEGURA DOS TESTES V11
 * Remove somente pedidos cujo Client Request ID
 * começa com TESTE-V11-.
 * Também remove o respectivo pagamento.
 *************************************************/

function LIMPAR_TESTES_V11() {

  const ss = getSpreadsheet_();
  ensureOperationalStructure_(ss);

  const pedidos = getSheet_(ss, SHEETS.PEDIDOS.name);
  const pagamentos = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  let pedidosRemovidos = 0;
  let pagamentosRemovidos = 0;
  const codigos = [];

  // PEDIDOS
  const pm = headerMap_(pedidos);
  const lastPedido = pedidos.getLastRow();

  if (lastPedido >= 2) {
    const values = pedidos.getRange(2, 1, lastPedido - 1, pedidos.getLastColumn()).getValues();

    for (let i = values.length - 1; i >= 0; i--) {
      const clientRequestId = String(values[i][pm['Client Request ID'] - 1] || '');

      if (clientRequestId.indexOf('TESTE-V11-') === 0) {
        const code = String(values[i][pm['Código DOOX'] - 1] || '');
        if (code) codigos.push(code);
        pedidos.deleteRow(i + 2);
        pedidosRemovidos++;
      }
    }
  }

  // PAGAMENTOS correspondentes aos códigos removidos.
  if (codigos.length && pagamentos.getLastRow() >= 2) {
    const payValues = pagamentos.getRange(2, 1, pagamentos.getLastRow() - 1, pagamentos.getLastColumn()).getValues();
    for (let i = payValues.length - 1; i >= 0; i--) {
      const code = String(payValues[i][0] || '');
      if (codigos.indexOf(code) !== -1) {
        pagamentos.deleteRow(i + 2);
        pagamentosRemovidos++;
      }
    }
  }


  const result = {
    ok: true,
    pedidosRemovidos: pedidosRemovidos,
    pagamentosRemovidos: pagamentosRemovidos,
    codigos: codigos
  };

  Logger.log('LIMPAR_TESTES_V11:');
  Logger.log(JSON.stringify(result, null, 2));

  return result;

}


/*************************************************
 * ACOMPANHAMENTO DO CLIENTE
 *
 * O portal consulta o pedido por um token privado.
 * Nenhuma lista de clientes ou dado interno é exposta.
 *************************************************/

function createTrackingToken_() {

  return Utilities.getUuid()
    .replace(/-/g, '')
    .substring(0, 32);

}


function getPublicOrderStatus_(token) {

  const ss = getSpreadsheet_();

  const pedido =
    findPedidoByTrackingToken_(
      ss,
      token
    );

  if (!pedido) {
    return {
      ok: false,
      error: 'Pedido não encontrado ou token inválido.'
    };
  }

  const status = String(
    pedido.status || 'SOLICITADO'
  ).trim().toUpperCase();

  return {
    ok: true,
    code: pedido.code,
    modality: pedido.modality,
    quantity: pedido.quantity,
    episode: pedido.episode,
    status: status,
    statusLabel: publicStatusLabel_(status),
    updatedAt: pedido.updatedAt,
    versionKey: String(pedido.updatedAt || ''),
    steps: publicStatusSteps_(status),
    nextAction: nextActionForStatus_(status),
    observationClient: pedido.observationClient || '',
    rejectionReason: status === 'REJEITADO' ? (pedido.observationClient || '') : '',
    instructions: getClientInstructions_(pedido.modality),
    simulation: getSimulationSpec_(pedido.modality, pedido.moment),
    progressPercent: publicProgressPercent_(status),
    payment: buildPublicPayment_(ss, pedido),
    receipt: {
      eligible: status === 'FINALIZADO',
      nameOrCompany: pedido.nameOrCompany || '',
      modality: pedido.modality || '',
      quantity: pedido.quantity || 1,
      episode: pedido.episode || '',
      code: pedido.code || '',
      issuedAt: new Date()
    }
  };

}


function publicProgressPercent_(status) {
  const map = { 'SOLICITADO': 10, 'EM ANÁLISE': 20, 'AGUARDANDO PAGAMENTO': 35, 'PAGAMENTO RECEBIDO': 45, 'MATERIAL PENDENTE': 55, 'MATERIAL RECEBIDO': 65, 'EM PRODUÇÃO': 78, 'PROGRAMADO': 88, 'PUBLICADO': 96, 'FINALIZADO': 100, 'REJEITADO': 100, 'CANCELADO': 100, 'ARQUIVADO': 100 };
  return map[status] || 0;
}

function publicStatusSteps_(currentStatus) {
  const groups = [
    { key: 'SOLICITAÇÃO', statuses: ['SOLICITADO'], label: 'Solicitação recebida' },
    { key: 'ANÁLISE', statuses: ['EM ANÁLISE'], label: 'Em análise' },
    { key: 'PAGAMENTO', statuses: ['AGUARDANDO PAGAMENTO', 'PAGAMENTO RECEBIDO'], label: 'Pagamento' },
    { key: 'MATERIAL', statuses: ['MATERIAL PENDENTE', 'MATERIAL RECEBIDO'], label: 'Materiais' },
    { key: 'PRODUÇÃO', statuses: ['EM PRODUÇÃO', 'PROGRAMADO', 'PUBLICADO', 'FINALIZADO'], label: 'Produção e veiculação' }
  ];
  const exceptional = ['REJEITADO', 'CANCELADO', 'ARQUIVADO'];
  if (exceptional.indexOf(currentStatus) >= 0) {
    return groups.map(g => ({ status: g.key, label: g.label, state: 'inactive' }))
      .concat([{ status: currentStatus, label: publicStatusLabel_(currentStatus), state: 'current' }]);
  }
  let currentGroup = groups.findIndex(g => g.statuses.indexOf(currentStatus) >= 0);
  if (currentGroup < 0) currentGroup = 0;
  return groups.map((g, index) => ({
    status: g.key,
    label: g.label,
    state: index < currentGroup ? 'completed' : index === currentGroup ? 'current' : 'pending'
  }));
}

function publicStatusLabel_(status) {

  const labels = {
    'SOLICITADO': 'Solicitação recebida',
    'EM ANÁLISE': 'Em análise',
    'AGUARDANDO PAGAMENTO': 'Aguardando pagamento',
    'PAGAMENTO RECEBIDO': 'Pagamento recebido',
    'MATERIAL PENDENTE': 'Material pendente',
    'MATERIAL RECEBIDO': 'Material recebido',
    'EM PRODUÇÃO': 'Em produção',
    'PROGRAMADO': 'Programado',
    'PUBLICADO': 'Veiculado',
    'FINALIZADO': 'Finalizado',
    'REJEITADO': 'Participação recusada',
    'CANCELADO': 'Solicitação cancelada',
    'ARQUIVADO': 'Registro arquivado'
  };

  return labels[status] || status;

}


function findPedidoByTrackingToken_(ss, token) {

  const sheet =
    getSheet_(ss, SHEETS.PEDIDOS.name);

  const map = headerMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (
    lastRow < 2 ||
    !map['Token de Acompanhamento']
  ) {
    return null;
  }

  const values = sheet.getRange(
    2,
    1,
    lastRow - 1,
    sheet.getLastColumn()
  ).getValues();

  const wanted = String(token || '').trim();

  for (let i = 0; i < values.length; i++) {

    const current = String(
      values[i][
        map['Token de Acompanhamento'] - 1
      ] || ''
    ).trim();

    if (current === wanted) {

      const row = i + 2;

      return {
        row: row,
        code: String(values[i][map['Código DOOX'] - 1] || ''),
        modality: String(values[i][map['Modalidade'] - 1] || ''),
        quantity: Number(values[i][map['Quantidade'] - 1] || 0),
        episode: String(values[i][map['Episódio'] - 1] || ''),
        status: String(values[i][map['Status'] - 1] || ''),
        updatedAt: values[i][map['Atualizado em'] - 1] || '',
        observationClient: map['Observação Cliente'] ? String(values[i][map['Observação Cliente'] - 1] || '') : ''
      };

    }
  }

  return null;

}


/*************************************************
 * BUSCAR PEDIDO PELO CÓDIGO
 *************************************************/

function findPedidoByCode_(
  ss,
  code
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const found =
    findRowByFirstColumn_(
      sheet,
      code
    );


  if (!found) {
    return null;
  }


  const map =
    headerMap_(
      sheet
    );


  const v =
    found.values;


  return {

    row:
      found.row,

    code:
      String(
        v[
          map['Código DOOX'] - 1
        ] || ''
      ),

    nameOrCompany:
      String(
        v[
          map['Nome / Empresa'] - 1
        ] || ''
      ),

    modality:
      String(
        v[
          map['Modalidade'] - 1
        ] || ''
      ),

    quantity:
      Number(
        v[
          map['Quantidade'] - 1
        ] || 0
      ),

    episode:
      String(
        v[
          map['Episódio'] - 1
        ] || ''
      ),

    moment:
      String(
        v[
          map['Momento desejado'] - 1
        ] || ''
      ),

    reservation:
      String(
        v[
          map['Reserva'] - 1
        ] || ''
      ),

    reserva:
      String(
        v[
          map['Reserva'] - 1
        ] || ''
      ),

    status:
      String(
        v[
          map['Status'] - 1
        ] || ''
      )

  };

}


/*************************************************
 * BUSCAR PELO CLIENT REQUEST ID
 *************************************************/

function findPedidoByClientRequestId_(
  ss,
  clientRequestId
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const map =
    headerMap_(
      sheet
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {
    return null;
  }


  const values =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      sheet.getLastColumn()
    ).getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const cell =
      String(
        values[i][
          map['Client Request ID'] - 1
        ] || ''
      );


    if (
      cell &&
      cell ===
      String(clientRequestId)
    ) {

      const row =
        i + 2;


      return {
        row: row,
        code: String(values[i][map['Código DOOX'] - 1] || ''),
        trackingToken: String(values[i][map['Token de Acompanhamento'] - 1] || ''),
        modality: String(values[i][map['Modalidade'] - 1] || ''),
        quantity: Number(values[i][map['Quantidade'] - 1] || 0),
        total: Number(values[i][map['Valor total'] - 1] || 0),
        status: String(values[i][map['Status'] - 1] || ''),
        order: values[i]
      };

    }

  }


  return null;

}


/*************************************************
 * ACESSO À PLANILHA
 *
 * NÃO usa getActiveSpreadsheet().
 *************************************************/

function getSpreadsheet_() {

  if (

    !CONFIG.SPREADSHEET_ID ||

    CONFIG.SPREADSHEET_ID
      .indexOf('COLE_') === 0

  ) {

    throw new Error(
      'CONFIG.SPREADSHEET_ID não foi configurado.'
    );

  }


  return SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

}


/*************************************************
 * ACESSO À ABA
 *************************************************/

function getSheet_(
  ss,
  name
) {

  const sheet =
    ss.getSheetByName(
      name
    );


  if (!sheet) {

    throw new Error(
      'Aba não encontrada: ' +
      name
    );

  }


  return sheet;

}


/*************************************************
 * CABEÇALHOS
 *************************************************/

function ensureHeaders_(
  sheet,
  headers
) {

  if (
    sheet.getMaxColumns() <
    headers.length
  ) {

    sheet.insertColumnsAfter(

      sheet.getMaxColumns(),

      headers.length -
      sheet.getMaxColumns()

    );

  }


  const current =
    sheet.getRange(
      1,
      1,
      1,
      headers.length
    ).getValues()[0];


  const mismatch =
    headers.some(
      (h, i) =>
        String(
          current[i] || ''
        ) !== h
    );


  if (mismatch) {

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

  }

}


/*************************************************
 * FORMATAÇÃO DA ABA
 *************************************************/

function formatSheet_(
  sheet,
  headers
) {

  if (
    sheet.getFrozenRows() < 1
  ) {

    sheet.setFrozenRows(
      1
    );

  }


  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold').setBackground('#ff6900').setFontColor('#ffffff').setVerticalAlignment('middle');
  headerRange.setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);


  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setWrap(
      true
    );


  const filter =
    sheet.getFilter();


  if (filter) {

    try {

      filter.remove();

    }

    catch (_) {}

  }


  if (
    sheet.getMaxRows() >= 2
  ) {

    try {

      sheet
        .getRange(
          1,
          1,
          Math.max(
            2,
            sheet.getLastRow()
          ),
          headers.length
        )
        .createFilter();

    }

    catch (_) {}

  }


  try {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).setBackground('#ffffff').setFontColor('#222222');
      const map = headerMap_(sheet);
      if (map['Status']) {
        sheet.getRange(2, map['Status'], Math.max(1, lastRow - 1), 1).setFontWeight('bold').setBackground('#fff1e6');
      }
      if (map['Status do Pedido']) {
        sheet.getRange(2, map['Status do Pedido'], Math.max(1, lastRow - 1), 1).setFontWeight('bold').setBackground('#fff1e6');
      }
      if (map['Status pagamento']) {
        sheet.getRange(2, map['Status pagamento'], Math.max(1, lastRow - 1), 1).setFontWeight('bold').setBackground('#fff1e6');
      }
    }
  } catch (_) {}

  try {

    sheet.autoResizeColumns(
      1,
      headers.length
    );

  }

  catch (_) {}

}


/*************************************************
 * FORMATAÇÃO DOS DADOS
 *************************************************/

function formatDataRows_(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {
    return;
  }


  const headers =
    sheet.getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    ).getValues()[0];


  headers.forEach(
    (h, i) => {

      if (
        /Data|Criado em|Atualizado em/i
          .test(
            String(h)
          )
      ) {

        sheet
          .getRange(
            2,
            i + 1,
            lastRow - 1,
            1
          )
          .setNumberFormat(
            'dd/mm/yyyy hh:mm:ss'
          );

      }


      if (
        /Valor|preço/i
          .test(
            String(h)
          )
      ) {

        sheet
          .getRange(
            2,
            i + 1,
            lastRow - 1,
            1
          )
          .setNumberFormat(
            'R$ #,##0.00'
          );

      }

    }
  );

}


/*************************************************
 * MAPA DE CABEÇALHOS
 *************************************************/

function headerMap_(
  sheet
) {

  const headers =
    sheet.getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    ).getValues()[0];


  const map =
    {};


  headers.forEach(
    (h, i) => {

      map[
        String(h)
      ] =
        i + 1;

    }
  );


  return map;

}


/*************************************************
 * ESCREVER NA LINHA PELO CABEÇALHO
 *************************************************/

function put_(
  row,
  map,
  header,
  value
) {

  if (!map[header]) {

    throw new Error(
      'Cabeçalho não encontrado: ' +
      header
    );

  }


  row[
    map[header] - 1
  ] =
    value;

}


/*************************************************
 * DADOS
 *************************************************/

function getDataRows_(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return [];

  }


  return sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      sheet.getLastColumn()
    )
    .getValues();

}


/*************************************************
 * BUSCA NA PRIMEIRA COLUNA
 *************************************************/

function findRowByFirstColumn_(
  sheet,
  value
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {
    return null;
  }


  const data =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        sheet.getLastColumn()
      )
      .getValues();


  const needle =
    String(
      value || ''
    ).trim();


  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    if (

      String(
        data[i][0] || ''
      ).trim() ===
      needle

    ) {

      return {

        row:
          i + 2,

        values:
          data[i]

      };

    }

  }


  return null;

}


/*************************************************
 * NOME ÚNICO DE ABA
 *************************************************/

function uniqueSheetName_(
  ss,
  desired
) {

  let name =
    desired.substring(
      0,
      90
    );


  if (
    !ss.getSheetByName(
      name
    )
  ) {

    return name;

  }


  let n = 2;


  while (
    ss.getSheetByName(
      (
        name +
        ' ' +
        n
      ).substring(
        0,
        99
      )
    )
  ) {

    n++;

  }


  return (
    name +
    ' ' +
    n
  ).substring(
    0,
    99
  );

}


/*************************************************
 * NORMALIZAR MODALIDADE
 *************************************************/

function normalizeModality_(
  value
) {

  const raw =
    clean_(
      value
    );


  if (!raw) {
    return '';
  }


  const aliases = {

    'Presença no Rodapé':
      'Presença no Rodapé',

    'Presenca no Rodape':
      'Presença no Rodapé',

    'Rodapé':
      'Presença no Rodapé',

    'Rodape':
      'Presença no Rodapé',

    'Sponsor Overlay':
      'Sponsor Overlay',

    'Overlay':
      'Sponsor Overlay',

    'Overlay + Áudio':
      'Overlay + Áudio',

    'Overlay + Audio':
      'Overlay + Áudio',

    'Apoiador Individual':
      'Apoiador Individual',

    'Empresa Patrocinadora do Episódio':
      'Empresa Patrocinadora do Episódio',

    'Empresa Patrocinadora do Episodio':
      'Empresa Patrocinadora do Episódio'

  };


  return (
    aliases[raw] ||
    raw
  );

}


/*************************************************
 * NORMALIZAR TIPO
 *************************************************/

function normalizeType_(
  value
) {

  const raw =
    clean_(
      value
    )
      .toLowerCase();


  if (

    raw ===
      'empresa' ||

    raw ===
      'pj' ||

    raw ===
      'juridica' ||

    raw ===
      'pessoa jurídica'

  ) {

    return 'Empresa';

  }


  if (

    raw ===
      'pessoa' ||

    raw ===
      'pessoa física' ||

    raw ===
      'pessoa fisica' ||

    raw ===
      'pf'

  ) {

    return 'Pessoa Física';

  }


  return clean_(
    value
  );

}


/*************************************************
 * INTERPRETAR POST
 *************************************************/

function parsePostBody_(
  e
) {

  if (!e) {
    return {};
  }


  if (
    e.postData &&
    e.postData.contents
  ) {

    const text =
      String(
        e.postData.contents ||
        ''
      ).trim();


    if (!text) {
      return {};
    }


    try {

      return JSON.parse(
        text
      );

    }

    catch (_) {

      const params =
        e.parameter ||
        {};


      return params;

    }

  }


  return (
    e.parameter ||
    {}
  );

}


/*************************************************
 * LIMPAR TEXTO
 *************************************************/

function clean_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(
    value
  ).trim();

}


/*************************************************
 * INTEIRO POSITIVO
 *************************************************/

function toPositiveInt_(
  value
) {

  const n =
    Number(
      value
    );


  if (
    !isFinite(n) ||
    n <= 0
  ) {

    return 0;

  }


  return Math.floor(
    n
  );

}


/*************************************************
 * BOOLEANO
 *************************************************/

function toBool_(
  value
) {

  if (
    value === true ||
    value === 1
  ) {

    return true;

  }


  const s =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();


  return [

    'true',
    '1',
    'sim',
    'yes',
    'aceito',
    'on'

  ].indexOf(
    s
  ) !== -1;

}


/*************************************************
 * E-MAIL
 *************************************************/

function normalizeEmail_(
  value
) {

  return clean_(
    value
  ).toLowerCase();

}


/*************************************************
 * TELEFONE
 *************************************************/

function normalizePhone_(
  value
) {

  return clean_(
    value
  ).replace(
    /\D/g,
    ''
  );

}


/*************************************************
 * ARREDONDAMENTO
 *************************************************/

function round2_(
  n
) {

  return Math.round(
    (
      Number(n) +
      Number.EPSILON
    ) * 100
  ) / 100;

}


/*************************************************
 * JSON
 *************************************************/

function json_(
  obj
) {

  return ContentService

    .createTextOutput(
      JSON.stringify(
        obj
      )
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/*************************************************
 * JSON DE ERRO
 *************************************************/

function jsonError_(
  err
) {

  return json_({

    ok: false,

    error:
      err &&
      err.message
        ? err.message
        : String(err)

  });

}


/*************************************************
 * PAINEL OPERACIONAL DOOX
 *************************************************/

function getPainelPedidos(filtro) {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, SHEETS.PEDIDOS.name);
  const map = headerMap_(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, orders: [], total: 0 };
  const values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  const q = String(filtro || '').trim().toLowerCase();
  const orders = values.map((v, i) => ({
    row: i + 2,
    code: String(v[map['Código DOOX'] - 1] || ''),
    name: String(v[map['Nome / Empresa'] - 1] || ''),
    type: String(v[map['Tipo'] - 1] || ''),
    whatsapp: String(v[map['WhatsApp'] - 1] || ''),
    modality: String(v[map['Modalidade'] - 1] || ''),
    moment: String(v[map['Momento desejado'] - 1] || ''),
    tier: String(v[map['Faixa comercial'] - 1] || ''),
    total: Number(v[map['Valor total'] - 1] || 0),
    quantity: Number(v[map['Quantidade'] - 1] || 0),
    status: String(v[map['Status'] - 1] || ''),
    paymentStatus: (function(){ const p = getPaymentRecord_(ss, String(v[map['Código DOOX'] - 1] || '')); return p ? p.status : ''; })(),
    updatedAt: v[map['Atualizado em'] - 1] || '',
    observation: String(v[map['Observações'] - 1] || ''),
    observationClient: map['Observação Cliente'] ? String(v[map['Observação Cliente'] - 1] || '') : '',
    nextAction: nextActionForStatus_(String(v[map['Status'] - 1] || '').trim().toUpperCase())
  })).filter(o => !q || (o.code + ' ' + o.name + ' ' + o.whatsapp + ' ' + o.modality + ' ' + o.status).toLowerCase().indexOf(q) >= 0);
  orders.reverse();
  return { ok: true, orders: orders.slice(0, 100), total: orders.length };
}

function abrirPainelDOOX() {
  const html = HtmlService.createHtmlOutput(`
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#fff;color:#171717}
.top{display:flex;gap:8px}.top input{flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:12px}.top button{border:0;border-radius:12px;padding:10px 12px;font-weight:800;cursor:pointer;background:#ff6900;color:#111}
.table{margin-top:14px;border:1px solid #e6e6e6;border-radius:14px;overflow:auto}.row{display:grid;grid-template-columns:140px 1.4fr 1fr 130px 1fr;min-width:780px;border-top:1px solid #eee}.row:first-child{border-top:0}.cell{padding:10px 12px;font-size:12px}.head{font-weight:900;background:#111;color:#fff}.pill{font-weight:800}.small{font-size:11px;color:#777;margin-top:8px}
</style></head><body><div class="top"><input id="q" placeholder="Buscar código, cliente, telefone..."><button onclick="load()">ATUALIZAR</button></div><div class="small">Painel somente para consulta. A alteração operacional é feita na lista Status da aba PAGAMENTO.</div><div id="box" class="table"><div class="row head"><div class="cell">CÓDIGO</div><div class="cell">CLIENTE</div><div class="cell">MODALIDADE</div><div class="cell">PAGAMENTO</div><div class="cell">STATUS</div></div></div><script>
function esc(s){return String(s||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;'}[m]||m))}
function load(){google.script.run.withSuccessHandler(render).withFailureHandler(err=>alert(err.message||err)).getPainelPedidos(document.getElementById('q').value)}
function render(r){const b=document.getElementById('box');const head=b.firstElementChild;if(!r.orders||!r.orders.length){b.innerHTML='';b.appendChild(head);const e=document.createElement('div');e.className='cell';e.textContent='Nenhum pedido encontrado.';b.appendChild(e);return;}b.innerHTML='';b.appendChild(head);r.orders.forEach(o=>{const row=document.createElement('div');row.className='row';row.innerHTML='<div class="cell">'+esc(o.code)+'</div><div class="cell">'+esc(o.name)+'</div><div class="cell">'+esc(o.modality)+'</div><div class="cell">'+esc(o.paymentStatus||'—')+'</div><div class="cell pill">'+esc(o.status)+'</div>';b.appendChild(row);})}
load();setInterval(load,5000);
</script></body></html>`).setTitle('Painel DOOX');
  SpreadsheetApp.getUi().showSidebar(html);
}

/*************************************************
 * MENU NA PLANILHA
 *************************************************/

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('DOOX')
      .addItem('Abrir painel de consulta', 'abrirPainelDOOX')
      .addItem('Preparar / corrigir estrutura', 'setupMVP')
      .addItem('Verificar sistema', 'testarSistema')
      .addItem('Fechar mês e arquivar', 'fecharMesEArquivar')
      .addToUi();
  } catch (_) {}
}