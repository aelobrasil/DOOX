import postgres from 'postgres';
import crypto from 'node:crypto';

const db = process.env.DOOX_DATABASE_URL
  ? postgres(process.env.DOOX_DATABASE_URL, {
      ssl: 'require',
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  : null;

const MODE_MAP = {
  'Presença no Rodapé': 'RODAPE',
  'Sponsor Overlay': 'SPONSOR_OVERLAY',
  'Overlay + Áudio': 'OVERLAY_AUDIO',
  'Empresa Patrocinadora do Episódio': 'PATROCINADOR_EPISODIO',
  'Apoiador Individual': 'APOIADOR_INDIVIDUAL',
};

const RANGE_MAP = {
  '00:30–02:00': 'F1',
  '02:00–04:00': 'F2',
  '04:00–06:30': 'F3',
  '06:30–09:00': 'F4',
  '09:00–11:00': 'F5',
};

const STATUS_LABELS = {
  SOLICITADO: 'SOLICITADO',
  EM_ANALISE: 'EM ANÁLISE',
  APROVADO: 'APROVADO',
  FILA_DE_ESPERA: 'FILA DE ESPERA',
  EM_PRODUCAO: 'EM PRODUÇÃO',
  PROGRAMADO: 'PROGRAMADO',
  VEICULADO: 'PUBLICADO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
};

const STATUS_PROGRESS = {
  SOLICITADO: 10,
  EM_ANALISE: 20,
  APROVADO: 42,
  FILA_DE_ESPERA: 48,
  EM_PRODUCAO: 78,
  PROGRAMADO: 88,
  VEICULADO: 96,
  FINALIZADO: 100,
  CANCELADO: 100,
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );
  res.setHeader(
    'Cache-Control',
    'no-store, max-age=0'
  );
  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );
  res.end(JSON.stringify(body));
}

function normalizeBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function getAction(url, body) {
  return String(
    url.searchParams.get('action') ||
      body.action ||
      'health'
  ).trim();
}

function requireDb(res) {
  if (!db) {
    json(res, 503, {
      ok: false,
      message:
        'DOOX CORE ainda não está conectado ao banco. Configure DOOX_DATABASE_URL no Vercel.',
    });

    return false;
  }

  return true;
}

function requireAdmin(req, res) {
  const expected =
    process.env.DOOX_ADMIN_SECRET;

  if (!expected) {
    json(res, 503, {
      ok: false,
      message:
        'Operação administrativa não configurada. Defina DOOX_ADMIN_SECRET no Vercel.',
    });

    return false;
  }

  const provided = String(
    req.headers['x-doox-admin-secret'] || ''
  );

  if (
    !provided ||
    provided !== expected
  ) {
    json(res, 401, {
      ok: false,
      message:
        'Autorização administrativa inválida.',
    });

    return false;
  }

  return true;
}

function parsePositiveInt(
  value,
  fallback = 1
) {
  const n = Number.parseInt(value, 10);

  return Number.isFinite(n) && n > 0
    ? n
    : fallback;
}

function mapType(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();

  if (v === 'empresa') {
    return 'EMPRESA';
  }

  if (
    v === 'pessoa' ||
    v === 'pessoa física' ||
    v === 'pessoa_fisica'
  ) {
    return 'PESSOA_FISICA';
  }

  return String(value || '')
    .trim()
    .toUpperCase();
}

function mapModality(value) {
  if (MODE_MAP[value]) {
    return MODE_MAP[value];
  }

  const v = String(value || '')
    .trim()
    .toUpperCase();

  return Object.values(MODE_MAP).includes(v)
    ? v
    : v;
}

function mapRange(value) {
  if (!value) {
    return null;
  }

  if (RANGE_MAP[value]) {
    return RANGE_MAP[value];
  }

  const v = String(value)
    .trim()
    .toUpperCase();

  return /^F[1-5]$/.test(v)
    ? v
    : null;
}

function b64url(input) {
  return Buffer
    .from(input)
    .toString('base64url');
}

function sign(value) {
  const secret =
    process.env.DOOX_TRACKING_SECRET;

  if (!secret) {
    throw new Error(
      'DOOX_TRACKING_SECRET não configurado.'
    );
  }

  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64url');
}

