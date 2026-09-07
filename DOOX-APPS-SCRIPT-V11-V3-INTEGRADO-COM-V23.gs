/*****
 * DOOX / HOCCO — Apps Script — MVP OPERACIONAL
 *
 * OBJETIVO
 * - Usar a planilha EXISTENTE.
 * - Manter o contrato do Web App usado pelo site V20.
 * - Substituir a estrutura operacional antiga por 5 abas simples.
 * - Receber pedidos do site via doPost().
 * - Guardar Observações corretamente.
 * - Calcular preço no servidor.
 * - Gerar Código DOOX.
 * - Controlar pedidos, pagamentos, clientes, episódios e veiculações.
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

  // No fechamento mensal, limpa também CLIENTES.
  // true = tudo do ciclo é arquivado e a operação começa limpa.
  RESET_CLIENTES_MENSAL: true,

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
  PIX_TXID: '***'
};

/*************************************************
 * ESTRUTURA DAS ABAS
 *************************************************/

const SHEETS = {

  PEDIDOS: {
    name: 'PEDIDOS',
    headers: [
      'Código DOOX',
      'Data/Hora',
      'Nome / Empresa',
      'Tipo',
      'WhatsApp',
      'E-mail',
      '@ / Perfil / Site',
      'Modalidade',
      'Episódio',
      'Momento desejado',
      'Faixa comercial',
      'Valor unitário',
      'Quantidade',
      'Valor total',
      'Status',
      'Termos',
      'Regras',
      'Observações',
      'Criado em',
      'Atualizado em',
      'Reserva',
      'Client Request ID',
      'Token de Acompanhamento',
      'Última Notificação'
    ]
  },

  PAGAMENTOS: {
    name: 'PAGAMENTOS',
    headers: [
      'Código DOOX',
      'Data/Hora',
      'Nome / Empresa',
      'Valor devido',
      'Forma de pagamento',
      'Status',
      'Data pagamento',
      'Observação',
      'Atualizado em'
    ]
  },

  CLIENTES: {
    name: 'CLIENTES',
    headers: [
      'ID Cliente',
      'Nome / Empresa',
      'Tipo',
      'WhatsApp',
      'E-mail',
      '@ / Perfil / Site',
      'Primeiro pedido em',
      'Último pedido em',
      'Total de pedidos',
      'Atualizado em'
    ]
  },

  EPISODIOS: {
    name: 'EPISÓDIOS',
    headers: [
      'Código Episódio',
      'Número',
      'Data prevista',
      'Status',

      'Capacidade Rodapé',
      'Ocupado Rodapé',
      'Vagas Rodapé',

      'Capacidade Sponsor Overlay',
      'Ocupado Sponsor Overlay',
      'Vagas Sponsor Overlay',

      'Capacidade Overlay + Áudio',
      'Ocupado Overlay + Áudio',
      'Vagas Overlay + Áudio',

      'Capacidade Apoiador Individual',
      'Ocupado Apoiador Individual',
      'Vagas Apoiador Individual',

      'Capacidade Empresa Patrocinadora',
      'Ocupado Empresa Patrocinadora',
      'Vagas Empresa Patrocinadora',

      'Observação',
      'Atualizado em'
    ]
  },

  VEICULACOES: {
    name: 'VEICULAÇÕES',
    headers: [
      'Código DOOX',
      'Episódio',
      'Nome / Empresa',
      'Modalidade',
      'Momento efetivo',
      'Status',
      'Data publicação',
      'Observação',
      'Atualizado em'
    ]
  }
};


/*************************************************
 * WEB APP
 * CONTRATO COMPATÍVEL COM O SITE V20
 *************************************************/

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
        version: 'MVP-2026',
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
          'informarPagamento'
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
  setupMVP_(ss);
  const pedido = findPedidoByTrackingToken_(ss, token);
  if (!pedido) throw new Error('Pedido não encontrado ou token inválido.');
  const status = String(pedido.status || '').toUpperCase();
  if (status !== 'AGUARDANDO PAGAMENTO') {
    return { ok: true, code: pedido.code, status: status, message: 'O pagamento ainda não está disponível para este pedido.' };
  }
  const sheet = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const found = findRowByFirstColumn_(sheet, pedido.code);
  if (!found) throw new Error('Registro financeiro não encontrado.');
  const map = headerMap_(sheet);
  sheet.getRange(found.row, map['Status']).setValue('PAGAMENTO INFORMADO');
  sheet.getRange(found.row, map['Observação']).setValue('Cliente informou pagamento pelo portal. Aguardando conferência manual.');
  sheet.getRange(found.row, map['Atualizado em']).setValue(new Date());
  return { ok: true, code: pedido.code, status: 'AGUARDANDO PAGAMENTO', paymentReported: true, message: 'Pagamento informado. A DOOX fará a conferência.' };
}


