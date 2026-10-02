const SUPABASE_URL = String(process.env.HOCCO_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = String(process.env.HOCCO_SUPABASE_SECRET_KEY || '').trim();
const PUBLIC_BASE_URL = String(process.env.HOCCO_PUBLIC_BASE_URL || '').replace(/\/$/, '');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return req.body ? JSON.parse(req.body) : {}; } catch { return {}; }
}

function actionOf(req, body) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  return String(url.searchParams.get('action') || body.action || 'health').trim().toLowerCase();
}

function configOk() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

async function supabase(path, options = {}) {
  if (!configOk()) throw new Error('HOCCO_API_NOT_CONFIGURED');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const message = data?.message || data?.details || data?.hint || `Supabase HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function health() {
  if (!configOk()) {
    return { ok: false, service: 'HOCCO API V1', configured: false, database: false, version: '1.0.0' };
  }

  try {
    const rows = await supabase('/rest/v1/modalidades?select=id,codigo&ativo=eq.true&limit=1');
    return {
      ok: true,
      service: 'HOCCO API V1',
      configured: true,
      database: Array.isArray(rows),
      version: '1.0.0'
    };
  } catch (error) {
    return {
      ok: false,
      service: 'HOCCO API V1',
      configured: true,
      database: false,
      version: '1.0.0',
      error: 'DATABASE_UNAVAILABLE'
    };
  }
}

async function catalog() {
  const rows = await supabase(
    '/rest/v1/v_catalogo?select=*&order=modalidade_ordem.asc,faixa_ordem.asc.nullsfirst'
  );
  return { ok: true, catalogo: rows || [] };
}

async function registerRequest(req, body) {
  if (body.website) throw new Error('Solicitação inválida.');

  const payload = { ...body };
  delete payload.action;

  if (!payload.clientRequestId && !payload.idempotency_key) {
    payload.clientRequestId = crypto.randomUUID();
  }

  const data = await supabase('/rest/v1/rpc/registrar_solicitacao', {
    method: 'POST',
    body: JSON.stringify({ p: payload })
  });

  if (!data?.ok || !data?.solicitacao_id || !data?.numero) {
    throw new Error('O banco não retornou a identificação completa da solicitação.');
  }

  const base = PUBLIC_BASE_URL || `https://${req.headers.host || ''}`;
  const trackingUrl = `${base}/?solicitacao=${encodeURIComponent(data.numero)}&token=${encodeURIComponent(data.tracking_token)}`;

  return {
    ok: true,
    duplicate: Boolean(data.duplicate),
    solicitacaoId: data.solicitacao_id,
    technicalId: data.solicitacao_id,
    id: data.solicitacao_id,
    numero: Number(data.numero),
    numeroExibicao: data.numero_exibicao,
    trackingToken: data.tracking_token,
    trackingUrl,
    modalidade: data.modalidade,
    modalidadeNome: data.modalidade_nome,
    faixa: data.faixa,
    quantidade: Number(data.quantidade || 1),
    valorUnitario: Number(data.valor_unitario || 0),
    valorTotal: Number(data.valor_total || 0),
    status: data.status,
    statusPagamento: data.status_pagamento,
    statusMaterial: data.status_material,
    requestId: payload.clientRequestId || payload.idempotency_key
  };
}

async function track(req, body) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const numero = Number(url.searchParams.get('numero') || body.numero || 0);
  const token = String(url.searchParams.get('token') || body.token || '').trim();

  if (!Number.isInteger(numero) || numero <= 0 || !/^[0-9a-f-]{36}$/i.test(token)) {
    return { ok: false, erro: 'DADOS_DE_ACOMPANHAMENTO_INVALIDOS' };
  }

  return await supabase('/rest/v1/rpc/acompanhar_solicitacao', {
    method: 'POST',
    body: JSON.stringify({ p_numero: numero, p_token: token })
  });
}

function publicMessage(error) {
  const raw = String(error?.message || '');
  const allow = [
    /Tipo de participação/i,
    /Modalidade/i,
    /Quantidade/i,
    /Faixa comercial/i,
    /Nome obrigatório/i,
    /WhatsApp obrigatório/i,
    /E-mail obrigatório/i,
    /Nome da empresa obrigatório/i,
    /Termos de Uso/i,
    /Regras de Participação/i,
    /Termo Empresarial/i,
    /Preço não configurado/i,
    /Solicitação inválida/i
  ];
  return allow.some((rx) => rx.test(raw)) ? raw : 'Não foi possível concluir a solicitação agora.';
}

export default async function handler(req, res) {
  const body = bodyOf(req);
  const action = actionOf(req, body);

  if (!['GET', 'POST'].includes(req.method)) {
    return send(res, 405, { ok: false, message: 'Método não permitido.' });
  }

  try {
    if (action === 'health') return send(res, 200, await health());
    if (action === 'catalog') return send(res, 200, await catalog());
    if (action === 'registerrequest' && req.method === 'POST') return send(res, 200, await registerRequest(req, body));
    if (action === 'track') return send(res, 200, await track(req, body));
    return send(res, 400, { ok: false, message: 'Ação inválida.' });
  } catch (error) {
    console.error('HOCCO API V1', action, error);
    return send(res, 400, { ok: false, message: publicMessage(error) });
  }
}