function makeTrackingToken(pedidoId) {
  const ttlDays =
    parsePositiveInt(
      process.env.DOOX_TRACKING_TTL_DAYS,
      3650
    );

  const expires =
    Date.now() +
    ttlDays *
      24 *
      60 *
      60 *
      1000;

  const payload =
    `${pedidoId}.${expires}`;

  return `${b64url(payload)}.${sign(payload)}`;
}

function verifyTrackingToken(token) {
  if (
    !token ||
    typeof token !== 'string'
  ) {
    throw new Error(
      'Token de acompanhamento inválido.'
    );
  }

  const [
    encoded,
    receivedSignature,
  ] = token.split('.');

  if (
    !encoded ||
    !receivedSignature
  ) {
    throw new Error(
      'Token de acompanhamento inválido.'
    );
  }

  const payload = Buffer
    .from(encoded, 'base64url')
    .toString('utf8');

  const [
    pedidoId,
    expiresRaw,
  ] = payload.split('.');

  const expectedSignature =
    sign(payload);

  const a =
    Buffer.from(receivedSignature);

  const b =
    Buffer.from(expectedSignature);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    throw new Error(
      'Token de acompanhamento inválido.'
    );
  }

  const expires =
    Number(expiresRaw);

  if (
    !pedidoId ||
    !Number.isFinite(expires) ||
    Date.now() > expires
  ) {
    throw new Error(
      'Token de acompanhamento expirado.'
    );
  }

  return pedidoId;
}

function modalityName(code) {
  return (
    Object.entries(MODE_MAP).find(
      ([, value]) =>
        value === code
    )?.[0] || code
  );
}

function normalizeTracking(
  data,
  pedido
) {
  const status =
    pedido?.status_operacional ||
    pedido?.status ||
    'SOLICITADO';

  const materiais =
    pedido?.materiais || [];

  const allApproved =
    materiais.length === 0 ||
    materiais.every(
      (material) =>
        material.status ===
        'APROVADO'
    );

  const discount =
    Number(
      pedido?.valor_desconto || 0
    );

  return {
    ok: true,

    code:
      pedido.codigo_doox,

    status,

    statusLabel:
      STATUS_LABELS[status] ||
      status,

    progressPercent:
      STATUS_PROGRESS[status] ??
      10,

    updatedAt:
      pedido.atualizado_em ||
      pedido.criado_em,

    discount,

    coupon:
      data?.coupon || '',

    customerMessage:
      data?.customerMessage || '',

    observationClient:
      data?.observationClient ||
      '',

    payment: {
      available: false,

      status:
        pedido.status_pagamento,

      amountLabel:
        `Valor do pedido: R$ ${Number(
          pedido.valor_total || 0
        )
          .toFixed(2)
          .replace('.', ',')}`,

      pixPayload: '',
    },

    materials: materiais,

    materialReady:
      allApproved,

    receipt: {
      eligible:
        pedido.status_veiculacao ===
          'FINALIZADA' ||
        pedido.status_operacional ===
          'FINALIZADO',
    },
  };
}

async function callJson(
  sqlQuery
) {
  const rows = await sqlQuery;

  if (!rows?.length) {
    throw new Error(
      'O DOOX CORE não retornou dados.'
    );
  }

  const value =
    rows[0]?.data;

  if (
    value &&
    typeof value === 'object' &&
    value.ok === false
  ) {
    throw new Error(
      value.message ||
        'Operação recusada pelo DOOX CORE.'
    );
  }

  return value;
}

/* =========================================================
   REGISTER REQUEST
   ========================================================= */