function registerRequest_(raw) {

  const ss = getSpreadsheet_();

  // Garante estrutura mínima sem apagar nada.
  setupMVP_(ss);


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


  // CLIENTE
  const clientId =
    upsertClient_(
      ss,
      r
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

  const newRow =
    pedidoSheet.getLastRow();


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


  pagamentoSheet.appendRow([

    code,

    now,

    r.nameOrCompany,

    price.total,

    '',

    'AGUARDANDO PAGAMENTO',

    '',

    '',

    now

  ]);


  updateClientOrderStats_(
    ss,
    clientId,
    now
  );


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

    clientId: clientId,

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
      return { row: i + 2, status: String(vals[i][5] || ''), updatedAt: vals[i][8] || '' };
    }
  }
  return null;
}

function buildPublicPayment_(ss, pedido) {
  const status = String(pedido.status || '').toUpperCase();
  const payment = getPaymentRecord_(ss, pedido.code);
  const result = {
    available: status === 'AGUARDANDO PAGAMENTO',
    status: payment ? payment.status : '',
    amount: null,
    amountLabel: '',
    pixKey: CONFIG.PIX_KEY,
    pixPayload: '',
    orderCode: pedido.code
  };
  if (status !== 'AGUARDANDO PAGAMENTO') return result;

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
 * CLIENTES
 *************************************************/

function upsertClient_(
  ss,
  r
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.CLIENTES.name
    );


  const map =
    headerMap_(
      sheet
    );


  const lastRow =
    sheet.getLastRow();


  let foundRow =
    0;


  if (lastRow >= 2) {

    const values =
      sheet.getRange(
        2,
        1,
        lastRow - 1,
        sheet.getLastColumn()
      ).getValues();


    const wa =
      normalizePhone_(
        r.whatsapp
      );


    const email =
      normalizeEmail_(
        r.email
      );


    for (
      let i = 0;
      i < values.length;
      i++
    ) {

      const row =
        values[i];


      const rowWa =
        normalizePhone_(
          String(
            row[
              map['WhatsApp'] - 1
            ] || ''
          )
        );


      const rowEmail =
        normalizeEmail_(
          String(
            row[
              map['E-mail'] - 1
            ] || ''
          )
        );


      if (

        (
          wa &&
          rowWa &&
          wa === rowWa
        )

        ||

        (
          email &&
          rowEmail &&
          email === rowEmail
        )

      ) {

        foundRow =
          i + 2;

        break;

      }

    }

  }


  const now =
    new Date();


  if (foundRow) {

    const existing =
      sheet.getRange(
        foundRow,
        1,
        1,
        sheet.getLastColumn()
      ).getValues()[0];


    if (
      !existing[
        map['Nome / Empresa'] - 1
      ]
    ) {

      sheet.getRange(
        foundRow,
        map['Nome / Empresa']
      ).setValue(
        r.nameOrCompany
      );

    }


    sheet.getRange(
      foundRow,
      map['Tipo']
    ).setValue(
      r.type
    );


    sheet.getRange(
      foundRow,
      map['WhatsApp']
    ).setValue(
      r.whatsapp
    );


    if (r.email) {

      sheet.getRange(
        foundRow,
        map['E-mail']
      ).setValue(
        r.email
      );

    }


    if (r.profile) {

      sheet.getRange(
        foundRow,
        map['@ / Perfil / Site']
      ).setValue(
        r.profile
      );

    }


    sheet.getRange(
      foundRow,
      map['Último pedido em']
    ).setValue(
      now
    );


    sheet.getRange(
      foundRow,
      map['Atualizado em']
    ).setValue(
      now
    );


    return String(
      existing[
        map['ID Cliente'] - 1
      ]
    );

  }


  const id =
    nextClientCode_();


  const row = [

    id,

    r.nameOrCompany,

    r.type,

    r.whatsapp,

    r.email,

    r.profile,

    now,

    now,

    1,

    now

  ];


  sheet.appendRow(
    row
  );


  return id;

}


