/**
 * ============================================================
 * DOOX / HOCCO — APPS SCRIPT V7.4 — CONTROLE FIEL AO SITE
 * BACKEND OPERACIONAL
 * ============================================================
 *
 * REGRAS:
 *
 * 1. Pedido público NÃO recebe episódio.
 * 2. Código público: DOOX-YY-####.
 * 3. Episódio será definido posteriormente pela produção.
 * 4. PEDIDOS é a entrada principal.
 * 5. CLIENTES é atualizado automaticamente.
 * 6. PAGAMENTOS começa como AGUARDANDO PAGAMENTO.
 * 7. Preço é calculado pelo servidor.
 * 8. O servidor consegue transformar um momento
 *    como 03:15 na faixa comercial correta.
 * 9. Os dados são gravados pelo NOME DO CABEÇALHO,
 *    evitando deslocamento de colunas.
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const CONFIG = {

  SPREADSHEET_ID:
    '1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB',

  TIMEZONE:
    'America/Sao_Paulo',

  RECEIPT_FOLDER:
    'DOOX — HOCCO — COMPROVANTES',

  ARCHIVE_FOLDER:
    'DOOX — HOCCO — ARQUIVO MENSAL',

  VERSION:
    'V9.0',

  SHEETS: {
    PAINEL: 'PAINEL',
    PEDIDOS: 'PEDIDOS',
    CLIENTES: 'CLIENTES',
    FINANCEIRO: 'FINANCEIRO',
    PRODUCAO: 'PRODUÇÃO',
    EPISODIOS: 'EPISÓDIOS',
    COMPROVANTES: 'COMPROVANTES'
  },

  PUBLIC_KEYS: [
    'name',
    'whatsapp',
    'email',
    'type',
    'modality',
    'moment',
    'quantity',
    'profile',
    'observation',
    'termsAccepted',
    'rulesAccepted'
  ],

  MODALITIES: [
    'Presença no Rodapé',
    'Sponsor Overlay',
    'Overlay + Áudio',
    'Empresa Patrocinadora do Episódio'
  ],

  STATES: [
    'SOLICITADO',
    'EM ANÁLISE',
    'AGUARDANDO PAGAMENTO',
    'PAGAMENTO RECEBIDO',
    'MATERIAL PENDENTE',
    'MATERIAL RECEBIDO',
    'EM PRODUÇÃO',
    'PROGRAMADO',
    'PUBLICADO',
    'FINALIZADO',
    'REJEITADO',
    'CANCELADO',
    'ARQUIVADO'
  ]

};


/* ============================================================
   GET
   ============================================================ */

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    if (action === 'testSpreadsheet') return out_(testSpreadsheet());
    if (action === 'contract') return out_(getPublicFormContract());
    if (action === 'downloadReceipt') return out_(downloadReceipt_(String((e.parameter && e.parameter.token) || '')));
    return out_({ ok: true, service: 'DOOX HOCCO', version: CONFIG.VERSION, timestamp: new Date().toISOString() });
  } catch (err) {
    return out_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}


/* ============================================================
   POST
   ============================================================ */