async function registerRequest(
  body
) {
  /*
   * ANTIFRAUDE / HONEYPOT
   */

  if (body.website) {
    throw new Error(
      'Solicitação recusada.'
    );
  }

  /*
   * ACEITES PRINCIPAIS
   */

  if (
    body.termsAccepted !== true
  ) {
    throw new Error(
      'Os Termos de Uso precisam ser aceitos.'
    );
  }

  if (
    body.rulesAccepted !== true
  ) {
    throw new Error(
      'As Regras de Participação precisam ser aceitas.'
    );
  }

  /*
   * NORMALIZAÇÃO
   */

  const type = mapType(
    body.type ||
      body.tipo_participacao
  );

  const modality =
    mapModality(
      body.modality ||
        body.modalidade
    );

  const range =
    mapRange(
      body.moment ||
        body.momento ||
        body.faixa
    );

  const quantity =
    parsePositiveInt(
      body.quantity ??
        body.quantidade,
      1
    );

  const name = String(
    body.name ||
      body.nome ||
      ''
  ).trim();

  const company = String(
    body.company ||
      body.empresa ||
      ''
  ).trim();

  const email = String(
    body.email || ''
  )
    .trim()
    .toLowerCase();

  const whatsapp = String(
    body.whatsapp || ''
  ).replace(/\D/g, '');

  const profile = String(
    body.profile ||
      body.perfil ||
      ''
  ).trim();

  const segment = String(
    body.segment ||
      body.segmento ||
      ''
  ).trim();

  const observation = String(
    body.observation ||
      body.observacoes ||
      ''
  ).trim();

  /*
   * VALIDAÇÕES
   */

  if (!name) {
    throw new Error(
      'Nome é obrigatório.'
    );
  }

  if (!email) {
    throw new Error(
      'E-mail é obrigatório.'
    );
  }

  if (!whatsapp) {
    throw new Error(
      'WhatsApp é obrigatório.'
    );
  }

  if (
    !['EMPRESA', 'PESSOA_FISICA']
      .includes(type)
  ) {
    throw new Error(
      'Tipo de participação inválido.'
    );
  }

  if (!modality) {
    throw new Error(
      'Modalidade inválida.'
    );
  }

  if (
    type === 'EMPRESA' &&
    !company
  ) {
    throw new Error(
      'Nome da empresa é obrigatório.'
    );
  }

  if (
    type === 'PESSOA_FISICA' &&
    modality !==
      'APOIADOR_INDIVIDUAL'
  ) {
    throw new Error(
      'Pessoa física participa somente como Apoiador Individual.'
    );
  }

  if (
    type === 'EMPRESA' &&
    modality ===
      'APOIADOR_INDIVIDUAL'
  ) {
    throw new Error(
      'Apoiador Individual é exclusivo para pessoa física.'
    );
  }

  if (
    type === 'EMPRESA' &&
    body.companyTermsAccepted !==
      true
  ) {
    throw new Error(
      'O Termo de Participação Empresarial precisa ser aceito.'
    );
  }

  /*
   * MODALIDADES QUE NÃO POSSUEM FAIXA
   */

  const modalityWithoutRange = [
    'RODAPE',
    'PATROCINADOR_EPISODIO',
    'APOIADOR_INDIVIDUAL',
  ].includes(modality);

  if (
    !modalityWithoutRange &&
    !range
  ) {
    throw new Error(
      'Faixa é obrigatória para esta modalidade.'
    );
  }

  /*
   * IDEMPOTÊNCIA
   *
   * O mesmo clientRequestId não deve
   * gerar vários pedidos.
   */

  const idempotencyKey =
    String(
      body.clientRequestId ||
        body.idempotency_key ||
        crypto.randomUUID()
    ).trim();

  if (!idempotencyKey) {
    throw new Error(
      'Identificador da solicitação inválido.'
    );
  }

  /*
   * BENEFÍCIO / CUPOM
   */

  const discountNumber =
    Number(body.discount || 0);

  const coupon =
    String(
      body.coupon || ''
    ).trim();

  const benefitDescription =
    String(
      body.benefit || ''
    ).trim();

  const benefit =
    discountNumber > 0 || coupon
      ? {
          tipo: 'CONDICAO',

          codigo:
            coupon || null,

          descricao:
            benefitDescription ||
            (
              discountNumber > 0
                ? `${discountNumber}% de desconto para quem vier pela HOCCO`
                : 'Condição comercial informada pelo participante.'
            ),
        }
      : null;

  /*
   * PAYLOAD ENVIADO AO DOOX CORE
   *
   * O preço NÃO é recebido do navegador.
   * O CORE calcula o preço oficial.
   */

  const payload = {
    tipo_participacao:
      type,

    modalidade:
      modality,

    faixa:
      range,

    quantidade:
      quantity,

    nome:
      name,

    empresa:
      company || null,

    whatsapp,

    email,

    perfil:
      profile || null,

    segmento:
      segment || null,

    observacoes:
      observation || null,

    momento_preferencial:
      range,

    idempotency_key:
      idempotencyKey,

    origem:
      'SITE_1',

    beneficio:
      benefit,
  };

  /*
   * CRIAÇÃO REAL DO PEDIDO
   */

  const created =
    await callJson(
      db`
        SELECT doox_core.criar_pedido(
          ${JSON.stringify(
            payload
          )}::jsonb
        ) AS data
      `
    );

  /*
   * IDENTIFICADOR TÉCNICO
   */

  const pedidoId =
    created?.pedido_id ||
    created?.pedido?.id ||
    created?.id;

  if (!pedidoId) {
    throw new Error(
      'O DOOX CORE não retornou o identificador técnico do pedido.'
    );
  }

  /*
   * RECUPERA PEDIDO DEFINITIVO
   */

  const pedido =
    await callJson(
      db`
        SELECT doox_core.resumo_pedido(
          ${pedidoId}::uuid
        ) AS data
      `
    );

  if (!pedido) {
    throw new Error(
      'O pedido foi criado, mas não foi possível recuperar seus dados.'
    );
  }

  /*
   * REGISTRA ACEITE ELETRÔNICO
   */

  const userAgent =
    String(
      body.userAgent || ''
    ).slice(0, 500);

  await callJson(
    db`
      SELECT doox_core.registrar_aceite(
        ${pedidoId}::uuid,
        'TERMO_EMPRESA_ACEITE',
        '2026.09',
        ${name},
        ${`ACEITE DIGITAL — ${name}`},
        NULL,
        ${userAgent || null}
      ) AS data
    `
  );

  /*
   * TOKEN DE ACOMPANHAMENTO
   */

  const trackingToken =
    makeTrackingToken(
      pedidoId
    );

  const baseUrl =
    process.env.DOOX_PUBLIC_BASE_URL ||
    'https://doox-omega.vercel.app';

  const trackingUrl =
    `${baseUrl.replace(/\/$/, '')}/?token=${encodeURIComponent(
      trackingToken
    )}`;

  /*
   * VALORES DEFINITIVOS
   *
   * Sempre priorizamos os valores
   * retornados pelo DOOX CORE.
   */

  const finalUnitPrice =
    Number(
      pedido?.valor_unitario ??
        created?.valor_unitario ??
        0
    );

  const finalGross =
    Number(
      pedido?.valor_bruto ??
        created?.valor_bruto ??
        finalUnitPrice *
          quantity
    );

  const finalDiscount =
    Number(
      pedido?.valor_desconto ??
        created?.valor_desconto ??
        0
    );

  const finalTotal =
    Number(
      pedido?.valor_total ??
        created?.valor_total ??
        Math.max(
          finalGross -
            finalDiscount,
          0
        )
    );

  /*
   * RESPOSTA DEFINITIVA
   */

  return {
    ok: true,

    pedido: {
      id:
        pedidoId,

      codigo_doox:
        pedido?.codigo_doox ||
        created?.codigo_doox ||
        null,

      tipo_participacao:
        pedido?.tipo_participacao ||
        type,

      modalidade:
        pedido?.modalidade ||
        modality,

      modalidade_nome:
        modalityName(
          pedido?.modalidade ||
            modality
        ),

      faixa:
        pedido?.faixa ||
        range,

      quantidade:
        Number(
          pedido?.quantidade ??
            quantity
        ),

      valor_unitario:
        finalUnitPrice,

      valor_bruto:
        finalGross,

      valor_desconto:
        finalDiscount,

      valor_total:
        finalTotal,

      moeda:
        pedido?.moeda ||
        'BRL',

      status_operacional:
        pedido?.status_operacional ||
        'SOLICITADO',

      status_pagamento:
        pedido?.status_pagamento ||
        'AGUARDANDO_PAGAMENTO',

      status_material:
        pedido?.status_material ||
        'PENDENTE',

      status_producao:
        pedido?.status_producao ||
        'NAO_INICIADA',

      status_veiculacao:
        pedido?.status_veiculacao ||
        'NAO_PROGRAMADA',
    },

    participante: {
      nome:
        name,

      empresa:
        company || null,

      email,

      whatsapp,

      perfil:
        profile || null,

      segmento:
        segment || null,
    },

    aceite: {
      registrado:
        true,

      documento:
        'TERMO_EMPRESA_ACEITE',

      versao:
        '2026.09',
    },

    beneficio: {
      desconto:
        finalDiscount,

      cupom:
        coupon || '',
    },

    tracking: {
      token:
        trackingToken,

      url:
        trackingUrl,
    },

    requestId:
      idempotencyKey,
  };
}

