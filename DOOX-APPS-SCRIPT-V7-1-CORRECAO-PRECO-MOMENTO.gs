/**
 * ============================================================
 * DOOX / HOCCO — APPS SCRIPT V7.1
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

  SHEETS: {

    PEDIDOS:
      'PEDIDOS',

    CLIENTES:
      'CLIENTES',

    PAGAMENTOS:
      'PAGAMENTOS',

    MATERIAIS:
      'MATERIAIS',

    EPISODIOS:
      'EPISÓDIOS',

    PROGRAMACAO:
      'PROGRAMAÇÃO',

    VEICULACOES:
      'VEICULAÇÕES',

    VAGAS:
      'VAGAS',

    COMPROVANTES:
      'COMPROVANTES',

    DASHBOARD:
      'DASHBOARD'
  }

};


/* ============================================================
   GET
   ============================================================ */

function doGet(e) {

  try {

    const action =
      String(
        e &&
        e.parameter &&
        e.parameter.action
          ? e.parameter.action
          : 'health'
      );

    if (action === 'testSpreadsheet') {

      return out_(
        testSpreadsheet()
      );

    }

    return out_({

      ok: true,

      service:
        'DOOX HOCCO',

      version:
        'V7.1',

      timestamp:
        new Date().toISOString()

    });

  }

  catch (err) {

    return out_({

      ok: false,

      error:
        err.message ||
        String(err)

    });

  }

}


/* ============================================================
   POST
   ============================================================ */