function doPost(e) {
  try {
    const raw = parse_(e) || {};
    const action = String(raw.action || 'registerRequest');
    if (action === 'testSpreadsheet') return out_(testSpreadsheet());
    if (action !== 'registerRequest') return out_({ ok: false, error: 'AÇÃO NÃO RECONHECIDA' });

    // Contrato estrito: somente os campos que existem no formulário público.
    const data = {};
    CONFIG.PUBLIC_KEYS.forEach(function(k) { data[k] = raw[k]; });
    return out_(registerRequest_(data));
  } catch (err) {
    return out_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}


/* ============================================================
   REGISTRAR PEDIDO
   ============================================================ */

function registerRequest_(data) {

  const lock =
    LockService.getScriptLock();

  if (
    !lock.tryLock(15000)
  ) {

    throw new Error(
      'Sistema ocupado. Tente novamente.'
    );

  }

  try {

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // O ciclo mensal é controlado pelo servidor, nunca pelo site.
    ensureMonthlyCycle_(ss);

    /*
     * Garante que as abas e cabeçalhos existam antes de escrever.
     */

    ensureStructure_(ss);


    /*
     * Normaliza os dados recebidos
     */

    const r =
      normalize_(data);


    /*
     * Valida
     */

    validate_(r);


    /* NUNCA aceitar episódio enviado pelo site. */
    r.episode = '';

    guardDuplicateRequest_(r);

    /*
     * Gera código:
     *
     * DOOX-26-0001
     */

    r.code =
      nextCode_(ss);


    r.createdAt =
      new Date();


    r.status =
      'SOLICITADO';


    /* --------------------------------------------------------
       1. CLIENTE
       --------------------------------------------------------
       O ID Cliente é permanente e é obtido antes de gravar
       o pedido, para que possa ser replicado nas demais abas.
    */

    r.clientId =
      upsertClient_(
        ss,
        r
      );


    /* --------------------------------------------------------
       2. PEDIDOS
       -------------------------------------------------------- */

    appendByHeaders_(
      ss.getSheetByName(CONFIG.SHEETS.PEDIDOS),
      {
        'Código DOOX': r.code,
        'ID Cliente': r.clientId,
        'Data/Hora': r.createdAt,
        'Cliente': r.name,
        'WhatsApp': r.phone,
        'E-mail': r.email,
        'Tipo': r.type,
        'Modalidade': r.mode,
        'Faixa / Preço': r.range ? (r.range + ' · ' + moneyBr_(r.unitPrice)) : ('Modalidade fixa · ' + moneyBr_(r.unitPrice)),
        'Momento Desejado': r.moment,
        'Quantidade': r.quantity,
        '@ / Perfil / Site': r.handle,
        'Termos': r.termsAccepted ? 'SIM' : 'NÃO',
        'Regras': r.rulesAccepted ? 'SIM' : 'NÃO',
        'Descrição / Observação': r.observation,
        'Valor Unitário': r.unitPrice,
        'Valor Total': r.total,
        'Status': r.status,
        'Episódio': '',
        'Criado em': r.createdAt,
        'Comprovante Solicitação': ''
      }
    );

    /* --------------------------------------------------------
       3. PAGAMENTOS
       -------------------------------------------------------- */

    /*
     * Isso NÃO significa que o cliente pagou.
     *
     * Apenas cria o controle financeiro
     * aguardando pagamento.
     */

    upsertPayment_(
      ss,
      r
    );


    /* --------------------------------------------------------
       4. COMPROVANTE INICIAL DA SOLICITAÇÃO
       --------------------------------------------------------
       É um comprovante de registro, NÃO é comprovante de
       pagamento nem de veiculação.
    */

    let receipt = {
      url: '',
      fileName: '',
      error: ''
    };

    try {

      receipt = createRequestReceipt_(ss, r);

      updateByHeaders_(ss.getSheetByName(CONFIG.SHEETS.PEDIDOS), ss.getSheetByName(CONFIG.SHEETS.PEDIDOS).getLastRow(), {
        'Comprovante Solicitação': receipt.fileName
      });

      appendByHeaders_(ss.getSheetByName(CONFIG.SHEETS.COMPROVANTES), {
        'Código DOOX': r.code,
        'ID Cliente': r.clientId,
        'Tipo': 'SOLICITAÇÃO',
        'Episódio': '',
        'Cliente': r.name,
        'Modalidade': r.mode,
        'Momento Solicitado': r.moment,
        'Faixa Contratada': r.range,
        'Quantidade': r.quantity,
        'Valor Unitário': r.unitPrice,
        'Valor Total': r.total,
        'Arquivo do Comprovante': receipt.fileName,
        'ID Arquivo': receipt.fileId,
        'Token': receipt.token,
        'Enviado ao Cliente': 'NÃO',
        'Data de Envio': '',
        'Status': 'GERADO',
        'Observações': 'Comprovante inicial de solicitação. Não representa pagamento ou publicação.'
      });
    }
    catch (receiptErr) {

      receipt.error =
        receiptErr.message ||
        String(receiptErr);

    }


    SpreadsheetApp.flush();


    /*
     * Resposta para o site
     */

    return {

      ok:
        true,

      registered:
        true,

      code:
        r.code,

      clientId:
        r.clientId,

      status:
        r.status,

      episode:
        '',

      paymentStatus:
        'AGUARDANDO PAGAMENTO',

      receiptUrl: receipt.token ? ('/api/receipt?token=' + encodeURIComponent(receipt.token)) : '',
      receiptFile: receipt.fileName,

      receiptError:
        receipt.error,

      message:
        'Solicitação registrada com sucesso.',

      timestamp:
        new Date().toISOString()

    };

  }

  finally {

    lock.releaseLock();

  }

}


/* ============================================================
   NORMALIZAÇÃO
   ============================================================ */

function moneyBr_(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}


function normalize_(d) {

  /*
   * CONTRATO PÚBLICO ÚNICO.
   * Somente os campos existentes no formulário do site entram aqui.
   * Preço/faixa são recalculados pelo servidor; nunca confiamos em preço vindo do navegador.
   */
  const mode = normalizeMode_(d.modality);
  const type = normalizeType_(d.type);
  const moment = clean_(d.moment);
  const range = rangeFromMomentOrLabel_(moment);
  const unit = price_(mode, range);
  const qty = Math.max(1, integer_(d.quantity) || 1);

  return {
    name: clean_(d.name),
    type: type,
    email: clean_(d.email).toLowerCase(),
    phone: phone_(d.whatsapp),
    handle: sanitizeHandle_(d.profile),
    mode: mode,
    moment: moment,
    range: range,
    quantity: qty,
    unitPrice: unit,
    total: round_(unit * qty),
    observation: clean_(d.observation),
    episode: '',
    termsAccepted: bool_(d.termsAccepted),
    rulesAccepted: bool_(d.rulesAccepted),
    clientId: ''
  };
}

function rangeFromMomentOrLabel_(moment) {
  const normalized = normalizeRange_(moment);
  if (isPricingRange_(normalized)) return normalized;
  return rangeFromMoment_(moment);
}


/* ============================================================
   VALIDAÇÃO
   ============================================================ */

function validate_(r) {

  if (!r.name) {

    throw new Error(
      'Nome ou empresa é obrigatório.'
    );

  }


  if (
    !r.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      r.email
    )
  ) {

    throw new Error(
      'E-mail inválido.'
    );

  }


  if (
    digits_(r.phone).length < 12
  ) {

    throw new Error(
      'WhatsApp inválido.'
    );

  }


  if (!r.mode) {

    throw new Error(
      'Modalidade não informada.'
    );

  }

  if (!['Empresa','Pessoa'].includes(r.type)) {
    throw new Error('Tipo deve ser Empresa ou Pessoa.');
  }

  if (!CONFIG.MODALITIES.includes(r.mode)) {
    throw new Error('Modalidade não disponível no formulário público.');
  }


  if (
    !r.unitPrice ||
    r.unitPrice <= 0
  ) {

    throw new Error(
      'Valor não pôde ser determinado.'
    );

  }


  if (
    !r.termsAccepted ||
    !r.rulesAccepted
  ) {

    throw new Error(
      'Termos e Regras precisam ser aceitos.'
    );

  }

}


/* ============================================================
   PREÇOS
   ============================================================ */

function price_(
  mode,
  range
) {

  /*
   * PRESENÇA NO RODAPÉ
   */

  if (
    mode ===
    'Presença no Rodapé'
  ) {

    return 49.90;

  }


  /*
   * APOIADOR INDIVIDUAL
   */

  /*
   * EMPRESA PATROCINADORA
   */

  if (
    mode ===
    'Empresa Patrocinadora do Episódio'
  ) {

    return 89.90;

  }


  /*
   * SPONSOR OVERLAY
   */

  const overlay = {

    '00:30–02:00':
      39.90,

    '02:00–04:00':
      49.90,

    '04:00–06:30':
      59.90,

    '06:30–09:00':
      69.90,

    '09:00–11:00':
      79.90

  };


  /*
   * SPONSOR OVERLAY + ÁUDIO
   */

  const overlayAudio = {

    '00:30–02:00':
      49.90,

    '02:00–04:00':
      59.90,

    '04:00–06:30':
      69.90,

    '06:30–09:00':
      79.90,

    '09:00–11:00':
      89.90

  };


  if (
    mode ===
    'Sponsor Overlay'
  ) {

    return (
      overlay[range] ||
      0
    );

  }


  if (
    mode ===
    'Overlay + Áudio'
  ) {

    return (
      overlayAudio[range] ||
      0
    );

  }


  return 0;

}


/* ============================================================
   MODALIDADE
   ============================================================ */

function normalizeMode_(v) {

  const x =
    clean_(v)
      .toLowerCase();


  const m = {

    'rodape':
      'Presença no Rodapé',

    'presenca no rodape':
      'Presença no Rodapé',

    'presença no rodapé':
      'Presença no Rodapé',


    'sponsor overlay':
      'Sponsor Overlay',

    'overlay':
      'Sponsor Overlay',


    'sponsor overlay + audio':
      'Overlay + Áudio',

    'sponsor overlay + áudio':
      'Overlay + Áudio',

    'overlay + audio':
      'Overlay + Áudio',

    'overlay + áudio':
      'Overlay + Áudio',



    'empresa patrocinadora do episodio':
      'Empresa Patrocinadora do Episódio',

    'empresa patrocinadora do episódio':
      'Empresa Patrocinadora do Episódio'

  };


  return (
    m[x] ||
    clean_(v)
  );

}