async function getTracking(
  req,
  url,
  body
) {
  const token = String(
    url.searchParams.get(
      'token'
    ) ||
      body.token ||
      ''
  ).trim();

  const pedidoId =
    verifyTrackingToken(
      token
    );

  const pedido =
    await callJson(
      db`
        SELECT doox_core.consultar_pedido(
          ${pedidoId}::uuid
        ) AS data
      `
    );

  return normalizeTracking(
    pedido,
    {
      ...pedido.pedido,

      materiais:
        pedido.materiais || [],

      pagamentos:
        pedido.pagamentos || [],
    }
  );
}

async function informPayment(
  req,
  url,
  body
) {
  const token = String(
    url.searchParams.get(
      'token'
    ) ||
      body.token ||
      ''
  ).trim();

  const pedidoId =
    verifyTrackingToken(
      token
    );

  await callJson(
    db`
      INSERT INTO doox_core.historico (
        pedido_id,
        entidade,
        campo,
        valor_anterior,
        valor_novo,
        origem,
        observacao
      )
      VALUES (
        ${pedidoId}::uuid,
        'PAGAMENTO',
        'aviso_cliente',
        NULL,
        'INFORMADO_PELO_CLIENTE',
        'SITE_1',
        'O participante informou pelo acompanhamento que realizou o pagamento. O status RECEBIDO depende de conferência pela DOOX.'
      )
      RETURNING jsonb_build_object(
        'ok',
        true
      ) AS data
    `
  );

  return {
    ok: true,
    message:
      'Pagamento informado. A confirmação do status depende da conferência pela DOOX.',
  };
}