function updateClientOrderStats_(
  ss,
  clientId,
  now
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.CLIENTES.name
    );


  const map =
    headerMap_(
      sheet
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {
    return;
  }


  const ids =
    sheet.getRange(
      2,
      map['ID Cliente'],
      lastRow - 1,
      1
    ).getValues();


  for (
    let i = 0;
    i < ids.length;
    i++
  ) {

    if (
      String(
        ids[i][0]
      ) ===
      String(clientId)
    ) {

      const row =
        i + 2;


      const countCell =
        sheet.getRange(
          row,
          map['Total de pedidos']
        );


      const current =
        Number(
          countCell.getValue() || 0
        );


      countCell.setValue(
        current + 1
      );


      sheet.getRange(
        row,
        map['Último pedido em']
      ).setValue(
        now
      );


      sheet.getRange(
        row,
        map['Atualizado em']
      ).setValue(
        now
      );


      return;

    }

  }

}


/*************************************************
 * CÓDIGOS
 *************************************************/

function nextOrderCode_() {

  const props =
    PropertiesService
      .getScriptProperties();


  let seq =
    Number(
      props.getProperty(
        'DOOX_ORDER_SEQ'
      ) || 0
    ) + 1;


  props.setProperty(
    'DOOX_ORDER_SEQ',
    String(seq)
  );


  const yy =
    Utilities.formatDate(
      new Date(),
      CONFIG.TIMEZONE,
      'yy'
    );


  return (
    'DOOX-' +
    yy +
    '-' +
    String(seq).padStart(
      4,
      '0'
    )
  );

}


function nextClientCode_() {

  const props =
    PropertiesService
      .getScriptProperties();


  let seq =
    Number(
      props.getProperty(
        'DOOX_CLIENT_SEQ'
      ) || 0
    ) + 1;


  props.setProperty(
    'DOOX_CLIENT_SEQ',
    String(seq)
  );


  return (
    'CLI-' +
    String(seq).padStart(
      4,
      '0'
    )
  );

}


function nextEpisodeCode_() {

  const props =
    PropertiesService
      .getScriptProperties();


  let seq =
    Number(
      props.getProperty(
        'DOOX_EPISODE_SEQ'
      ) || 0
    ) + 1;


  props.setProperty(
    'DOOX_EPISODE_SEQ',
    String(seq)
  );


  return (
    'EP' +
    String(seq).padStart(
      2,
      '0'
    )
  );

}


/*************************************************
 * EPISÓDIOS
 *************************************************/

function createEpisode_(
  ss,
  dateValue
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  const code =
    nextEpisodeCode_();


  const number =
    Number(
      code.replace(
        /^EP/i,
        ''
      )
    );


  const date =
    dateValue ||
    new Date();


  const row = [

    code,

    number,

    date,

    'ABERTO',

    // RODAPÉ
    50,
    0,
    50,

    // SPONSOR OVERLAY
    10,
    0,
    10,

    // OVERLAY + ÁUDIO
    10,
    0,
    10,

    // APOIADOR
    50,
    0,
    50,

    // EMPRESA PATROCINADORA
    1,
    0,
    1,

    '',

    new Date()

  ];


  sheet.appendRow(
    row
  );


  formatDataRows_(
    sheet
  );


  return code;

}


/*************************************************
 * PRIMEIRO EPISÓDIO
 *************************************************/

function setupPrimeiroEpisodio_() {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


  const sheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  if (
    sheet.getLastRow() < 2
  ) {

    return createEpisode_(
      ss,
      new Date()
    );

  }


  return String(
    sheet
      .getRange(
        2,
        1
      )
      .getValue()
      ||
      createEpisode_(
        ss,
        new Date()
      )
  );

}


/*************************************************
 * RESERVA
 *************************************************/