/* ============================================================
   FAIXA
   ============================================================ */

function normalizeRange_(v) {

  const x =
    clean_(v)
      .replace(
        /[–—-]/g,
        '–'
      )
      .replace(
        /\s+/g,
        ''
      );


  const m = {

    '00:30–02:00':
      '00:30–02:00',

    '00:30–2:00':
      '00:30–02:00',

    '02:00–04:00':
      '02:00–04:00',

    '04:00–06:30':
      '04:00–06:30',

    '06:30–09:00':
      '06:30–09:00',

    '09:00–11:00':
      '09:00–11:00'

  };


  return (
    m[x] ||
    clean_(v)
  );

}


/* ============================================================
   VERIFICAR FAIXA
   ============================================================ */

function isPricingRange_(v) {

  return [

    '00:30–02:00',

    '02:00–04:00',

    '04:00–06:30',

    '06:30–09:00',

    '09:00–11:00'

  ].includes(
    clean_(v)
  );

}


/* ============================================================
   CONVERTER MOMENTO EM FAIXA
   ============================================================ */

function rangeFromMoment_(
  moment
) {

  const text =
    clean_(moment)
      .replace(
        /\s+/g,
        ''
      );


  const parts =
    text
      .split(':')
      .map(Number);


  if (
    parts.some(
      n =>
        Number.isNaN(n) ||
        n < 0
    )
  ) {

    return '';

  }


  let seconds =
    null;


  /*
   * MM:SS
   */

  if (
    parts.length === 2
  ) {

    seconds =
      parts[0] * 60 +
      parts[1];

  }


  /*
   * MM
   */

  else if (
    parts.length === 1
  ) {

    seconds =
      parts[0] * 60;

  }


  /*
   * HH:MM:SS
   */

  else if (
    parts.length === 3
  ) {

    seconds =
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2];

  }


  if (
    seconds === null
  ) {

    return '';

  }


  if (
    seconds >= 30 &&
    seconds < 120
  ) {

    return '00:30–02:00';

  }


  if (
    seconds >= 120 &&
    seconds < 240
  ) {

    return '02:00–04:00';

  }


  if (
    seconds >= 240 &&
    seconds < 390
  ) {

    return '04:00–06:30';

  }


  if (
    seconds >= 390 &&
    seconds < 540
  ) {

    return '06:30–09:00';

  }


  if (
    seconds >= 540 &&
    seconds < 660
  ) {

    return '09:00–11:00';

  }


  return '';

}


/* ============================================================
   TIPO
   ============================================================ */

function normalizeType_(v) {

  const x =
    clean_(v)
      .toLowerCase();


  if (
    [
      'empresa',
      'company',
      'pj'
    ].includes(x)
  ) {

    return 'Empresa';

  }


  if (
    [
      'pessoa',
      'person',
      'pf'
    ].includes(x)
  ) {

    return 'Pessoa';

  }


  return clean_(v);

}


/* ============================================================
   GERAR CÓDIGO DOOX
   ============================================================ */

function guardDuplicateRequest_(r) {
  const raw=[r.name,r.email,r.phone,r.type,r.mode,r.moment,r.quantity,r.handle,r.observation].map(x=>clean_(x)).join('|');
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw);
  const fp=Utilities.base64EncodeWebSafe(digest);
  const cache=CacheService.getScriptCache();
  const key='REQ_'+fp.slice(0,80);
  if(cache.get(key)) throw new Error('Solicitação idêntica já recebida. Aguarde alguns minutos antes de reenviar.');
  cache.put(key,'1',600);
}


function nextCode_(ss) {
  const props=PropertiesService.getScriptProperties();
  const current=Number(props.getProperty('DOOX_ORDER_SEQ')||0)+1;
  props.setProperty('DOOX_ORDER_SEQ',String(current));
  const yy=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yy');
  return 'DOOX-'+yy+'-'+pad_(current,4);
}


/* ============================================================
   CLIENTES
   ============================================================ */

function upsertClient_(
  ss,
  r
) {

  const sh =
    ss.getSheetByName(
      CONFIG.SHEETS.CLIENTES
    );


  const h =
    headers_(sh);


  const pi =
    find_(
      h,
      [
        'WhatsApp',
        'Telefone',
        'Celular',
        'Telefone / WhatsApp'
      ]
    );


  const ei =
    find_(
      h,
      [
        'E-mail',
        'Email',
        'E-mail principal'
      ]
    );


  const idIndex =
    find_(
      h,
      [
        'ID Cliente',
        'Cliente ID',
        'ID'
      ]
    );


  let row =
    -1;


  if (
    sh.getLastRow() > 1
  ) {

    const all =
      sh
        .getDataRange()
        .getDisplayValues();


    for (
      let n = 1;
      n < all.length;
      n++
    ) {

      const p =
        pi >= 0
          ? digits_(
              all[n][pi]
            )
          : '';


      const e =
        ei >= 0
          ? clean_(
              all[n][ei]
            ).toLowerCase()
          : '';


      if (
        (
          p &&
          p === digits_(r.phone)
        ) ||
        (
          e &&
          e === r.email
        )
      ) {

        row =
          n + 1;

        break;

      }

    }

  }


  let clientId =
    '';


  if (
    row > 0 &&
    idIndex >= 0
  ) {

    clientId =
      clean_(
        sh
          .getRange(
            row,
            idIndex + 1
          )
          .getDisplayValue()
      );

  }


  if (!clientId) {

    clientId =
      nextClientId_(
        sh
      );

  }


  const payload = {
    'ID Cliente': clientId,
    'Cliente': r.name,
    'Tipo': r.type,
    'WhatsApp': r.phone,
    'E-mail': r.email,
    '@ / Perfil / Site': r.handle,
    'Primeiro Pedido': row > 0 ? (find_(h,['Primeiro Pedido']) >= 0 ? sh.getRange(row, find_(h,['Primeiro Pedido'])+1).getValue() : r.createdAt) : r.createdAt,
    'Último Pedido': r.createdAt,
    'Status': 'ATIVO',
    'Última Atualização': r.createdAt
  };


  if (row > 0) {

    updateByHeaders_(
      sh,
      row,
      payload
    );

  }

  else {

    appendByHeaders_(
      sh,
      payload
    );

  }


  return clientId;

}


/* ============================================================
   GERAR ID PERMANENTE DO CLIENTE
   ============================================================ */

function nextClientId_(sh) {
  const props=PropertiesService.getScriptProperties();
  const current=Number(props.getProperty('DOOX_CLIENT_SEQ')||0)+1;
  props.setProperty('DOOX_CLIENT_SEQ',String(current));
  return 'CLI-'+pad_(current,5);
}


