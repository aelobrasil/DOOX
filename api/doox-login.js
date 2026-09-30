import crypto from 'node:crypto';

const DEFAULT_ADMIN_PASSWORD_HASH = 'scrypt$N=16384,r=8,p=1$6R2yxd0DTs7360wsZYo3xA$gyJHji-UBmYdT4_CkjQB3CwS0zg3O0WSiGDzfiBZM0U';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function passwordHash() {
  return String(process.env.DOOX_ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH);
}

function sessionSecret() {
  return String(process.env.DOOX_ADMIN_SECRET || process.env.DOOX_ADMIN_SESSION_SECRET || passwordHash());
}

function verifyPassword(password) {
  try {
    const parts = passwordHash().split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
    const params = Object.fromEntries(parts[1].split(',').map(item => item.split('=')));
    const N = Number(params.N), r = Number(params.r), p = Number(params.p);
    if (![N, r, p].every(Number.isFinite)) return false;
    const salt = Buffer.from(parts[2], 'base64url');
    const expected = Buffer.from(parts[3], 'base64url');
    const derived = crypto.scryptSync(String(password || ''), salt, expected.length, {
      N, r, p, maxmem: 64 * 1024 * 1024,
    });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function makeSession() {
  const hours = Math.max(1, Number(process.env.DOOX_ADMIN_SESSION_HOURS || 12));
  const expires = Date.now() + hours * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  const signature = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Método não permitido.' });
  const body = bodyOf(req);
  if (!verifyPassword(body.password)) return json(res, 401, { ok: false, message: 'Senha administrativa incorreta.' });

  const hours = Math.max(1, Number(process.env.DOOX_ADMIN_SESSION_HOURS || 12));
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') || process.env.NODE_ENV === 'production';
  const cookie = [
    `doox_admin_session=${encodeURIComponent(makeSession())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${hours * 3600}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
  return json(res, 200, { ok: true, authenticated: true });
}