function reserveOrder_(
  code
) {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


  const pedido =
    findPedidoByCode_(
      ss,
      code
    );


  if (!pedido) {

    throw new Error(
      'Pedido não encontrado: ' +
      code
    );

  }


  if (

    pedido.reserva ===
    'RESERVADO'

    ||

    pedido.reserva ===
    'CONFIRMADO'

  ) {

    return {

      ok: true,

      code: code,

      message:
        'Pedido já possui reserva.',

      episode:
        pedido.episode

    };

  }


  const episodeCode =
    findEpisodeForReservation_(
      ss,
      pedido.modality,
      pedido.quantity
    );


  allocateEpisode_(
    ss,
    episodeCode,
    pedido.modality,
    pedido.quantity
  );


  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const map =
    headerMap_(
      sheet
    );


  sheet.getRange(
    pedido.row,
    map['Episódio']
  ).setValue(
    episodeCode
  );


  sheet.getRange(
    pedido.row,
    map['Reserva']
  ).setValue(
    'RESERVADO'
  );


  sheet.getRange(
    pedido.row,
    map['Status']
  ).setValue(
    'AGUARDANDO PAGAMENTO'
  );


  sheet.getRange(
    pedido.row,
    map['Atualizado em']
  ).setValue(
    new Date()
  );


  return {

    ok: true,

    code: code,

    episode:
      episodeCode,

    reservation:
      'RESERVADO'

  };

}


function releaseOrderReservation_(
  code,
  newStatus
) {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


  const pedido =
    findPedidoByCode_(
      ss,
      code
    );


  if (!pedido) {

    throw new Error(
      'Pedido não encontrado: ' +
      code
    );

  }


  if (

    pedido.episode

    &&

    (
      pedido.reserva ===
      'RESERVADO'

      ||

      pedido.reserva ===
      'CONFIRMADO'
    )

  ) {

    deallocateEpisode_(
      ss,
      pedido.episode,
      pedido.modality,
      pedido.quantity
    );

  }


  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const map =
    headerMap_(
      sheet
    );


  sheet.getRange(
    pedido.row,
    map['Episódio']
  ).setValue(
    ''
  );


  sheet.getRange(
    pedido.row,
    map['Reserva']
  ).setValue(
    'CANCELADO'
  );


  sheet.getRange(
    pedido.row,
    map['Status']
  ).setValue(
    newStatus ||
    'CANCELADO'
  );


  sheet.getRange(
    pedido.row,
    map['Atualizado em']
  ).setValue(
    new Date()
  );


  return {

    ok: true,

    code: code,

    reservation:
      'CANCELADO'

  };

}


/*************************************************
 * CONFIRMAR RESERVA
 *************************************************/

function confirmarReserva(
  codigo
) {

  const result =
    reserveOrder_(
      codigo
    );


  const ss =
    getSpreadsheet_();


  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const map =
    headerMap_(
      sheet
    );


  const pedido =
    findPedidoByCode_(
      ss,
      codigo
    );


  if (pedido) {

    sheet.getRange(
      pedido.row,
      map['Reserva']
    ).setValue(
      'CONFIRMADO'
    );


    sheet.getRange(
      pedido.row,
      map['Atualizado em']
    ).setValue(
      new Date()
    );

  }


  return result;

}


/*************************************************
 * CANCELAR RESERVA
 *************************************************/

function cancelarReserva(
  codigo
) {

  return releaseOrderReservation_(
    codigo,
    'CANCELADO'
  );

}


/*************************************************
 * LOCALIZAR EPISÓDIO COM VAGA
 *************************************************/

function findEpisodeForReservation_(
  ss,
  modality,
  quantity
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  const rows =
    getDataRows_(
      sheet
    );


  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i];


    const status =
      String(
        row[3] || ''
      ).toUpperCase();


    if (
      status !== 'ABERTO'
    ) {
      continue;
    }


    const available =
      getEpisodeAvailabilityFromRow_(
        row,
        modality
      );


    if (
      available >= quantity
    ) {

      return String(
        row[0]
      );

    }

  }


  // Não encontrou episódio com vaga suficiente.
  // Cria o próximo episódio.
  return createEpisode_(
    ss,
    new Date()
  );

}


/*************************************************
 * OCUPAR VAGA
 *************************************************/