/* ============================================================
   PAGAMENTOS
   ============================================================ */

function upsertPayment_(
  ss,
  r
) {

  const sh =
    ss.getSheetByName(
      CONFIG.SHEETS.FINANCEIRO
    );


  const h =
    headers_(sh);


  const ci =
    find_(
      h,
      [
        'Código DOOX',
        'Código',
        'Pedido',
        'Código do Pedido'
      ]
    );


  let row =
    -1;


  if (
    ci >= 0 &&
    sh.getLastRow() > 1
  ) {

    const v =
      sh
        .getRange(
          2,
          ci + 1,
          sh.getLastRow() - 1,
          1
        )
        .getDisplayValues();


    for (
      let i = 0;
      i < v.length;
      i++
    ) {

      if (
        clean_(
          v[i][0]
        ) === r.code
      ) {

        row =
          i + 2;

        break;

      }

    }

  }


  const payload = {
    'Código DOOX': r.code,
    'ID Cliente': r.clientId,
    'Cliente': r.name,
    'Modalidade': r.mode,
    'Quantidade': r.quantity,
    'Valor Unitário': r.unitPrice,
    'Valor Total': r.total,
    'Status': 'AGUARDANDO PAGAMENTO',
    'Data da Solicitação': r.createdAt,
    'Data do Pagamento': '',
    'Comprovante': '',
    'Observações': ''
  };


  if (row > 0) {

    updateByHeaders_(
      sh,
      row,
      payload
    );

  }

  else {

    appendByHeaders_(
      sh,
      payload
    );

  }

}


/* ============================================================
   CRIAR / GARANTIR ESTRUTURA
   ============================================================ */

function schema_() {
  const schema = {};
  schema[CONFIG.SHEETS.PAINEL] = ['Indicador','Valor','Atualizado em'];
  schema[CONFIG.SHEETS.PEDIDOS] = [
    'Código DOOX','ID Cliente','Data/Hora','Nome / Empresa','WhatsApp','E-mail','Tipo',
    'Modalidade','Faixa / Preço','Momento Desejado','Quantidade','@ / Perfil / Site',
    'Aceite','Descrição / Observação','Valor Unitário','Valor Total','Status','Episódio',
    'Criado em','Atualizado em','Comprovante Solicitação'
  ];
  schema[CONFIG.SHEETS.CLIENTES] = [
    'ID Cliente','Nome / Empresa','Tipo','WhatsApp','E-mail','@ / Perfil / Site',
    'Primeiro Pedido','Último Pedido','Status','Última Atualização'
  ];
  schema[CONFIG.SHEETS.FINANCEIRO] = [
    'Código DOOX','ID Cliente','Cliente','Modalidade','Quantidade','Valor Unitário','Valor Total',
    'Status','Data da Solicitação','Data do Pagamento','Comprovante','Observações'
  ];
  schema[CONFIG.SHEETS.PRODUCAO] = [
    'Código DOOX','ID Cliente','Episódio','Modalidade','Etapa','Status','Faixa Contratada',
    'Momento Efetivo','Tipo de Material','Canal','Arquivo / Referência','Data de Solicitação',
    'Data de Recebimento','Duração','Bloco / Ordem','Data de Publicação','URL','Evidência',
    'Observações','Atualizado em'
  ];
  schema[CONFIG.SHEETS.EPISODIOS] = [
    'Episódio','Título','Status','Data Prevista','Data de Publicação','Capacidade Rodapé',
    'Capacidade Patrocinador','Observações'
  ];
  schema[CONFIG.SHEETS.COMPROVANTES] = [
    'Código DOOX','ID Cliente','Tipo','Episódio','Cliente','Modalidade','Momento Solicitado',
    'Faixa Contratada','Quantidade','Valor Unitário','Valor Total','Arquivo do Comprovante',
    'ID Arquivo','Token','Enviado ao Cliente','Data de Envio','Status','Observações'
  ];
  return schema;
}

function ensureStructure_(ss) {
  const schema = schema_();
  Object.keys(schema).forEach(function(name) {
    const sh = getOrCreate_(ss, name);
    ensureHeaders_(sh, schema[name]);
  });
  applyOperationalFormatting_(ss);
}


/* ============================================================
   COMPROVANTE PDF DA SOLICITAÇÃO
   ============================================================ */

