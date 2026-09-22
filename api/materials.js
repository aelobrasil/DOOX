import crypto from 'node:crypto';
import postgres from 'postgres';

const BUCKET = 'doox-v2-arquivos';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const DATABASE_URL = String(process.env.DOOX_DATABASE_URL || '');

const LIMITS = {
  LOGO: 5 * 1024 * 1024,
  AUDIO: 15 * 1024 * 1024,
  IMAGEM: 10 * 1024 * 1024,
  OUTRO: 10 * 1024 * 1024
};

const MIME = {
  LOGO: ['image/jpeg', 'image/png', 'image/webp'],
  AUDIO: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'],
  IMAGEM: ['image/jpeg', 'image/png', 'image/webp'],
  OUTRO: []
};

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function clean(value) {
  return String(value ?? '').trim();
}

function safeName(name) {
  const base = clean(name).split(/[\\/]/).pop() || 'arquivo';
  return base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120) || 'arquivo';
}

function extension(name, mime) {
  const ext = clean(name).split('.').pop()?.toLowerCase();
  if (ext && ext !== clean(name).toLowerCase()) return ext.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav'
  };
  return map[mime] || 'bin';
}

function decodeBase64(value) {
  const raw = clean(value);
  if (!raw) throw new Error('Arquivo não enviado.');
  const match = raw.match(/^data:[^;]+;base64,(.*)$/s);
  const encoded = match ? match[1] : raw;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(encoded)) throw new Error('Conteúdo do arquivo inválido.');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw new Error('Arquivo vazio ou inválido.');
  return buffer;
}

async function uploadToStorage(path, buffer, mime) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Storage DOOX não configurado no Vercel. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': mime || 'application/octet-stream',
      'x-upsert': 'false',
      'Cache-Control': '3600'
    },
    body: buffer
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao armazenar material: ${text || `HTTP ${response.status}`}`);
  }
}

async function registerMaterial(pedidoId, type, originalName, mime, size, storagePath) {
  if (!DATABASE_URL) throw new Error('DOOX_DATABASE_URL não configurada no Vercel.');

  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10
  });

  try {
    const rows = await sql`
      select * from doox_core.registrar_material(
        ${pedidoId}::uuid,
        ${type},
        ${originalName},
        ${mime},
        ${Number(size)},
        ${storagePath}
      )
    `;
    return rows?.[0] || null;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function signedDownload(path) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Storage DOOX não configurado.');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: 3600 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Falha ao gerar link (HTTP ${response.status}).`);
  const signed = data.signedURL || data.signedUrl || data.path;
  if (!signed) throw new Error('O Storage não retornou o link assinado.');
  return signed.startsWith('http') ? signed : `${SUPABASE_URL}/storage/v1${signed}`;
}

export default async function handler(req, res) {
  try {
    const action = clean(req.query?.action || (req.body && req.body.action)).toLowerCase();

    if (req.method === 'GET' && action === 'download_url') {
      const path = clean(req.query?.path);
      if (!path) return json(res, 400, { ok: false, message: 'Informe o caminho do arquivo.' });
      const url = await signedDownload(path);
      return json(res, 200, { ok: true, download_url: url, expires_in: 3600 });
    }

    if (req.method !== 'POST' || action !== 'upload') {
      return json(res, 405, { ok: false, message: 'Ação de materiais inválida.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const pedidoId = clean(body.pedidoId || body.technicalId || body.pedido_id);
    const type = clean(body.materialType || body.tipo || body.type).toUpperCase();
    const fileName = clean(body.fileName || body.originalName || 'arquivo');
    const mimeType = clean(body.mimeType || body.mime || 'application/octet-stream').toLowerCase();
    const declaredSize = Number(body.size || 0);

    if (!pedidoId) return json(res, 400, { ok: false, message: 'Identificador técnico do pedido não informado.' });
    if (!/^[0-9a-fA-F-]{36}$/.test(pedidoId)) return json(res, 400, { ok: false, message: 'Identificador técnico do pedido inválido.' });
    if (!Object.prototype.hasOwnProperty.call(LIMITS, type)) return json(res, 400, { ok: false, message: 'Tipo de material inválido.' });

    const buffer = decodeBase64(body.base64 || body.data || body.file);
    const size = buffer.length;
    if (declaredSize && declaredSize !== size) return json(res, 400, { ok: false, message: 'O tamanho informado não corresponde ao arquivo recebido.' });
    if (size > LIMITS[type]) return json(res, 413, { ok: false, message: `Arquivo excede o limite permitido para ${type}.` });
    if (MIME[type].length && !MIME[type].includes(mimeType)) return json(res, 415, { ok: false, message: `Formato não permitido para ${type}.` });

    const id = crypto.randomUUID();
    const ext = extension(fileName, mimeType);
    const finalName = `${id}-${safeName(fileName).replace(/\.[^.]+$/, '')}.${ext}`;
    const storagePath = `pedidos/${pedidoId}/${type}/${finalName}`;

    await uploadToStorage(storagePath, buffer, mimeType);

    let record;
    try {
      record = await registerMaterial(pedidoId, type, fileName, mimeType, size, storagePath);
    } catch (error) {
      // O arquivo já foi gravado; o registro no CORE falhou. Não mascarar o erro.
      return json(res, 500, {
        ok: false,
        message: error?.message || 'Material armazenado, mas não foi possível registrá-lo no DOOX CORE.',
        storagePath
      });
    }

    return json(res, 200, {
      ok: true,
      material: {
        id: record?.id || null,
        pedido_id: pedidoId,
        tipo: type,
        nome_original: fileName,
        mime_type: mimeType,
        tamanho_bytes: size,
        storage_path: storagePath,
        registrado: true
      }
    });
  } catch (error) {
    return json(res, 500, { ok: false, message: error?.message || String(error) });
  }
}