function allocateEpisode_(
  ss,
  episodeCode,
  modality,
  quantity
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  const found =
    findRowByFirstColumn_(
      sheet,
      episodeCode
    );


  if (!found) {

    throw new Error(
      'Episódio não encontrado: ' +
      episodeCode
    );

  }


  const row =
    found.row;


  const map =
    headerMap_(
      sheet
    );


  const occupiedHeader =
    occupiedHeaderForModality_(
      modality
    );


  const capacityHeader =
    capacityHeaderForModality_(
      modality
    );


  const availableHeader =
    availableHeaderForModality_(
      modality
    );


  const capacity =
    Number(
      sheet
        .getRange(
          row,
          map[capacityHeader]
        )
        .getValue() || 0
    );


  const occupied =
    Number(
      sheet
        .getRange(
          row,
          map[occupiedHeader]
        )
        .getValue() || 0
    );


  const available =
    capacity -
    occupied;


  if (
    available < quantity
  ) {

    throw new Error(

      'Não há vagas suficientes no episódio ' +
      episodeCode +
      ' para ' +
      modality +
      '.'

    );

  }


  const newOccupied =
    occupied +
    quantity;


  sheet
    .getRange(
      row,
      map[occupiedHeader]
    )
    .setValue(
      newOccupied
    );


  sheet
    .getRange(
      row,
      map[availableHeader]
    )
    .setValue(
      Math.max(
        0,
        capacity -
        newOccupied
      )
    );


  sheet
    .getRange(
      row,
      map['Atualizado em']
    )
    .setValue(
      new Date()
    );


  updateEpisodeStatus_(
    sheet,
    row
  );

}


/*************************************************
 * LIBERAR VAGA
 *************************************************/

function deallocateEpisode_(
  ss,
  episodeCode,
  modality,
  quantity
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.EPISODIOS.name
    );


  const found =
    findRowByFirstColumn_(
      sheet,
      episodeCode
    );


  if (!found) {
    return;
  }


  const row =
    found.row;


  const map =
    headerMap_(
      sheet
    );


  const occupiedHeader =
    occupiedHeaderForModality_(
      modality
    );


  const capacityHeader =
    capacityHeaderForModality_(
      modality
    );


  const availableHeader =
    availableHeaderForModality_(
      modality
    );


  const capacity =
    Number(
      sheet
        .getRange(
          row,
          map[capacityHeader]
        )
        .getValue() || 0
    );


  const occupied =
    Number(
      sheet
        .getRange(
          row,
          map[occupiedHeader]
        )
        .getValue() || 0
    );


  const newOccupied =
    Math.max(
      0,
      occupied -
      quantity
    );


  sheet
    .getRange(
      row,
      map[occupiedHeader]
    )
    .setValue(
      newOccupied
    );


  sheet
    .getRange(
      row,
      map[availableHeader]
    )
    .setValue(
      Math.max(
        0,
        capacity -
        newOccupied
      )
    );


  sheet
    .getRange(
      row,
      map['Atualizado em']
    )
    .setValue(
      new Date()
    );


  updateEpisodeStatus_(
    sheet,
    row
  );

}


/*************************************************
 * STATUS DO EPISÓDIO
 *************************************************/

function updateEpisodeStatus_(
  sheet,
  row
) {

  const map =
    headerMap_(
      sheet
    );


  const headers = [

    [
      'Capacidade Rodapé',
      'Ocupado Rodapé'
    ],

    [
      'Capacidade Sponsor Overlay',
      'Ocupado Sponsor Overlay'
    ],

    [
      'Capacidade Overlay + Áudio',
      'Ocupado Overlay + Áudio'
    ],

    [
      'Capacidade Apoiador Individual',
      'Ocupado Apoiador Individual'
    ],

    [
      'Capacidade Empresa Patrocinadora',
      'Ocupado Empresa Patrocinadora'
    ]

  ];


  const allFull =
    headers.every(
      ([cap, occ]) => {

        const c =
          Number(
            sheet
              .getRange(
                row,
                map[cap]
              )
              .getValue() || 0
          );


        const o =
          Number(
            sheet
              .getRange(
                row,
                map[occ]
              )
              .getValue() || 0
          );


        return o >= c;

      }
    );


  sheet
    .getRange(
      row,
      map['Status']
    )
    .setValue(
      allFull
        ? 'ENCERRADO'
        : 'ABERTO'
    );

}


/*************************************************
 * DISPONIBILIDADE DO EPISÓDIO
 *************************************************/