function createRequestReceipt_(ss, r) {
  const folder = getOrCreateFolder_(CONFIG.RECEIPT_FOLDER);
  const timestamp = Utilities.formatDate(new Date(r.createdAt || new Date()), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  const doc = DocumentApp.create('DOOX — Solicitação ' + r.code);
  const body = doc.getBody();
  body.appendParagraph('DOOX STUDIOS / HOCCO').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('COMPROVANTE DE SOLICITAÇÃO').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Este documento confirma o registro da solicitação no sistema DOOX. Não representa comprovante de pagamento, aprovação, programação ou publicação.');
  [
    ['Código DOOX',r.code],['ID Cliente',r.clientId],['Data/Hora da solicitação',timestamp],['Nome / Empresa',r.name],
    ['Tipo',r.type],['E-mail',r.email],['WhatsApp',r.phone],['Perfil / Site',r.handle||'—'],['Modalidade',r.mode],
    ['Momento solicitado',r.moment||'Definido pela produção'],['Faixa comercial',r.range||'Modalidade fixa'],['Quantidade',r.quantity],
    ['Valor unitário',formatMoneyBR_(r.unitPrice)],['Valor total',formatMoneyBR_(r.total)],['Aceite',(r.termsAccepted&&r.rulesAccepted)?'SIM':'NÃO'],['Status',r.status]
  ].forEach(x=>body.appendParagraph(x[0]+': '+x[1]));
  if(r.observation) body.appendParagraph('Observações: '+r.observation);
  body.appendParagraph('DOOX Studios — registro operacional HOCCO');
  doc.saveAndClose();
  const temp=DriveApp.getFileById(doc.getId());
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  const storedName='DOOX-'+r.code+'-SOLICITACAO-'+token+'.pdf';
  const pdf=temp.getAs(MimeType.PDF).setName(storedName);
  const file=folder.createFile(pdf);
  temp.setTrashed(true);
  return {url:file.getUrl(),fileName:'DOOX-'+r.code+'-SOLICITACAO.pdf',storedName:storedName,fileId:file.getId(),token:token};
}

function downloadReceipt_(token) {
  if (!token || token.length < 32) throw new Error('Token de comprovante inválido.');
  const folderIt=DriveApp.getFoldersByName(CONFIG.RECEIPT_FOLDER);
  if(!folderIt.hasNext()) throw new Error('Pasta de comprovantes não encontrada.');
  const folder=folderIt.next();
  const prefix='DOOX-';
  const files=folder.getFiles();
  while(files.hasNext()){
    const file=files.next();
    if(file.getName().indexOf('-'+token+'.pdf')<0) continue;
    return {ok:true,fileName:file.getName().replace('-'+token,''),mimeType:MimeType.PDF,base64:Utilities.base64Encode(file.getBlob().getBytes())};
  }
  throw new Error('Comprovante não encontrado.');
}

/* ============================================================
   PASTA DE COMPROVANTES
   ============================================================ */

function getOrCreateFolder_(
  name
) {

  const it =
    DriveApp
      .getFoldersByName(
        name
      );


  if (
    it.hasNext()
  ) {

    return it.next();

  }


  return DriveApp.createFolder(
    name
  );

}


/* ============================================================
   FORMATAÇÃO MONETÁRIA
   ============================================================ */

function formatMoneyBR_(
  n
) {

  const value =
    Number(n) || 0;


  return (
    'R$ ' +
    value
      .toFixed(2)
      .replace(
        '.',
        ','
      )
  );

}


/* ============================================================
   FORMATAÇÃO OPERACIONAL DAS ABAS
   ============================================================ */

function formatOperationalSheets_(
  ss
) {

  Object.keys(
    CONFIG.SHEETS
  ).forEach(
    function(key) {

      const name =
        CONFIG.SHEETS[key];


      const sh =
        ss.getSheetByName(
          name
        );


      if (!sh) {
        return;
      }


      const lastColumn =
        sh.getLastColumn();


      if (
        lastColumn < 1
      ) {
        return;
      }


      sh.setFrozenRows(
        1
      );


      sh
        .getRange(
          1,
          1,
          1,
          lastColumn
        )
        .setFontWeight(
          'bold'
        );


      sh
        .getRange(
          1,
          1,
          Math.max(
            1,
            sh.getLastRow()
          ),
          lastColumn
        )
        .setVerticalAlignment(
          'middle'
        );


      const h =
        headers_(
          sh
        );


      const dateColumns = [
        'Data/Hora',
        'Data',
        'Criado em',
        'Data da Solicitação',
        'Data do Pagamento',
        'Último Pedido',
        'Última Atualização',
        'Data de Solicitação',
        'Data de Recebimento',
        'Data Prevista',
        'Data de Publicação',
        'Data de Envio',
        'Atualizado em'
      ];


      dateColumns.forEach(
        function(label) {

          const i =
            find_(
              h,
              [label]
            );


          if (
            i >= 0 &&
            sh.getMaxRows() >= 2
          ) {

            sh
              .getRange(
                2,
                i + 1,
                sh.getMaxRows() - 1,
                1
              )
              .setNumberFormat(
                'dd/mm/yyyy hh:mm:ss'
              );

          }

        }
      );


      const moneyColumns = [
        'Valor Unitário',
        'Valor',
        'Valor Total'
      ];


      moneyColumns.forEach(
        function(label) {

          const i =
            find_(
              h,
              [label]
            );


          if (
            i >= 0 &&
            sh.getMaxRows() >= 2
          ) {

            sh
              .getRange(
                2,
                i + 1,
                sh.getMaxRows() - 1,
                1
              )
              .setNumberFormat(
                'R$ #,##0.00'
              );

          }

        }
      );


      const qtyIndex =
        find_(
          h,
          [
            'Quantidade',
            'Capacidade',
            'Reservadas',
            'Disponíveis'
          ]
        );


      if (
        qtyIndex >= 0 &&
        sh.getMaxRows() >= 2
      ) {

        sh
          .getRange(
            2,
            qtyIndex + 1,
            sh.getMaxRows() - 1,
            1
          )
          .setNumberFormat(
            '0'
          );

      }


      /*
       * Status que exigem ação operacional ficam destacados
       * em vermelho claro. O texto continua legível.
       */
      const statusIndex =
        find_(
          h,
          [
            'Status',
            'Status do Pagamento'
          ]
        );


      if (
        statusIndex >= 0 &&
        sh.getMaxRows() >= 2
      ) {

        const existing =
          sh.getConditionalFormatRules();


        if (
          existing.length === 0
        ) {

          const range =
            sh.getRange(
              2,
              statusIndex + 1,
              sh.getMaxRows() - 1,
              1
            );


          const rule =
            SpreadsheetApp
              .newConditionalFormatRule()
              .setRanges(
                [range]
              )
              .whenTextContains(
                'AGUARDANDO'
              )
              .setBackground(
                '#f4cccc'
              )
              .setFontColor(
                '#9c0006'
              )
              .build();


          sh.setConditionalFormatRules(
            [rule]
          );

        }

      }

    }
  );

}


/* ============================================================
   ATUALIZAR PAINEL / ESTRUTURA
   ============================================================ */

function applyOperationalFormatting_(
  ss
) {

  try {

    formatOperationalSheets_(
      ss
    );

  }
  catch (err) {

    /*
     * Formatação nunca deve impedir uma solicitação
     * comercial de ser registrada.
     */

    console.log(
      'Aviso de formatação: ' +
      (
        err.message ||
        String(err)
      )
    );

  }

}


/* ============================================================
   TESTE DA PLANILHA
   ============================================================ */

/*
 * IMPORTANTE:
 *
 * Esta função NÃO tem "_" no final.
 *
 * Portanto ela aparecerá no seletor
 * de funções do Apps Script.
 */

function testSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureStructure_(ss);
  return {
    ok: true,
    message: 'Google Sheets conectado e estrutura verificada sem inserir dados de teste.',
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheets: Object.keys(CONFIG.SHEETS).map(k => CONFIG.SHEETS[k]),
    activeMonth: getActiveMonth_(),
    timestamp: new Date().toISOString()
  };
}