async function adminAction(
  action,
  body
) {
  switch (action) {
    case 'confirmarPagamento': {
      const pedidoId =
        body.pedidoId ||
        body.pedido_id;

      if (!pedidoId) {
        throw new Error(
          'pedidoId é obrigatório.'
        );
      }

      const valor =
        Number(body.valor);

      return callJson(
        db`
          SELECT doox_core.confirmar_pagamento(
            ${pedidoId}::uuid,
            ${valor},
            ${
              body.referencia_externa ||
              null
            },
            ${body.metodo || null},
            NULL
          ) AS data
        `
      );
    }

    case 'registrarMaterial': {
      return callJson(
        db`
          SELECT doox_core.registrar_material(
            ${body.pedidoId}::uuid,
            ${body.tipo_material},
            ${body.nome_original},
            ${body.mime_type},
            ${Number(
              body.tamanho_bytes
            )},
            ${body.storage_path},
            ${
              body.hash_arquivo ||
              null
            }
          ) AS data
        `
      );
    }

    case 'aprovarMaterial': {
      return callJson(
        db`
          SELECT doox_core.aprovar_material(
            ${body.materialId}::uuid,
            ${body.aprovado === true},
            ${body.motivo || null}
          ) AS data
        `
      );
    }

    case 'definirMomento': {
      return callJson(
        db`
          SELECT doox_core.definir_momento(
            ${body.pedidoId}::uuid,
            ${body.momentoId}::uuid
          ) AS data
        `
      );
    }

    case 'reservarPosicoes': {
      return callJson(
        db`
          SELECT doox_core.reservar_posicoes(
            ${body.pedidoId}::uuid
          ) AS data
        `
      );
    }

    case 'mudarProducao': {
      return callJson(
        db`
          SELECT doox_core.mudar_producao(
            ${body.pedidoId}::uuid,
            ${body.status},
            ${body.observacao || null},
            NULL
          ) AS data
        `
      );
    }

    case 'programar': {
      return callJson(
        db`
          SELECT doox_core.programar_pedido(
            ${body.pedidoId}::uuid,
            ${body.data_hora}::timestamptz,
            NULL
          ) AS data
        `
      );
    }

    case 'veicular': {
      return callJson(
        db`
          SELECT doox_core.marcar_veiculado(
            ${body.pedidoId}::uuid,
            NULL
          ) AS data
        `
      );
    }

    case 'finalizar': {
      return callJson(
        db`
          SELECT doox_core.finalizar_pedido(
            ${body.pedidoId}::uuid,
            NULL,
            ${body.observacao || null}
          ) AS data
        `
      );
    }

    case 'cancelar': {
      return callJson(
        db`
          SELECT doox_core.cancelar_pedido(
            ${body.pedidoId}::uuid,
            ${body.observacao || null},
            NULL
          ) AS data
        `
      );
    }

    case 'dashboard': {
      const [
        indicadores,
        pedidos,
        fila,
        disponibilidade,
        mapa,
      ] = await Promise.all([
        db`
          SELECT
            COUNT(*) FILTER (
              WHERE status_operacional =
                'SOLICITADO'
            ) AS novos,

            COUNT(*) FILTER (
              WHERE status_operacional =
                'EM_ANALISE'
            ) AS em_analise,

            COUNT(*) FILTER (
              WHERE status_pagamento =
                'AGUARDANDO_PAGAMENTO'
            ) AS aguardando_pagamento,

            COUNT(*) FILTER (
              WHERE status_material =
                'PENDENTE'
            ) AS material_pendente,

            COUNT(*) FILTER (
              WHERE status_operacional =
                'FILA_DE_ESPERA'
            ) AS fila,

            COUNT(*) FILTER (
              WHERE status_producao =
                'EM_PRODUCAO'
            ) AS em_producao,

            COUNT(*) FILTER (
              WHERE status_veiculacao =
                'PROGRAMADA'
            ) AS programadas,

            COUNT(*) FILTER (
              WHERE status_veiculacao =
                'VEICULADA'
            ) AS veiculadas,

            COALESCE(
              SUM(valor_total) FILTER (
                WHERE status_pagamento =
                  'RECEBIDO'
              ),
              0
            ) AS valor_recebido

          FROM doox_core.pedidos
        `,

        db`
          SELECT *
          FROM doox_core.v_pedidos_operacionais
          ORDER BY criado_em DESC
          LIMIT 100
        `,

        db`
          SELECT *
          FROM doox_core.v_fila_espera
        `,

        db`
          SELECT *
          FROM doox_core.v_disponibilidade
          ORDER BY
            episodio_numero,
            inicio_segundos
        `,

        db`
          SELECT *
          FROM doox_core.v_mapa_posicoes
          ORDER BY
            episodio_numero,
            momento_codigo,
            posicao_numero
        `,
      ]);

      return {
        ok: true,

        indicadores:
          indicadores || {},

        pedidos:
          pedidos || [],

        fila:
          fila || [],

        disponibilidade:
          disponibilidade || [],

        mapa:
          mapa || [],
      };
    }

    case 'listarPedidos': {
      const limit =
        Math.min(
          parsePositiveInt(
            body.limit,
            100
          ),
          500
        );

      const result =
        await db`
          SELECT *
          FROM doox_core.v_pedidos_operacionais
          ORDER BY criado_em DESC
          LIMIT ${limit}
        `;

      return {
        ok: true,
        pedidos: result,
      };
    }

    case 'listarFila': {
      const result =
        await db`
          SELECT *
          FROM doox_core.v_fila_espera
        `;

      return {
        ok: true,
        fila: result,
      };
    }

    case 'listarDisponibilidade': {
      const result =
        await db`
          SELECT *
          FROM doox_core.v_disponibilidade
          ORDER BY
            episodio_numero,
            inicio_segundos
        `;

      return {
        ok: true,
        disponibilidade:
          result,
      };
    }

    case 'listarMapa': {
      const result =
        await db`
          SELECT *
          FROM doox_core.v_mapa_posicoes
          ORDER BY
            episodio_numero,
            momento_codigo,
            posicao_numero
        `;

      return {
        ok: true,
        mapa: result,
      };
    }

    default:
      throw new Error(
        `Ação administrativa não reconhecida: ${action}`
      );
  }
}