function getEpisodeAvailabilityFromRow_(
  row,
  modality
) {

  const indexByMod = {

    'Presença no Rodapé':
      [4, 5],

    'Sponsor Overlay':
      [7, 8],

    'Overlay + Áudio':
      [10, 11],

    'Apoiador Individual':
      [13, 14],

    'Empresa Patrocinadora do Episódio':
      [16, 17]

  };


  const pair =
    indexByMod[
      modality
    ];


  if (!pair) {
    return 0;
  }


  return Math.max(

    0,

    Number(
      row[pair[0]] || 0
    ) -

    Number(
      row[pair[1]] || 0
    )

  );

}


/*************************************************
 * CABEÇALHO — CAPACIDADE
 *************************************************/

function capacityHeaderForModality_(
  modality
) {

  const map = {

    'Presença no Rodapé':
      'Capacidade Rodapé',

    'Sponsor Overlay':
      'Capacidade Sponsor Overlay',

    'Overlay + Áudio':
      'Capacidade Overlay + Áudio',

    'Apoiador Individual':
      'Capacidade Apoiador Individual',

    'Empresa Patrocinadora do Episódio':
      'Capacidade Empresa Patrocinadora'

  };


  return (
    map[modality] ||
    ''
  );

}


/*************************************************
 * CABEÇALHO — OCUPADO
 *************************************************/

function occupiedHeaderForModality_(
  modality
) {

  const map = {

    'Presença no Rodapé':
      'Ocupado Rodapé',

    'Sponsor Overlay':
      'Ocupado Sponsor Overlay',

    'Overlay + Áudio':
      'Ocupado Overlay + Áudio',

    'Apoiador Individual':
      'Ocupado Apoiador Individual',

    'Empresa Patrocinadora do Episódio':
      'Ocupado Empresa Patrocinadora'

  };


  return (
    map[modality] ||
    ''
  );

}


/*************************************************
 * CABEÇALHO — VAGAS
 *************************************************/

function availableHeaderForModality_(
  modality
) {

  const map = {

    'Presença no Rodapé':
      'Vagas Rodapé',

    'Sponsor Overlay':
      'Vagas Sponsor Overlay',

    'Overlay + Áudio':
      'Vagas Overlay + Áudio',

    'Apoiador Individual':
      'Vagas Apoiador Individual',

    'Empresa Patrocinadora do Episódio':
      'Vagas Empresa Patrocinadora'

  };


  return (
    map[modality] ||
    ''
  );

}


/*************************************************
 * PAGAMENTOS
 *************************************************/

function atualizarPagamento(
  codigo,
  status,
  formaPagamento,
  observacao
) {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


  const sheet =
    getSheet_(
      ss,
      SHEETS.PAGAMENTOS.name
    );


  const found =
    findRowByFirstColumn_(
      sheet,
      codigo
    );


  if (!found) {

    throw new Error(
      'Pagamento não encontrado para o código: ' +
      codigo
    );

  }


  const map =
    headerMap_(
      sheet
    );


  const row =
    found.row;


  const normalizedStatus =
    String(
      status || ''
    )
      .trim()
      .toUpperCase();


  sheet
    .getRange(
      row,
      map['Forma de pagamento']
    )
    .setValue(
      formaPagamento ||
      ''
    );


  sheet
    .getRange(
      row,
      map['Status']
    )
    .setValue(
      normalizedStatus ||
      'AGUARDANDO PAGAMENTO'
    );


  sheet
    .getRange(
      row,
      map['Observação']
    )
    .setValue(
      observacao ||
      ''
    );


  sheet
    .getRange(
      row,
      map['Atualizado em']
    )
    .setValue(
      new Date()
    );


  if (
    normalizedStatus ===
    'PAGO'
  ) {

    sheet
      .getRange(
        row,
        map['Data pagamento']
      )
      .setValue(
        new Date()
      );


    atualizarStatusPedido_(
      ss,
      codigo,
      'PAGAMENTO RECEBIDO'
    );

  }


  return {

    ok: true,

    code: codigo,

    paymentStatus:
      normalizedStatus

  };

}


/*************************************************
 * STATUS DO PEDIDO
 *************************************************/