/* ============================================================
   ADMINISTRAÇÃO DO CICLO MENSAL
   ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DOOX • HOCCO')
    .addItem('Iniciar / sincronizar mês', 'DOOX_INICIAR_MES')
    .addItem('Preparar novo ciclo (backup + zerar + reconstruir)', 'DOOX_PREPARAR_NOVO_CICLO')
    .addItem('Fechar mês atual e arquivar', 'DOOX_FECHAR_MES')
    .addSeparator()
    .addItem('Gerar comprovante da linha selecionada', 'generateReceiptFromSelectedRow')
    .addItem('Atualizar painel', 'atualizarPainel')
    .addItem('Verificar estrutura e conexão', 'testSpreadsheet')
    .addToUi();
}

function DOOX_INICIAR_MES() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    ensureStructure_(ss);
    const current = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
    const active = getActiveMonth_();
    if (!active) PropertiesService.getScriptProperties().setProperty('DOOX_ACTIVE_MONTH', current);
    else if (active !== current) rolloverMonth_(ss, active, current);
    atualizarPainel();
    return 'Mês iniciado: ' + current;
  } finally { lock.releaseLock(); }
}

function DOOX_FECHAR_MES() {
  const ui = SpreadsheetApp.getUi();
  const active = getActiveMonth_() || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  const response = ui.alert('Fechar ciclo ' + active + '?', 'O sistema criará um arquivo de arquivo mensal, preservará os dados e zerará as abas operacionais para o próximo ciclo.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return 'Operação cancelada.';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const archive = archiveCurrentCycle_(ss, active);
    clearLiveData_(ss);
    const parts=active.split('-').map(Number); const nextDate=new Date(parts[0],(parts[1]||1),1); const next = Utilities.formatDate(nextDate, CONFIG.TIMEZONE, 'yyyy-MM');
    PropertiesService.getScriptProperties().setProperty('DOOX_ACTIVE_MONTH', next);
    PropertiesService.getScriptProperties().setProperty('DOOX_LAST_ARCHIVE', archive.getUrl());
    atualizarPainel();
    ui.alert('Fechamento concluído', 'Arquivo: ' + archive.getName() + '\nO ciclo ativo agora é ' + next + '.', ui.ButtonSet.OK);
    return archive.getUrl();
  } finally { lock.releaseLock(); }
}

function getActiveMonth_() {
  return PropertiesService.getScriptProperties().getProperty('DOOX_ACTIVE_MONTH') || '';
}

function ensureMonthlyCycle_(ss) {
  ensureStructure_(ss);
  const current = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  const active = getActiveMonth_();
  if (!active) {
    PropertiesService.getScriptProperties().setProperty('DOOX_ACTIVE_MONTH', current);
    return;
  }
  if (active !== current) rolloverMonth_(ss, active, current);
}

function rolloverMonth_(ss, oldMonth, newMonth) {
  archiveCurrentCycle_(ss, oldMonth);
  clearLiveData_(ss);
  PropertiesService.getScriptProperties().setProperty('DOOX_ACTIVE_MONTH', newMonth);
}

function archiveCurrentCycle_(ss, month) {
  const folder = getOrCreateFolder_(CONFIG.ARCHIVE_FOLDER);
  const name = 'DOOX HOCCO — ARQUIVO ' + month;
  const file = SpreadsheetApp.create(name);
  const defaultSheet = file.getSheets()[0];
  let first = true;

  Object.keys(CONFIG.SHEETS).forEach(function(key) {
    const source = ss.getSheetByName(CONFIG.SHEETS[key]);
    if (!source) return;
    let target;
    if (first) {
      target = defaultSheet;
      target.setName(source.getName());
      first = false;
    } else {
      target = file.insertSheet(source.getName());
    }
    const range = source.getDataRange();
    if (range.getNumRows() && range.getNumColumns()) {
      target.getRange(1,1,range.getNumRows(),range.getNumColumns()).setValues(range.getValues());
    }
    target.setFrozenRows(1);
  });

  DriveApp.getFileById(file.getId()).moveTo(folder);
  return file;
}

function clearLiveData_(ss) {
  Object.keys(CONFIG.SHEETS).forEach(function(key) {
    const sh = ss.getSheetByName(CONFIG.SHEETS[key]);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow > 1 && lastCol > 0) {
      sh.getRange(2,1,lastRow-1,lastCol).clearContent();
    }
  });
}


function DOOX_PREPARAR_NOVO_CICLO() {
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const stamp=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyyMMdd-HHmmss');
    const backup=archiveWorkbookSnapshot_(ss,'DOOX HOCCO — BACKUP PRÉ-CICLO — '+stamp);
    const schema=schema_();

    // Remove abas que não fazem parte do sistema atual, depois de preservá-las.
    const keep=Object.keys(schema);
    ss.getSheets().slice().forEach(function(sh){
      if(!keep.includes(sh.getName()) && ss.getSheets().length>1) ss.deleteSheet(sh);
    });

    // Reconstrói cada aba com exatamente o esquema vigente e sem linhas antigas.
    Object.keys(schema).forEach(function(name){
      const sh=getOrCreate_(ss,name);
      const lastRow=sh.getLastRow(), lastCol=sh.getLastColumn();
      if(lastRow>0 && lastCol>0) sh.clear();
      const maxCols=sh.getMaxColumns();
      if(maxCols>schema[name].length) sh.deleteColumns(schema[name].length+1,maxCols-schema[name].length);
      if(sh.getMaxColumns()<schema[name].length) sh.insertColumnsAfter(sh.getMaxColumns(),schema[name].length-sh.getMaxColumns());
      sh.getRange(1,1,1,schema[name].length).setValues([schema[name]]);
    });

    const current=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM');
    PropertiesService.getScriptProperties().setProperty('DOOX_ACTIVE_MONTH',current);
    PropertiesService.getScriptProperties().setProperty('DOOX_LAST_ARCHIVE',backup.getUrl());
    PropertiesService.getScriptProperties().setProperty('DOOX_LAST_RESET',new Date().toISOString());
    applyOperationalFormatting_(ss);
    atualizarPainel();
    SpreadsheetApp.getUi().alert('Ciclo preparado','O banco operacional foi zerado sem apagar o backup. Mês ativo: '+current+'\nBackup: '+backup.getUrl(),SpreadsheetApp.getUi().ButtonSet.OK);
    return {ok:true,month:current,backupUrl:backup.getUrl()};
  } finally { lock.releaseLock(); }
}

function archiveWorkbookSnapshot_(ss,name) {
  const folder=getOrCreateFolder_(CONFIG.ARCHIVE_FOLDER);
  const file=SpreadsheetApp.create(name);
  const defaultSheet=file.getSheets()[0];
  let first=true;
  ss.getSheets().forEach(function(source){
    let target;
    if(first){target=defaultSheet;target.setName(source.getName().slice(0,99));first=false;}
    else target=file.insertSheet(source.getName().slice(0,99));
    const r=source.getDataRange();
    if(r.getNumRows()&&r.getNumColumns()){
      target.getRange(1,1,r.getNumRows(),r.getNumColumns()).setValues(r.getValues());
      target.getRange(1,1,r.getNumRows(),r.getNumColumns()).setNumberFormats(r.getNumberFormats());
    }
    target.setFrozenRows(Math.min(1,r.getNumRows()));
  });
  DriveApp.getFileById(file.getId()).moveTo(folder);
  return file;
}

function cleanupExtraSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureStructure_(ss);
  const keep = Object.keys(CONFIG.SHEETS).map(k => CONFIG.SHEETS[k]);
  const extras = ss.getSheets().filter(sh => !keep.includes(sh.getName()));
  if (!extras.length) return 'Nenhuma aba extra.';
  const backup = archiveWorkbookSnapshot_(ss,'DOOX HOCCO — BACKUP ABAS EXTRAS — '+Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyyMMdd-HHmmss'));
  extras.forEach(function(source){ if (ss.getSheets().length > 1) ss.deleteSheet(source); });
  return backup.getUrl();
}

function atualizarPainel() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureStructure_(ss);
  const painel = ss.getSheetByName(CONFIG.SHEETS.PAINEL);
  const pedidos = ss.getSheetByName(CONFIG.SHEETS.PEDIDOS);
  const financeiro = ss.getSheetByName(CONFIG.SHEETS.FINANCEIRO);
  const now = new Date();
  const rows = pedidos.getLastRow() > 1 ? pedidos.getRange(2,1,pedidos.getLastRow()-1,pedidos.getLastColumn()).getDisplayValues() : [];
  const hp = headers_(pedidos);
  const statusIdx = find_(hp,['Status']);
  const totalIdx = find_(hp,['Valor Total']);
  const qIdx = find_(hp,['Quantidade']);
  const requests = rows.length;
  const solicTotal = rows.reduce((a,r)=>a+(Number(String(r[totalIdx]||'0').replace(/[^0-9,-]/g,'').replace('.','').replace(',','.'))||0),0);
  const aguardando = rows.filter(r => statusIdx>=0 && r[statusIdx]==='SOLICITADO').length;
  const finRows = financeiro.getLastRow()>1 ? financeiro.getRange(2,1,financeiro.getLastRow()-1,financeiro.getLastColumn()).getDisplayValues() : [];
  const hf=headers_(financeiro), fStatus=find_(hf,['Status']);
  const pago=finRows.filter(r=>fStatus>=0 && r[fStatus]==='PAGAMENTO RECEBIDO').length;
  const data=[
    ['Ciclo ativo', getActiveMonth_() || Utilities.formatDate(now,CONFIG.TIMEZONE,'yyyy-MM'), now],
    ['Solicitações', requests, now],
    ['Solicitações em análise/entrada', aguardando, now],
    ['Valor solicitado', solicTotal, now],
    ['Pagamentos recebidos', pago, now],
    ['Último arquivo mensal', PropertiesService.getScriptProperties().getProperty('DOOX_LAST_ARCHIVE')||'', now]
  ];
  const max= Math.max(painel.getLastRow(),1);
  if (max>1) painel.getRange(2,1,max-1,3).clearContent();
  painel.getRange(2,1,data.length,3).setValues(data);
  painel.getRange(2,3,data.length,1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
}

function generateReceiptFromSelectedRow() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh=ss.getActiveSheet();
  if(sh.getName()!==CONFIG.SHEETS.PEDIDOS) throw new Error('Selecione uma linha na aba PEDIDOS.');
  const row=sh.getActiveRange().getRow();
  if(row<2) throw new Error('Selecione uma linha de pedido.');
  const h=headers_(sh);
  const v=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0];
  const get=label=>{const i=find_(h,[label]); return i>=0?v[i]:'';};
  const r={
    code: get('Código DOOX'), clientId:get('ID Cliente'), createdAt:get('Data/Hora')||new Date(), name:get('Nome / Empresa'),
    type:get('Tipo'), email:get('E-mail'), phone:get('WhatsApp'), handle:get('@ / Perfil / Site'), mode:get('Modalidade'),
    moment:get('Momento Desejado'), range: (String(get('Faixa / Preço')||'').split(' · ')[0]||''), quantity:Number(get('Quantidade'))||1,
    unitPrice:Number(get('Valor Unitário'))||0,total:Number(get('Valor Total'))||0,termsAccepted:get('Aceite')==='SIM',rulesAccepted:get('Aceite')==='SIM',
    observation:get('Descrição / Observação'),status:get('Status')||'SOLICITADO'
  };
  const receipt=createRequestReceipt_(ss,r);
  const token=receipt.token;
  const comp=ss.getSheetByName(CONFIG.SHEETS.COMPROVANTES);
  appendByHeaders_(comp,{'Código DOOX':r.code,'ID Cliente':r.clientId,'Tipo':'SOLICITAÇÃO','Cliente':r.name,'Modalidade':r.mode,'Momento Solicitado':r.moment,'Faixa Contratada':r.range,'Quantidade':r.quantity,'Valor Unitário':r.unitPrice,'Valor Total':r.total,'Arquivo do Comprovante':receipt.fileName,'ID Arquivo':receipt.fileId,'Token':token,'Enviado ao Cliente':'NÃO','Status':'GERADO','Observações':'Gerado manualmente pela produção.'});
  updateByHeaders_(sh,row,{'Comprovante Solicitação':receipt.fileName,'Atualizado em':new Date()});
  SpreadsheetApp.getUi().alert('Comprovante gerado: '+receipt.fileName+'\nAcesso pelo site: /api/receipt?token='+token);
  return receipt;
}

/* ============================================================
   CONTROLE DE CONTRATO PÚBLICO
   ============================================================ */
