export default async function handler(req, res) {
  const base = process.env.APPS_SCRIPT_WEBAPP_URL;
  const webKey = process.env.DOOX_WEB_APP_KEY;

  if (!base || !webKey) {
    return res.status(503).json({
      ok: false,
      message: 'Integração DOOX ainda não configurada. Defina APPS_SCRIPT_WEBAPP_URL e DOOX_WEB_APP_KEY no Vercel.'
    });
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  const incomingUrl = new URL(req.url, `https://${req.headers.host || 'doox-omega.vercel.app'}`);
  const action = incomingUrl.searchParams.get('action') || (req.body && req.body.action) || 'health';
  const target = new URL(base);
  target.searchParams.set('action', action);
  target.searchParams.set('key', webKey);

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const clientIp = String(req.headers['x-real-ip'] || forwarded || '').trim();
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

  if (req.method === 'GET') {
    for (const [key, value] of incomingUrl.searchParams.entries()) {
      if (key !== 'action' && key !== 'key') target.searchParams.set(key, value);
    }
    if (action === 'pedido') {
      target.searchParams.set('ip', clientIp);
      target.searchParams.set('ua', userAgent);
    }
  }

  try {
    const options = {
      method: req.method,
      headers: { 'Accept': 'application/json' }
    };

    if (req.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      let body = req.body || {};
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body._apiKey = webKey;
      body._security = {
        ip: clientIp,
        userAgent,
        action,
        origin: String(req.headers.origin || '').slice(0, 300)
      };
      options.body = JSON.stringify(body);
      if (options.body.length > 15000) return res.status(413).json({ ok: false, message: 'Solicitação excede o limite permitido.' });
    }

    const upstream = await fetch(target.toString(), options);
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { ok: false, message: 'Resposta inválida do serviço DOOX.' }; }
    if (!data || typeof data !== 'object') data = { ok: false, message: String(data || 'Resposta inválida do serviço DOOX.') };
    if (data.ok === false) {
      const raw = data.message ?? data.error ?? data.details;
      if (raw && typeof raw === 'object') {
        data.message = typeof raw.message === 'string' ? raw.message : (typeof raw.error === 'string' ? raw.error : JSON.stringify(raw));
      } else if (!data.message && raw != null) {
        data.message = String(raw);
      }
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, message: 'Não foi possível conectar ao serviço DOOX.' });
  }
}