function atualizarStatusPedido_(
  ss,
  codigo,
  status
) {

  const sheet =
    getSheet_(
      ss,
      SHEETS.PEDIDOS.name
    );


  const found =
    findRowByFirstColumn_(
      sheet,
      codigo
    );


  if (!found) {

    throw new Error(
      'Pedido não encontrado: ' +
      codigo
    );

  }


  const map =
    headerMap_(
      sheet
    );


  const normalized =
    String(
      status || ''
    )
      .trim()
      .toUpperCase();


  sheet
    .getRange(
      found.row,
      map['Status']
    )
    .setValue(
      normalized
    );


  const updatedAt = new Date();

  sheet
    .getRange(
      found.row,
      map['Atualizado em']
    )
    .setValue(
      updatedAt
    );

  // Marca a mudança para a futura camada de notificações.
  // Não envia WhatsApp/e-mail nesta primeira etapa.
  if (map['Última Notificação']) {
    sheet
      .getRange(
        found.row,
        map['Última Notificação']
      )
      .setValue(
        updatedAt
      );
  }


  return {

    ok: true,

    code: codigo,

    status: normalized

  };

}


/*************************************************
 * FUNÇÃO MANUAL — ATUALIZAR STATUS
 *************************************************/

function atualizarStatus(
  codigo,
  status
) {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


  return atualizarStatusPedido_(
    ss,
    codigo,
    status
  );

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


  setupMVP_(
    ss
  );


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


function setupMVP_(
  ss
) {

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


      formatSheet_(
        sheet,
        def.headers
      );


      names.push(
        def.name
      );

    }
  );


  // Cria episódio somente se a aba estiver vazia.
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


  setupMVP_(
    ss
  );


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

  clearOperationalData_(
    ss,
    CONFIG.RESET_CLIENTES_MENSAL
  );


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