function doPost(e) {

  try {

    const data =
      parse_(e);

    const action =
      String(
        data.action ||
        'registerRequest'
      );

    if (action === 'testSpreadsheet') {

      return out_(
        testSpreadsheet()
      );

    }

    if (action === 'registerRequest') {

      return out_(
        registerRequest_(data)
      );

    }

    return out_({

      ok: false,

      error:
        'AÇÃO NÃO RECONHECIDA'

    });

  }

  catch (err) {

    return out_({

      ok: false,

      error:
        err.message ||
        String(err)

    });

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

    const ss =
      SpreadsheetApp.openById(
        CONFIG.SPREADSHEET_ID
      );

    /*
     * Garante que as abas e cabeçalhos
     * existam antes de escrever.
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


    /*
     * NUNCA aceitar episódio enviado
     * pelo site.
     */

    r.episode =
      '';


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
       1. PEDIDOS
       -------------------------------------------------------- */

    appendByHeaders_(
      ss.getSheetByName(
        CONFIG.SHEETS.PEDIDOS
      ),

      {

        'Código DOOX':
          r.code,

        'Código':
          r.code,

        'Data/Hora':
          r.createdAt,

        'Data':
          r.createdAt,

        'Criado em':
          r.createdAt,

        'Nome':
          r.name,

        'Nome / Empresa':
          r.name,

        'Empresa':
          r.company,

        'Tipo':
          r.type,

        'E-mail':
          r.email,

        'Email':
          r.email,

        'WhatsApp':
          r.phone,

        'Telefone':
          r.phone,

        '@ / Perfil / Site':
          r.handle,

        'Perfil / Site':
          r.handle,

        'Modalidade':
          r.mode,

        'Inserção':
          r.mode,

        'Momento':
          r.moment,

        'Faixa':
          r.range,

        'Quantidade':
          r.quantity,

        'Valor Unitário':
          r.unitPrice,

        'Valor':
          r.total,

        'Valor Total':
          r.total,

        'Observações':
          r.observation,

        'Observacao':
          r.observation,

        /*
         * EPISÓDIO FICA VAZIO
         */

        'Episódio':
          '',

        'EP':
          '',

        'Status':
          r.status,

        'Termos Aceitos':
          r.termsAccepted
            ? 'SIM'
            : 'NÃO',

        'Regras Aceitas':
          r.rulesAccepted
            ? 'SIM'
            : 'NÃO',

        'Material':
          'PENDENTE',

        'Origem':
          r.source

      }

    );


    /* --------------------------------------------------------
       2. CLIENTES
       -------------------------------------------------------- */

    upsertClient_(
      ss,
      r
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

      status:
        r.status,

      episode:
        '',

      paymentStatus:
        'AGUARDANDO PAGAMENTO',

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

function normalize_(d) {

  const mode =
    normalizeMode_(
      first_(
        d,
        [
          'mode',
          'modality',
          'modalidade',
          'insertion'
        ]
      )
    );


  /*
   * Pode chegar:
   *
   * range = 02:00–04:00
   *
   * ou somente:
   *
   * moment = 03:15
   *
   * Se a faixa não existir,
   * descobrimos a faixa pelo momento.
   */

  const momentRaw =
    first_(
      d,
      [
        'moment',
        'requestMoment',
        'momento'
      ]
    );


  const rangeRaw =
    first_(
      d,
      [
        'range',
        'requestRange',
        'faixa'
      ]
    );


  let range =
    normalizeRange_(
      rangeRaw
    );


  if (
    !isPricingRange_(range)
  ) {

    range =
      rangeFromMoment_(
        momentRaw
      );

  }


  /*
   * O preço é calculado pelo servidor.
   */

  const unit =
    price_(
      mode,
      range
    );


  const qty =
    Math.max(
      1,

      integer_(
        first_(
          d,
          [
            'quantity',
            'qty',
            'reqQty'
          ]
        )
      ) || 1
    );


  return {

    name:
      clean_(
        first_(
          d,
          [
            'name',
            'fullName',
            'reqName',
            'nome'
          ]
        )
      ),


    company:
      clean_(
        first_(
          d,
          [
            'company',
            'empresa',
            'companyName'
          ]
        )
      ),


    type:
      normalizeType_(
        first_(
          d,
          [
            'type',
            'requestType',
            'tipo'
          ]
        )
      ),


    email:
      clean_(
        first_(
          d,
          [
            'email',
            'reqEmail'
          ]
        )
      ).toLowerCase(),


    phone:
      phone_(
        first_(
          d,
          [
            'phone',
            'whatsapp',
            'reqPhone',
            'telefone'
          ]
        )
      ),


    handle:
      clean_(
        first_(
          d,
          [
            'handle',
            'profile',
            'site',
            'reqHandle',
            'perfil'
          ]
        )
      ),


    mode:
      mode,


    moment:
      clean_(
        momentRaw
      ),


    range:
      range,


    quantity:
      qty,


    unitPrice:
      unit,


    total:
      round_(
        unit * qty
      ),


    observation:
      clean_(
        first_(
          d,
          [
            'observation',
            'observations',
            'obs',
            'reqObs'
          ]
        )
      ),


    /*
     * Nunca utilizar episódio
     * recebido pelo navegador.
     */

    episode:
      '',


    termsAccepted:
      bool_(
        first_(
          d,
          [
            'termsAccepted',
            'acceptTerms',
            'terms'
          ]
        )
      ),


    /*
     * Algumas versões do site enviam
     * apenas acceptTerms para representar
     * Termos + Regras.
     */

    rulesAccepted:
      bool_(
        first_(
          d,
          [
            'rulesAccepted',
            'acceptRules',
            'rules'
          ]
        )
      ) ||
      bool_(
        first_(
          d,
          [
            'termsAccepted',
            'acceptTerms',
            'terms'
          ]
        )
      ),


    source:
      clean_(
        first_(
          d,
          [
            'source',
            'origem'
          ]
        )
      ) || 'SITE'

  };

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

  if (
    mode ===
    'Apoiador Individual'
  ) {

    return 9.90;

  }


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
    'Sponsor Overlay + Áudio'
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
      'Sponsor Overlay + Áudio',

    'sponsor overlay + áudio':
      'Sponsor Overlay + Áudio',

    'overlay + audio':
      'Sponsor Overlay + Áudio',

    'overlay + áudio':
      'Sponsor Overlay + Áudio',


    'apoiador individual':
      'Apoiador Individual',


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

function nextCode_(ss) {

  const sheet =
    ss.getSheetByName(
      CONFIG.SHEETS.PEDIDOS
    );


  const h =
    headers_(sheet);


  const i =
    find_(
      h,
      [
        'Código DOOX',
        'Código',
        'Codigo DOOX',
        'Codigo'
      ]
    );


  let max =
    0;


  if (
    i >= 0 &&
    sheet.getLastRow() > 1
  ) {

    const values =
      sheet
        .getRange(
          2,
          i + 1,
          sheet.getLastRow() - 1,
          1
        )
        .getDisplayValues();


    values.forEach(
      row => {

        const code =
          String(
            row[0] || ''
          );


        const match =
          code.match(
            /^DOOX-\d{2}-(\d{4,})$/i
          );


        if (match) {

          max =
            Math.max(
              max,
              parseInt(
                match[1],
                10
              )
            );

        }

      }
    );

  }


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
    pad_(
      max + 1,
      4
    )
  );

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


  const payload = {

    'Código DOOX':
      r.code,

    'Código':
      r.code,

    'Nome':
      r.name,

    'Nome / Empresa':
      r.name,

    'Empresa':
      r.company,

    'Tipo':
      r.type,

    'E-mail':
      r.email,

    'Email':
      r.email,

    'WhatsApp':
      r.phone,

    'Telefone':
      r.phone,

    '@ / Perfil / Site':
      r.handle,

    'Perfil / Site':
      r.handle,

    'Status':
      'ATIVO',

    'Último Pedido':
      r.createdAt,

    'Última Atualização':
      r.createdAt

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
   PAGAMENTOS
   ============================================================ */

function upsertPayment_(
  ss,
  r
) {

  const sh =
    ss.getSheetByName(
      CONFIG.SHEETS.PAGAMENTOS
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

    'Código DOOX':
      r.code,

    'Código':
      r.code,

    'Pedido':
      r.code,

    'Nome':
      r.name,

    'Empresa':
      r.company,

    'Modalidade':
      r.mode,

    'Quantidade':
      r.quantity,

    'Valor Unitário':
      r.unitPrice,

    'Valor':
      r.total,

    'Valor Total':
      r.total,

    'Status':
      'AGUARDANDO PAGAMENTO',

    'Status do Pagamento':
      'AGUARDANDO PAGAMENTO',

    'Data da Solicitação':
      r.createdAt,

    'Data/Hora':
      r.createdAt,

    'Data do Pagamento':
      '',

    'Comprovante':
      '',

    'Observações':
      ''

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

function ensureStructure_(ss) {

  const s = {};


  s[
    CONFIG.SHEETS.PEDIDOS
  ] = [

    'Código DOOX',
    'Data/Hora',
    'Nome',
    'Empresa',
    'Tipo',
    'E-mail',
    'WhatsApp',
    '@ / Perfil / Site',
    'Modalidade',
    'Momento',
    'Faixa',
    'Quantidade',
    'Valor Unitário',
    'Valor Total',
    'Observações',
    'Episódio',
    'Status',
    'Termos Aceitos',
    'Regras Aceitas',
    'Material',
    'Origem',
    'Criado em'

  ];


  s[
    CONFIG.SHEETS.CLIENTES
  ] = [

    'Código DOOX',
    'Nome',
    'Empresa',
    'Tipo',
    'E-mail',
    'WhatsApp',
    '@ / Perfil / Site',
    'Status',
    'Último Pedido',
    'Última Atualização'

  ];


  s[
    CONFIG.SHEETS.PAGAMENTOS
  ] = [

    'Código DOOX',
    'Pedido',
    'Nome',
    'Empresa',
    'Modalidade',
    'Quantidade',
    'Valor Unitário',
    'Valor Total',
    'Status',
    'Data da Solicitação',
    'Data do Pagamento',
    'Comprovante',
    'Observações'

  ];


  s[
    CONFIG.SHEETS.MATERIAIS
  ] = [

    'Código DOOX',
    'Cliente',
    'Modalidade',
    'Tipo de Material',
    'Status',
    'Canal de Recebimento',
    'Data de Solicitação',
    'Data de Recebimento',
    'Arquivo / Referência',
    'Observações'

  ];


  s[
    CONFIG.SHEETS.EPISODIOS
  ] = [

    'Episódio',
    'Título',
    'Status',
    'Data Prevista',
    'Data de Publicação',
    'Capacidade Rodapé',
    'Capacidade Patrocinador',
    'Observações'

  ];


  s[
    CONFIG.SHEETS.PROGRAMACAO
  ] = [

    'Código DOOX',
    'Episódio',
    'Modalidade',
    'Faixa Contratada',
    'Momento Efetivo',
    'Duração',
    'Bloco / Ordem',
    'Status',
    'Observações'

  ];


  s[
    CONFIG.SHEETS.VEICULACOES
  ] = [

    'Código DOOX',
    'Episódio',
    'Data de Publicação',
    'URL',
    'Momento Efetivo',
    'Status',
    'Evidência',
    'Observações'

  ];


  s[
    CONFIG.SHEETS.VAGAS
  ] = [

    'Episódio',
    'Modalidade',
    'Capacidade',
    'Reservadas',
    'Disponíveis',
    'Status',
    'Última Atualização'

  ];


  s[
    CONFIG.SHEETS.COMPROVANTES
  ] = [

    'Código DOOX',
    'Episódio',
    'Cliente',
    'Modalidade',
    'Data de Publicação',
    'URL',
    'Arquivo do Comprovante',
    'Enviado ao Cliente',
    'Data de Envio',
    'Status'

  ];


  s[
    CONFIG.SHEETS.DASHBOARD
  ] = [

    'Indicador',
    'Valor',
    'Atualizado em'

  ];


  Object.keys(s)
    .forEach(
      function(name) {

        const sh =
          getOrCreate_(
            ss,
            name
          );


        ensureHeaders_(
          sh,
          s[name]
        );

      }
    );

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

  const ss =
    SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );


  /*
   * Cria/verifica toda a estrutura.
   */

  ensureStructure_(
    ss
  );


  /*
   * Registra uma linha de teste
   * apenas no Dashboard.
   */

  const sh =
    ss.getSheetByName(
      CONFIG.SHEETS.DASHBOARD
    );


  appendByHeaders_(
    sh,
    {

      'Indicador':
        'TESTE DE CONEXÃO',

      'Valor':
        'OK',

      'Atualizado em':
        new Date()

    }
  );


  SpreadsheetApp.flush();


  return {

    ok:
      true,

    message:
      'Google Sheets conectado e estrutura verificada.',

    spreadsheetName:
      ss.getName(),

    spreadsheetId:
      ss.getId(),

    timestamp:
      new Date().toISOString()

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