export default async function handler(
  req,
  res
) {
  if (
    !['GET', 'POST'].includes(
      req.method
    )
  ) {
    return json(res, 405, {
      ok: false,
      message:
        'Método não permitido.',
    });
  }

  const url = new URL(
    req.url,
    `https://${req.headers.host || 'doox-omega.vercel.app'}`
  );

  const body =
    normalizeBody(req);

  const action =
    getAction(url, body);

  try {
    /*
     * HEALTH
     */

    if (action === 'health') {
      return json(res, 200, {
        ok: true,
        service: 'DOOX CORE',
        version: '2026.09.1',
        databaseConfigured:
          Boolean(db),
        timestamp:
          new Date().toISOString(),
      });
    }

    /*
     * BANCO
     */

    if (!requireDb(res)) {
      return;
    }

    /*
     * CATÁLOGO
     */

    if (action === 'catalogo') {
      const catalogo =
        await callJson(
          db`
            SELECT doox_core.catalogo_publico()
            AS data
          `
        );

      return json(res, 200, {
        ok: true,
        catalogo,
      });
    }

    /*
     * SIMULAÇÃO
     */

    if (action === 'simular') {
      const modality =
        mapModality(
          body.modality ||
            body.modalidade ||
            url.searchParams.get(
              'modality'
            ) ||
            url.searchParams.get(
              'modalidade'
            )
        );

      const range =
        mapRange(
          body.range ||
            body.faixa ||
            url.searchParams.get(
              'range'
            ) ||
            url.searchParams.get(
              'faixa'
            )
        );

      const quantity =
        parsePositiveInt(
          body.quantity ??
            body.quantidade ??
            url.searchParams.get(
              'quantity'
            ) ??
            url.searchParams.get(
              'quantidade'
            ),
          1
        );

      if (!modality) {
        return json(res, 400, {
          ok: false,
          message:
            'Modalidade não informada.',
        });
      }

      const modalityWithoutRange = [
        'RODAPE',
        'PATROCINADOR_EPISODIO',
        'APOIADOR_INDIVIDUAL',
      ].includes(modality);

      if (
        !range &&
        !modalityWithoutRange
      ) {
        return json(res, 400, {
          ok: false,
          message:
            'Faixa não informada ou inválida.',
        });
      }

      const result =
        await callJson(
          db`
            SELECT doox_core.simular(
              ${modality},
              ${range},
              ${quantity}
            ) AS data
          `
        );

      return json(res, 200, {
        ok: true,
        ...result,
      });
    }

    /*
     * CADASTRO / PEDIDO
     */

    if (
      action ===
      'registerRequest'
    ) {
      if (req.method !== 'POST') {
        return json(res, 405, {
          ok: false,
          message:
            'registerRequest exige POST.',
        });
      }

      const result =
        await registerRequest({
          ...body,

          userAgent:
            String(
              req.headers[
                'user-agent'
              ] || ''
            ).slice(0, 500),
        });

      return json(
        res,
        200,
        result
      );
    }

    /*
     * ACOMPANHAMENTO
     */

    if (action === 'pedido') {
      const result =
        await getTracking(
          req,
          url,
          body
        );

      return json(
        res,
        200,
        result
      );
    }

    /*
     * INFORMAR PAGAMENTO
     */

    if (
      action ===
      'informarPagamento'
    ) {
      if (req.method !== 'POST') {
        return json(res, 405, {
          ok: false,
          message:
            'informarPagamento exige POST.',
        });
      }

      const result =
        await informPayment(
          req,
          url,
          body
        );

      return json(
        res,
        200,
        result
      );
    }

    /*
     * OPERAÇÕES ADMINISTRATIVAS
     */

    if (
      !requireAdmin(
        req,
        res
      )
    ) {
      return;
    }

    const result =
      await adminAction(
        action,
        body
      );

    return json(
      res,
      200,
      result
    );
  } catch (error) {
    console.error(
      'DOOX CORE ERROR:',
      error
    );

    const message =
      error?.message ||
      'Não foi possível concluir a operação.';

    return json(res, 400, {
      ok: false,
      message:
        message.length > 500
          ? message.slice(
              0,
              500
            )
          : message,
    });
  }
}