function clearOperationalData_(
  ss,
  resetClients
) {

  const names = [

    SHEETS.PEDIDOS.name,

    SHEETS.PAGAMENTOS.name,

    SHEETS.EPISODIOS.name,

    SHEETS.VEICULACOES.name

  ];


  if (resetClients) {

    names.push(
      SHEETS.CLIENTES.name
    );

  }


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
 * TESTE DO SISTEMA
 *************************************************/

function testarSistema() {

  const ss =
    getSpreadsheet_();


  setupMVP_(
    ss
  );


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

  // 1. Consulta pública enquanto SOLICITADO.
  const antes = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('2) ACOMPANHAMENTO — antes de liberar pagamento:');
  Logger.log(JSON.stringify(antes, null, 2));

  if (!antes.ok) throw new Error('Falha na consulta inicial do acompanhamento.');
  if (antes.status !== 'SOLICITADO') {
    throw new Error('Status inicial inesperado: ' + antes.status);
  }
  if (antes.payment.available !== false) {
    throw new Error('Pagamento não deveria estar disponível em SOLICITADO.');
  }

  // 2. Operador libera o pagamento.
  const liberado = atualizarStatusPedido_(
    ss,
    pedido.code,
    'AGUARDANDO PAGAMENTO'
  );
  Logger.log('3) STATUS ALTERADO PARA AGUARDANDO PAGAMENTO:');
  Logger.log(JSON.stringify(liberado, null, 2));

  // 3. Consulta pública deve trazer valor + Pix.
  const depoisLiberacao = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('4) ACOMPANHAMENTO — pagamento liberado:');
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
  Logger.log('5) CLIENTE INFORMOU PAGAMENTO:');
  Logger.log(JSON.stringify(informado, null, 2));

  if (!informado.ok || informado.paymentReported !== true) {
    throw new Error('Falha ao registrar o aviso de pagamento.');
  }
  if (informado.status !== 'AGUARDANDO PAGAMENTO') {
    throw new Error('O aviso do cliente alterou indevidamente o status do pedido.');
  }

  // 5. Confirmação manual pelo operador.
  const confirmado = atualizarPagamento(
    pedido.code,
    'PAGAMENTO RECEBIDO',
    'PIX',
    'TESTE INTERNO V11 — pagamento confirmado manualmente.'
  );
  Logger.log('6) PAGAMENTO CONFIRMADO NO FINANCEIRO:');
  Logger.log(JSON.stringify(confirmado, null, 2));

  // 6. Atualiza o pedido para PAGAMENTO RECEBIDO.
  const statusFinal = atualizarStatusPedido_(
    ss,
    pedido.code,
    'PAGAMENTO RECEBIDO'
  );
  Logger.log('7) STATUS FINAL DO PEDIDO:');
  Logger.log(JSON.stringify(statusFinal, null, 2));

  // 7. Consulta final pública.
  const final = getPublicOrderStatus_(pedido.trackingToken);
  Logger.log('8) ACOMPANHAMENTO FINAL:');
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
  setupMVP_(ss);

  const pedidos = getSheet_(ss, SHEETS.PEDIDOS.name);
  const pagamentos = getSheet_(ss, SHEETS.PAGAMENTOS.name);
  const clientes = getSheet_(ss, SHEETS.CLIENTES.name);

  let pedidosRemovidos = 0;
  let pagamentosRemovidos = 0;
  let clientesRemovidos = 0;
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

  // CLIENTES criados exclusivamente pelo teste.
  if (clientes.getLastRow() >= 2) {
    const cm = headerMap_(clientes);
    const clientValues = clientes.getRange(2, 1, clientes.getLastRow() - 1, clientes.getLastColumn()).getValues();

    for (let i = clientValues.length - 1; i >= 0; i--) {
      const email = normalizeEmail_(clientValues[i][cm['E-mail'] - 1]);
      const name = String(clientValues[i][cm['Nome / Empresa'] - 1] || '');

      if (email === 'teste-v11@doox.local' || name === 'TESTE DOOX V11') {
        clientes.deleteRow(i + 2);
        clientesRemovidos++;
      }
    }
  }

  const result = {
    ok: true,
    pedidosRemovidos: pedidosRemovidos,
    pagamentosRemovidos: pagamentosRemovidos,
    clientesRemovidos: clientesRemovidos,
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
  setupMVP_(ss);

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
    steps: publicStatusSteps_(status),
    payment: buildPublicPayment_(ss, pedido)
  };

}


function publicStatusSteps_(currentStatus) {

  const flow = [
    ['SOLICITADO', 'Solicitação recebida'],
    ['EM ANÁLISE', 'Em análise'],
    ['AGUARDANDO PAGAMENTO', 'Aguardando pagamento'],
    ['PAGAMENTO RECEBIDO', 'Pagamento recebido'],
    ['MATERIAL PENDENTE', 'Material pendente'],
    ['MATERIAL RECEBIDO', 'Material recebido'],
    ['EM PRODUÇÃO', 'Em produção'],
    ['PROGRAMADO', 'Programado'],
    ['PUBLICADO', 'Veiculado'],
    ['FINALIZADO', 'Finalizado']
  ];

  const exceptional = [
    'REJEITADO',
    'CANCELADO',
    'ARQUIVADO'
  ];

  const currentIndex = flow.findIndex(
    item => item[0] === currentStatus
  );

  if (exceptional.indexOf(currentStatus) >= 0) {
    return flow.map(item => ({
      status: item[0],
      label: item[1],
      state: 'inactive'
    })).concat([{ 
      status: currentStatus,
      label: publicStatusLabel_(currentStatus),
      state: 'current'
    }]);
  }

  return flow.map((item, index) => ({
    status: item[0],
    label: item[1],
    state:
      index < currentIndex
        ? 'completed'
        : index === currentIndex
          ? 'current'
          : 'pending'
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
    'REJEITADO': 'Solicitação não aprovada',
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
        updatedAt: values[i][map['Atualizado em'] - 1] || ''
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

        row:
          row,

        code:
          String(
            values[i][
              map['Código DOOX'] - 1
            ] || ''
          ),

        order:
          values[i]

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


  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setFontWeight(
      'bold'
    );


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
 * MENU NA PLANILHA
 *************************************************/

function onOpen() {

  try {

    SpreadsheetApp
      .getUi()

      .createMenu(
        'DOOX MVP'
      )

      .addItem(
        'Preparar MVP',
        'setupMVP'
      )

      .addItem(
        'Testar sistema',
        'testarSistema'
      )

      .addItem(
        'Testar pedido V11',
        'TESTE_PEDIDO_V11'
      )

      .addItem(
        'Testar PIX V11',
        'TESTE_PIX_V11'
      )

      .addItem(
        'Limpar testes V11',
        'LIMPAR_TESTES_V11'
      )

      .addSeparator()

      .addItem(
        'Fechar mês e arquivar',
        'fecharMesEArquivar'
      )

      .addToUi();

  }

  catch (_) {

    // Pode ocorrer quando executado fora da interface da planilha.

  }

}