function getPublicFormContract() {
  return {
    fields: [
      'Nome / Empresa',
      'Seu WhatsApp',
      'Seu E-mail',
      'Tipo',
      'Modalidade',
      'Faixa / Preço (Automático)',
      'Momento Desejado',
      'Quantidade',
      '@ / Perfil / Site',
      'Aceite',
      'Descrição / Observação'
    ],
    modalities: [
      'Presença no Rodapé',
      'Sponsor Overlay',
      'Overlay + Áudio',
      'Empresa Patrocinadora do Episódio'
    ],
    rule: 'Somente os campos públicos acima entram como dados de solicitação. Código, ID Cliente, data, status, valores calculados e comprovante são criados pelo sistema.'
  };
}


/* ============================================================
   CABEÇALHOS
   ============================================================ */

function ensureHeaders_(
  sh,
  required
) {

  const h =
    headers_(sh);


  /*
   * Aba vazia
   */

  if (!h.length) {

    sh
      .getRange(
        1,
        1,
        1,
        required.length
      )
      .setValues(
        [required]
      );

    return;

  }


  /*
   * Adiciona somente os cabeçalhos
   * que estiverem faltando.
   */

  const missing =
    required.filter(
      x =>
        find_(
          h,
          [x]
        ) < 0
    );


  if (
    missing.length
  ) {

    sh
      .getRange(
        1,
        h.length + 1,
        1,
        missing.length
      )
      .setValues(
        [missing]
      );

  }

}


/* ============================================================
   INSERIR POR CABEÇALHO
   ============================================================ */

function appendByHeaders_(
  sh,
  payload
) {

  const h =
    headers_(sh);


  const row =
    h.map(
      x =>
        value_(
          payload,
          x
        )
    );


  sh.appendRow(
    row
  );

}


/* ============================================================
   ATUALIZAR POR CABEÇALHO
   ============================================================ */

