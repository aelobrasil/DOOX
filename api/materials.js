import crypto from 'node:crypto';
import postgres from 'postgres';

const BUCKET = 'doox-v2-arquivos';
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const DATABASE_URL = String(process.env.DOOX_DATABASE_URL || '');

const LIMITS = { LOGO: 5 * 1024 * 1024, AUDIO: 15 * 1024 * 1024, IMAGEM: 10 * 1024 * 1024, OUTRO: 10 * 1024 * 1024 };
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
function clean(v) { return String(v ?? '').trim(); }
function safeName(name) {
  const base = clean(name).split(/[\\/]/).pop() || 'arquivo';
  return base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 120) || 'arquivo';
}
function extension(name, mime) {
  const raw = clean(name).split('.').pop()?.toLowerCase();
  if (raw && raw !== clean(name).toLowerCase()) return raw.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/wave':'wav'})[mime] || 'bin';
}
function sign(value) {
  const secret = process.env.DOOX_TRACKING_SECRET;
  if (!secret) throw new Error('DOOX_TRACKING_SECRET não configurado.');
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}
function verifyTrackingToken(token) {
  const parts = clean(token).split('.');
  if (parts.length !== 2) throw new Error('Token de acompanhamento inválido.');
  const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
  const [pedidoId, expiresRaw] = payload.split('.');
  const expected = sign(payload);
  const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Token de acompanhamento inválido.');
  const expires = Number(expiresRaw);
  if (!pedidoId || !Number.isFinite(expires) || Date.now() > expires) throw new Error('Token de acompanhamento expirado.');
  return pedidoId;
}
function assertConfig() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Storage DOOX não configurado no Vercel. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  if (!DATABASE_URL) throw new Error('DOOX_DATABASE_URL não configurada no Vercel.');
}
function validateMaterial(type, mime, size) {
  if (!Object.prototype.hasOwnProperty.call(LIMITS, type)) throw new Error('Tipo de material inválido.');
  if (!Number.isFinite(size) || size <= 0) throw new Error('Tamanho do material inválido.');
  if (size > LIMITS[type]) throw new Error(`Arquivo excede o limite permitido para ${type}.`);
  if (MIME[type].length && !MIME[type].includes(mime)) throw new Error(`Formato não permitido para ${type}.`);
}
function storageUrl(path) { return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`; }
async function createSignedUpload(path) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST', headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ upsert: false })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Falha ao preparar upload (HTTP ${response.status}).`);
  const signed = data.signedUrl || data.signedURL || (data.url ? new URL(data.url, SUPABASE_URL + '/storage/v1').toString() : '');
  if (!signed) throw new Error('O Storage não retornou a URL de upload.');
  return signed.startsWith('http') ? signed : `${SUPABASE_URL}/storage/v1${signed}`;
}
async function objectInfo(path) {
  const response = await fetch(storageUrl(path), { method: 'HEAD', headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } });
  if (!response.ok) throw new Error(`Arquivo não encontrado no Storage (HTTP ${response.status}).`);
  return { size: Number(response.headers.get('content-length') || 0), mime: clean(response.headers.get('content-type')).toLowerCase() };
}
async function registerMaterial(pedidoId, type, originalName, mime, size, storagePath) {
  const sql = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1, idle_timeout: 10, connect_timeout: 10 });
  try {
    const rows = await sql`select * from doox_core.registrar_material(${pedidoId}::uuid, ${type}, ${originalName}, ${mime}, ${Number(size)}, ${storagePath})`;
    return rows?.[0] || null;
  } finally { await sql.end({ timeout: 5 }).catch(() => {}); }
}
async function signedDownload(path) {
  assertConfig();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST', headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
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
      const path = clean(req.query?.path); if (!path) return json(res, 400, { ok:false, message:'Informe o caminho do arquivo.' });
      return json(res, 200, { ok:true, download_url: await signedDownload(path), expires_in:3600 });
    }
    if (req.method !== 'POST') return json(res, 405, { ok:false, message:'Método não permitido.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const pedidoId = clean(body.pedidoId || body.technicalId || body.pedido_id);
    if (!pedidoId || !/^[0-9a-fA-F-]{36}$/.test(pedidoId)) return json(res,400,{ok:false,message:'Identificador técnico do pedido inválido.'});
    const tokenPedido = verifyTrackingToken(body.trackingToken || body.token);
    if (tokenPedido !== pedidoId) return json(res,403,{ok:false,message:'Token não corresponde ao pedido.'});
    assertConfig();

    if (action === 'prepare_upload') {
      const type = clean(body.materialType || body.tipo || body.type).toUpperCase();
      const fileName = clean(body.fileName || body.originalName || 'arquivo');
      const mimeType = clean(body.mimeType || body.mime || 'application/octet-stream').toLowerCase();
      const size = Number(body.size || 0);
      validateMaterial(type, mimeType, size);
      const id = crypto.randomUUID();
      const ext = extension(fileName, mimeType);
      const finalName = `${id}-${safeName(fileName).replace(/\.[^.]+$/, '')}.${ext}`;
      const storagePath = `pedidos/${pedidoId}/${type}/${finalName}`;
      const signedUrl = await createSignedUpload(storagePath);
      return json(res,200,{ok:true,upload:{pedido_id:pedidoId,tipo:type,nome_original:fileName,mime_type:mimeType,tamanho_bytes:size,storage_path:storagePath,signed_url:signedUrl,expires_in:7200}});
    }

    if (action === 'register') {
      const type = clean(body.materialType || body.tipo || body.type).toUpperCase();
      const fileName = clean(body.fileName || body.originalName || 'arquivo');
      const mimeType = clean(body.mimeType || body.mime || 'application/octet-stream').toLowerCase();
      const declaredSize = Number(body.size || 0);
      const storagePath = clean(body.storagePath || body.path);
      if (!storagePath || !storagePath.startsWith(`pedidos/${pedidoId}/`)) return json(res,400,{ok:false,message:'Caminho de armazenamento inválido.'});
      validateMaterial(type,mimeType,declaredSize);
      const info = await objectInfo(storagePath);
      if (info.size && info.size !== declaredSize) return json(res,400,{ok:false,message:'O tamanho do arquivo armazenado não corresponde ao informado.'});
      const record = await registerMaterial(pedidoId,type,fileName,mimeType,declaredSize,storagePath);
      return json(res,200,{ok:true,material:{id:record?.id||null,pedido_id:pedidoId,tipo:type,nome_original:fileName,mime_type:mimeType,tamanho_bytes:declaredSize,storage_path:storagePath,registrado:true}});
    }

    return json(res,400,{ok:false,message:'Ação de materiais inválida.'});
  } catch (error) { return json(res,500,{ok:false,message:error?.message||String(error)}); }
}