function updateByHeaders_(
  sh,
  row,
  payload
) {

  const h =
    headers_(sh);


  h.forEach(
    function(x, i) {

      const v =
        value_(
          payload,
          x
        );


      if (
        v !== undefined
      ) {

        sh
          .getRange(
            row,
            i + 1
          )
          .setValue(v);

      }

    }
  );

}


/* ============================================================
   ENCONTRAR VALOR DO PAYLOAD
   ============================================================ */

function value_(
  p,
  h
) {

  /*
   * Correspondência exata
   */

  if (
    p[h] !== undefined
  ) {

    return p[h];

  }


  /*
   * Correspondência normalizada
   */

  const n =
    norm_(h);


  for (
    const k in p
  ) {

    if (
      norm_(k) === n
    ) {

      return p[k];

    }

  }


  /*
   * Aliases
   */

  const aliases = {

    codigo: [
      'Código DOOX',
      'Código',
      'Pedido'
    ],

    codigodoox: [
      'Código DOOX',
      'Código'
    ],

    datahora: [
      'Data/Hora',
      'Criado em'
    ],

    email: [
      'E-mail',
      'Email'
    ],

    whatsapp: [
      'WhatsApp',
      'Telefone'
    ],

    perfilsite: [
      '@ / Perfil / Site',
      'Perfil / Site'
    ],

    modalidade: [
      'Modalidade',
      'Inserção'
    ],

    valor: [
      'Valor Total',
      'Valor'
    ],

    episodio: [
      'Episódio',
      'EP'
    ],

    status: [
      'Status',
      'Status do Pagamento'
    ]

  };


  const list =
    aliases[n];


  if (list) {

    for (
      const k of list
    ) {

      if (
        p[k] !== undefined
      ) {

        return p[k];

      }

    }

  }


  /*
   * Se o campo não existir no payload,
   * deixa a célula vazia.
   */

  return undefined;

}


/* ============================================================
   CABEÇALHOS DA PLANILHA
   ============================================================ */

function headers_(
  sh
) {

  if (
    !sh ||
    sh.getLastColumn() === 0
  ) {

    return [];

  }


  return sh
    .getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(
      clean_
    );

}


/* ============================================================
   ENCONTRAR ÍNDICE
   ============================================================ */

function find_(
  h,
  candidates
) {

  const normalized =
    h.map(
      norm_
    );


  for (
    const candidate of candidates
  ) {

    const target =
      norm_(
        candidate
      );


    const i =
      normalized.indexOf(
        target
      );


    if (
      i >= 0
    ) {

      return i;

    }

  }


  return -1;

}


/* ============================================================
   NORMALIZAR CABEÇALHO
   ============================================================ */

function norm_(
  v
) {

  return clean_(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]/g,
      ''
    );

}


/* ============================================================
   OBTER / CRIAR ABA
   ============================================================ */

function getOrCreate_(
  ss,
  name
) {

  return (
    ss.getSheetByName(name) ||
    ss.insertSheet(name)
  );

}


/* ============================================================
   PRIMEIRO VALOR
   ============================================================ */

function first_(
  o,
  keys
) {

  for (
    const k of keys
  ) {

    if (
      o[k] !== undefined &&
      o[k] !== null
    ) {

      return o[k];

    }

  }


  return '';

}


/* ============================================================
   LIMPAR TEXTO
   ============================================================ */

function sanitizeHandle_(
  v
) {

  const value =
    clean_(v);

  if (!value) {
    return '';
  }

  const n =
    norm_(value);

  const placeholders = [
    'suaempresa',
    'seuperfil',
    'empresaaqui',
    'exemplo',
    'exemploperfil',
    'seusite',
    'seuinstagram'
  ];

  for (
    let i = 0;
    i < placeholders.length;
    i++
  ) {

    if (
      n.indexOf(
        placeholders[i]
      ) >= 0
    ) {

      return '';

    }

  }

  return value;

}


/* ============================================================
   LIMPAR TEXTO
   ============================================================ */

function clean_(
  v
) {

  if (
    v === null ||
    v === undefined
  ) {

    return '';

  }


  return String(v)
    .trim();

}


/* ============================================================
   SOMENTE DÍGITOS
   ============================================================ */

function digits_(
  v
) {

  return clean_(v)
    .replace(
      /\D/g,
      ''
    );

}


/* ============================================================
   TELEFONE
   ============================================================ */

function phone_(
  v
) {

  let d =
    digits_(v);


  if (!d) {

    return '';

  }


  /*
   * Se veio sem DDI,
   * adiciona 55.
   */

  if (
    d.length === 10 ||
    d.length === 11
  ) {

    d =
      '55' + d;

  }


  return '+' + d;

}


/* ============================================================
   INTEIRO
   ============================================================ */

function integer_(
  v
) {

  const n =
    parseInt(
      String(v || '')
        .replace(
          /\D/g,
          ''
        ),
      10
    );


  return isNaN(n)
    ? 0
    : n;

}


/* ============================================================
   DINHEIRO
   ============================================================ */

function money_(
  v
) {

  if (
    typeof v === 'number'
  ) {

    return round_(v);

  }


  let s =
    clean_(v)
      .replace(
        /[R$\s]/g,
        ''
      );


  if (
    s.includes(',')
  ) {

    s =
      s
        .replace(
          /\./g,
          ''
        )
        .replace(
          ',',
          '.'
        );

  }


  const n =
    Number(s);


  return isNaN(n)
    ? 0
    : round_(n);

}


/* ============================================================
   ARREDONDAR
   ============================================================ */

function round_(
  v
) {

  return (
    Math.round(
      Number(v) * 100
    ) / 100
  );

}


/* ============================================================
   BOOLEAN
   ============================================================ */

function bool_(
  v
) {

  if (
    v === true
  ) {

    return true;

  }


  return [

    'true',
    '1',
    'sim',
    'yes',
    'aceito',
    'aceita'

  ].includes(
    clean_(v)
      .toLowerCase()
  );

}


/* ============================================================
   PREENCHER ZEROS
   ============================================================ */

function pad_(
  n,
  s
) {

  return String(n)
    .padStart(
      s,
      '0'
    );

}


/* ============================================================
   PARSE DO POST
   ============================================================ */

function parse_(
  e
) {

  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {

    return (
      e &&
      e.parameter
        ? e.parameter
        : {}
    );

  }


  const contents =
    e.postData.contents;


  /*
   * Tenta JSON
   */

  try {

    return JSON.parse(
      contents
    );

  }

  catch (_) {

    /*
     * Fallback para formulário
     */

    return (
      e.parameter ||
      {}
    );

  }

}


/* ============================================================
   RESPOSTA JSON
   ============================================================ */

function out_(
  o
) {

  return ContentService
    .createTextOutput(
      JSON.stringify(o)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}